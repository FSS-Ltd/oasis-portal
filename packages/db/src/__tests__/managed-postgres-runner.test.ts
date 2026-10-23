import { describe, expect, it } from 'vitest';
import {
  assertMigrationFixture,
  migrationTestEnvironment,
  runManagedMigrationIntegration,
} from '../../scripts/test-managed-postgres-migration.js';

const fixture = {
  database: 'postgres',
  address: '127.0.0.1',
  port: 55441,
  serverVersion: 170007,
  marker: true,
};
describe('dedicated migration fixture runner', () => {
  it('requires explicit write opt-in before any subprocess runs', async () => {
    await expect(runManagedMigrationIntegration({ PATH: '/nonexistent' })).rejects.toThrow(
      'OASIS_MIGRATION_SECURITY_TEST=1',
    );
    await expect(
      runManagedMigrationIntegration({
        OASIS_MIGRATION_SECURITY_TEST: 'true',
        PATH: '/nonexistent',
      }),
    ).rejects.toThrow('OASIS_MIGRATION_SECURITY_TEST=1');
  });
  it('strips inherited credentials and forces the dedicated loopback endpoint', () => {
    const environment = migrationTestEnvironment({
      PATH: '/tools',
      DATABASE_URL: 'private-source',
      DIRECT_URL: 'private-source',
      PREVIEW_DIRECT_URL: 'private-source',
      PGHOSTADDR: '198.51.100.1',
      PGPASSWORD: 'private-password',
      PGSERVICE: 'production',
      PG17_PSQL: '/unreviewed/tool',
    });
    expect(environment.PATH).toBe('/tools');
    expect(environment.PGHOST).toBe('127.0.0.1');
    expect(environment.PGPORT).toBe('55441');
    expect(environment.PGUSER).toBe('postgres');
    expect(environment.PGDATABASE).toBe('postgres');
    for (const name of [
      'DATABASE_URL',
      'DIRECT_URL',
      'PREVIEW_DIRECT_URL',
      'PGHOSTADDR',
      'PGPASSWORD',
      'PGSERVICE',
      'PG17_PSQL',
    ])
      expect(environment[name]).toBeUndefined();
  });
  it('accepts only the marked fixed loopback PostgreSQL 17 cluster', () => {
    expect(() => {
      assertMigrationFixture(JSON.stringify(fixture));
    }).not.toThrow();
    for (const changed of [
      { marker: false },
      { serverVersion: 160007 },
      { serverVersion: 180000 },
      { port: 5432 },
      { address: '198.51.100.1' },
      { database: 'oasis_prod' },
    ]) {
      expect(() => {
        assertMigrationFixture(JSON.stringify({ ...fixture, ...changed }));
      }).toThrow('fixture');
    }
    expect(() => {
      assertMigrationFixture('invalid');
    }).toThrow('fixture');
  });
});
