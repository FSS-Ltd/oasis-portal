import { describe, expect, it } from 'vitest';
import { splitSqlStatements } from '../../scripts/apply-rls.js';

describe('splitSqlStatements', () => {
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
