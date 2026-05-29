DROP POLICY IF EXISTS incident_parent_copy_parent_select ON "IncidentReportParentCopy";
DROP POLICY IF EXISTS incident_parent_recipient_parent_select ON "IncidentReportParentRecipient";
DROP POLICY IF EXISTS incident_parent_recipient_parent_ack_update ON "IncidentReportParentRecipient";

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
