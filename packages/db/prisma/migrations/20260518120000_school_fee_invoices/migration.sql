CREATE TYPE "SchoolFeeInvoiceStatus" AS ENUM ('Draft', 'Unpaid', 'Paid');

CREATE TABLE "SchoolFeeInvoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "studentId" TEXT,
  "status" "SchoolFeeInvoiceStatus" NOT NULL DEFAULT 'Draft',
  "term" TEXT,
  "issuedOn" DATE,
  "dueOn" DATE,
  "paidAt" TIMESTAMP(3),
  "totalAmountPence" INTEGER NOT NULL DEFAULT 0,
  "originalFileNameEnc" TEXT NOT NULL,
  "fileMimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "fileSizeBytes" INTEGER NOT NULL,
  "pdfBytesEnc" TEXT NOT NULL,
  "extractedTextEnc" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SchoolFeeInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolFeeInvoiceLineItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "descriptionEnc" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitAmountPence" INTEGER NOT NULL,
  "totalAmountPence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolFeeInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolFeeInvoice_invoiceNumber_key" ON "SchoolFeeInvoice"("invoiceNumber");
CREATE INDEX "SchoolFeeInvoice_studentId_status_dueOn_idx" ON "SchoolFeeInvoice"("studentId", "status", "dueOn");
CREATE INDEX "SchoolFeeInvoice_status_dueOn_idx" ON "SchoolFeeInvoice"("status", "dueOn");
CREATE INDEX "SchoolFeeInvoice_createdById_createdAt_idx" ON "SchoolFeeInvoice"("createdById", "createdAt");
CREATE UNIQUE INDEX "SchoolFeeInvoiceLineItem_invoiceId_position_key" ON "SchoolFeeInvoiceLineItem"("invoiceId", "position");
CREATE INDEX "SchoolFeeInvoiceLineItem_invoiceId_idx" ON "SchoolFeeInvoiceLineItem"("invoiceId");

ALTER TABLE "SchoolFeeInvoice"
  ADD CONSTRAINT "SchoolFeeInvoice_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolFeeInvoice"
  ADD CONSTRAINT "SchoolFeeInvoice_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolFeeInvoiceLineItem"
  ADD CONSTRAINT "SchoolFeeInvoiceLineItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SchoolFeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolFeeInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoice" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceLineItem" FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_staff_select ON "SchoolFeeInvoice"
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

CREATE POLICY invoice_parent_own_child_select ON "SchoolFeeInvoice"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND "status" <> 'Draft'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "SchoolFeeInvoice"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_staff_insert ON "SchoolFeeInvoice"
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

CREATE POLICY invoice_staff_update ON "SchoolFeeInvoice"
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

CREATE POLICY invoice_staff_delete ON "SchoolFeeInvoice"
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

CREATE POLICY invoice_line_accessible_select ON "SchoolFeeInvoiceLineItem"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "SchoolFeeInvoice" i
      WHERE i."id" = "SchoolFeeInvoiceLineItem"."invoiceId"
    )
  );

CREATE POLICY invoice_line_staff_insert ON "SchoolFeeInvoiceLineItem"
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

CREATE POLICY invoice_line_staff_update ON "SchoolFeeInvoiceLineItem"
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

CREATE POLICY invoice_line_staff_delete ON "SchoolFeeInvoiceLineItem"
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
