-- Row-Level Security policies.
-- Applied manually via `prisma migrate dev --create-only` + edit; documented here
-- as the source of truth. See docs/ADRs/003-sensitive-visibility-enforcement.md.
--
-- The app connects to Postgres as a non-superuser role `oasis_app` which has RLS
-- enforced (not BYPASSRLS). Session variables set per-request by the tRPC layer:
--   SET app.user_id = '<cuid>';
--   SET app.user_role = 'Head' | 'Principal' | ...;
--   SET app.full_admin = 'true' | 'false';

ALTER TABLE "StudentPortalSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentPortalSettings" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_portal_settings_full_admin_all ON "StudentPortalSettings";
DROP POLICY IF EXISTS student_portal_settings_parent_select ON "StudentPortalSettings";
DROP POLICY IF EXISTS student_portal_settings_student_self_select ON "StudentPortalSettings";
DROP POLICY IF EXISTS student_portal_settings_parent_insert ON "StudentPortalSettings";
DROP POLICY IF EXISTS student_portal_settings_parent_update ON "StudentPortalSettings";

CREATE POLICY student_portal_settings_full_admin_all ON "StudentPortalSettings"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY student_portal_settings_parent_select ON "StudentPortalSettings"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_student_self_select ON "StudentPortalSettings"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "StudentPortalSettings"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_parent_insert ON "StudentPortalSettings"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY student_portal_settings_parent_update ON "StudentPortalSettings"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "StudentPortalSettings"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

ALTER TABLE "BehaviourEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BehaviourEntry" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS behaviour_full_admin_select ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_supervisor_general ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_parent_own_child ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_guardian_own_child ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_clubs_lead_assigned_select ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_student_self ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_write ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_clubs_lead_assigned_insert ON "BehaviourEntry";
DROP POLICY IF EXISTS behaviour_full_admin_update ON "BehaviourEntry";

-- Full admins see everything.
CREATE POLICY behaviour_full_admin_select ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    AND "deletedAt" IS NULL
  );

-- Supervisors/ClubsAdmin see General entries and Sensitive demerits or General marks they recorded.
CREATE POLICY behaviour_supervisor_general ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN ('Supervisor', 'ClubsAdmin')
    AND "deletedAt" IS NULL
    AND (
      "visibility" = 'General'
      OR (
        "visibility" = 'Sensitive'
        AND "type" IN ('Demerit', 'General')
        AND "recordedById" = current_setting('app.user_id', true)
      )
    )
  );

-- Guardian-linked users see General entries only for their own children.
CREATE POLICY behaviour_guardian_own_child ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor',
      'Parent'
    )
    AND "deletedAt" IS NULL
    AND "visibility" = 'General'
    AND EXISTS (
      SELECT 1 FROM "Guardian" g
      WHERE g."studentId" = "BehaviourEntry"."studentId"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

-- ClubsLead users see General entries only for active students in clubs they lead.
CREATE POLICY behaviour_clubs_lead_assigned_select ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'ClubsLead'
    AND "deletedAt" IS NULL
    AND "visibility" = 'General'
    AND EXISTS (
      SELECT 1
      FROM "ClubLeadAssignment" cla
      JOIN "Club" c ON c."id" = cla."clubId"
      JOIN "ClubSignup" cs ON cs."clubId" = cla."clubId"
      JOIN "Student" s ON s."id" = cs."studentId"
      WHERE cla."userId" = current_setting('app.user_id', true)
        AND c."active" = true
        AND cs."status" = 'Active'
        AND s."active" = true
        AND cs."studentId" = "BehaviourEntry"."studentId"
    )
  );

-- Students see General entries only about themselves.
CREATE POLICY behaviour_student_self ON "BehaviourEntry"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Student'
    AND "deletedAt" IS NULL
    AND "visibility" = 'General'
    AND EXISTS (
      SELECT 1 FROM "Student" s
      WHERE s."id" = "BehaviourEntry"."studentId"
        AND s."userId" = current_setting('app.user_id', true)
    )
  );

-- Writes require full-admin OR Supervisor/ClubsAdmin. Sensitive operational writes are
-- limited to authors recording their own Sensitive demerit or General mark.
CREATE POLICY behaviour_write ON "BehaviourEntry"
  FOR INSERT
  WITH CHECK (
    (
      "visibility" = 'General'
      AND (
        current_setting('app.full_admin', true) = 'true'
        OR current_setting('app.user_role', true) IN ('Supervisor', 'ClubsAdmin')
      )
    )
    OR current_setting('app.full_admin', true) = 'true'
    OR (
      current_setting('app.user_role', true) IN ('Supervisor', 'ClubsAdmin')
      AND "visibility" = 'Sensitive'
      AND "type" IN ('Demerit', 'General')
      AND "recordedById" = current_setting('app.user_id', true)
    )
  );

-- ClubsLead users can create General entries only for students in active assigned clubs.
CREATE POLICY behaviour_clubs_lead_assigned_insert ON "BehaviourEntry"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) = 'ClubsLead'
    AND "recordedById" = current_setting('app.user_id', true)
    AND "visibility" = 'General'
    AND EXISTS (
      SELECT 1
      FROM "ClubLeadAssignment" cla
      JOIN "Club" c ON c."id" = cla."clubId"
      JOIN "ClubSignup" cs ON cs."clubId" = cla."clubId"
      JOIN "Student" s ON s."id" = cs."studentId"
      WHERE cla."userId" = current_setting('app.user_id', true)
        AND c."active" = true
        AND cs."status" = 'Active'
        AND s."active" = true
        AND cs."studentId" = "BehaviourEntry"."studentId"
    )
  );

-- Corrections and soft deletes are Head/full-admin only.
CREATE POLICY behaviour_full_admin_update ON "BehaviourEntry"
  FOR UPDATE
  USING (
    current_setting('app.full_admin', true) = 'true'
    AND "deletedAt" IS NULL
  )
  WITH CHECK (
    current_setting('app.full_admin', true) = 'true'
  );

ALTER TABLE "SchoolFeeInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoice" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceLineItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeYearFeeConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeYearFeeConfig" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceStudent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceStudent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceDiscount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolFeeInvoiceDiscount" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_staff_select ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_parent_own_child_select ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_staff_insert ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_staff_update ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_staff_delete ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_parent_payment_update ON "SchoolFeeInvoice";
DROP POLICY IF EXISTS invoice_line_accessible_select ON "SchoolFeeInvoiceLineItem";
DROP POLICY IF EXISTS invoice_line_staff_insert ON "SchoolFeeInvoiceLineItem";
DROP POLICY IF EXISTS invoice_line_staff_update ON "SchoolFeeInvoiceLineItem";
DROP POLICY IF EXISTS invoice_line_staff_delete ON "SchoolFeeInvoiceLineItem";
DROP POLICY IF EXISTS invoice_fee_config_staff_select ON "SchoolFeeYearFeeConfig";
DROP POLICY IF EXISTS invoice_fee_config_parent_select ON "SchoolFeeYearFeeConfig";
DROP POLICY IF EXISTS invoice_fee_config_staff_insert ON "SchoolFeeYearFeeConfig";
DROP POLICY IF EXISTS invoice_fee_config_staff_update ON "SchoolFeeYearFeeConfig";
DROP POLICY IF EXISTS invoice_student_staff_select ON "SchoolFeeInvoiceStudent";
DROP POLICY IF EXISTS invoice_student_parent_select ON "SchoolFeeInvoiceStudent";
DROP POLICY IF EXISTS invoice_student_staff_insert ON "SchoolFeeInvoiceStudent";
DROP POLICY IF EXISTS invoice_student_staff_delete ON "SchoolFeeInvoiceStudent";
DROP POLICY IF EXISTS invoice_discount_staff_select ON "SchoolFeeInvoiceDiscount";
DROP POLICY IF EXISTS invoice_discount_parent_select ON "SchoolFeeInvoiceDiscount";
DROP POLICY IF EXISTS invoice_discount_staff_insert ON "SchoolFeeInvoiceDiscount";
DROP POLICY IF EXISTS invoice_discount_staff_update ON "SchoolFeeInvoiceDiscount";
DROP POLICY IF EXISTS invoice_discount_parent_update ON "SchoolFeeInvoiceDiscount";
DROP POLICY IF EXISTS invoice_discount_staff_delete ON "SchoolFeeInvoiceDiscount";

-- API RBAC applies the stricter finance-admin tag check before these policies.
-- RLS remains a second boundary between staff, parents, students, and anonymous sessions.
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

CREATE POLICY invoice_fee_config_parent_select ON "SchoolFeeYearFeeConfig"
  FOR SELECT
  USING (current_setting('app.user_role', true) = 'Parent');

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

ALTER TABLE "PermissionSlip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlip" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipRecipient" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipBringItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipBringItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipQuestion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PermissionSlipAnswer" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permission_slip_manager_select ON "PermissionSlip";
DROP POLICY IF EXISTS permission_slip_parent_select ON "PermissionSlip";
DROP POLICY IF EXISTS permission_slip_manager_insert ON "PermissionSlip";
DROP POLICY IF EXISTS permission_slip_manager_update ON "PermissionSlip";
DROP POLICY IF EXISTS permission_slip_manager_delete ON "PermissionSlip";
DROP POLICY IF EXISTS permission_slip_recipient_manager_select ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_parent_select ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_manager_insert ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_manager_update ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_parent_response_update ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_parent_payment_update ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_recipient_manager_delete ON "PermissionSlipRecipient";
DROP POLICY IF EXISTS permission_slip_bring_item_accessible_select ON "PermissionSlipBringItem";
DROP POLICY IF EXISTS permission_slip_bring_item_manager_insert ON "PermissionSlipBringItem";
DROP POLICY IF EXISTS permission_slip_bring_item_manager_update ON "PermissionSlipBringItem";
DROP POLICY IF EXISTS permission_slip_bring_item_manager_delete ON "PermissionSlipBringItem";
DROP POLICY IF EXISTS permission_slip_question_accessible_select ON "PermissionSlipQuestion";
DROP POLICY IF EXISTS permission_slip_question_manager_insert ON "PermissionSlipQuestion";
DROP POLICY IF EXISTS permission_slip_question_manager_update ON "PermissionSlipQuestion";
DROP POLICY IF EXISTS permission_slip_question_manager_delete ON "PermissionSlipQuestion";
DROP POLICY IF EXISTS permission_slip_answer_accessible_select ON "PermissionSlipAnswer";
DROP POLICY IF EXISTS permission_slip_answer_parent_insert ON "PermissionSlipAnswer";
DROP POLICY IF EXISTS permission_slip_answer_manager_insert ON "PermissionSlipAnswer";
DROP POLICY IF EXISTS permission_slip_answer_manager_update ON "PermissionSlipAnswer";
DROP POLICY IF EXISTS permission_slip_answer_manager_delete ON "PermissionSlipAnswer";

-- Permission slips are deliberately narrower than full-admin: only Head and Pastor
-- manage slips, physical signatures, and payment confirmations in this version.
CREATE POLICY permission_slip_manager_select ON "PermissionSlip"
  FOR SELECT
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_parent_select ON "PermissionSlip"
  FOR SELECT
  USING (
    "active" = true
    AND current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlipRecipient" psr
      JOIN "Guardian" g ON g."studentId" = psr."studentId"
      WHERE psr."slipId" = "PermissionSlip"."id"
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY permission_slip_manager_insert ON "PermissionSlip"
  FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_manager_update ON "PermissionSlip"
  FOR UPDATE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'))
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_manager_delete ON "PermissionSlip"
  FOR DELETE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_recipient_manager_select ON "PermissionSlipRecipient"
  FOR SELECT
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_recipient_parent_select ON "PermissionSlipRecipient"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipRecipient"."studentId"
      WHERE ps."id" = "PermissionSlipRecipient"."slipId"
        AND ps."active" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY permission_slip_recipient_manager_insert ON "PermissionSlipRecipient"
  FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_recipient_manager_update ON "PermissionSlipRecipient"
  FOR UPDATE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'))
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_recipient_parent_response_update ON "PermissionSlipRecipient"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Parent'
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
    current_setting('app.user_role', true) = 'Parent'
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
    current_setting('app.user_role', true) = 'Parent'
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
    current_setting('app.user_role', true) = 'Parent'
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

CREATE POLICY permission_slip_recipient_manager_delete ON "PermissionSlipRecipient"
  FOR DELETE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_bring_item_accessible_select ON "PermissionSlipBringItem"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      WHERE ps."id" = "PermissionSlipBringItem"."slipId"
    )
  );

CREATE POLICY permission_slip_bring_item_manager_insert ON "PermissionSlipBringItem"
  FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_bring_item_manager_update ON "PermissionSlipBringItem"
  FOR UPDATE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'))
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_bring_item_manager_delete ON "PermissionSlipBringItem"
  FOR DELETE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_question_accessible_select ON "PermissionSlipQuestion"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      WHERE ps."id" = "PermissionSlipQuestion"."slipId"
    )
  );

CREATE POLICY permission_slip_question_manager_insert ON "PermissionSlipQuestion"
  FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_question_manager_update ON "PermissionSlipQuestion"
  FOR UPDATE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'))
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_question_manager_delete ON "PermissionSlipQuestion"
  FOR DELETE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_answer_accessible_select ON "PermissionSlipAnswer"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "PermissionSlipRecipient" psr
      WHERE psr."slipId" = "PermissionSlipAnswer"."slipId"
        AND psr."studentId" = "PermissionSlipAnswer"."studentId"
    )
  );

CREATE POLICY permission_slip_answer_parent_insert ON "PermissionSlipAnswer"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND EXISTS (
      SELECT 1
      FROM "PermissionSlip" ps
      JOIN "Guardian" g ON g."studentId" = "PermissionSlipAnswer"."studentId"
      WHERE ps."id" = "PermissionSlipAnswer"."slipId"
        AND ps."active" = true
        AND g."userId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY permission_slip_answer_manager_insert ON "PermissionSlipAnswer"
  FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_answer_manager_update ON "PermissionSlipAnswer"
  FOR UPDATE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'))
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

CREATE POLICY permission_slip_answer_manager_delete ON "PermissionSlipAnswer"
  FOR DELETE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor'));

ALTER TABLE "IncidentReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReport" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportStudent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportStudent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportStaff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportStaff" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportAttachment" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportParentCopy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportParentCopy" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportParentRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportParentRecipient" FORCE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReportEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incident_staff_select ON "IncidentReport";
DROP POLICY IF EXISTS incident_staff_insert ON "IncidentReport";
DROP POLICY IF EXISTS incident_staff_update ON "IncidentReport";
DROP POLICY IF EXISTS incident_staff_delete ON "IncidentReport";
DROP POLICY IF EXISTS incident_report_student_staff_select ON "IncidentReportStudent";
DROP POLICY IF EXISTS incident_report_student_staff_write ON "IncidentReportStudent";
DROP POLICY IF EXISTS incident_report_staff_staff_select ON "IncidentReportStaff";
DROP POLICY IF EXISTS incident_report_staff_staff_write ON "IncidentReportStaff";
DROP POLICY IF EXISTS incident_attachment_staff_select ON "IncidentReportAttachment";
DROP POLICY IF EXISTS incident_attachment_staff_write ON "IncidentReportAttachment";
DROP POLICY IF EXISTS incident_parent_copy_staff_select ON "IncidentReportParentCopy";
DROP POLICY IF EXISTS incident_parent_copy_parent_select ON "IncidentReportParentCopy";
DROP POLICY IF EXISTS incident_parent_copy_staff_write ON "IncidentReportParentCopy";
DROP POLICY IF EXISTS incident_parent_recipient_staff_select ON "IncidentReportParentRecipient";
DROP POLICY IF EXISTS incident_parent_recipient_parent_select ON "IncidentReportParentRecipient";
DROP POLICY IF EXISTS incident_parent_recipient_staff_write ON "IncidentReportParentRecipient";
DROP POLICY IF EXISTS incident_parent_recipient_parent_ack_update ON "IncidentReportParentRecipient";
DROP POLICY IF EXISTS incident_event_staff_select ON "IncidentReportEvent";
DROP POLICY IF EXISTS incident_event_staff_insert ON "IncidentReportEvent";

CREATE POLICY incident_staff_select ON "IncidentReport"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
    OR (
      current_setting('app.user_role', true) = 'Parent'
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

CREATE POLICY incident_staff_insert ON "IncidentReport"
  FOR INSERT
  WITH CHECK (
    "recordedById" = current_setting('app.user_id', true)
    AND (
      current_setting('app.full_admin', true) = 'true'
      OR current_setting('app.user_role', true) = 'Supervisor'
    )
  );

CREATE POLICY incident_staff_update ON "IncidentReport"
  FOR UPDATE
  USING (
    (
      current_setting('app.full_admin', true) = 'true'
      AND "status" <> 'Draft'
    )
    OR (
      "recordedById" = current_setting('app.user_id', true)
      AND "status" = 'Draft'
      AND (
        current_setting('app.full_admin', true) = 'true'
        OR current_setting('app.user_role', true) = 'Supervisor'
      )
    )
  )
  WITH CHECK (
    (
      current_setting('app.full_admin', true) = 'true'
      AND "status" <> 'Draft'
    )
    OR (
      "recordedById" = current_setting('app.user_id', true)
      AND "status" IN ('Draft', 'HeadReview')
      AND (
        current_setting('app.full_admin', true) = 'true'
        OR current_setting('app.user_role', true) = 'Supervisor'
      )
    )
  );

CREATE POLICY incident_staff_delete ON "IncidentReport"
  FOR DELETE
  USING (
    "recordedById" = current_setting('app.user_id', true)
    AND "status" = 'Draft'
    AND (
      current_setting('app.full_admin', true) = 'true'
      OR current_setting('app.user_role', true) = 'Supervisor'
    )
  );

CREATE POLICY incident_report_student_staff_select ON "IncidentReportStudent"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
  );

CREATE POLICY incident_report_student_staff_write ON "IncidentReportStudent"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "IncidentReport" ir
      WHERE ir."id" = "IncidentReportStudent"."reportId"
        AND ir."recordedById" = current_setting('app.user_id', true)
        AND ir."status" = 'Draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "IncidentReport" ir
      WHERE ir."id" = "IncidentReportStudent"."reportId"
        AND ir."recordedById" = current_setting('app.user_id', true)
        AND ir."status" = 'Draft'
    )
  );

CREATE POLICY incident_report_staff_staff_select ON "IncidentReportStaff"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
  );

CREATE POLICY incident_report_staff_staff_write ON "IncidentReportStaff"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "IncidentReport" ir
      WHERE ir."id" = "IncidentReportStaff"."reportId"
        AND ir."recordedById" = current_setting('app.user_id', true)
        AND ir."status" = 'Draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "IncidentReport" ir
      WHERE ir."id" = "IncidentReportStaff"."reportId"
        AND ir."recordedById" = current_setting('app.user_id', true)
        AND ir."status" = 'Draft'
    )
  );

CREATE POLICY incident_attachment_staff_select ON "IncidentReportAttachment"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
  );

CREATE POLICY incident_attachment_staff_write ON "IncidentReportAttachment"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "IncidentReport" ir
      WHERE ir."id" = "IncidentReportAttachment"."reportId"
        AND ir."recordedById" = current_setting('app.user_id', true)
        AND ir."status" = 'Draft'
    )
  )
  WITH CHECK (
    "uploadedById" = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1 FROM "IncidentReport" ir
      WHERE ir."id" = "IncidentReportAttachment"."reportId"
        AND ir."recordedById" = current_setting('app.user_id', true)
        AND ir."status" = 'Draft'
    )
  );

CREATE POLICY incident_parent_copy_staff_select ON "IncidentReportParentCopy"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
  );

CREATE POLICY incident_parent_copy_parent_select ON "IncidentReportParentCopy"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
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

CREATE POLICY incident_parent_copy_staff_write ON "IncidentReportParentCopy"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY incident_parent_recipient_staff_select ON "IncidentReportParentRecipient"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
  );

CREATE POLICY incident_parent_recipient_parent_select ON "IncidentReportParentRecipient"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
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

CREATE POLICY incident_parent_recipient_staff_write ON "IncidentReportParentRecipient"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY incident_parent_recipient_parent_ack_update ON "IncidentReportParentRecipient"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) IN (
      'Parent',
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

CREATE POLICY incident_event_staff_select ON "IncidentReportEvent"
  FOR SELECT
  USING (
    current_setting('app.full_admin', true) = 'true'
    OR current_setting('app.user_role', true) = 'Supervisor'
  );

CREATE POLICY incident_event_staff_insert ON "IncidentReportEvent"
  FOR INSERT
  WITH CHECK (
    "actorId" IS NULL
    OR "actorId" = current_setting('app.user_id', true)
    OR current_setting('app.full_admin', true) = 'true'
  );
