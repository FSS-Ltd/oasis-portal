import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSqlStatements } from '../../scripts/apply-rls.js';

describe('splitSqlStatements', () => {
  it('keeps the Compliance Admin migration and canonical policies in sync', () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const migration = readFileSync(
      resolve(testDir, '../../prisma/migrations/20261015100000_compliance_admin_tag/migration.sql'),
      'utf8',
    );
    const canonical = readFileSync(resolve(testDir, '../../prisma/rls.sql'), 'utf8');
    const statements = splitSqlStatements(migration);
    expect(canonical.endsWith(migration)).toBe(true);
    expect(statements.filter((statement) => statement.startsWith('CREATE POLICY'))).toHaveLength(
      35,
    );
    expect(statements.filter((statement) => statement.startsWith('DROP POLICY'))).toHaveLength(35);
  });
  it('ignores semicolons inside SQL comments', () => {
    const statements = splitSqlStatements(`
      -- Header comment with a semicolon; this must not split.
      ALTER TABLE "BehaviourEntry" ENABLE ROW LEVEL SECURITY;

      /*
       * Block comment with another semicolon; also ignored.
       */
      DROP POLICY IF EXISTS behaviour_full_admin_select ON "BehaviourEntry";

      CREATE POLICY behaviour_full_admin_select ON "BehaviourEntry"
        FOR SELECT
        USING (current_setting('app.full_admin', true) = 'true');
    `);

    expect(statements).toEqual([
      'ALTER TABLE "BehaviourEntry" ENABLE ROW LEVEL SECURITY',
      'DROP POLICY IF EXISTS behaviour_full_admin_select ON "BehaviourEntry"',
      `CREATE POLICY behaviour_full_admin_select ON "BehaviourEntry"
        FOR SELECT
        USING (current_setting('app.full_admin', true) = 'true')`,
    ]);
  });

  it('preserves semicolons inside quoted SQL strings', () => {
    const statements = splitSqlStatements(`
      SELECT 'value; still one statement';
      SELECT "column;name" FROM "Example";
    `);

    expect(statements).toEqual([
      "SELECT 'value; still one statement'",
      'SELECT "column;name" FROM "Example"',
    ]);
  });
});
