CREATE TYPE "StudentParentLinkRequestStatus" AS ENUM (
  'Pending',
  'Confirmed',
  'Rejected',
  'Invited'
);

CREATE TABLE "StudentParentLinkRequest" (
  "id" TEXT NOT NULL,
  "studentSelfRegistrationId" TEXT NOT NULL,
  "studentId" TEXT,
  "parentEmailEnc" TEXT NOT NULL,
  "parentEmailBidx" TEXT NOT NULL,
  "parentNameEnc" TEXT,
  "existingAccount" BOOLEAN NOT NULL,
  "targetUserId" TEXT,
  "status" "StudentParentLinkRequestStatus" NOT NULL DEFAULT 'Pending',
  "confirmedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "invitedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentParentLinkRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserInvitation"
ADD COLUMN "studentParentLinkRequestId" TEXT;

CREATE UNIQUE INDEX "StudentParentLinkRequest_studentSelfRegistrationId_parentEmailBidx_key"
ON "StudentParentLinkRequest"("studentSelfRegistrationId", "parentEmailBidx");

CREATE INDEX "StudentParentLinkRequest_targetUserId_status_createdAt_idx"
ON "StudentParentLinkRequest"("targetUserId", "status", "createdAt");

CREATE INDEX "StudentParentLinkRequest_studentId_status_idx"
ON "StudentParentLinkRequest"("studentId", "status");

CREATE INDEX "StudentParentLinkRequest_parentEmailBidx_status_idx"
ON "StudentParentLinkRequest"("parentEmailBidx", "status");

CREATE UNIQUE INDEX "UserInvitation_studentParentLinkRequestId_key"
ON "UserInvitation"("studentParentLinkRequestId");

CREATE INDEX "UserInvitation_studentParentLinkRequestId_idx"
ON "UserInvitation"("studentParentLinkRequestId");

ALTER TABLE "StudentParentLinkRequest"
ADD CONSTRAINT "StudentParentLinkRequest_studentSelfRegistrationId_fkey"
FOREIGN KEY ("studentSelfRegistrationId") REFERENCES "StudentSelfRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentParentLinkRequest"
ADD CONSTRAINT "StudentParentLinkRequest_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentParentLinkRequest"
ADD CONSTRAINT "StudentParentLinkRequest_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
ADD CONSTRAINT "UserInvitation_studentParentLinkRequestId_fkey"
FOREIGN KEY ("studentParentLinkRequestId") REFERENCES "StudentParentLinkRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
