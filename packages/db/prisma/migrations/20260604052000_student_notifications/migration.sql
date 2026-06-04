CREATE TYPE "StudentNotificationKind" AS ENUM (
  'MeritAward',
  'ShopPurchase',
  'ClubNotice',
  'SystemAnnouncement'
);

CREATE TABLE "StudentNotification" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "kind" "StudentNotificationKind" NOT NULL,
  "title" TEXT NOT NULL,
  "bodyEnc" TEXT NOT NULL,
  "sourceEntity" TEXT,
  "sourceId" TEXT,
  "createdById" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentNotification_studentId_readAt_createdAt_idx"
ON "StudentNotification"("studentId", "readAt", "createdAt");

CREATE INDEX "StudentNotification_studentId_kind_createdAt_idx"
ON "StudentNotification"("studentId", "kind", "createdAt");

CREATE INDEX "StudentNotification_sourceEntity_sourceId_idx"
ON "StudentNotification"("sourceEntity", "sourceId");

CREATE INDEX "StudentNotification_createdById_createdAt_idx"
ON "StudentNotification"("createdById", "createdAt");

ALTER TABLE "StudentNotification"
ADD CONSTRAINT "StudentNotification_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentNotification"
ADD CONSTRAINT "StudentNotification_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentNotification" FORCE ROW LEVEL SECURITY;

CREATE POLICY student_notifications_full_admin_all ON "StudentNotification"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY student_notifications_technical_support_all ON "StudentNotification"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'TechnicalSupport')
  WITH CHECK (current_setting('app.user_role', true) = 'TechnicalSupport');

CREATE POLICY student_notifications_staff_insert ON "StudentNotification"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'ClubsLead',
      'Supervisor'
    )
  );

CREATE POLICY student_notifications_student_select ON "StudentNotification"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentNotification"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_notifications_student_update ON "StudentNotification"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentNotification"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentNotification"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );
