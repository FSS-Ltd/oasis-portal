-- Retain user references for attendance, safeguarding, and audit history.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD CONSTRAINT "User_deleted_account_inactive"
  CHECK ("deletedAt" IS NULL OR "active" = false);
