CREATE TABLE "PaceProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "paceNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedByRecordId" TEXT,
    "finalTestAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaceProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaceProgress_studentId_subjectId_paceNumber_key"
  ON "PaceProgress"("studentId", "subjectId", "paceNumber");

CREATE INDEX "PaceProgress_studentId_subjectId_completedAt_idx"
  ON "PaceProgress"("studentId", "subjectId", "completedAt");

CREATE INDEX "PaceProgress_completedByRecordId_idx"
  ON "PaceProgress"("completedByRecordId");

ALTER TABLE "PaceProgress"
  ADD CONSTRAINT "PaceProgress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceProgress"
  ADD CONSTRAINT "PaceProgress_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceProgress"
  ADD CONSTRAINT "PaceProgress_completedByRecordId_fkey"
  FOREIGN KEY ("completedByRecordId") REFERENCES "PaceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
