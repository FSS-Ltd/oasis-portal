CREATE TYPE "StudentSelfRegistrationStatus" AS ENUM (
  'Pending',
  'AwaitingConsent',
  'Activated',
  'Declined'
);

CREATE TABLE "StudentRegistrationCode" (
  "id" TEXT NOT NULL,
  "codeBidx" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentRegistrationCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentSelfRegistration" (
  "id" TEXT NOT NULL,
  "firstNameEnc" TEXT NOT NULL,
  "lastNameEnc" TEXT NOT NULL,
  "fullNameEnc" TEXT NOT NULL,
  "emailEnc" TEXT NOT NULL,
  "emailBidx" TEXT NOT NULL,
  "dobEnc" TEXT NOT NULL,
  "yearGroup" TEXT NOT NULL,
  "registrationCodeId" TEXT NOT NULL,
  "status" "StudentSelfRegistrationStatus" NOT NULL DEFAULT 'Pending',
  "parentConsentConfirmedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "declinedById" TEXT,
  "declinedAt" TIMESTAMP(3),
  "declineReasonEnc" TEXT,
  "activationEmailSentAt" TIMESTAMP(3),
  "activationEmailMessageId" TEXT,
  "studentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentSelfRegistration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserInvitation"
ADD COLUMN "studentSelfRegistrationId" TEXT;

CREATE UNIQUE INDEX "StudentRegistrationCode_codeBidx_key"
ON "StudentRegistrationCode"("codeBidx");

CREATE INDEX "StudentRegistrationCode_active_expiresAt_idx"
ON "StudentRegistrationCode"("active", "expiresAt");

CREATE INDEX "StudentRegistrationCode_createdById_createdAt_idx"
ON "StudentRegistrationCode"("createdById", "createdAt");

CREATE UNIQUE INDEX "StudentSelfRegistration_studentId_key"
ON "StudentSelfRegistration"("studentId");

CREATE INDEX "StudentSelfRegistration_status_createdAt_idx"
ON "StudentSelfRegistration"("status", "createdAt");

CREATE INDEX "StudentSelfRegistration_emailBidx_status_idx"
ON "StudentSelfRegistration"("emailBidx", "status");

CREATE INDEX "StudentSelfRegistration_registrationCodeId_createdAt_idx"
ON "StudentSelfRegistration"("registrationCodeId", "createdAt");

CREATE INDEX "StudentSelfRegistration_approvedById_approvedAt_idx"
ON "StudentSelfRegistration"("approvedById", "approvedAt");

CREATE INDEX "StudentSelfRegistration_declinedById_declinedAt_idx"
ON "StudentSelfRegistration"("declinedById", "declinedAt");

CREATE UNIQUE INDEX "UserInvitation_studentSelfRegistrationId_key"
ON "UserInvitation"("studentSelfRegistrationId");

CREATE INDEX "UserInvitation_studentSelfRegistrationId_idx"
ON "UserInvitation"("studentSelfRegistrationId");

CREATE UNIQUE INDEX "StudentSelfRegistration_active_emailBidx_key"
ON "StudentSelfRegistration"("emailBidx")
WHERE "status" IN ('Pending', 'AwaitingConsent', 'Activated');

ALTER TABLE "StudentRegistrationCode"
ADD CONSTRAINT "StudentRegistrationCode_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentSelfRegistration"
ADD CONSTRAINT "StudentSelfRegistration_registrationCodeId_fkey"
FOREIGN KEY ("registrationCodeId") REFERENCES "StudentRegistrationCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentSelfRegistration"
ADD CONSTRAINT "StudentSelfRegistration_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentSelfRegistration"
ADD CONSTRAINT "StudentSelfRegistration_declinedById_fkey"
FOREIGN KEY ("declinedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentSelfRegistration"
ADD CONSTRAINT "StudentSelfRegistration_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
ADD CONSTRAINT "UserInvitation_studentSelfRegistrationId_fkey"
FOREIGN KEY ("studentSelfRegistrationId") REFERENCES "StudentSelfRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
