ALTER TABLE "StudentPortalSettings"
ADD COLUMN "childIconPhotoUrl" TEXT,
ADD COLUMN "childIconPhotoBucket" TEXT,
ADD COLUMN "childIconPhotoPathEnc" TEXT,
ADD COLUMN "childIconPhotoMimeType" TEXT,
ADD COLUMN "childIconPhotoSizeBytes" INTEGER,
ADD COLUMN "childIconPhotoUpdatedById" TEXT,
ADD COLUMN "childIconPhotoUpdatedAt" TIMESTAMP(3);

CREATE INDEX "StudentPortalSettings_childIconPhotoUpdatedById_childIconPhotoUpdatedAt_idx"
ON "StudentPortalSettings"("childIconPhotoUpdatedById", "childIconPhotoUpdatedAt");

ALTER TABLE "StudentPortalSettings"
ADD CONSTRAINT "StudentPortalSettings_childIconPhotoUpdatedById_fkey"
FOREIGN KEY ("childIconPhotoUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP POLICY IF EXISTS student_portal_settings_parent_select ON "StudentPortalSettings";
DROP POLICY IF EXISTS student_portal_settings_parent_insert ON "StudentPortalSettings";
DROP POLICY IF EXISTS student_portal_settings_parent_update ON "StudentPortalSettings";

CREATE POLICY student_portal_settings_parent_select ON "StudentPortalSettings"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_parent_insert ON "StudentPortalSettings"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_parent_update ON "StudentPortalSettings"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );
