-- Add local tombstone fields for Head-only account deletion and student archive.
ALTER TABLE "User"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "authDeletedAt" TIMESTAMP(3);

ALTER TABLE "Student"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Student_archivedAt_idx" ON "Student"("archivedAt");
