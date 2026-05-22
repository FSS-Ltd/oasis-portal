ALTER TYPE "SchoolFeeInvoiceStatus" ADD VALUE IF NOT EXISTS 'PaymentPending';

DO $$
BEGIN
  CREATE TYPE "SchoolFeeBillingCadence" AS ENUM ('Annual', 'Term', 'Monthly');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SchoolFeeInvoiceDiscountKind" AS ENUM ('Preset', 'ManualPercent', 'ManualFixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SchoolFeeInvoice"
  ADD COLUMN IF NOT EXISTS "schoolYear" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingCadence" "SchoolFeeBillingCadence",
  ADD COLUMN IF NOT EXISTS "familyLabelEnc" TEXT,
  ADD COLUMN IF NOT EXISTS "subtotalAmountPence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discountAmountPence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "parentMarkedPaidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parentMarkedPaidById" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentConfirmedById" TEXT;

UPDATE "SchoolFeeInvoice"
SET
  "subtotalAmountPence" = "totalAmountPence",
  "discountAmountPence" = 0
WHERE "subtotalAmountPence" = 0
  AND "discountAmountPence" = 0;

CREATE TABLE IF NOT EXISTS "SchoolFeeYearFeeConfig" (
  "id" TEXT NOT NULL,
  "schoolYear" INTEGER NOT NULL,
  "annualAmountPence" INTEGER NOT NULL,
  "termAmountPence" INTEGER NOT NULL,
  "monthlyAmountPence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SchoolFeeYearFeeConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SchoolFeeInvoiceStudent" (
  "invoiceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolFeeInvoiceStudent_pkey" PRIMARY KEY ("invoiceId", "studentId")
);

CREATE TABLE IF NOT EXISTS "SchoolFeeInvoiceDiscount" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "labelEnc" TEXT NOT NULL,
  "kind" "SchoolFeeInvoiceDiscountKind" NOT NULL,
  "presetCode" TEXT,
  "percentBps" INTEGER,
  "amountPence" INTEGER,
  "baseAmountPence" INTEGER NOT NULL DEFAULT 0,
  "appliedAmountPence" INTEGER NOT NULL DEFAULT 0,
  "optedOutAt" TIMESTAMP(3),
  "optedOutById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolFeeInvoiceDiscount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolFeeYearFeeConfig_schoolYear_key"
  ON "SchoolFeeYearFeeConfig"("schoolYear");

INSERT INTO "SchoolFeeYearFeeConfig" (
  "id",
  "schoolYear",
  "annualAmountPence",
  "termAmountPence",
  "monthlyAmountPence",
  "updatedAt"
)
VALUES (
  'schoolfeeconfig2026',
  2026,
  294000,
  98000,
  24500,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("schoolYear") DO NOTHING;

INSERT INTO "SchoolFeeInvoiceStudent" ("invoiceId", "studentId", "position")
SELECT "id", "studentId", 1
FROM "SchoolFeeInvoice"
WHERE "studentId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS "SchoolFeeInvoice_schoolYear_status_dueOn_idx"
  ON "SchoolFeeInvoice"("schoolYear", "status", "dueOn");
CREATE INDEX IF NOT EXISTS "SchoolFeeInvoice_parentMarkedPaidById_parentMarkedPaidAt_idx"
  ON "SchoolFeeInvoice"("parentMarkedPaidById", "parentMarkedPaidAt");
CREATE INDEX IF NOT EXISTS "SchoolFeeInvoice_paymentConfirmedById_paymentConfirmedAt_idx"
  ON "SchoolFeeInvoice"("paymentConfirmedById", "paymentConfirmedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolFeeInvoiceStudent_invoiceId_position_key"
  ON "SchoolFeeInvoiceStudent"("invoiceId", "position");
CREATE INDEX IF NOT EXISTS "SchoolFeeInvoiceStudent_studentId_idx"
  ON "SchoolFeeInvoiceStudent"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolFeeInvoiceDiscount_invoiceId_position_key"
  ON "SchoolFeeInvoiceDiscount"("invoiceId", "position");
CREATE INDEX IF NOT EXISTS "SchoolFeeInvoiceDiscount_invoiceId_idx"
  ON "SchoolFeeInvoiceDiscount"("invoiceId");
CREATE INDEX IF NOT EXISTS "SchoolFeeInvoiceDiscount_optedOutById_optedOutAt_idx"
  ON "SchoolFeeInvoiceDiscount"("optedOutById", "optedOutAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolFeeInvoice_parentMarkedPaidById_fkey'
  ) THEN
    ALTER TABLE "SchoolFeeInvoice"
      ADD CONSTRAINT "SchoolFeeInvoice_parentMarkedPaidById_fkey"
      FOREIGN KEY ("parentMarkedPaidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolFeeInvoice_paymentConfirmedById_fkey'
  ) THEN
    ALTER TABLE "SchoolFeeInvoice"
      ADD CONSTRAINT "SchoolFeeInvoice_paymentConfirmedById_fkey"
      FOREIGN KEY ("paymentConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolFeeInvoiceStudent_invoiceId_fkey'
  ) THEN
    ALTER TABLE "SchoolFeeInvoiceStudent"
      ADD CONSTRAINT "SchoolFeeInvoiceStudent_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "SchoolFeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolFeeInvoiceStudent_studentId_fkey'
  ) THEN
    ALTER TABLE "SchoolFeeInvoiceStudent"
      ADD CONSTRAINT "SchoolFeeInvoiceStudent_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolFeeInvoiceDiscount_invoiceId_fkey'
  ) THEN
    ALTER TABLE "SchoolFeeInvoiceDiscount"
      ADD CONSTRAINT "SchoolFeeInvoiceDiscount_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "SchoolFeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolFeeInvoiceDiscount_optedOutById_fkey'
  ) THEN
    ALTER TABLE "SchoolFeeInvoiceDiscount"
      ADD CONSTRAINT "SchoolFeeInvoiceDiscount_optedOutById_fkey"
      FOREIGN KEY ("optedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "SchoolFeeYearFeeConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeYearFeeConfig" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceStudent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceStudent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceDiscount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceDiscount" FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_fee_config_staff_select ON "SchoolFeeYearFeeConfig"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_fee_config_staff_insert ON "SchoolFeeYearFeeConfig"
  FOR INSERT
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_fee_config_staff_update ON "SchoolFeeYearFeeConfig"
  FOR UPDATE
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  )
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_student_staff_select ON "SchoolFeeInvoiceStudent"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_student_parent_select ON "SchoolFeeInvoiceStudent"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "SchoolFeeInvoiceStudent"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_student_staff_insert ON "SchoolFeeInvoiceStudent"
  FOR INSERT
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_student_staff_delete ON "SchoolFeeInvoiceStudent"
  FOR DELETE
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_discount_staff_select ON "SchoolFeeInvoiceDiscount"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_discount_parent_select ON "SchoolFeeInvoiceDiscount"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoiceStudent" link
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE link."invoiceId" = "SchoolFeeInvoiceDiscount"."invoiceId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_discount_staff_insert ON "SchoolFeeInvoiceDiscount"
  FOR INSERT
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_discount_staff_update ON "SchoolFeeInvoiceDiscount"
  FOR UPDATE
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  )
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

CREATE POLICY invoice_discount_parent_update ON "SchoolFeeInvoiceDiscount"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoice" i
      JOIN "SchoolFeeInvoiceStudent" link ON link."invoiceId" = i."id"
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE i."id" = "SchoolFeeInvoiceDiscount"."invoiceId"
        AND i."status" = 'Unpaid'
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoice" i
      JOIN "SchoolFeeInvoiceStudent" link ON link."invoiceId" = i."id"
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE i."id" = "SchoolFeeInvoiceDiscount"."invoiceId"
        AND i."status" = 'Unpaid'
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_discount_staff_delete ON "SchoolFeeInvoiceDiscount"
  FOR DELETE
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
  );

DROP POLICY IF EXISTS invoice_parent_own_child_select ON "SchoolFeeInvoice";
CREATE POLICY invoice_parent_own_child_select ON "SchoolFeeInvoice"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND "status" <> 'Draft'
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoiceStudent" link
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE link."invoiceId" = "SchoolFeeInvoice"."id"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_parent_payment_update ON "SchoolFeeInvoice"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND "status" = 'Unpaid'
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoiceStudent" link
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE link."invoiceId" = "SchoolFeeInvoice"."id"
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND "status"::text IN ('Unpaid', 'PaymentPending')
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoiceStudent" link
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE link."invoiceId" = "SchoolFeeInvoice"."id"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );
