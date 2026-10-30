import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../prisma/migrations');
// Migrations run as postgres on managed Postgres. Tables created from here on must hand
// ownership to oasis_owner and grant oasis_app, or the API cannot read them and Supabase's
// anon and authenticated roles can.
const MANAGED_SINCE = '20261029120000';

const migrations = readdirSync(migrationsDir)
  .filter((name) => existsSync(resolve(migrationsDir, name, 'migration.sql')))
  .sort()
  .map((name) => ({
    name,
    sql: readFileSync(resolve(migrationsDir, name, 'migration.sql'), 'utf8'),
  }));
const allSql = migrations.map(({ sql }) => sql).join('\n');

const newTables = migrations
  .filter(({ name }) => name >= MANAGED_SINCE)
  .flatMap(({ sql }) => [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1] ?? ''));

describe('tables created on managed Postgres', () => {
  it('finds the tables to check', () => {
    expect(newTables).toContain('PushDeviceToken');
  });

  it.each(newTables)(
    '%s is owned by oasis_owner, granted to oasis_app, closed to anon',
    (table) => {
      expect(allSql).toContain(`ALTER TABLE "${table}" OWNER TO oasis_owner`);
      expect(allSql).toMatch(new RegExp(`GRANT [A-Z, ]+ ON TABLE "${table}" TO oasis_app`));
      expect(allSql).toMatch(new RegExp(`REVOKE ALL ON TABLE "${table}" FROM`));
    },
  );
});
