-- Add real per-instrument Merit Markets holdings and explicit tax accounting.

ALTER TYPE "MeritAccount" ADD VALUE 'TaxSink';

CREATE TABLE "InvestmentHolding" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "units" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "costBasisMerits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentHolding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvestmentTransaction"
    ADD COLUMN "instrumentId" TEXT,
    ADD COLUMN "grossMerits" INTEGER,
    ADD COLUMN "taxMerits" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "costBasisMerits" INTEGER;

CREATE UNIQUE INDEX "InvestmentHolding_studentId_instrumentId_key"
    ON "InvestmentHolding"("studentId", "instrumentId");

CREATE INDEX "InvestmentHolding_studentId_idx"
    ON "InvestmentHolding"("studentId");

CREATE INDEX "InvestmentHolding_instrumentId_idx"
    ON "InvestmentHolding"("instrumentId");

CREATE INDEX "InvestmentTransaction_instrumentId_idx"
    ON "InvestmentTransaction"("instrumentId");

ALTER TABLE "InvestmentHolding"
    ADD CONSTRAINT "InvestmentHolding_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestmentHolding"
    ADD CONSTRAINT "InvestmentHolding_instrumentId_fkey"
    FOREIGN KEY ("instrumentId") REFERENCES "InvestmentInstrument"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvestmentTransaction"
    ADD CONSTRAINT "InvestmentTransaction_instrumentId_fkey"
    FOREIGN KEY ("instrumentId") REFERENCES "InvestmentInstrument"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
