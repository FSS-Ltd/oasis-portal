-- Link admin-created student invitations back to the student profile they activate.
ALTER TABLE "UserInvitation" ADD COLUMN "studentId" TEXT;

CREATE UNIQUE INDEX "UserInvitation_studentId_key" ON "UserInvitation"("studentId");
CREATE INDEX "UserInvitation_studentId_idx" ON "UserInvitation"("studentId");

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_studentId_fkey"
  FOREIGN KEY ("studentId")
  REFERENCES "Student"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
