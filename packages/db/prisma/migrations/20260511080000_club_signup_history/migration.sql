-- Allow a withdrawn club signup to remain as history while permitting a later
-- active re-sign for the same student and club.

DROP INDEX IF EXISTS "ClubSignup_clubId_studentId_key";

ALTER TABLE "ClubSignup"
  ADD COLUMN "withdrawnAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ClubSignup_active_clubId_studentId_key"
  ON "ClubSignup"("clubId", "studentId")
  WHERE "status" = 'Active';

CREATE INDEX "ClubSignup_clubId_status_idx" ON "ClubSignup"("clubId", "status");
CREATE INDEX "ClubSignup_studentId_status_idx" ON "ClubSignup"("studentId", "status");
