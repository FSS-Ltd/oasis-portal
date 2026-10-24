-- Application-owned metadata only. Supabase's realtime schema is managed upstream.
CREATE SCHEMA IF NOT EXISTS oasis_private;
REVOKE ALL ON SCHEMA oasis_private FROM PUBLIC;

CREATE TABLE oasis_private.realtime_configuration (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enforce_2fa boolean,
  configured_at timestamptz
);
ALTER TABLE oasis_private.realtime_configuration ENABLE ROW LEVEL SECURITY;
INSERT INTO oasis_private.realtime_configuration (singleton) VALUES (true);
REVOKE ALL ON ALL TABLES IN SCHEMA oasis_private FROM PUBLIC;

CREATE FUNCTION oasis_private.receive_allowed(claims jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, oasis_private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    CROSS JOIN oasis_private.realtime_configuration c
    WHERE u."clerkId" = claims->>'sub' AND u.active AND u."deletedAt" IS NULL
      AND c.enforce_2fa IS NOT NULL
      AND (NOT c.enforce_2fa OR (
        jsonb_typeof(claims->'fva') = 'array'
        AND jsonb_typeof(claims->'fva'->0) = 'number'
        AND jsonb_typeof(claims->'fva'->1) = 'number'
        AND CASE WHEN jsonb_typeof(claims->'fva'->0) = 'number' THEN (claims->'fva'->>0)::numeric BETWEEN 0 AND 1.7976931348623157e308::numeric ELSE false END
        AND CASE WHEN jsonb_typeof(claims->'fva'->1) = 'number' THEN (claims->'fva'->>1)::numeric BETWEEN 0 AND 1.7976931348623157e308::numeric ELSE false END
      ))
  );
$$;
REVOKE ALL ON FUNCTION oasis_private.receive_allowed(jsonb) FROM PUBLIC;

DO $$
DECLARE helper record; client_role text;
BEGIN
  -- Existing triggers retain their helper access. JWT roles cannot spoof events.
  FOR helper IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'oasis_realtime_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', helper.signature);
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', helper.signature, client_role);
      END IF;
    END LOOP;
  END LOOP;
  IF to_regclass('realtime.messages') IS NULL THEN RETURN; END IF;
  GRANT USAGE ON SCHEMA oasis_private TO authenticated;
  GRANT EXECUTE ON FUNCTION oasis_private.receive_allowed(jsonb) TO authenticated;
  DROP POLICY IF EXISTS oasis_user_realtime_receive ON realtime.messages;
  CREATE POLICY oasis_user_realtime_receive ON realtime.messages FOR SELECT TO authenticated
    USING (extension = 'broadcast'
      AND realtime.topic() = 'oasis:user:' || (auth.jwt()->>'sub')
      AND oasis_private.receive_allowed(auth.jwt()));
  -- Restrictive policies remain effective if another feature adds permissive
  -- Realtime policies later. Service-role database triggers retain publication.
  DROP POLICY IF EXISTS oasis_user_realtime_isolation ON realtime.messages;
  CREATE POLICY oasis_user_realtime_isolation ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
    USING (realtime.topic() NOT LIKE 'oasis:user:%' OR (
      realtime.topic() = 'oasis:user:' || (auth.jwt()->>'sub')
      AND oasis_private.receive_allowed(auth.jwt())));
  DROP POLICY IF EXISTS oasis_user_realtime_no_publish ON realtime.messages;
  CREATE POLICY oasis_user_realtime_no_publish ON realtime.messages AS RESTRICTIVE FOR INSERT TO authenticated
    WITH CHECK (realtime.topic() NOT LIKE 'oasis:user:%');
END;
$$;
