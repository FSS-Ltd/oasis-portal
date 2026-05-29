-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('SafeguardingConcern', 'AccidentFirstAid', 'BehaviourIncident', 'BullyingPeerOnPeer', 'OnlineSafety', 'MedicalMedication', 'PhysicalIntervention', 'NearMiss', 'OffSiteTrip');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "IncidentConfidentiality" AS ENUM ('StaffOnly', 'HeadDsl', 'ParentViewableAfterSignOff');

-- CreateEnum
CREATE TYPE "IncidentReportStatus" AS ENUM ('Draft', 'HeadReview', 'Escalated', 'SignedOff', 'Archived');

-- CreateEnum
CREATE TYPE "IncidentParentCopyStatus" AS ENUM ('Draft', 'Generated', 'Shared', 'Archived');

-- CreateEnum
CREATE TYPE "IncidentPersonKind" AS ENUM ('StaffInvolved', 'Witness');

-- CreateEnum
CREATE TYPE "IncidentEventType" AS ENUM ('DraftSaved', 'SubmittedForHeadReview', 'SignedOff', 'Escalated', 'ParentCopyGenerated', 'ParentCopyShared', 'ParentCopyAcknowledged', 'AttachmentAdded', 'Archived');

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "confidentiality" "IncidentConfidentiality" NOT NULL DEFAULT 'StaffOnly',
    "status" "IncidentReportStatus" NOT NULL DEFAULT 'Draft',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "locationEnc" TEXT NOT NULL,
    "activityEnc" TEXT,
    "offSite" BOOLEAN NOT NULL DEFAULT false,
    "factualAccountEnc" TEXT NOT NULL,
    "directDisclosureEnc" TEXT,
    "immediateActionsEnc" TEXT,
    "witnessesEnc" TEXT,
    "injurySustained" BOOLEAN NOT NULL DEFAULT false,
    "bodyAreaEnc" TEXT,
    "firstAidGiven" BOOLEAN NOT NULL DEFAULT false,
    "firstAiderId" TEXT,
    "emergencyServicesContacted" BOOLEAN NOT NULL DEFAULT false,
    "hospitalTreatment" BOOLEAN NOT NULL DEFAULT false,
    "parentCarerNotified" BOOLEAN NOT NULL DEFAULT false,
    "parentNotifiedAt" TIMESTAMP(3),
    "medicalNotesEnc" TEXT,
    "dslNotified" BOOLEAN NOT NULL DEFAULT false,
    "headSignOffRequired" BOOLEAN NOT NULL DEFAULT false,
    "pastorPrincipalEscalation" BOOLEAN NOT NULL DEFAULT false,
    "ladoConsidered" BOOLEAN NOT NULL DEFAULT false,
    "socialCarePoliceReferral" BOOLEAN NOT NULL DEFAULT false,
    "riddorCheck" BOOLEAN NOT NULL DEFAULT false,
    "dataSharingReasonEnc" TEXT,
    "parentVisibilityRequested" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT NOT NULL,
    "signedOffById" TEXT,
    "signedOffAt" TIMESTAMP(3),
    "escalatedById" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReportStudent" (
    "reportId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReportStudent_pkey" PRIMARY KEY ("reportId","studentId")
);

-- CreateTable
CREATE TABLE "IncidentReportStaff" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "IncidentPersonKind" NOT NULL,
    "roleLabelEnc" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReportStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReportAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "originalFileNameEnc" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePathEnc" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReportParentCopy" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "IncidentParentCopyStatus" NOT NULL DEFAULT 'Draft',
    "parentSummaryEnc" TEXT NOT NULL,
    "redactionsEnc" TEXT,
    "attachmentsIncludedEnc" TEXT,
    "sharingReasonEnc" TEXT,
    "pdfBytesEnc" TEXT,
    "pdfFileNameEnc" TEXT,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3),
    "sharedById" TEXT,
    "sharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReportParentCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReportParentRecipient" (
    "copyId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReportParentRecipient_pkey" PRIMARY KEY ("copyId","guardianId")
);

-- CreateTable
CREATE TABLE "IncidentReportEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "IncidentEventType" NOT NULL,
    "noteEnc" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncidentReport_reportNumber_key" ON "IncidentReport"("reportNumber");
CREATE INDEX "IncidentReport_status_updatedAt_idx" ON "IncidentReport"("status", "updatedAt");
CREATE INDEX "IncidentReport_type_severity_occurredAt_idx" ON "IncidentReport"("type", "severity", "occurredAt");
CREATE INDEX "IncidentReport_recordedById_createdAt_idx" ON "IncidentReport"("recordedById", "createdAt");
CREATE INDEX "IncidentReport_signedOffById_signedOffAt_idx" ON "IncidentReport"("signedOffById", "signedOffAt");
CREATE INDEX "IncidentReport_escalatedById_escalatedAt_idx" ON "IncidentReport"("escalatedById", "escalatedAt");

CREATE UNIQUE INDEX "IncidentReportStudent_reportId_position_key" ON "IncidentReportStudent"("reportId", "position");
CREATE INDEX "IncidentReportStudent_studentId_idx" ON "IncidentReportStudent"("studentId");

CREATE UNIQUE INDEX "IncidentReportStaff_reportId_kind_position_key" ON "IncidentReportStaff"("reportId", "kind", "position");
CREATE INDEX "IncidentReportStaff_userId_kind_idx" ON "IncidentReportStaff"("userId", "kind");

CREATE UNIQUE INDEX "IncidentReportAttachment_reportId_position_key" ON "IncidentReportAttachment"("reportId", "position");
CREATE INDEX "IncidentReportAttachment_uploadedById_createdAt_idx" ON "IncidentReportAttachment"("uploadedById", "createdAt");

CREATE UNIQUE INDEX "IncidentReportParentCopy_reportId_studentId_key" ON "IncidentReportParentCopy"("reportId", "studentId");
CREATE INDEX "IncidentReportParentCopy_studentId_status_sharedAt_idx" ON "IncidentReportParentCopy"("studentId", "status", "sharedAt");
CREATE INDEX "IncidentReportParentCopy_generatedById_generatedAt_idx" ON "IncidentReportParentCopy"("generatedById", "generatedAt");
CREATE INDEX "IncidentReportParentCopy_sharedById_sharedAt_idx" ON "IncidentReportParentCopy"("sharedById", "sharedAt");

CREATE INDEX "IncidentReportParentRecipient_guardianId_acknowledgedAt_idx" ON "IncidentReportParentRecipient"("guardianId", "acknowledgedAt");
CREATE INDEX "IncidentReportParentRecipient_guardianId_downloadedAt_idx" ON "IncidentReportParentRecipient"("guardianId", "downloadedAt");

CREATE INDEX "IncidentReportEvent_reportId_createdAt_idx" ON "IncidentReportEvent"("reportId", "createdAt");
CREATE INDEX "IncidentReportEvent_actorId_createdAt_idx" ON "IncidentReportEvent"("actorId", "createdAt");
CREATE INDEX "IncidentReportEvent_type_createdAt_idx" ON "IncidentReportEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_firstAiderId_fkey" FOREIGN KEY ("firstAiderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncidentReportStudent" ADD CONSTRAINT "IncidentReportStudent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentReportStudent" ADD CONSTRAINT "IncidentReportStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncidentReportStaff" ADD CONSTRAINT "IncidentReportStaff_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentReportStaff" ADD CONSTRAINT "IncidentReportStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncidentReportAttachment" ADD CONSTRAINT "IncidentReportAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentReportAttachment" ADD CONSTRAINT "IncidentReportAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncidentReportParentCopy" ADD CONSTRAINT "IncidentReportParentCopy_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentReportParentCopy" ADD CONSTRAINT "IncidentReportParentCopy_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncidentReportParentCopy" ADD CONSTRAINT "IncidentReportParentCopy_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentReportParentCopy" ADD CONSTRAINT "IncidentReportParentCopy_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IncidentReportParentRecipient" ADD CONSTRAINT "IncidentReportParentRecipient_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "IncidentReportParentCopy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentReportParentRecipient" ADD CONSTRAINT "IncidentReportParentRecipient_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncidentReportEvent" ADD CONSTRAINT "IncidentReportEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentReportEvent" ADD CONSTRAINT "IncidentReportEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
