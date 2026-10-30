-- 20261029120000_push_device_tokens ran as postgres, so the new table and enum were owned by
-- postgres. That skipped the oasis_owner default privileges: oasis_app got no access (every
-- register call failed) and Supabase's defaults gave anon and authenticated full access.
-- Match every other application table: owned by oasis_owner, used only by oasis_app.
-- Roles only exist on managed Postgres; plain CI and local databases skip what is missing.
DO $$
DECLARE client_role text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oasis_owner') THEN
    ALTER TABLE "PushDeviceToken" OWNER TO oasis_owner;
    ALTER TYPE "PushPlatform" OWNER TO oasis_owner;
  END IF;
  REVOKE ALL ON TABLE "PushDeviceToken" FROM PUBLIC;
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "PushDeviceToken" FROM %I', client_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oasis_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PushDeviceToken" TO oasis_app;
  END IF;
END;
$$;
