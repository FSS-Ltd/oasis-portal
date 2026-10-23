-- SOURCE ONLY. Before any accepted target write, after confirming source routing.
-- After target writes: forward repair or separately approved reconciled reverse copy.
-- The operator must enforce this boundary; SQL cannot infer accepted target writes.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $scope$
DECLARE reviewed text[]; actual text[];
BEGIN
  IF current_setting('oasis_migration.expected_database', true) IS DISTINCT FROM current_database()
    OR (current_database() <> 'oasis_prod' AND NOT (
      current_database() ~ '^oasis_migration_(fixture_[a-z0-9_]+|rehearsal(_[a-z0-9_]+)?)$'
      AND coalesce(inet_server_addr() IN (inet '127.0.0.1', inet '::1'), false)
      AND EXISTS (SELECT FROM pg_roles WHERE rolname='oasis_migration_fixture' AND NOT rolcanlogin)
      AND coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname=current_database()), 'pg_database'), '')='oasis-migration-fixture-v1'
    )) THEN RAISE EXCEPTION 'Source identity is required'; END IF;
  SELECT array_agg(name ORDER BY name) INTO reviewed
    FROM jsonb_array_elements_text(current_setting('oasis_migration.reviewed_tables')::jsonb) name;
  SELECT array_agg(c.relname::text ORDER BY c.relname::text) INTO actual
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p');
  IF reviewed IS NULL OR reviewed IS DISTINCT FROM actual THEN
    RAISE EXCEPTION 'Reviewed table scope does not match complete source catalog';
  END IF;
  -- ACCESS EXCLUSIVE waits for pre-existing writers and readers. A timeout rolls
  -- back the whole freeze; never terminate unknown transactions automatically.
  EXECUTE (SELECT 'LOCK TABLE ' || string_agg(format('public.%I', name), ', ' ORDER BY name) || ' IN ACCESS EXCLUSIVE MODE'
    FROM unnest(reviewed) name);
END;
$scope$;

DO $unfreeze$
DECLARE name text;
BEGIN
  FOR name IN SELECT jsonb_array_elements_text(current_setting('oasis_migration.reviewed_tables')::jsonb) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS oasis_migration_write_freeze ON public.%I', name);
  END LOOP;
END;
$unfreeze$;
DROP FUNCTION IF EXISTS oasis_private.oasis_migration_reject_write();
COMMIT;
