import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Separate local cluster: bootstrap is fixture_bootstrap; postgres is NOT superuser.
const database = `oasis_migration_fixture_admin_${String(process.pid)}`;
const psql = process.env.PG17_PSQL ?? 'psql';
function query(
  sql: string,
  role: 'postgres' | 'fixture_bootstrap' | 'oasis_app' = 'postgres',
  db = database,
): string {
  return execFileSync(
    psql,
    ['-X', '-h', '127.0.0.1', '-p', '55442', '-U', role, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq'],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}
function install(): void {
  query(
    `SET oasis_migration.expected_database='${database}';${readFileSync(fileURLToPath(new URL('../../sql/managed-postgres-runtime.sql', import.meta.url)), 'utf8')}`,
  );
}

describe.skipIf(process.env.OASIS_MIGRATION_SECURITY_ADMIN_TEST !== '1')(
  'runtime installation as managed-style CREATEROLE administrator',
  () => {
    let created = false;
    beforeAll(() => {
      expect(
        query(
          "SELECT NOT rolsuper AND rolcreaterole FROM pg_roles WHERE rolname='postgres'",
          'fixture_bootstrap',
          'postgres',
        ),
      ).toBe('t');
      expect(
        query(
          "SELECT count(*) FROM pg_roles WHERE rolname IN ('oasis_migration_fixture','oasis_migration_fixture_admin') AND NOT rolcanlogin",
          'fixture_bootstrap',
          'postgres',
        ),
      ).toBe('2');
      expect(
        query(
          "SELECT count(*) FROM pg_roles WHERE rolname IN ('oasis_owner','oasis_app')",
          'fixture_bootstrap',
          'postgres',
        ),
      ).toBe('0');
      query(`CREATE DATABASE "${database}" OWNER postgres`, 'fixture_bootstrap', 'postgres');
      created = true;
      query(`COMMENT ON DATABASE "${database}" IS 'oasis-migration-fixture-v1'`);
    });
    afterAll(() => {
      if (!created) return;
      query(`DROP DATABASE "${database}" WITH (FORCE)`, 'fixture_bootstrap', 'postgres');
      query(
        'DROP ROLE IF EXISTS oasis_app; DROP ROLE IF EXISTS oasis_owner',
        'fixture_bootstrap',
        'postgres',
      );
    });
    it('creates roles, sets the restore owner, preserves admin grants and reruns without superuser', () => {
      const defaults = query(
        "SELECT coalesce(string_agg(defaclobjtype::text || ':' || defaclacl::text,',' ORDER BY defaclnamespace,defaclobjtype),'') FROM pg_default_acl WHERE defaclrole='postgres'::regrole",
      );
      install();
      expect(
        query(
          "SELECT pg_has_role('postgres','oasis_owner','SET') AND pg_has_role('postgres','oasis_owner','USAGE')",
        ),
      ).toBe('t');
      expect(
        query(
          "SELECT bool_or(admin_option) FROM pg_auth_members WHERE roleid='oasis_owner'::regrole AND member='postgres'::regrole",
        ),
      ).toBe('t');
      expect(
        query(
          "SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='oasis_owner'",
        ),
      ).toBe('t');
      expect(
        query(
          "SELECT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='oasis_app'",
        ),
      ).toBe('t');
      query(
        `SET ROLE oasis_owner; CREATE TABLE public."Record" (id serial PRIMARY KEY,owner text); CREATE FUNCTION oasis_private.hidden() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$; ALTER TABLE public."Record" ENABLE ROW LEVEL SECURITY; CREATE POLICY scoped ON public."Record" USING (owner=current_setting('app.user_id',true)); INSERT INTO public."Record" (owner) VALUES ('one'),('two')`,
      );
      expect(
        query(
          `SELECT has_table_privilege('authenticated','public."Record"','SELECT') OR has_function_privilege('authenticated','oasis_private.hidden()','EXECUTE')`,
        ),
      ).toBe('f');
      install();
      expect(
        query(`SET app.user_id='one'; SELECT count(*) FROM public."Record"`, 'oasis_app'),
      ).toBe('1');
      expect(
        query(
          "SELECT coalesce(string_agg(defaclobjtype::text || ':' || defaclacl::text,',' ORDER BY defaclnamespace,defaclobjtype),'') FROM pg_default_acl WHERE defaclrole='postgres'::regrole",
        ),
      ).toBe(defaults);
      expect(query("SELECT count(*) FROM pg_auth_members WHERE member='oasis_app'::regrole")).toBe(
        '0',
      );
    });
  },
);
