CREATE TYPE "PermissionSlipCategory" AS ENUM ('SchoolTrip', 'Activity', 'Reward', 'Consent');

CREATE TYPE "PermissionSlipResponseStatus" AS ENUM ('Pending', 'Signed', 'Declined');

CREATE TYPE "PermissionSlipSignatureSource" AS ENUM ('ParentPortal', 'Physical');

CREATE TYPE "PermissionSlipPaymentStatus" AS ENUM ('NotRequired', 'Unpaid', 'PaymentPending', 'Paid');

CREATE TABLE "PermissionSlip" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "PermissionSlipCategory" NOT NULL,
  "descriptionEnc" TEXT,
  "eventDate" DATE,
  "deadline" DATE NOT NULL,
  "departureTimeMinutes" INTEGER,
  "returnTimeMinutes" INTEGER,
  "locationEnc" TEXT,
  "transportEnc" TEXT,
  "costEnc" TEXT,
  "consentTextEnc" TEXT NOT NULL,
  "requireMedical" BOOLEAN NOT NULL DEFAULT false,
  "requireEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
  "requirePayment" BOOLEAN NOT NULL DEFAULT false,
  "recipientLabel" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "calendarEventId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PermissionSlip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermissionSlipRecipient" (
  "slipId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "responseStatus" "PermissionSlipResponseStatus" NOT NULL DEFAULT 'Pending',
  "signatureSource" "PermissionSlipSignatureSource",
  "parentNameEnc" TEXT,
  "signedAt" TIMESTAMP(3),
  "medicalInfoEnc" TEXT,
  "emergencyContactEnc" TEXT,
  "declineReasonEnc" TEXT,
  "parentRespondedById" TEXT,
  "physicalSignedById" TEXT,
  "paymentStatus" "PermissionSlipPaymentStatus" NOT NULL DEFAULT 'NotRequired',
  "parentMarkedPaidAt" TIMESTAMP(3),
  "parentMarkedPaidById" TEXT,
  "paymentConfirmedAt" TIMESTAMP(3),
  "paymentConfirmedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PermissionSlipRecipient_pkey" PRIMARY KEY ("slipId", "studentId")
);

CREATE TABLE "PermissionSlipBringItem" (
  "id" TEXT NOT NULL,
  "slipId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "labelEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PermissionSlipBringItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermissionSlipQuestion" (
  "id" TEXT NOT NULL,
  "slipId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "labelEnc" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PermissionSlipQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermissionSlipAnswer" (
  "questionId" TEXT NOT NULL,
  "slipId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "answerEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PermissionSlipAnswer_pkey" PRIMARY KEY ("questionId", "studentId")
);

CREATE UNIQUE INDEX "PermissionSlip_calendarEventId_key"
  ON "PermissionSlip"("calendarEventId");
CREATE INDEX "PermissionSlip_active_deadline_idx"
  ON "PermissionSlip"("active", "deadline");
CREATE INDEX "PermissionSlip_createdById_createdAt_idx"
  ON "PermissionSlip"("createdById", "createdAt");
CREATE INDEX "PermissionSlip_category_active_deadline_idx"
  ON "PermissionSlip"("category", "active", "deadline");

CREATE UNIQUE INDEX "PermissionSlipRecipient_slipId_position_key"
  ON "PermissionSlipRecipient"("slipId", "position");
CREATE INDEX "PermissionSlipRecipient_studentId_responseStatus_idx"
  ON "PermissionSlipRecipient"("studentId", "responseStatus");
CREATE INDEX "PermissionSlipRecipient_paymentStatus_parentMarkedPaidAt_idx"
  ON "PermissionSlipRecipient"("paymentStatus", "parentMarkedPaidAt");
CREATE INDEX "PermissionSlipRecipient_parentRespondedById_signedAt_idx"
  ON "PermissionSlipRecipient"("parentRespondedById", "signedAt");
CREATE INDEX "PermissionSlipRecipient_physicalSignedById_signedAt_idx"
  ON "PermissionSlipRecipient"("physicalSignedById", "signedAt");
CREATE INDEX "PermissionSlipRecipient_parentMarkedPaidById_parentMarkedPaidAt_idx"
  ON "PermissionSlipRecipient"("parentMarkedPaidById", "parentMarkedPaidAt");
CREATE INDEX "PermissionSlipRecipient_paymentConfirmedById_paymentConfirmedAt_idx"
  ON "PermissionSlipRecipient"("paymentConfirmedById", "paymentConfirmedAt");

CREATE UNIQUE INDEX "PermissionSlipBringItem_slipId_position_key"
  ON "PermissionSlipBringItem"("slipId", "position");
CREATE INDEX "PermissionSlipBringItem_slipId_idx"
  ON "PermissionSlipBringItem"("slipId");

CREATE UNIQUE INDEX "PermissionSlipQuestion_slipId_position_key"
  ON "PermissionSlipQuestion"("slipId", "position");
CREATE INDEX "PermissionSlipQuestion_slipId_idx"
  ON "PermissionSlipQuestion"("slipId");

CREATE INDEX "PermissionSlipAnswer_slipId_studentId_idx"
  ON "PermissionSlipAnswer"("slipId", "studentId");

ALTER TABLE "PermissionSlip"
  ADD CONSTRAINT "PermissionSlip_calendarEventId_fkey"
  FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PermissionSlip"
  ADD CONSTRAINT "PermissionSlip_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipRecipient"
  ADD CONSTRAINT "PermissionSlipRecipient_slipId_fkey"
  FOREIGN KEY ("slipId") REFERENCES "PermissionSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipRecipient"
  ADD CONSTRAINT "PermissionSlipRecipient_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipRecipient"
  ADD CONSTRAINT "PermissionSlipRecipient_parentRespondedById_fkey"
  FOREIGN KEY ("parentRespondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipRecipient"
  ADD CONSTRAINT "PermissionSlipRecipient_physicalSignedById_fkey"
  FOREIGN KEY ("physicalSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipRecipient"
  ADD CONSTRAINT "PermissionSlipRecipient_parentMarkedPaidById_fkey"
  FOREIGN KEY ("parentMarkedPaidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipRecipient"
  ADD CONSTRAINT "PermissionSlipRecipient_paymentConfirmedById_fkey"
  FOREIGN KEY ("paymentConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipBringItem"
  ADD CONSTRAINT "PermissionSlipBringItem_slipId_fkey"
  FOREIGN KEY ("slipId") REFERENCES "PermissionSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipQuestion"
  ADD CONSTRAINT "PermissionSlipQuestion_slipId_fkey"
  FOREIGN KEY ("slipId") REFERENCES "PermissionSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipAnswer"
  ADD CONSTRAINT "PermissionSlipAnswer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "PermissionSlipQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PermissionSlipAnswer"
  ADD CONSTRAINT "PermissionSlipAnswer_slipId_studentId_fkey"
  FOREIGN KEY ("slipId", "studentId") REFERENCES "PermissionSlipRecipient"("slipId", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;
