import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  captureApplicationBaseline,
  compareApplicationBaseline,
  compareRehearsalBaseline,
  type ValidationClient,
} from '../../scripts/managed-postgres-validation.js';
import type {
  MigrationManifest,
  InventoryClient,
  CatalogObject,
  MigrationSequence,
  MigrationTable,
} from '../../scripts/managed-postgres-inventory.js';
const payload = {
  version: 1 as const,
  projectReference: 'project',
  source: { database: 'oasis_prod', serverVersion: '170006' },
  target: { database: 'postgres', serverVersion: '170006' },
  sourceGitCommit: 'a'.repeat(40),
  tables: [
    {
      schema: 'public',
      name: 'Secret"Table',
      columns: [
        { name: 'id', dataType: 'text', ordinal: 1 },
        { name: 'ciphertext', dataType: 'bytea', ordinal: 2 },
      ],
      primaryKey: ['id'],
    },
  ],
  sequences: [{ schema: 'public', name: 'seq' }],
  objects: [],
  extensions: [],
  migrations: [],
};
const manifest: MigrationManifest = {
  ...payload,
  artifactHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
};
function database(
  database: string,
  values: string[],
  sequence = '42',
  invalid = false,
  isCalled = true,
  serverAddress = '127.0.0.1',
  objects: readonly CatalogObject[] = [],
  sequences: readonly MigrationSequence[] = payload.sequences,
  tables: readonly MigrationTable[] = payload.tables,
  statements: string[] = [],
): ValidationClient {
  return {
    $transaction: async (callback) => {
      let fetched = false;
      const tx: InventoryClient = {
        $queryRawUnsafe: async <T>(sql: string) => {
          await Promise.resolve();
          statements.push(sql);
          if (sql.includes('current_database()') && !sql.includes('WITH app_relations'))
            return [{ database, serverAddress }] as T;
          if (sql.includes('WITH app_relations'))
            return [
              {
                snapshot: {
                  database,
                  serverVersion: '170006',
                  tables,
                  sequences,
                  objects,
                  extensions: [],
                  migrations: [],
                  crossSchemaDependencies: [],
                  largeObjectCount: 0,
                },
              },
            ] as T;
          if (sql.includes('FETCH')) {
            const rows = fetched ? [] : values.map((canonical) => ({ canonical }));
            fetched = true;
            return rows as T;
          }
          if (sql.includes('last_value')) return [{ lastValue: sequence, isCalled }] as T;
          if (sql.includes('invalid_count')) return [{ invalid_count: invalid ? 1 : 0 }] as T;
          return [] as T;
        },
      };
      return callback(tx);
    },
  };
}
describe('complete content validation', () => {
  it('requests an unmasked server host for the loopback identity boundary', async () => {
    const statements: string[] = [];
    await captureApplicationBaseline(
      database(
        'oasis_prod',
        [],
        '42',
        false,
        true,
        '127.0.0.1',
        [],
        payload.sequences,
        payload.tables,
        statements,
      ),
      manifest,
    );
    expect(statements.find((statement) => statement.includes('AS "serverAddress"'))).toContain(
      'host(inet_server_addr())',
    );
  });
  it('accepts restored contiguous column positions while preserving semantic column order', async () => {
    const tables = payload.tables.map((table) => ({
      ...table,
      columns: table.columns.map((column, index) => ({ ...column, ordinal: index === 0 ? 1 : 3 })),
    }));
    const gappedPayload = { ...payload, tables };
    const gappedManifest: MigrationManifest = {
      ...gappedPayload,
      artifactHash: createHash('sha256').update(JSON.stringify(gappedPayload)).digest('hex'),
    };
    const baseline = await captureApplicationBaseline(
      database('oasis_prod', [], '42', false, true, '127.0.0.1', [], payload.sequences, tables),
      gappedManifest,
    );
    const report = await compareApplicationBaseline(
      database('postgres', []),
      gappedManifest,
      baseline,
    );
    expect(report.schemaMatches).toBe(true);
    expect(report.valid).toBe(true);
    const reordered = payload.tables.map((table) => ({
      ...table,
      columns: [...table.columns].reverse(),
    }));
    const reorderedReport = await compareApplicationBaseline(
      database('postgres', [], '42', false, true, '127.0.0.1', [], payload.sequences, reordered),
      gappedManifest,
      baseline,
    );
    expect(reorderedReport.schemaMatches).toBe(false);
    expect(reorderedReport.valid).toBe(false);
  });
  it('rejects disabled capture triggers despite identical table content', async () => {
    const trigger = {
      kind: 'trigger',
      schema: 'public',
      name: 'Secret"Table:capture',
      definition: JSON.stringify({ definition: 'CREATE TRIGGER capture', enabled: 'O' }),
      owner: '',
      acl: [],
    };
    const changed = {
      ...trigger,
      definition: JSON.stringify({ definition: 'CREATE TRIGGER capture', enabled: 'D' }),
    };
    const triggerPayload = {
      ...payload,
      objects: [
        {
          ...trigger,
          fingerprint: createHash('sha256').update(JSON.stringify(trigger)).digest('hex'),
        },
      ],
    };
    const triggerManifest: MigrationManifest = {
      ...triggerPayload,
      artifactHash: createHash('sha256').update(JSON.stringify(triggerPayload)).digest('hex'),
    };
    const baseline = await captureApplicationBaseline(
      database('oasis_prod', [], '42', false, true, '127.0.0.1', [trigger]),
      triggerManifest,
    );
    const report = await compareApplicationBaseline(
      database('postgres', [], '42', false, true, '127.0.0.1', [changed]),
      triggerManifest,
      baseline,
    );
    expect(report.schemaMatches).toBe(false);
    expect(report.valid).toBe(false);
    expect(report.tables[0]?.contentMatch).toBe(true);
  });
  it('does not exclude a disabled source maintenance guard', async () => {
    const frozenPayload = {
      ...payload,
      excludedMaintenanceObjects: [
        {
          kind: 'trigger' as const,
          schema: 'public',
          name: 'Secret"Table:oasis_migration_write_freeze',
          securitySourceHash: 'f'.repeat(64),
        },
      ],
    };
    const frozenManifest: MigrationManifest = {
      ...frozenPayload,
      artifactHash: createHash('sha256').update(JSON.stringify(frozenPayload)).digest('hex'),
    };
    const guard = {
      kind: 'trigger',
      schema: 'public',
      name: 'Secret"Table:oasis_migration_write_freeze',
      definition: JSON.stringify({
        definition: 'CREATE TRIGGER oasis_migration_write_freeze',
        enabled: 'D',
      }),
      owner: '',
      acl: [],
    };
    await expect(
      captureApplicationBaseline(
        database('oasis_prod', [], '42', false, true, '127.0.0.1', [guard]),
        frozenManifest,
      ),
    ).rejects.toThrow();
  });
  it('detects equal-count ciphertext substitution without exposing contents', async () => {
    const baseline = await captureApplicationBaseline(
      database('oasis_prod', ['["id","cipher-A"]']),
      manifest,
    );
    const report = await compareApplicationBaseline(
      database('postgres', ['["id","cipher-B"]']),
      manifest,
      baseline,
    );
    expect(report.valid).toBe(false);
    expect(report.tables[0]?.countMatch).toBe(true);
    expect(report.tables[0]?.contentMatch).toBe(false);
    expect(JSON.stringify(report)).not.toContain('cipher-');
    expect(JSON.stringify(baseline)).not.toContain('cipher-');
  });

  it('rejects sequence configuration drift despite identical last_value and is_called', async () => {
    const configuration = {
      dataType: 'bigint',
      start: '1',
      increment: '1',
      min: '1',
      max: '999',
      cache: '1',
      cycle: false,
    };
    const sequences = [{ schema: 'public', name: 'seq', configuration }];
    const sequencePayload = { ...payload, sequences };
    const sequenceManifest: MigrationManifest = {
      ...sequencePayload,
      artifactHash: createHash('sha256').update(JSON.stringify(sequencePayload)).digest('hex'),
    };
    const baseline = await captureApplicationBaseline(
      database('oasis_prod', [], '42', false, true, '127.0.0.1', [], sequences),
      sequenceManifest,
    );
    const changed = [
      { schema: 'public', name: 'seq', configuration: { ...configuration, increment: '2' } },
    ];
    const report = await compareApplicationBaseline(
      database('postgres', [], '42', false, true, '127.0.0.1', [], changed),
      sequenceManifest,
      baseline,
    );
    expect(report.sequences[0]?.matches).toBe(true);
    expect(report.schemaMatches).toBe(false);
    expect(report.valid).toBe(false);
  });
  it('compares sequence state even beyond existing table IDs', async () => {
    const baseline = await captureApplicationBaseline(
      database('oasis_prod', ['["1"]'], '9000'),
      manifest,
    );
    const report = await compareApplicationBaseline(
      database('postgres', ['["1"]'], '9001'),
      manifest,
      baseline,
    );
    expect(report.valid).toBe(false);
    expect(report.sequences[0]?.matches).toBe(false);
  });

  it('detects changed sequence is_called even when last_value matches', async () => {
    const baseline = await captureApplicationBaseline(
      database('oasis_prod', [], '42', false, true),
      manifest,
    );
    const report = await compareApplicationBaseline(
      database('postgres', [], '42', false, false),
      manifest,
      baseline,
    );
    expect(report.sequences[0]?.matches).toBe(false);
  });
  it('accepts an exact copy and rejects invalid restored constraints', async () => {
    const baseline = await captureApplicationBaseline(database('oasis_prod', ['["1"]']), manifest);
    expect(
      (await compareApplicationBaseline(database('postgres', ['["1"]']), manifest, baseline)).valid,
    ).toBe(true);
    expect(
      (
        await compareApplicationBaseline(
          database('postgres', ['["1"]'], '42', true),
          manifest,
          baseline,
        )
      ).valid,
    ).toBe(false);
  });

  it('limits rehearsal comparisons to explicitly named loopback databases', async () => {
    const baseline = await captureApplicationBaseline(database('oasis_prod', []), manifest);
    expect(
      (
        await compareRehearsalBaseline(
          database('oasis_migration_rehearsal', []),
          manifest,
          baseline,
          'oasis_migration_rehearsal',
        )
      ).valid,
    ).toBe(true);
    await expect(
      compareRehearsalBaseline(database('postgres', []), manifest, baseline, 'postgres'),
    ).rejects.toThrow();
    await expect(
      compareRehearsalBaseline(
        database('oasis_migration_rehearsal', [], '42', false, true, '203.0.113.1'),
        manifest,
        baseline,
        'oasis_migration_rehearsal',
      ),
    ).rejects.toThrow();
  });
  it('rejects malformed exported snapshot identifiers', async () => {
    await expect(
      captureApplicationBaseline(database('oasis_prod', []), manifest, {
        snapshot: "x'; DROP TABLE x; --",
      }),
    ).rejects.toThrow();
  });
  it('rejects wrong database and edited manifests before reading content', async () => {
    await expect(captureApplicationBaseline(database('postgres', []), manifest)).rejects.toThrow();
    await expect(
      captureApplicationBaseline(database('oasis_prod', []), {
        ...manifest,
        sourceGitCommit: 'changed',
      }),
    ).rejects.toThrow();
  });
});
