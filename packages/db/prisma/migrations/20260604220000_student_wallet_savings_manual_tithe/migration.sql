-- Extend manual tithe configuration and runs.
ALTER TABLE "TitheConfig"
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'Percentage',
  ADD COLUMN "fixedAmount" INTEGER,
  ADD COLUMN "weeklyDay" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "monthlyDate" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TitheRun"
  ADD COLUMN "cadence" TEXT NOT NULL DEFAULT 'Weekly',
  ADD COLUMN "minimumAmount" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "TitheRun_studentId_periodStart_key";

CREATE UNIQUE INDEX "TitheRun_studentId_cadence_periodStart_key"
  ON "TitheRun"("studentId", "cadence", "periodStart");

-- Idempotent monthly savings interest payouts.
CREATE TABLE "SavingsInterestRun" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "savingBalance" INTEGER NOT NULL,
  "interestAmount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SavingsInterestRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavingsInterestRun_studentId_periodStart_key"
  ON "SavingsInterestRun"("studentId", "periodStart");

ALTER TABLE "SavingsInterestRun"
  ADD CONSTRAINT "SavingsInterestRun_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
