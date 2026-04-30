-- Child notes are separate from behaviour entries so neutral observations do
-- not interact with the merit ledger.
CREATE TABLE "ChildNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "noteEnc" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChildNote_studentId_createdAt_idx" ON "ChildNote"("studentId", "createdAt");
CREATE INDEX "ChildNote_sensitive_idx" ON "ChildNote"("sensitive");
CREATE INDEX "ChildNote_createdById_createdAt_idx" ON "ChildNote"("createdById", "createdAt");

ALTER TABLE "ChildNote" ADD CONSTRAINT "ChildNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChildNote" ADD CONSTRAINT "ChildNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
