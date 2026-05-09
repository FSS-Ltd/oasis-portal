CREATE TYPE "StaffNoticeAudience" AS ENUM ('Supervisors', 'Parents', 'Both');

ALTER TABLE "StaffNotice"
ADD COLUMN "audience" "StaffNoticeAudience" NOT NULL DEFAULT 'Supervisors';

CREATE INDEX "StaffNotice_audience_active_expiresAt_createdAt_idx"
ON "StaffNotice"("audience", "active", "expiresAt", "createdAt");
