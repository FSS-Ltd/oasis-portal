CREATE TYPE "StudentPaceSupplySource" AS ENUM ('CurrentStock', 'DeliveredOrder');

CREATE TABLE "StudentPaceSupply" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "paceNumber" INTEGER NOT NULL,
  "source" "StudentPaceSupplySource" NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentPaceSupply_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentPaceSupply_studentId_subjectId_paceNumber_key"
    UNIQUE ("studentId", "subjectId", "paceNumber")
);

ALTER TABLE "StudentPaceSupply"
  ADD CONSTRAINT "StudentPaceSupply_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentPaceSupply"
  ADD CONSTRAINT "StudentPaceSupply_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentPaceSupply"
  ADD CONSTRAINT "StudentPaceSupply_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "StudentPaceSupply" (
  "id",
  "studentId",
  "subjectId",
  "paceNumber",
  "source",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "studentId",
  "subjectId",
  "paceNumber",
  'DeliveredOrder',
  "createdById",
  "deliveredAt",
  "updatedAt"
FROM "PaceInventoryOrder"
WHERE "status" = 'Delivered'
ON CONFLICT ("studentId", "subjectId", "paceNumber") DO NOTHING;

ALTER TABLE "DiagnosticResult" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "DiagnosticResult" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DiagnosticResult_deletedAt_idx" ON "DiagnosticResult"("deletedAt");
CREATE INDEX "DiagnosticResult_deletedById_idx" ON "DiagnosticResult"("deletedById");

ALTER TABLE "StudentPaceSupply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentPaceSupply" FORCE ROW LEVEL SECURITY;

CREATE POLICY "student_pace_supply_head_all" ON "StudentPaceSupply"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
