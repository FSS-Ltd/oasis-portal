DO $$
BEGIN
  CREATE TYPE "SchoolFeeInvoiceKind" AS ENUM ('SchoolFee', 'Manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SchoolFeeInvoice"
  ADD COLUMN IF NOT EXISTS "kind" "SchoolFeeInvoiceKind" NOT NULL DEFAULT 'SchoolFee',
  ADD COLUMN IF NOT EXISTS "invoiceTitleEnc" TEXT;

UPDATE "SchoolFeeInvoice"
SET "kind" = 'Manual'
WHERE "invoiceNumber" = 'OLC0059';
