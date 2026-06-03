CREATE TABLE "StudentPortalUsageMinute" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "minuteStartedAt" TIMESTAMP(3) NOT NULL,
    "sessionKey" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPortalUsageMinute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentPortalUsageMinute_studentId_minuteStartedAt_key"
ON "StudentPortalUsageMinute"("studentId", "minuteStartedAt");

CREATE INDEX "StudentPortalUsageMinute_studentId_minuteStartedAt_idx"
ON "StudentPortalUsageMinute"("studentId", "minuteStartedAt");

ALTER TABLE "StudentPortalUsageMinute"
ADD CONSTRAINT "StudentPortalUsageMinute_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentPortalUsageMinute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentPortalUsageMinute" FORCE ROW LEVEL SECURITY;

CREATE POLICY student_portal_usage_minutes_full_admin_all ON "StudentPortalUsageMinute"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY student_portal_usage_minutes_student_select ON "StudentPortalUsageMinute"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentPortalUsageMinute"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_usage_minutes_student_insert ON "StudentPortalUsageMinute"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentPortalUsageMinute"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_usage_minutes_student_update ON "StudentPortalUsageMinute"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentPortalUsageMinute"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentPortalUsageMinute"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );
