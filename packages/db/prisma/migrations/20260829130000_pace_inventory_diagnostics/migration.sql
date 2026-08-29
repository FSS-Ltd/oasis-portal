CREATE TYPE "PaceInventoryOrderStatus" AS ENUM ('Ordered', 'InTransit', 'Delivered');

CREATE TYPE "DiagnosticOutcome" AS ENUM ('Pass', 'Fail');

CREATE TABLE "PaceInventoryOrder" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "paceNumber" INTEGER NOT NULL,
  "status" "PaceInventoryOrderStatus" NOT NULL DEFAULT 'Ordered',
  "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "inTransitAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaceInventoryOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaceInventoryOrder_paceNumber_check" CHECK ("paceNumber" > 0),
  CONSTRAINT "PaceInventoryOrder_status_timestamps_check" CHECK (
    ("status" = 'Ordered' AND "inTransitAt" IS NULL AND "deliveredAt" IS NULL)
    OR ("status" = 'InTransit' AND "inTransitAt" IS NOT NULL AND "deliveredAt" IS NULL)
    OR ("status" = 'Delivered' AND "inTransitAt" IS NOT NULL AND "deliveredAt" IS NOT NULL)
  ),
  CONSTRAINT "PaceInventoryOrder_timestamp_order_check" CHECK (
    ("inTransitAt" IS NULL OR "inTransitAt" >= "orderedAt")
    AND ("deliveredAt" IS NULL OR "deliveredAt" >= "inTransitAt")
  )
);

CREATE TABLE "DiagnosticResult" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "outcome" "DiagnosticOutcome" NOT NULL,
  "recordedById" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiagnosticResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiagnosticResult_level_check" CHECK ("level" >= 1 AND "level" <= 5)
);

CREATE INDEX "PaceInventoryOrder_studentId_subjectId_status_paceNumber_idx"
  ON "PaceInventoryOrder"("studentId", "subjectId", "status", "paceNumber");

CREATE INDEX "DiagnosticResult_studentId_subjectId_recordedAt_idx"
  ON "DiagnosticResult"("studentId", "subjectId", "recordedAt");

ALTER TABLE "PaceInventoryOrder"
  ADD CONSTRAINT "PaceInventoryOrder_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceInventoryOrder"
  ADD CONSTRAINT "PaceInventoryOrder_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceInventoryOrder"
  ADD CONSTRAINT "PaceInventoryOrder_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceInventoryOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaceInventoryOrder" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticResult" FORCE ROW LEVEL SECURITY;

CREATE POLICY pace_inventory_orders_head_all ON "PaceInventoryOrder"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');

CREATE POLICY diagnostic_results_head_all ON "DiagnosticResult"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
