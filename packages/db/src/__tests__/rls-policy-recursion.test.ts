import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSqlStatements } from '../../scripts/apply-rls.js';

/**
 * Postgres expands row level security policies while it rewrites a query. If a relation reappears while
 * it is already being expanded it stops with `42P17 infinite recursion detected in policy`, whatever the
 * data or the signed-in user. This test finds those cycles statically so they never reach a database.
 *
 * Rules, matching Postgres (rewriteHandler.c, fireRIRrules):
 * - Running a command on table A applies A's policies for that command (UPDATE and DELETE also apply
 *   its SELECT policies). Only policies that contain a sub-query are expanded further.
 * - A table read inside a policy is a sub-query read, so only that table's SELECT (or ALL) policies apply.
 * - It is an error when a relation whose applicable policies contain a sub-query is reached again while
 *   it is already being expanded.
 * - A function call (for example a SECURITY DEFINER helper) is opaque, so it never creates an edge.
 */
type Command = 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

interface Policy {
  name: string;
  table: string;
  command: Command;
  references: string[];
  hasSubquery: boolean;
}

interface Parsed {
  policies: Policy[];
  rlsTables: Set<string>;
}

const COMMANDS: readonly Command[] = ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function parsePolicies(sql: string): Parsed {
  const rlsTables = new Set<string>();
  const policies = new Map<string, Policy>();
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    const rls = /^ALTER TABLE\s+"?(\w+)"?\s+(?:ENABLE|FORCE)\s+ROW LEVEL SECURITY/i.exec(statement);
    if (rls?.[1]) rlsTables.add(rls[1]);
  }

  for (const statement of statements) {
    const drop = /^DROP POLICY(?:\s+IF EXISTS)?\s+(\w+)\s+ON\s+"?(\w+)"?/i.exec(statement);
    if (drop?.[1] && drop[2]) {
      policies.delete(`${drop[2]}.${drop[1]}`);
      continue;
    }

    const create = /^CREATE POLICY\s+(\w+)\s+ON\s+"?(\w+)"?/i.exec(statement);
    if (!create?.[1] || !create[2]) continue;

    const body = statement.slice(create[0].length);
    const header = body.split(/\b(?:USING|WITH\s+CHECK)\b/i)[0] ?? '';
    const forMatch = /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i.exec(header);
    const command = COMMANDS.find((value) => value === forMatch?.[1]?.toUpperCase()) ?? 'ALL';
    const references = new Set<string>();
    for (const match of body.matchAll(/\b(?:FROM|JOIN)\s+(?:public\.)?"?([A-Za-z_]\w*)"?/gi)) {
      if (match[1] && rlsTables.has(match[1])) references.add(match[1]);
    }

    policies.set(`${create[2]}.${create[1]}`, {
      name: create[1],
      table: create[2],
      command,
      references: [...references],
      hasSubquery: /\(\s*SELECT\b/i.test(body),
    });
  }

  return { policies: [...policies.values()], rlsTables };
}

function findRecursion({ policies }: Parsed): string[] {
  const byTable = new Map<string, Policy[]>();
  for (const policy of policies) {
    byTable.set(policy.table, [...(byTable.get(policy.table) ?? []), policy]);
  }

  const applicable = (table: string, commands: readonly Command[]): Policy[] =>
    (byTable.get(table) ?? []).filter(
      (policy) =>
        policy.hasSubquery && (policy.command === 'ALL' || commands.includes(policy.command)),
    );

  const found = new Set<string>();

  // `table` is read inside the policy of the last step in `path`.
  function visit(table: string, path: Array<{ table: string; policy: string }>): void {
    const expanding = applicable(table, ['SELECT']);
    if (expanding.length === 0) return;

    const seen = path.findIndex((step) => step.table === table);
    if (seen !== -1) {
      const loop = path.slice(seen);
      found.add(
        `${[...loop.map((step) => step.table), table].join(' -> ')} (via ${loop
          .map((step) => step.policy)
          .join(', ')})`,
      );
      return;
    }

    for (const policy of expanding) {
      for (const reference of policy.references) {
        visit(reference, [...path, { table, policy: policy.name }]);
      }
    }
  }

  const commandPolicies: ReadonlyArray<readonly Command[]> = [
    ['SELECT'],
    ['INSERT'],
    ['UPDATE', 'SELECT'],
    ['DELETE', 'SELECT'],
  ];
  for (const table of byTable.keys()) {
    for (const commands of commandPolicies) {
      for (const policy of applicable(table, commands)) {
        for (const reference of policy.references) {
          visit(reference, [{ table, policy: policy.name }]);
        }
      }
    }
  }

  return [...found].sort();
}

function recursionIn(sql: string): string[] {
  return findRecursion(parsePolicies(sql));
}

describe('findRecursion', () => {
  const enable = (table: string) => `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`;

  it('flags two tables whose policies read each other', () => {
    const sql = `
      ${enable('A')} ${enable('B')}
      CREATE POLICY a_select ON "A" FOR SELECT USING (EXISTS (SELECT 1 FROM "B" b WHERE b."aId" = "A"."id"));
      CREATE POLICY b_select ON "B" FOR SELECT USING (EXISTS (SELECT 1 FROM "A" a WHERE a."id" = "B"."aId"));
    `;
    expect(recursionIn(sql)).not.toEqual([]);
  });

  it('flags a cycle that only closes through an UPDATE policy on the starting table', () => {
    const sql = `
      ${enable('Slip')} ${enable('Recipient')}
      CREATE POLICY slip_select ON "Slip" FOR SELECT USING (EXISTS (SELECT 1 FROM "Recipient" r WHERE r."slipId" = "Slip"."id"));
      CREATE POLICY recipient_select ON "Recipient" FOR SELECT USING (EXISTS (SELECT 1 FROM "Guardian" g WHERE g."id" = "Recipient"."guardianId"));
      CREATE POLICY recipient_update ON "Recipient" FOR UPDATE USING (EXISTS (SELECT 1 FROM "Slip" s WHERE s."id" = "Recipient"."slipId"));
    `;
    expect(recursionIn(sql)).toEqual([
      'Recipient -> Slip -> Recipient (via recipient_update, slip_select)',
    ]);
  });

  it('flags a policy that reads its own table', () => {
    const sql = `
      ${enable('Node')}
      CREATE POLICY node_select ON "Node" FOR SELECT USING (EXISTS (SELECT 1 FROM "Node" n WHERE n."id" = "Node"."parentId"));
    `;
    expect(recursionIn(sql)).toEqual(['Node -> Node (via node_select)']);
  });

  it('does not follow a read into policies that only apply to other commands', () => {
    const sql = `
      ${enable('A')} ${enable('B')}
      CREATE POLICY a_select ON "A" FOR SELECT USING (EXISTS (SELECT 1 FROM "B" b WHERE b."aId" = "A"."id"));
      CREATE POLICY b_insert ON "B" FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM "A" a WHERE a."id" = "B"."aId"));
    `;
    expect(recursionIn(sql)).toEqual([]);
  });

  it('allows reaching the same table again when its applicable policies have no sub-query', () => {
    const sql = `
      ${enable('Slip')} ${enable('Recipient')}
      CREATE POLICY slip_select ON "Slip" FOR SELECT USING (public.guardian_of_slip("Slip"."id"));
      CREATE POLICY recipient_select ON "Recipient" FOR SELECT USING (EXISTS (SELECT 1 FROM "Slip" s WHERE s."id" = "Recipient"."slipId"));
      CREATE POLICY recipient_update ON "Recipient" FOR UPDATE USING (EXISTS (SELECT 1 FROM "Slip" s WHERE s."id" = "Recipient"."slipId"));
    `;
    expect(recursionIn(sql)).toEqual([]);
  });

  it('treats a helper function call as opaque', () => {
    const sql = `
      ${enable('A')} ${enable('B')}
      CREATE POLICY a_select ON "A" FOR SELECT USING (public.b_visible("A"."id"));
      CREATE POLICY b_select ON "B" FOR SELECT USING (EXISTS (SELECT 1 FROM "A" a WHERE a."id" = "B"."aId"));
    `;
    expect(recursionIn(sql)).toEqual([]);
  });

  it('ignores tables without row level security and respects later DROP and CREATE', () => {
    const sql = `
      ${enable('A')}
      CREATE POLICY a_select ON "A" FOR SELECT USING (EXISTS (SELECT 1 FROM "Plain" p WHERE p."id" = "A"."id"));
      CREATE POLICY a_loop ON "A" FOR SELECT USING (EXISTS (SELECT 1 FROM "A" x WHERE x."id" = "A"."id"));
      DROP POLICY IF EXISTS a_loop ON "A";
    `;
    expect(recursionIn(sql)).toEqual([]);
  });
});

describe('prisma/rls.sql', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const parsed = parsePolicies(readFileSync(resolve(testDir, '../../prisma/rls.sql'), 'utf8'));

  it('is parsed in full, so an empty result below cannot be a parsing failure', () => {
    expect(parsed.rlsTables.size).toBeGreaterThan(30);
    expect(parsed.policies.length).toBeGreaterThan(100);
    expect(parsed.policies.some((policy) => policy.table === 'PermissionSlip')).toBe(true);
  });

  // A second cycle of the same kind exists in the homework policies. It is outside the permission slip
  // fix and the homework screens are hidden, so it is recorded here rather than changed. When it is
  // fixed, delete these entries and this list becomes empty.
  const KNOWN_HOMEWORK_CYCLES = [
    'HomeworkAssignment -> HomeworkAssignmentBand -> HomeworkAssignment (via homework_assignment_student_select, homework_assignment_band_student_select)',
    'HomeworkAssignmentBand -> HomeworkAssignment -> HomeworkAssignmentBand (via homework_assignment_band_student_select, homework_assignment_student_select)',
  ];

  it('has no policy that can recurse, apart from the known homework pair', () => {
    expect(findRecursion(parsed)).toEqual(KNOWN_HOMEWORK_CYCLES);
  });

  it('keeps the permission slip policies out of any cycle', () => {
    expect(findRecursion(parsed).filter((cycle) => cycle.includes('PermissionSlip'))).toEqual([]);
  });
});

describe('permission slip recursion fix', () => {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const read = (path: string) => readFileSync(resolve(testDir, path), 'utf8');
  const migration = read(
    '../../prisma/migrations/20261028090000_permission_slip_policy_recursion/migration.sql',
  );
  const policyNamed = (sql: string, name: string) =>
    splitSqlStatements(sql).find((statement) => statement.startsWith(`CREATE POLICY ${name} `));

  it('keeps the migration and rls.sql policy text identical', () => {
    const fromMigration = policyNamed(migration, 'permission_slip_parent_select');
    const fromRls = policyNamed(read('../../prisma/rls.sql'), 'permission_slip_parent_select');
    expect(fromMigration).toBeDefined();
    expect(fromMigration).toBe(fromRls);
  });

  it('asks the helper instead of reading the recipient table', () => {
    const policy = policyNamed(migration, 'permission_slip_parent_select') ?? '';
    expect(policy).toContain(
      'public.oasis_guardian_can_see_permission_slip("PermissionSlip"."id")',
    );
    expect(policy).not.toContain('PermissionSlipRecipient');
  });

  it('defines the helper as a fixed-search_path definer that answers only for the caller session', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public');
    expect(migration).toContain('SET row_security = off');
    expect(migration).toContain('g."userId" = current_setting(\'app.user_id\', true)');
    // One argument only: it cannot be asked about another user.
    expect(migration).toContain('oasis_guardian_can_see_permission_slip(slip_id TEXT)');
  });

  it('is exercised by the database smoke script', () => {
    const smoke = read('../../scripts/smoke-rls.ts');
    expect(smoke).toContain('assertNoPolicyRecursion(prisma, runtimePrisma)');
    expect(smoke).toContain('assertPermissionSlipAccess(prisma, runtimePrisma)');
    expect(smoke).toContain('parent signing another child slip');
  });
});
