-- Homework assignments, submissions, reviews, and private submission image bucket.

CREATE TYPE "HomeworkSubmissionMethod" AS ENUM ('UploadImage', 'InPerson');

CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "descriptionEnc" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "submissionMethod" "HomeworkSubmissionMethod" NOT NULL,
    "allYearGroupBands" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeworkAssignmentBand" (
    "assignmentId" TEXT NOT NULL,
    "yearGroupBandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAssignmentBand_pkey" PRIMARY KEY ("assignmentId", "yearGroupBandId")
);

CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "scorePercent" INTEGER,
    "commentsEnc" TEXT,
    "meritAmount" INTEGER NOT NULL DEFAULT 0,
    "behaviourEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeworkSubmissionImage" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalFileNameEnc" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePathEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkSubmissionImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeworkAssignment_active_dueDate_idx" ON "HomeworkAssignment"("active", "dueDate");
CREATE INDEX "HomeworkAssignment_createdById_createdAt_idx" ON "HomeworkAssignment"("createdById", "createdAt");
CREATE INDEX "HomeworkAssignmentBand_yearGroupBandId_idx" ON "HomeworkAssignmentBand"("yearGroupBandId");
CREATE UNIQUE INDEX "HomeworkSubmission_behaviourEntryId_key" ON "HomeworkSubmission"("behaviourEntryId");
CREATE UNIQUE INDEX "HomeworkSubmission_assignmentId_studentId_key" ON "HomeworkSubmission"("assignmentId", "studentId");
CREATE INDEX "HomeworkSubmission_studentId_reviewedAt_submittedAt_idx" ON "HomeworkSubmission"("studentId", "reviewedAt", "submittedAt");
CREATE INDEX "HomeworkSubmission_assignmentId_reviewedAt_idx" ON "HomeworkSubmission"("assignmentId", "reviewedAt");
CREATE INDEX "HomeworkSubmission_reviewedById_reviewedAt_idx" ON "HomeworkSubmission"("reviewedById", "reviewedAt");
CREATE INDEX "HomeworkSubmissionImage_submissionId_createdAt_idx" ON "HomeworkSubmissionImage"("submissionId", "createdAt");
CREATE INDEX "HomeworkSubmissionImage_uploadedById_createdAt_idx" ON "HomeworkSubmissionImage"("uploadedById", "createdAt");

ALTER TABLE "HomeworkAssignment"
    ADD CONSTRAINT "HomeworkAssignment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HomeworkAssignmentBand"
    ADD CONSTRAINT "HomeworkAssignmentBand_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeworkAssignmentBand"
    ADD CONSTRAINT "HomeworkAssignmentBand_yearGroupBandId_fkey"
    FOREIGN KEY ("yearGroupBandId") REFERENCES "YearGroupBand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HomeworkSubmission"
    ADD CONSTRAINT "HomeworkSubmission_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeworkSubmission"
    ADD CONSTRAINT "HomeworkSubmission_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeworkSubmission"
    ADD CONSTRAINT "HomeworkSubmission_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomeworkSubmission"
    ADD CONSTRAINT "HomeworkSubmission_behaviourEntryId_fkey"
    FOREIGN KEY ("behaviourEntryId") REFERENCES "BehaviourEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HomeworkSubmissionImage"
    ADD CONSTRAINT "HomeworkSubmissionImage_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeworkSubmissionImage"
    ADD CONSTRAINT "HomeworkSubmissionImage_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('homework-submissions', 'homework-submissions', false)
    ON CONFLICT (id) DO UPDATE
      SET public = false;
  END IF;
END $$;
