-- Track spouse/second-parent invitations that should create guardian links
-- once the Clerk invite is accepted.

ALTER TABLE "UserInvitation"
  ADD COLUMN "guardianLinkInviterId" TEXT,
  ADD COLUMN "guardianLinkStudentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_guardianLinkInviterId_fkey"
  FOREIGN KEY ("guardianLinkInviterId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UserInvitation_guardianLinkInviterId_createdAt_idx"
  ON "UserInvitation"("guardianLinkInviterId", "createdAt");
