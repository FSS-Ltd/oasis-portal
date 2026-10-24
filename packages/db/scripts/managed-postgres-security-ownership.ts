import { createHash } from 'node:crypto';
import { verifyManifest, type MigrationManifest } from './managed-postgres-inventory.js';

export interface OwnershipExecutor {
  $executeRawUnsafe(sql: string): Promise<number>;
}

/** Restore trusted source ownership only after a protected application restore. */
export async function restoreTrustedDefinerOwnership(
  client: OwnershipExecutor,
  manifest: MigrationManifest,
): Promise<number> {
  verifyManifest(manifest);
  if (manifest.target.database !== 'postgres') throw new Error('Expected managed postgres target');
  const approved = manifest.objects
    .filter((object) => {
      if (object.kind !== 'function') return false;
      // pg_get_functiondef puts security attributes before the AS dollar-quoted body.
      const body = object.definition.indexOf('\nAS $');
      return /\bSECURITY DEFINER\b/.test(object.definition.slice(0, body < 0 ? undefined : body));
    })
    .map((object) => {
      const { fingerprint, ...source } = object;
      if (
        object.owner !== 'postgres' ||
        !['public', 'oasis_private'].includes(object.schema) ||
        !object.definition.startsWith('CREATE OR REPLACE FUNCTION ') ||
        createHash('sha256').update(JSON.stringify(source)).digest('hex') !== fingerprint
      ) {
        throw new Error(
          'Only reviewed postgres-owned application SECURITY DEFINER functions may transfer',
        );
      }
      return { signature: object.name, schema: object.schema, definition: object.definition };
    });
  if (new Set(approved.map((item) => item.signature)).size !== approved.length) {
    throw new Error('Duplicate reviewed function signatures');
  }
  const payload = JSON.stringify(approved);
  const hash = createHash('sha256').update(payload).digest('hex');
  const blockDelimiter = `$ownership_${hash}$`;
  const payloadDelimiter = `$manifest_${hash}$`;
  if (payload.includes(blockDelimiter) || payload.includes(payloadDelimiter)) {
    throw new Error('Unsafe ownership manifest delimiter');
  }
  // One DO statement is atomic even without an outer transaction. All definitions
  // and identities are checked before any ownership or EXECUTE privilege changes.
  await client.$executeRawUnsafe(`DO ${blockDelimiter}
DECLARE
  reviewed jsonb := ${payloadDelimiter}${payload}${payloadDelimiter}::jsonb;
  item record; actual record; signature_oid oid;
  approved_oids oid[] := ARRAY[]::oid[];
  saved_search_path text := current_setting('search_path');
BEGIN
  IF current_user <> 'postgres' OR current_setting('server_version_num')::int / 10000 <> 17 OR NOT (
    current_database()='postgres' OR (
      current_database() ~ '^oasis_migration_(fixture_[a-z0-9_]+|rehearsal(_[a-z0-9_]+)?)$'
      AND coalesce(inet_server_addr() IN (inet '127.0.0.1',inet '::1'),false)
      AND EXISTS (SELECT FROM pg_roles WHERE rolname='oasis_migration_fixture' AND NOT rolcanlogin)
      AND coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()),'pg_database'),'')='oasis-migration-fixture-v1'
    )
  ) THEN RAISE EXCEPTION 'Trusted ownership requires reviewed target identity and administrator'; END IF;
  IF EXISTS (SELECT FROM pg_namespace n WHERE n.nspname IN ('public','oasis_private')
    AND (has_schema_privilege('anon',n.oid,'CREATE')
      OR has_schema_privilege('authenticated',n.oid,'CREATE')
      OR has_schema_privilege('oasis_app',n.oid,'CREATE'))) THEN
    RAISE EXCEPTION 'Application schemas must reject client object creation';
  END IF;
  PERFORM set_config('search_path','pg_catalog,public,oasis_private',true);
  FOR item IN SELECT * FROM jsonb_to_recordset(reviewed) AS fn(signature text,schema text,definition text) LOOP
    signature_oid := to_regprocedure(item.signature);
    SELECT n.nspname,p.prosecdef,p.prokind,pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) AS definition
      INTO actual FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=signature_oid;
    IF NOT FOUND OR actual.nspname<>item.schema OR NOT actual.prosecdef OR actual.prokind<>'f'
      OR actual.owner NOT IN ('postgres','oasis_owner') OR actual.definition IS DISTINCT FROM item.definition THEN
      RAISE EXCEPTION 'Restored trusted function does not match reviewed source';
    END IF;
    approved_oids := array_append(approved_oids,signature_oid);
  END LOOP;
  IF EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','oasis_private') AND p.prosecdef AND NOT (p.oid=ANY(approved_oids))) THEN
    RAISE EXCEPTION 'Unreviewed application SECURITY DEFINER function';
  END IF;
  FOREACH signature_oid IN ARRAY approved_oids LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',signature_oid::regprocedure);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,oasis_app',signature_oid::regprocedure);
  END LOOP;
  PERFORM set_config('search_path',saved_search_path,true);
END;
${blockDelimiter};`);
  return approved.length;
}
