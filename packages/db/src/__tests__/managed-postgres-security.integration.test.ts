import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyMaintenanceFreeze } from '../../scripts/managed-postgres-maintenance-checks.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Explicit opt-in. All connections are pinned to a dedicated loopback fixture cluster.
const enabled = process.env.OASIS_MIGRATION_SECURITY_TEST === '1';
const database = `oasis_migration_fixture_security_${String(process.pid)}`;
const psql = process.env.PG17_PSQL ?? 'psql';
const args = (db: string): string[] => [
  '-X',
  '-h',
  '127.0.0.1',
  '-p',
  '55441',
  '-U',
  'postgres',
  '-d',
  db,
  '-v',
  'ON_ERROR_STOP=1',
  '-Atq',
];
function query(statement: string, db = database): string {
  return execFileSync(psql, args(db), {
    input: statement,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
const catalogClient = {
  $queryRawUnsafe<T>(statement: string): Promise<T> {
    const result: unknown = JSON.parse(
      query(`SELECT coalesce(json_agg(result), '[]'::json) FROM (${statement}) result`),
    );
    // psql serializes the exact catalog query result; preserve the generic Prisma test seam.
    return Promise.resolve(result as T);
  },
};
// Reviewed PG17 pg_get_functiondef hash from the checked maintenance SQL fixture.
const reviewedGuardDefinitionHash =
  'e9583fe7bcf21bc64277ebc27fd035fdd5f5a0753c812822700d0a140f96f35b';
function install(name: string, db = database): void {
  query(
    `SET oasis_migration.expected_database = '${db}';\n${readFileSync(fileURLToPath(new URL(`../../sql/managed-postgres-${name}.sql`, import.meta.url)), 'utf8')}`,
    db,
  );
}
const tables = [
  'User',
  'Student',
  'CommunityGroupMember',
  'TimetableAgeGroupMembership',
  '_prisma_migrations',
  'Record',
];
function scope(db = database): string {
  return `SET oasis_migration.expected_database = '${db}'; SET oasis_migration.reviewed_tables = '${JSON.stringify(tables)}';`;
}
function maintenance(name: string, db = database): void {
  query(
    scope(db) +
      readFileSync(
        fileURLToPath(new URL(`../../sql/managed-postgres-${name}.sql`, import.meta.url)),
        'utf8',
      ),
    db,
  );
}
function denied(statement: string, code: string): void {
  try {
    query(`\\set VERBOSITY verbose\n${statement}`);
    throw new Error('Write unexpectedly succeeded');
  } catch (error) {
    expect(String(error)).toContain(code);
  }
}

describe.skipIf(!enabled)('managed Postgres SQL on isolated PostgreSQL 17', () => {
  let postgresDefaults = '';
  let restoreExposedClients = '';
  let createdFixture = false;
  beforeAll(() => {
    if (
      query(
        "SELECT EXISTS (SELECT FROM pg_roles WHERE rolname='oasis_migration_fixture' AND NOT rolcanlogin)",
        'postgres',
      ) !== 't'
    ) {
      throw new Error(
        'Dedicated local cluster must have an operator-created oasis_migration_fixture NOLOGIN marker',
      );
    }
    query(
      `DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$; CREATE DATABASE "${database}";`,
      'postgres',
    );
    createdFixture = true;
    query(`COMMENT ON DATABASE "${database}" IS 'oasis-migration-fixture-v1';`);
    postgresDefaults = query(
      "SELECT coalesce(string_agg(defaclobjtype::text || ':' || defaclacl::text, ',' ORDER BY defaclnamespace, defaclobjtype), '') FROM pg_default_acl WHERE defaclrole='postgres'::regrole",
    );
    install('runtime');
    query(`SET ROLE oasis_owner; CREATE TABLE public."User" (id text PRIMARY KEY, "clerkId" text, active boolean, "deletedAt" timestamptz);
      CREATE TABLE public."Student" (id text PRIMARY KEY, "userId" text, active boolean);
      CREATE TABLE public."CommunityGroupMember" ("groupId" text, "studentId" text, active boolean);
      CREATE TABLE public."TimetableAgeGroupMembership" (id text);
      CREATE TABLE public._prisma_migrations (id text);
      CREATE TABLE public."Record" (id serial PRIMARY KEY, "userId" text);
      ALTER TABLE public."Record" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY scoped ON public."Record" USING ("userId" = current_setting('app.user_id', true));
      INSERT INTO public."User" VALUES ('one', 'clerk-one', true, NULL), ('two', 'clerk-two', true, NULL);
      INSERT INTO public."Student" VALUES ('student', 'one', true);
      INSERT INTO public."CommunityGroupMember" VALUES ('group', 'student', true);
      INSERT INTO public."Record" ("userId") VALUES ('one'), ('two');
      INSERT INTO public._prisma_migrations VALUES ('historically-applied-policy-migration');
      CREATE TABLE oasis_private.realtime_configuration (enforce_2fa boolean);
      INSERT INTO oasis_private.realtime_configuration VALUES (false);
      ${readFileSync(fileURLToPath(new URL('../../prisma/migrations/20261023150000_realtime_private_delivery/migration.sql', import.meta.url)), 'utf8').match(/CREATE FUNCTION oasis_private\.receive_allowed[\s\S]*?\$\$;/)?.[0] ?? 'MISSING_RESTORED_JWT_HELPER'}
      CREATE FUNCTION public.oasis_realtime_legacy() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      RESET ROLE; CREATE SCHEMA auth; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb $$;
      CREATE SCHEMA realtime; CREATE TABLE realtime.messages (extension text);
      CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('realtime.topic',true) $$;
      ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,realtime TO authenticated; GRANT EXECUTE ON FUNCTION auth.jwt(),realtime.topic() TO authenticated;
      GRANT SELECT,INSERT ON realtime.messages TO authenticated;
      INSERT INTO realtime.messages VALUES ('broadcast');
      ALTER FUNCTION oasis_private.receive_allowed(jsonb) OWNER TO postgres;
      ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public."User" FORCE ROW LEVEL SECURITY;`);
    restoreExposedClients = query(
      `SELECT has_table_privilege('authenticated','public."User"','SELECT') OR has_table_privilege('anon','public."Record"','SELECT') OR has_function_privilege('authenticated','public.oasis_realtime_legacy()','EXECUTE')`,
    );
    install('runtime');
  });
  afterAll(() => {
    if (createdFixture) query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`, 'postgres');
  });

  it('accepts only explicitly marked loopback rehearsal databases', () => {
    const rehearsal = `oasis_migration_rehearsal_security_${String(process.pid)}`;
    query(`CREATE DATABASE "${rehearsal}" WITH TEMPLATE "${database}"`, 'postgres');
    try {
      expect(() => {
        install('runtime', rehearsal);
      }).toThrow();
      query(`COMMENT ON DATABASE "${rehearsal}" IS 'oasis-migration-fixture-v1'`, rehearsal);
      install('runtime', rehearsal);
      install('realtime', rehearsal);
      maintenance('maintenance', rehearsal);
      expect(() => query('TRUNCATE public."Record"', rehearsal)).toThrow();
      maintenance('unfreeze', rehearsal);
    } finally {
      query(`DROP DATABASE "${rehearsal}" WITH (FORCE)`, 'postgres');
    }
  });
  it('does not alter managed postgres default ACLs', () => {
    expect(
      query(
        "SELECT coalesce(string_agg(defaclobjtype::text || ':' || defaclacl::text, ',' ORDER BY defaclnamespace, defaclobjtype), '') FROM pg_default_acl WHERE defaclrole='postgres'::regrole",
      ),
    ).toBe(postgresDefaults);
  });
  it('restricts runtime and default client access before and after restore', () => {
    expect(restoreExposedClients).toBe('f');
    expect(
      query(
        "SELECT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper FROM pg_roles WHERE rolname='oasis_app'",
      ),
    ).toBe('t');
    expect(
      query(
        `SELECT has_table_privilege('authenticated','public."User"','SELECT') OR has_table_privilege('anon','public."Record"','SELECT')`,
      ),
    ).toBe('f');
    expect(
      query(
        `SELECT has_function_privilege('authenticated','public.oasis_realtime_legacy()','EXECUTE')`,
      ),
    ).toBe('f');
    expect(
      query(`SET ROLE oasis_app; SET app.user_id='one'; SELECT count(*) FROM public."Record"`),
    ).toBe('1');
    denied(`SET ROLE oasis_app; SELECT * FROM oasis_private.realtime_configuration`, '42501');
    denied(`SET ROLE oasis_app; INSERT INTO public._prisma_migrations VALUES ('bad')`, '42501');
  });
  it('refuses target installers in unmarked non-postgres databases', () => {
    query(`COMMENT ON DATABASE "${database}" IS NULL`);
    expect(() => {
      install('runtime');
    }).toThrow();
    query(`COMMENT ON DATABASE "${database}" IS 'oasis-migration-fixture-v1'`);
  });
  it('installs actual receive policies despite historical ledger and avoids direct client table grants', () => {
    expect(query("SELECT count(*) FROM pg_policies WHERE schemaname='realtime'")).toBe('0');
    expect(query('SELECT count(*) FROM public._prisma_migrations')).toBe('1');
    install('realtime');
    expect(
      query(
        "SELECT count(*) FROM pg_policies WHERE schemaname='realtime' AND policyname LIKE 'oasis_%'",
      ),
    ).toBe('4');
    const receive = (topic: string, sub: string): string =>
      query(
        `SET ROLE authenticated; SET request.jwt.claims='{"sub":"${sub}"}'; SET realtime.topic='${topic}'; SELECT count(*) FROM realtime.messages`,
      );
    expect(receive('oasis:user:clerk-one', 'clerk-one')).toBe('1');
    expect(receive('oasis:user:clerk-two', 'clerk-one')).toBe('0');
    expect(receive('oasis:community:group', 'clerk-one')).toBe('1');
    expect(receive('oasis:community:group', 'clerk-two')).toBe('0');
    query(
      `CREATE POLICY overly_broad ON realtime.messages FOR SELECT TO authenticated USING (true); CREATE POLICY publish_broad ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true)`,
    );
    expect(receive('oasis:community:group', 'clerk-two')).toBe('0');
    denied(
      `SET ROLE authenticated; SET request.jwt.claims='{"sub":"clerk-one"}'; SET realtime.topic='oasis:user:clerk-one'; INSERT INTO realtime.messages VALUES ('broadcast')`,
      '42501',
    );
    denied(
      `SET ROLE authenticated; SET realtime.topic='oasis:community:group'; INSERT INTO realtime.messages VALUES ('broadcast')`,
      '42501',
    );
    denied(`SET ROLE authenticated; SELECT * FROM public."User"`, '42501');
    query(`UPDATE oasis_private.realtime_configuration SET enforce_2fa=true`);
    expect(receive('oasis:user:clerk-one', 'clerk-one')).toBe('0');
    expect(
      query(
        `SET ROLE authenticated; SET request.jwt.claims='{"sub":"clerk-one","fva":[0,0]}'; SET realtime.topic='oasis:community:group'; SELECT count(*) FROM realtime.messages`,
      ),
    ).toBe('1');
    query(`UPDATE oasis_private.realtime_configuration SET enforce_2fa=false`);
    query(`UPDATE public."CommunityGroupMember" SET active=false`);
    expect(receive('oasis:community:group', 'clerk-one')).toBe('0');
    query(`UPDATE public."CommunityGroupMember" SET active=true`);
    query(`UPDATE public."User" SET active=false WHERE id='one'`);
    expect(receive('oasis:user:clerk-one', 'clerk-one')).toBe('0');
    expect(receive('oasis:community:group', 'clerk-one')).toBe('0');
  });
  it('freezes all reviewed tables even for owner, replica sessions, no-op writes and truncate', async () => {
    maintenance('maintenance');
    const receipt = await verifyMaintenanceFreeze(
      catalogClient,
      database,
      tables,
      reviewedGuardDefinitionHash,
    );
    expect(receipt.tableCount).toBe(tables.length);
    for (const statement of [
      `INSERT INTO public."Record" ("userId") VALUES ('one')`,
      `UPDATE public."Record" SET "userId"='one' WHERE false`,
      `DELETE FROM public."Record" WHERE false`,
      `TRUNCATE public."TimetableAgeGroupMembership"`,
      `INSERT INTO public._prisma_migrations VALUES ('bad')`,
      `SET session_replication_role=replica; DELETE FROM public."Record"`,
    ])
      denied(statement, '25006');
    expect(query(`SELECT count(*) FROM public."Record"`)).toBe('2');
    maintenance('unfreeze');
    query(`BEGIN; INSERT INTO public."Record" ("userId") VALUES ('one'); ROLLBACK;`);
    expect(query(`SELECT count(*) FROM public."Record"`)).toBe('2');
  });
  it('rejects a substituted guard body and conditional freeze triggers', async () => {
    maintenance('maintenance');
    const expectedHash = reviewedGuardDefinitionHash;
    query(
      `CREATE OR REPLACE FUNCTION oasis_private.oasis_migration_reject_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;`,
    );
    await expect(
      verifyMaintenanceFreeze(catalogClient, database, tables, expectedHash),
    ).rejects.toThrow();
    maintenance('maintenance');
    query(`DROP TRIGGER oasis_migration_write_freeze ON public."Record";
      CREATE TRIGGER oasis_migration_write_freeze BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public."Record" FOR EACH STATEMENT WHEN (false) EXECUTE FUNCTION oasis_private.oasis_migration_reject_write();
      ALTER TABLE public."Record" ENABLE ALWAYS TRIGGER oasis_migration_write_freeze;`);
    await expect(
      verifyMaintenanceFreeze(catalogClient, database, tables, expectedHash),
    ).rejects.toThrow();
    maintenance('maintenance');
    expect(
      (await verifyMaintenanceFreeze(catalogClient, database, tables, expectedHash)).tableCount,
    ).toBe(tables.length);
    maintenance('unfreeze');
  });
  it('fails closed on incomplete reviewed scope', () => {
    const sql = readFileSync(
      fileURLToPath(new URL('../../sql/managed-postgres-maintenance.sql', import.meta.url)),
      'utf8',
    );
    expect(() =>
      query(
        `SET oasis_migration.expected_database='${database}'; SET oasis_migration.reviewed_tables='["User"]';${sql}`,
      ),
    ).toThrow();
    expect(
      query("SELECT count(*) FROM pg_trigger WHERE tgname='oasis_migration_write_freeze'"),
    ).toBe('0');
  });
  it('waits for an inflight writer and rejects writes from a transaction opened before freeze', async () => {
    const holder = spawn(psql, args(database), { stdio: ['pipe', 'pipe', 'pipe'] });
    holder.stdin.write(`BEGIN; LOCK TABLE public."Record" IN ROW EXCLUSIVE MODE; SELECT 'held';\n`);
    await new Promise<void>((resolve) =>
      holder.stdout.once('data', () => {
        resolve();
      }),
    );
    const oldTransaction = spawn(psql, args(database), { stdio: ['pipe', 'pipe', 'pipe'] });
    oldTransaction.stdin.write("BEGIN; SELECT 'old transaction ready';\n");
    await new Promise<void>((resolve) =>
      oldTransaction.stdout.once('data', () => {
        resolve();
      }),
    );
    let completed = false;
    const freeze = spawn(psql, args(database), { stdio: ['pipe', 'pipe', 'pipe'] });
    freeze.stdin.end(
      scope() +
        readFileSync(
          fileURLToPath(new URL('../../sql/managed-postgres-maintenance.sql', import.meta.url)),
          'utf8',
        ),
    );
    const frozen = new Promise<number | null>((resolve) =>
      freeze.once('exit', (code) => {
        completed = true;
        resolve(code);
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(completed).toBe(false);
    holder.stdin.end('ROLLBACK;\n');
    expect(await frozen).toBe(0);
    let oldTransactionError = '';
    oldTransaction.stderr.on('data', (chunk: Buffer) => {
      oldTransactionError += chunk.toString();
    });
    const oldTransactionExited = new Promise<number | null>((resolve) =>
      oldTransaction.once('exit', resolve),
    );
    oldTransaction.stdin.end(
      '\\set VERBOSITY verbose\nUPDATE public."Record" SET "userId"=\'one\'; COMMIT;\n',
    );
    expect(await oldTransactionExited).not.toBe(0);
    expect(oldTransactionError).toContain('25006');
    maintenance('unfreeze');
  });
});
