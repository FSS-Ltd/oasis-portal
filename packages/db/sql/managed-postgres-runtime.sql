-- Run as postgres, before restore AND again after restore. Restore with --role=oasis_owner.
-- SET oasis_migration.expected_database = 'postgres';
-- Password provisioning is a separate protected operator action. Never put passwords here.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $identity$
BEGIN
  IF current_setting('oasis_migration.expected_database', true) IS DISTINCT FROM current_database()
    OR current_setting('server_version_num')::int / 10000 <> 17 THEN
    RAISE EXCEPTION 'Expected database identity and PostgreSQL 17 are required';
  END IF;
  IF current_database() <> 'postgres' AND NOT (
    current_database() ~ '^oasis_migration_(fixture_[a-z0-9_]+|rehearsal(_[a-z0-9_]+)?)$'
    AND coalesce(inet_server_addr() IN (inet '127.0.0.1', inet '::1'), false)
    AND EXISTS (SELECT FROM pg_roles WHERE rolname = 'oasis_migration_fixture' AND NOT rolcanlogin)
    AND coalesce(shobj_description((SELECT oid FROM pg_database WHERE datname = current_database()), 'pg_database'), '') = 'oasis-migration-fixture-v1'
  ) THEN
    RAISE EXCEPTION 'Installer is restricted to managed postgres or an explicit isolated fixture';
  END IF;
END;
$identity$;

DO $runtime$
DECLARE
  client_role text;
  application_schema text;
  owner_name text := 'oasis_owner';
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Install as reviewed postgres administrator; restore objects as oasis_owner';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'oasis_owner') THEN
    CREATE ROLE oasis_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='oasis_owner'
    AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
    OR EXISTS (SELECT FROM pg_auth_members WHERE member='oasis_owner'::regrole) THEN
    RAISE EXCEPTION 'Application owner must be an isolated restricted NOLOGIN role';
  END IF;
  GRANT oasis_owner TO postgres WITH ADMIN OPTION;
  CREATE SCHEMA IF NOT EXISTS oasis_private AUTHORIZATION oasis_owner;
  GRANT USAGE, CREATE ON SCHEMA public, oasis_private TO oasis_owner;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'oasis_app') THEN
    CREATE ROLE oasis_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oasis_app'
    AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR NOT rolcanlogin))
    OR EXISTS (SELECT FROM pg_auth_members WHERE member = 'oasis_app'::regrole)
    OR current_user = 'oasis_app'
    OR EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','oasis_private') AND c.relowner='oasis_app'::regrole)
    OR EXISTS (SELECT FROM pg_namespace WHERE nspname IN ('public','oasis_private') AND nspowner='oasis_app'::regrole)
    OR EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('public','oasis_private') AND p.proowner='oasis_app'::regrole) THEN
    RAISE EXCEPTION 'Runtime must be separate from owner and have no elevated attributes or memberships';
  END IF;

  FOREACH client_role IN ARRAY ARRAY['PUBLIC', 'anon', 'authenticated', 'oasis_app'] LOOP
    IF client_role <> 'PUBLIC' AND NOT EXISTS (SELECT FROM pg_roles WHERE rolname=client_role) THEN
      RAISE EXCEPTION 'Required role missing: %', client_role;
    END IF;
    -- Schema REVOKE cannot subtract a global default grant. Clear owner defaults
    -- globally for the dedicated app owner only, including built-in PUBLIC EXECUTE.
    -- Never change postgres/managed-service owner defaults.
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES FROM %s', owner_name, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM %s', owner_name, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON FUNCTIONS FROM %s', owner_name, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
    FOREACH application_schema IN ARRAY ARRAY['public', 'oasis_private'] LOOP
      IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname=application_schema) THEN CONTINUE; END IF;
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON TABLES FROM %s', owner_name, application_schema, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %s', owner_name, application_schema, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM %s', owner_name, application_schema, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %s', application_schema, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %s', application_schema, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %s', application_schema, CASE WHEN client_role='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END);
    END LOOP;
  END LOOP;
  REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, oasis_app;
  GRANT USAGE ON SCHEMA public TO oasis_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oasis_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oasis_app;
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE ON public._prisma_migrations FROM oasis_app;
  END IF;
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname='oasis_private') THEN
    REVOKE ALL ON SCHEMA oasis_private FROM PUBLIC, anon, authenticated, oasis_app;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO oasis_app', current_database());
  -- Canonical rls.sql uses only pg_catalog functions. No public function needs
  -- runtime EXECUTE; security-definer trigger functions keep their owner rights.
END;
$runtime$;
COMMIT;
