import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { restoreTrustedDefinerOwnership } from '../../scripts/managed-postgres-security-ownership.js';
import type { CatalogObject, MigrationManifest } from '../../scripts/managed-postgres-inventory.js';

const database = `oasis_migration_fixture_ownership_${String(process.pid)}`;
const psql = process.env.PG17_PSQL ?? 'psql';
function query(sql: string, db = database): string {
  return execFileSync(
    psql,
    [
      '-X',
      '-h',
      '127.0.0.1',
      '-p',
      '55441',
      '-U',
      'postgres',
      '-d',
      db,
      '-Atq',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}
const executor = {
  $executeRawUnsafe(sql: string): Promise<number> {
    query(sql);
    return Promise.resolve(0);
  },
};
function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function manifest(objects: CatalogObject[]): MigrationManifest {
  const payload = {
    version: 1 as const,
    projectReference: 'local',
    source: { database: 'oasis_prod', serverVersion: '170006' },
    target: { database: 'postgres', serverVersion: '170006' },
    sourceGitCommit: 'a'.repeat(40),
    tables: [],
    sequences: [],
    extensions: [],
    migrations: [],
    objects: objects.map((object) => ({ ...object, fingerprint: hash(object) })),
  };
  return { ...payload, artifactHash: hash(payload) };
}
function functions(): CatalogObject[] {
  const result: unknown = JSON.parse(
    query(
      `SELECT coalesce(json_agg(result),'[]') FROM (SELECT 'function' AS kind,n.nspname AS schema,p.oid::regprocedure::text AS name,pg_get_functiondef(p.oid) AS definition,pg_get_userbyid(p.proowner) AS owner,ARRAY[]::text[] AS acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','oasis_private') ORDER BY p.oid) result`,
    ),
  );
  // The real PostgreSQL catalog projection has the exact CatalogObject shape.
  return result as CatalogObject[];
}

describe.skipIf(process.env.OASIS_MIGRATION_SECURITY_TEST !== '1')(
  'manifest-bound trusted definer ownership on PostgreSQL 17',
  () => {
    let created = false;
    let reviewed: MigrationManifest;
    beforeAll(() => {
      if (
        query(
          "SELECT EXISTS(SELECT FROM pg_roles WHERE rolname='oasis_migration_fixture' AND NOT rolcanlogin)",
          'postgres',
        ) !== 't'
      )
        throw new Error('Dedicated fixture marker required');
      query(`CREATE DATABASE "${database}"`, 'postgres');
      created = true;
      query(`COMMENT ON DATABASE "${database}" IS 'oasis-migration-fixture-v1'`);
      query(
        `SET oasis_migration.expected_database='${database}';${readFileSync(fileURLToPath(new URL('../../sql/managed-postgres-runtime.sql', import.meta.url)), 'utf8')}`,
      );
      const migration = readFileSync(
        fileURLToPath(
          new URL(
            '../../prisma/migrations/20261023150200_realtime_change_capture/migration.sql',
            import.meta.url,
          ),
        ),
        'utf8',
      );
      const captures = migration.match(
        /CREATE FUNCTION oasis_private\.capture_change[\s\S]*?\$\$;/,
      )?.[0];
      const flush = migration.match(
        /CREATE FUNCTION oasis_private\.flush_changes[\s\S]*?\$\$;/,
      )?.[0];
      if (!captures || !flush) throw new Error('Actual event migration definitions required');
      query(`CREATE TABLE public."User" (id text PRIMARY KEY,"clerkId" text,active boolean,"deletedAt" timestamptz);
      INSERT INTO public."User" VALUES ('one','clerk-one',true,NULL);
      CREATE TABLE public."Record" (id text PRIMARY KEY,"ownerId" text);
      CREATE TABLE oasis_private.model_coverage(model text PRIMARY KEY,areas text[],audience text);
      INSERT INTO oasis_private.model_coverage VALUES ('Record',ARRAY['profile'],'own');
      CREATE TABLE oasis_private.pending_change(transaction_id bigint,clerk_id text,area text,PRIMARY KEY(transaction_id,clerk_id,area));
      ALTER TABLE oasis_private.pending_change ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION oasis_private.recipients(model text,audience text,row_data jsonb) RETURNS TABLE(clerk_id text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,oasis_private AS $$ SELECT "clerkId" FROM public."User" WHERE id=row_data->>'ownerId' $$;
      CREATE FUNCTION oasis_private.row_visible(model text,row_data jsonb,target_user text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT true $$;
      ${captures}
      ${flush}
      CREATE CONSTRAINT TRIGGER oasis_flush_changes AFTER INSERT ON oasis_private.pending_change DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION oasis_private.flush_changes();
      CREATE TRIGGER capture AFTER INSERT ON public."Record" FOR EACH ROW EXECUTE FUNCTION oasis_private.capture_change();
      CREATE SCHEMA realtime; CREATE TABLE realtime.sent(topic text);
      CREATE FUNCTION realtime.send(payload jsonb,event text,topic text,private boolean) RETURNS void LANGUAGE sql AS $$ INSERT INTO realtime.sent VALUES (topic) $$;
      REVOKE ALL ON FUNCTION realtime.send(jsonb,text,text,boolean) FROM PUBLIC,anon,authenticated,oasis_app,oasis_owner;
      GRANT USAGE ON SCHEMA realtime TO oasis_owner;
      ALTER TABLE public."User" OWNER TO oasis_owner;
      ALTER TABLE public."Record" OWNER TO oasis_owner;
      ALTER TABLE oasis_private.model_coverage OWNER TO oasis_owner;
      ALTER TABLE oasis_private.pending_change OWNER TO oasis_owner;`);
      reviewed = manifest(functions());
      for (const fn of reviewed.objects) query(`ALTER FUNCTION ${fn.name} OWNER TO oasis_owner`);
      query(
        `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA oasis_private TO PUBLIC,authenticated; GRANT SELECT,INSERT ON public."Record" TO oasis_app`,
      );
    });
    afterAll(() => {
      if (created) query(`DROP DATABASE "${database}" WITH (FORCE)`, 'postgres');
    });
    it('rejects an altered current definition without transferring any owner', async () => {
      query(
        `CREATE OR REPLACE FUNCTION oasis_private.row_visible(model text,row_data jsonb,target_user text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT false $$`,
      );
      await expect(restoreTrustedDefinerOwnership(executor, reviewed)).rejects.toThrow();
      expect(
        query(
          `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='oasis_private' AND p.proowner='postgres'::regrole`,
        ),
      ).toBe('0');
      const original = reviewed.objects.find((fn) =>
        fn.name.startsWith('oasis_private.row_visible('),
      );
      if (!original) throw new Error('Reviewed function missing');
      query(original.definition);
    });
    it('rejects incomplete reviewed function sets and missing rehearsal markers', async () => {
      const partialPayload = {
        ...reviewed,
        objects: reviewed.objects.filter(
          (fn) => !fn.name.startsWith('oasis_private.flush_changes('),
        ),
      };
      const { artifactHash: previousHash, ...payload } = partialPayload;
      expect(previousHash).toBe(reviewed.artifactHash);
      await expect(
        restoreTrustedDefinerOwnership(executor, { ...payload, artifactHash: hash(payload) }),
      ).rejects.toThrow();
      query(`COMMENT ON DATABASE "${database}" IS NULL`);
      await expect(restoreTrustedDefinerOwnership(executor, reviewed)).rejects.toThrow();
      query(`COMMENT ON DATABASE "${database}" IS 'oasis-migration-fixture-v1'`);
      expect(
        query(
          `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='oasis_private' AND p.proowner='postgres'::regrole`,
        ),
      ).toBe('0');
    });
    it('requires the ownership step for actual capture/flush commits and revokes private execution', async () => {
      expect(() =>
        query(`SET ROLE oasis_app; INSERT INTO public."Record" VALUES ('before','one')`),
      ).toThrow();
      expect(query(`SELECT count(*) FROM public."Record"`)).toBe('0');
      expect(await restoreTrustedDefinerOwnership(executor, reviewed)).toBe(4);
      expect(
        query(
          `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='oasis_private' AND p.proowner='postgres'::regrole`,
        ),
      ).toBe('4');
      expect(
        query(
          `SELECT has_function_privilege('authenticated','oasis_private.capture_change()','EXECUTE') OR has_function_privilege('oasis_app','oasis_private.flush_changes()','EXECUTE')`,
        ),
      ).toBe('f');
      query(`SET ROLE oasis_app; INSERT INTO public."Record" VALUES ('after','one')`);
      expect(query('SELECT count(*) FROM realtime.sent')).toBe('1');
      expect(query('SELECT count(*) FROM oasis_private.pending_change')).toBe('0');
      query(
        `SET ROLE oasis_app; BEGIN; INSERT INTO public."Record" VALUES ('rollback','one'); ROLLBACK`,
      );
      expect(query('SELECT count(*) FROM realtime.sent')).toBe('1');
      expect(await restoreTrustedDefinerOwnership(executor, reviewed)).toBe(4);
    });
  },
);
