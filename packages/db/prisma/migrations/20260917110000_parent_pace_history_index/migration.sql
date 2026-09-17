-- Support a linked parent's newest-first PACE history for a student's selected period.
CREATE INDEX "PaceRecord_studentId_completedAt_createdAt_idx"
ON "PaceRecord"("studentId", "completedAt", "createdAt");
