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

-- Full admins (Head, Principal, Pastor, HeadOfDiscipline) see everything.
CREATE POLICY behaviour_full_admin_select ON "BehaviourEntry"
  FOR SELECT
  USING (current_setting('app.full_admin', true) = 'true');

-- Supervisors see General entries for any student; never Sensitive.
CREATE POLICY behaviour_supervisor_general ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Supervisor'
    AND "visibility" = 'General'
  );

-- Parents see General entries only for their own children.
CREATE POLICY behaviour_parent_own_child ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
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
    AND "visibility" = 'General'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "BehaviourEntry"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

-- Writes require full-admin OR Supervisor.
CREATE POLICY behaviour_write ON "BehaviourEntry"
  FOR INSERT
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
  );
