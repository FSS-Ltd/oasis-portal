CREATE TABLE "StudentPortalSettings" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "loginHandleEnc" TEXT,
    "loginHandleBidx" TEXT,
    "studentCanManagePassword" BOOLEAN NOT NULL DEFAULT false,
    "hourlyUsageLimitMinutes" INTEGER,
    "dailyUsageLimitMinutes" INTEGER,
    "weeklyUsageLimitMinutes" INTEGER,
    "parentAccountLocked" BOOLEAN NOT NULL DEFAULT false,
    "parentLockReasonEnc" TEXT,
    "headAcademicLocked" BOOLEAN NOT NULL DEFAULT false,
    "headAcademicLockReasonEnc" TEXT,
    "parentMeritShopBlocked" BOOLEAN NOT NULL DEFAULT false,
    "settingsUpdatedById" TEXT,
    "settingsUpdatedAt" TIMESTAMP(3),
    "parentLockUpdatedById" TEXT,
    "parentLockUpdatedAt" TIMESTAMP(3),
    "headLockUpdatedById" TEXT,
    "headLockUpdatedAt" TIMESTAMP(3),
    "shopBlockUpdatedById" TEXT,
    "shopBlockUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPortalSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentPortalSettings_hourlyUsageLimitMinutes_check"
        CHECK ("hourlyUsageLimitMinutes" IS NULL OR ("hourlyUsageLimitMinutes" >= 1 AND "hourlyUsageLimitMinutes" <= 60)),
    CONSTRAINT "StudentPortalSettings_dailyUsageLimitMinutes_check"
        CHECK ("dailyUsageLimitMinutes" IS NULL OR ("dailyUsageLimitMinutes" >= 1 AND "dailyUsageLimitMinutes" <= 1440)),
    CONSTRAINT "StudentPortalSettings_weeklyUsageLimitMinutes_check"
        CHECK ("weeklyUsageLimitMinutes" IS NULL OR ("weeklyUsageLimitMinutes" >= 1 AND "weeklyUsageLimitMinutes" <= 10080))
);

CREATE UNIQUE INDEX "StudentPortalSettings_studentId_key" ON "StudentPortalSettings"("studentId");
CREATE UNIQUE INDEX "StudentPortalSettings_loginHandleBidx_key" ON "StudentPortalSettings"("loginHandleBidx");
CREATE INDEX "StudentPortalSettings_settingsUpdatedById_settingsUpdatedAt_idx" ON "StudentPortalSettings"("settingsUpdatedById", "settingsUpdatedAt");
CREATE INDEX "StudentPortalSettings_parentLockUpdatedById_parentLockUpdatedAt_idx" ON "StudentPortalSettings"("parentLockUpdatedById", "parentLockUpdatedAt");
CREATE INDEX "StudentPortalSettings_headLockUpdatedById_headLockUpdatedAt_idx" ON "StudentPortalSettings"("headLockUpdatedById", "headLockUpdatedAt");
CREATE INDEX "StudentPortalSettings_shopBlockUpdatedById_shopBlockUpdatedAt_idx" ON "StudentPortalSettings"("shopBlockUpdatedById", "shopBlockUpdatedAt");

ALTER TABLE "StudentPortalSettings"
ADD CONSTRAINT "StudentPortalSettings_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentPortalSettings"
ADD CONSTRAINT "StudentPortalSettings_settingsUpdatedById_fkey"
FOREIGN KEY ("settingsUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentPortalSettings"
ADD CONSTRAINT "StudentPortalSettings_parentLockUpdatedById_fkey"
FOREIGN KEY ("parentLockUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentPortalSettings"
ADD CONSTRAINT "StudentPortalSettings_headLockUpdatedById_fkey"
FOREIGN KEY ("headLockUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentPortalSettings"
ADD CONSTRAINT "StudentPortalSettings_shopBlockUpdatedById_fkey"
FOREIGN KEY ("shopBlockUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentPortalSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentPortalSettings" FORCE ROW LEVEL SECURITY;

CREATE POLICY student_portal_settings_full_admin_all ON "StudentPortalSettings"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY student_portal_settings_parent_select ON "StudentPortalSettings"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_student_self_select ON "StudentPortalSettings"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentPortalSettings"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_parent_insert ON "StudentPortalSettings"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_parent_update ON "StudentPortalSettings"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );
