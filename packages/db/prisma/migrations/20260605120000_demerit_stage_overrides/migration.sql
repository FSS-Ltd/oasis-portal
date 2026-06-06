CREATE TABLE "DemeritStageOverride" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "stage" INTEGER NOT NULL,
  "noteEnc" TEXT,
  "setById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DemeritStageOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemeritStageOverride_studentId_day_key" ON "DemeritStageOverride"("studentId", "day");
CREATE INDEX "DemeritStageOverride_day_stage_idx" ON "DemeritStageOverride"("day", "stage");
CREATE INDEX "DemeritStageOverride_setById_createdAt_idx" ON "DemeritStageOverride"("setById", "createdAt");

ALTER TABLE "DemeritStageOverride"
  ADD CONSTRAINT "DemeritStageOverride_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DemeritStageOverride"
  ADD CONSTRAINT "DemeritStageOverride_setById_fkey"
  FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DemeritStageOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DemeritStageOverride" FORCE ROW LEVEL SECURITY;

CREATE POLICY demerit_stage_override_full_admin_all ON "DemeritStageOverride"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY demerit_stage_override_staff_select ON "DemeritStageOverride"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN ('Supervisor', 'ClubsAdmin', 'ClubsLead')
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "DemeritStageOverride"."studentId"
        AND s."active" = true
    )
  );
