import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildMigrationManifest,
  verifyManifest,
  quoteIdentifier,
  parseProjectIdentity,
  type CatalogSnapshot,
  type InventoryOptions,
} from '../../scripts/managed-postgres-inventory.js';

const options: InventoryOptions = {
  projectReference: 'project',
  sourceUrl: 'postgresql://postgres@db.project.supabase.co/oasis_prod',
  targetUrl: 'postgresql://postgres@db.project.supabase.co/postgres',
  expectedSourceDatabase: 'oasis_prod',
  expectedTargetDatabase: 'postgres',
  sourceGitCommit: 'a'.repeat(40),
};
const source: CatalogSnapshot = {
  database: 'oasis_prod',
  serverVersion: '170006',
  tables: ['TimetableAgeGroupMembership', '_prisma_migrations'].map((name) => ({
    schema: 'public',
    name,
    columns: [{ name: 'id', dataType: 'text', ordinal: 1 }],
    primaryKey: ['id'],
  })),
  sequences: [],
  objects: [],
  extensions: [],
  migrations: [],
  crossSchemaDependencies: [],
  largeObjectCount: 0,
};
function client(snapshot: CatalogSnapshot) {
  return {
    $queryRawUnsafe: <T>(sql: string): Promise<T> =>
      Promise.resolve(
        (sql.includes('WITH app_relations') ? [{ snapshot }] : snapshot.migrations) as T,
      ),
  };
}
const target = { ...source, database: 'postgres', tables: [] };
describe('migration inventory safety', () => {
  it('derives Supabase project identity from direct and pooled connection URLs', () => {
    expect(
      parseProjectIdentity('postgresql://postgres:unused@db.project.supabase.co/oasis_prod'),
    ).toBe('project');
    expect(
      parseProjectIdentity(
        'postgresql://postgres.project:unused@aws-0.eu.pooler.supabase.com:6543/postgres',
      ),
    ).toBe('project');
    expect(() =>
      parseProjectIdentity('postgresql://postgres.project@attacker.example/postgres'),
    ).toThrow();
    expect(() => parseProjectIdentity('postgresql://postgres@localhost/postgres')).toThrow();
  });

  it('quotes hostile identifiers without SQL injection', () => {
    expect(quoteIdentifier('a"; DROP TABLE x; --')).toBe('"a""; DROP TABLE x; --"');
  });

  it('rejects a rehashed manifest that points source and target at the same database', async () => {
    const manifest = await buildMigrationManifest(client(source), client(target), options);
    const { artifactHash: originalHash, ...payload } = { ...manifest, target: manifest.source };
    expect(createHash('sha256').update(JSON.stringify(payload)).digest('hex')).not.toBe(
      originalHash,
    );
    expect(() => {
      verifyManifest({
        ...payload,
        artifactHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      });
    }).toThrow();
  });
  it('pins only exact reviewed source maintenance objects', async () => {
    const manifest = await buildMigrationManifest(client(source), client(target), {
      ...options,
      maintenanceGuardSourceHash: 'f'.repeat(64),
    });
    expect(manifest.excludedMaintenanceObjects).toHaveLength(3);
    const { artifactHash: originalHash, ...payload } = {
      ...manifest,
      excludedMaintenanceObjects: [
        {
          kind: 'function' as const,
          schema: 'oasis_private',
          name: 'oasis_private.unrelated()',
          securitySourceHash: 'f'.repeat(64),
        },
      ],
    };
    expect(createHash('sha256').update(JSON.stringify(payload)).digest('hex')).not.toBe(
      originalHash,
    );
    expect(() => {
      verifyManifest({
        ...payload,
        artifactHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      });
    }).toThrow();
  });

  it('preserves compound object identities longer than PostgreSQL name fields', async () => {
    const name = 'LongApplicationTableIdentifier:LongApplicationPrimaryKeyConstraintIdentifier';
    const object = {
      kind: 'constraint',
      schema: 'public',
      name,
      definition: 'PRIMARY KEY (id);validated=true',
      owner: '',
      acl: [],
    };
    const manifest = await buildMigrationManifest(
      client({ ...source, objects: [object] }),
      client(target),
      options,
    );
    expect(manifest.objects[0]?.name).toBe(name);
    expect(JSON.parse(JSON.stringify(manifest))).toMatchObject({ objects: [{ name }] });
  });
  it('records metadata and preserves legacy and migration tables', async () => {
    const manifest = await buildMigrationManifest(client(source), client(target), options);
    expect(manifest.tables.map((t) => t.name)).toEqual([
      'TimetableAgeGroupMembership',
      '_prisma_migrations',
    ]);
    expect(manifest.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(manifest)).not.toContain('postgresql://');
  });
  it.each([
    ['same database', { ...source, database: 'postgres' }, target, options],
    [
      'wrong project',
      source,
      target,
      { ...options, targetUrl: 'postgresql://postgres@db.other.supabase.co/postgres' },
    ],
    [
      'unexpected target objects',
      source,
      {
        ...target,
        objects: [
          {
            kind: 'view',
            schema: 'public',
            name: 'unexpected',
            definition: '',
            owner: '',
            acl: [],
          },
        ],
      },
      options,
    ],
    ['missing legacy table', { ...source, tables: source.tables.slice(1) }, target, options],
    [
      'unclassified dependency',
      { ...source, crossSchemaDependencies: ['storage.objects'] },
      target,
      options,
    ],
    [
      'pending migration',
      {
        ...source,
        migrations: [{ name: 'pending', checksum: 'checksum', finished: false, rolledBack: false }],
      },
      target,
      options,
    ],
    ['large objects', { ...source, largeObjectCount: 1 }, target, options],
    [
      'missing unique ordering',
      { ...source, tables: source.tables.map((t) => ({ ...t, primaryKey: [] })) },
      target,
      options,
    ],
  ])('rejects %s', async (_name, from, to, settings) => {
    await expect(buildMigrationManifest(client(from), client(to), settings)).rejects.toThrow();
  });
});
