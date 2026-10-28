-- A pending deletion request is a set deletionRequestedAt on an account that is not yet deleted.
-- History lives in AuditLog. Approval reuses the existing deletedAt path.
ALTER TABLE "User" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletionRequestedById" TEXT;
CREATE INDEX "User_deletionRequestedAt_idx" ON "User"("deletionRequestedAt");
