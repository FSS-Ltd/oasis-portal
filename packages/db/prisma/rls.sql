-- Row-Level Security policies.
-- Applied manually via `prisma migrate dev --create-only` + edit; documented here
-- as the source of truth. See docs/ADRs/003-sensitive-visibility-enforcement.md.
--
-- The app connects to Postgres as a non-superuser role `oasis_app` which has RLS
-- enforced (not BYPASSRLS). Session variables set per-request by the tRPC layer:
--   SET app.user_id = '<cuid>';
--   SET app.user_role = 'Head' | 'Principal' | ...;
--   SET app.full_admin = 'true' | 'false';

ALTER TABLE "BehaviourEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BehaviourEntry" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS behaviour_full_admin_select ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_supervisor_general ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_parent_own_child ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_guardian_own_child ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_student_self ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_write ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_full_admin_update ON "BehaviourEntry";

-- Full admins see everything.
CREATE POLICY behaviour_full_admin_select ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    AND "deletedAt" IS NULL
  );

-- Supervisors/ClubsAdmin see General entries and Sensitive demerits or General marks they recorded.
CREATE POLICY behaviour_supervisor_general ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN ('Supervisor', 'ClubsAdmin')
    AND "deletedAt" IS NULL
    AND (
      "visibility" = 'General'
      OR (
        "visibility" = 'Sensitive'
        AND "type" IN ('Demerit', 'General')
        AND "recordedById" = current_setting('app.user_id', true)
      )
    )
  );

-- Guardian-linked users see General entries only for their own children.
CREATE POLICY behaviour_guardian_own_child ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor',
      'Parent'
    )
    AND "deletedAt" IS NULL
    AND "visibility" = 'General'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "BehaviourEntry"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

-- Students see General entries only about themselves.
CREATE POLICY behaviour_student_self ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND "deletedAt" IS NULL
    AND "visibility" = 'General'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "BehaviourEntry"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

-- Writes require full-admin OR Supervisor/ClubsAdmin. Sensitive operational writes are
-- limited to authors recording their own Sensitive demerit or General mark.
CREATE POLICY behaviour_write ON "BehaviourEntry"
  FOR INSERT
  WITH CHECK (
    (
      "visibility" = 'General'
      AND (
        current_setting('app.full_admin', true) = 'true'
        OR current_setting('app.user_role', true) IN ('Supervisor', 'ClubsAdmin')
      )
    )
    OR current_setting('app.full_admin', true) = 'true'
    OR (
      current_setting('app.user_role', true) IN ('Supervisor', 'ClubsAdmin')
      AND "visibility" = 'Sensitive'
      AND "type" IN ('Demerit', 'General')
      AND "recordedById" = current_setting('app.user_id', true)
    )
  );

-- Corrections and soft deletes are Head/full-admin only.
CREATE POLICY behaviour_full_admin_update ON "BehaviourEntry"
  FOR UPDATE
  USING (
    current_setting('app.full_admin', true) = 'true'
    AND "deletedAt" IS NULL
  )
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
  );
