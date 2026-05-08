ALTER TABLE "StaffNotice"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "StaffNotice_active_expiresAt_createdAt_idx"
ON "StaffNotice"("active", "expiresAt", "createdAt");
