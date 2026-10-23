-- Apply after restore and the final runtime privilege pass. Supported policies only.
-- The restored final oasis_private.receive_allowed(jsonb) remains authoritative.
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

DO $requirements$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Install as reviewed postgres administrator'; END IF;
  IF to_regclass('realtime.messages') IS NULL
    OR to_regprocedure('realtime.topic()') IS NULL
    OR to_regprocedure('auth.jwt()') IS NULL
    OR to_regprocedure('oasis_private.receive_allowed(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Managed transport and restored private JWT helper are required';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_class WHERE oid='realtime.messages'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Managed transport RLS must already be enabled';
  END IF;
END;
$requirements$;

CREATE OR REPLACE FUNCTION oasis_private.legacy_community_receive_allowed(claims jsonb, channel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, oasis_private
AS $function$
  SELECT oasis_private.receive_allowed(claims) AND EXISTS (
    SELECT 1 FROM public."CommunityGroupMember" member
    JOIN public."Student" student ON student.id = member."studentId"
    JOIN public."User" account ON account.id = student."userId"
    WHERE channel = 'oasis:community:' || member."groupId"
      AND member.active AND student.active AND account.active
      AND account."deletedAt" IS NULL AND account."clerkId" = claims->>'sub'
  );
$function$;
REVOKE ALL ON FUNCTION oasis_private.legacy_community_receive_allowed(jsonb,text) FROM PUBLIC, anon, oasis_app;
GRANT USAGE ON SCHEMA oasis_private TO authenticated;
GRANT EXECUTE ON FUNCTION oasis_private.receive_allowed(jsonb), oasis_private.legacy_community_receive_allowed(jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION oasis_private.receive_allowed(jsonb) FROM PUBLIC, anon, oasis_app;

DROP POLICY IF EXISTS oasis_user_realtime_receive ON realtime.messages;
CREATE POLICY oasis_user_realtime_receive ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND realtime.topic() = 'oasis:user:' || (auth.jwt()->>'sub')
    AND oasis_private.receive_allowed(auth.jwt()));
DROP POLICY IF EXISTS oasis_community_realtime_receive ON realtime.messages;
CREATE POLICY oasis_community_realtime_receive ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND oasis_private.legacy_community_receive_allowed(auth.jwt(), realtime.topic()));
-- Replace the historical user-only restrictions with one boundary for both topic families.
DROP POLICY IF EXISTS oasis_user_realtime_isolation ON realtime.messages;
CREATE POLICY oasis_user_realtime_isolation ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((realtime.topic() NOT LIKE 'oasis:user:%' AND realtime.topic() NOT LIKE 'oasis:community:%') OR (
    extension = 'broadcast' AND (
      (realtime.topic() = 'oasis:user:' || (auth.jwt()->>'sub') AND oasis_private.receive_allowed(auth.jwt()))
      OR oasis_private.legacy_community_receive_allowed(auth.jwt(), realtime.topic())
    )
  ));
DROP POLICY IF EXISTS oasis_user_realtime_no_publish ON realtime.messages;
CREATE POLICY oasis_user_realtime_no_publish ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (realtime.topic() NOT LIKE 'oasis:user:%' AND realtime.topic() NOT LIKE 'oasis:community:%');
COMMIT;
