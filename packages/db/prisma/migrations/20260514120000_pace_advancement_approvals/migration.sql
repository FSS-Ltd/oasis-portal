CREATE TABLE "PaceAdvancementApproval" (
    "id" TEXT NOT NULL,
    "paceRecordId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "paceNumber" INTEGER NOT NULL,
    "notesEnc" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaceAdvancementApproval_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaceProgress"
  ADD COLUMN "completedByApprovalId" TEXT;

CREATE UNIQUE INDEX "PaceAdvancementApproval_paceRecordId_key"
  ON "PaceAdvancementApproval"("paceRecordId");

CREATE INDEX "PaceAdvancementApproval_studentId_subjectId_paceNumber_idx"
  ON "PaceAdvancementApproval"("studentId", "subjectId", "paceNumber");

CREATE INDEX "PaceAdvancementApproval_approvedById_approvedAt_idx"
  ON "PaceAdvancementApproval"("approvedById", "approvedAt");

CREATE INDEX "PaceAdvancementApproval_approvedAt_idx"
  ON "PaceAdvancementApproval"("approvedAt");

CREATE INDEX "PaceProgress_completedByApprovalId_idx"
  ON "PaceProgress"("completedByApprovalId");

ALTER TABLE "PaceAdvancementApproval"
  ADD CONSTRAINT "PaceAdvancementApproval_paceRecordId_fkey"
  FOREIGN KEY ("paceRecordId") REFERENCES "PaceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceAdvancementApproval"
  ADD CONSTRAINT "PaceAdvancementApproval_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceAdvancementApproval"
  ADD CONSTRAINT "PaceAdvancementApproval_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceAdvancementApproval"
  ADD CONSTRAINT "PaceAdvancementApproval_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceProgress"
  ADD CONSTRAINT "PaceProgress_completedByApprovalId_fkey"
  FOREIGN KEY ("completedByApprovalId") REFERENCES "PaceAdvancementApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
