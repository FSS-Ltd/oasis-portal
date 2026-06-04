DROP POLICY IF EXISTS invoice_parent_own_child_select ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_parent_payment_update ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_fee_config_parent_select ON "SchoolFeeYearFeeConfig";
DROP POLICY IF EXISTS invoice_student_parent_select ON "SchoolFeeInvoiceStudent";
DROP POLICY IF EXISTS invoice_discount_parent_select ON "SchoolFeeInvoiceDiscount";
DROP POLICY IF EXISTS invoice_discount_parent_update ON "SchoolFeeInvoiceDiscount";
DROP POLICY IF EXISTS permission_slip_parent_select ON "PermissionSlip";
DROP POLICY IF EXISTS permission_slip_recipient_parent_select ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_parent_response_update ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_parent_payment_update ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_answer_parent_insert ON "PermissionSlipAnswer";
DROP POLICY IF EXISTS incident_staff_select ON "IncidentReport";
DROP POLICY IF EXISTS incident_parent_copy_parent_select ON "IncidentReportParentCopy";
DROP POLICY IF EXISTS incident_parent_recipient_parent_select ON "IncidentReportParentRecipient";
DROP POLICY IF EXISTS incident_parent_recipient_parent_ack_update ON "IncidentReportParentRecipient";

CREATE POLICY invoice_parent_own_child_select ON "SchoolFeeInvoice"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
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
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
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
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "status"::text IN ('Unpaid', 'PaymentPending')
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoiceStudent" link
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE link."invoiceId" = "SchoolFeeInvoice"."id"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_fee_config_parent_select ON "SchoolFeeYearFeeConfig"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
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
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "SchoolFeeInvoiceStudent"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_discount_parent_select ON "SchoolFeeInvoiceDiscount"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1
      FROM "SchoolFeeInvoiceStudent" link
      JOIN "Guardian" g ON g."studentId" = link."studentId"
      WHERE link."invoiceId" = "SchoolFeeInvoiceDiscount"."invoiceId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY invoice_discount_parent_update ON "SchoolFeeInvoiceDiscount"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
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
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
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

CREATE POLICY permission_slip_parent_select ON "PermissionSlip"
  FOR SELECT
  USING (
    "active" = true
    AND current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlipRecipient" psr
      JOIN "Guardian" g ON g."studentId" = psr."studentId"
      WHERE psr."slipId" = "PermissionSlip"."id"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY permission_slip_recipient_parent_select ON "PermissionSlipRecipient"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipRecipient"."studentId"
      WHERE ps."id" = "PermissionSlipRecipient"."slipId"
        AND ps."active" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY permission_slip_recipient_parent_response_update ON "PermissionSlipRecipient"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "responseStatus" = 'Pending'
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipRecipient"."studentId"
      WHERE ps."id" = "PermissionSlipRecipient"."slipId"
        AND ps."active" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "responseStatus" IN ('Signed', 'Declined')
    AND "paymentStatus" IN ('NotRequired', 'Unpaid')
    AND (
      ("responseStatus" = 'Signed' AND "signatureSource" = 'ParentPortal')
      OR ("responseStatus" = 'Declined' AND "signatureSource" IS NULL)
    )
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipRecipient"."studentId"
      WHERE ps."id" = "PermissionSlipRecipient"."slipId"
        AND ps."active" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY permission_slip_recipient_parent_payment_update ON "PermissionSlipRecipient"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "responseStatus" = 'Signed'
    AND "paymentStatus" = 'Unpaid'
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipRecipient"."studentId"
      WHERE ps."id" = "PermissionSlipRecipient"."slipId"
        AND ps."active" = true
        AND ps."requirePayment" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "responseStatus" = 'Signed'
    AND "paymentStatus" = 'PaymentPending'
    AND ("signatureSource" IS NULL OR "signatureSource" IN ('ParentPortal', 'Physical'))
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipRecipient"."studentId"
      WHERE ps."id" = "PermissionSlipRecipient"."slipId"
        AND ps."active" = true
        AND ps."requirePayment" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY permission_slip_answer_parent_insert ON "PermissionSlipAnswer"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipAnswer"."studentId"
      WHERE ps."id" = "PermissionSlipAnswer"."slipId"
        AND ps."active" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY incident_staff_select ON "IncidentReport"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
    OR (
      current_setting('app.user_role', true) IN (
        'Parent',
        'Head',
        'Principal',
        'Pastor',
        'HeadOfDiscipline',
        'TechnicalSupport',
        'ClubsAdmin',
        'Supervisor'
      )
      AND EXISTS (
        SELECT 1
        FROM "IncidentReportParentCopy" ipc
        JOIN "Guardian" g ON g."studentId" = ipc."studentId"
        WHERE ipc."reportId" = "IncidentReport"."id"
          AND ipc."status" = 'Shared'
          AND g."userId" = current_setting('app.user_id', true)
      )
    )
  );

CREATE POLICY incident_parent_copy_parent_select ON "IncidentReportParentCopy"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "status" = 'Shared'
    AND EXISTS (
      SELECT 1
      FROM "Guardian" g
      WHERE g."studentId" = "IncidentReportParentCopy"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY incident_parent_recipient_parent_select ON "IncidentReportParentRecipient"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "guardianId" = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1
      FROM "IncidentReportParentCopy" ipc
      JOIN "Guardian" g ON g."studentId" = ipc."studentId"
      WHERE ipc."id" = "IncidentReportParentRecipient"."copyId"
        AND ipc."status" = 'Shared'
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY incident_parent_recipient_parent_ack_update ON "IncidentReportParentRecipient"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "guardianId" = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1
      FROM "IncidentReportParentCopy" ipc
      JOIN "Guardian" g ON g."studentId" = ipc."studentId"
      WHERE ipc."id" = "IncidentReportParentRecipient"."copyId"
        AND ipc."status" = 'Shared'
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND "guardianId" = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1
      FROM "IncidentReportParentCopy" ipc
      JOIN "Guardian" g ON g."studentId" = ipc."studentId"
      WHERE ipc."id" = "IncidentReportParentRecipient"."copyId"
        AND ipc."status" = 'Shared'
        AND g."userId" = current_setting('app.user_id', true)
    )
  );
