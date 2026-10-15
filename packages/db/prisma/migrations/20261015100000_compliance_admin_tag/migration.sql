-- Compliance Admin is a transaction-local capability derived from the authenticated user.
DROP POLICY IF EXISTS compliance_admin_adultcompliance_select ON "AdultCompliance";
CREATE POLICY compliance_admin_adultcompliance_select ON "AdultCompliance" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_adultcompliance_insert ON "AdultCompliance";
CREATE POLICY compliance_admin_adultcompliance_insert ON "AdultCompliance" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_adultcompliance_update ON "AdultCompliance";
CREATE POLICY compliance_admin_adultcompliance_update ON "AdultCompliance" FOR UPDATE USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreement_select ON "UserAgreement";
CREATE POLICY compliance_admin_useragreement_select ON "UserAgreement" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreement_insert ON "UserAgreement";
CREATE POLICY compliance_admin_useragreement_insert ON "UserAgreement" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementversion_select ON "UserAgreementVersion";
CREATE POLICY compliance_admin_useragreementversion_select ON "UserAgreementVersion" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementversion_insert ON "UserAgreementVersion";
CREATE POLICY compliance_admin_useragreementversion_insert ON "UserAgreementVersion" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementrequest_select ON "UserAgreementRequest";
CREATE POLICY compliance_admin_useragreementrequest_select ON "UserAgreementRequest" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementrequest_insert ON "UserAgreementRequest";
CREATE POLICY compliance_admin_useragreementrequest_insert ON "UserAgreementRequest" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementrequest_update ON "UserAgreementRequest";
CREATE POLICY compliance_admin_useragreementrequest_update ON "UserAgreementRequest" FOR UPDATE USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementsignature_select ON "UserAgreementSignature";
CREATE POLICY compliance_admin_useragreementsignature_select ON "UserAgreementSignature" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementsignature_insert ON "UserAgreementSignature";
CREATE POLICY compliance_admin_useragreementsignature_insert ON "UserAgreementSignature" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true' AND "method" = 'HeadRecorded' AND "signedById" = current_setting('app.user_id', true));
DROP POLICY IF EXISTS compliance_admin_useragreementdelivery_select ON "UserAgreementDelivery";
CREATE POLICY compliance_admin_useragreementdelivery_select ON "UserAgreementDelivery" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementdelivery_insert ON "UserAgreementDelivery";
CREATE POLICY compliance_admin_useragreementdelivery_insert ON "UserAgreementDelivery" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_useragreementdelivery_update ON "UserAgreementDelivery";
CREATE POLICY compliance_admin_useragreementdelivery_update ON "UserAgreementDelivery" FOR UPDATE USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreport_select ON "IncidentReport";
CREATE POLICY compliance_admin_incidentreport_select ON "IncidentReport" FOR SELECT
  USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreport_insert ON "IncidentReport";
CREATE POLICY compliance_admin_incidentreport_insert ON "IncidentReport" FOR INSERT
  WITH CHECK (current_setting('app.compliance_admin', true) = 'true'
    AND "recordedById" = current_setting('app.user_id', true));
DROP POLICY IF EXISTS compliance_admin_incidentreport_update ON "IncidentReport";
CREATE POLICY compliance_admin_incidentreport_update ON "IncidentReport" FOR UPDATE
  USING (current_setting('app.compliance_admin', true) = 'true')
  WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreport_delete ON "IncidentReport";
CREATE POLICY compliance_admin_incidentreport_delete ON "IncidentReport" FOR DELETE
  USING (current_setting('app.compliance_admin', true) = 'true' AND "status" = 'Draft');
DROP POLICY IF EXISTS compliance_admin_incidentreportstudent_all ON "IncidentReportStudent";
CREATE POLICY compliance_admin_incidentreportstudent_all ON "IncidentReportStudent" FOR ALL USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportstaff_all ON "IncidentReportStaff";
CREATE POLICY compliance_admin_incidentreportstaff_all ON "IncidentReportStaff" FOR ALL USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportattachment_select ON "IncidentReportAttachment";
CREATE POLICY compliance_admin_incidentreportattachment_select ON "IncidentReportAttachment" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportattachment_insert ON "IncidentReportAttachment";
CREATE POLICY compliance_admin_incidentreportattachment_insert ON "IncidentReportAttachment" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true' AND "uploadedById" = current_setting('app.user_id', true));
DROP POLICY IF EXISTS compliance_admin_incidentreportattachment_update ON "IncidentReportAttachment";
CREATE POLICY compliance_admin_incidentreportattachment_update ON "IncidentReportAttachment" FOR UPDATE USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportattachment_delete ON "IncidentReportAttachment";
CREATE POLICY compliance_admin_incidentreportattachment_delete ON "IncidentReportAttachment" FOR DELETE USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportparentcopy_select ON "IncidentReportParentCopy";
CREATE POLICY compliance_admin_incidentreportparentcopy_select ON "IncidentReportParentCopy" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportparentcopy_insert ON "IncidentReportParentCopy";
CREATE POLICY compliance_admin_incidentreportparentcopy_insert ON "IncidentReportParentCopy" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportparentcopy_update ON "IncidentReportParentCopy";
CREATE POLICY compliance_admin_incidentreportparentcopy_update ON "IncidentReportParentCopy" FOR UPDATE USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportparentrecipient_select ON "IncidentReportParentRecipient";
CREATE POLICY compliance_admin_incidentreportparentrecipient_select ON "IncidentReportParentRecipient" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportparentrecipient_insert ON "IncidentReportParentRecipient";
CREATE POLICY compliance_admin_incidentreportparentrecipient_insert ON "IncidentReportParentRecipient" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportparentrecipient_update ON "IncidentReportParentRecipient";
CREATE POLICY compliance_admin_incidentreportparentrecipient_update ON "IncidentReportParentRecipient" FOR UPDATE USING (current_setting('app.compliance_admin', true) = 'true') WITH CHECK (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportevent_select ON "IncidentReportEvent";
CREATE POLICY compliance_admin_incidentreportevent_select ON "IncidentReportEvent" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentreportevent_insert ON "IncidentReportEvent";
CREATE POLICY compliance_admin_incidentreportevent_insert ON "IncidentReportEvent" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true' AND ("actorId" IS NULL OR "actorId" = current_setting('app.user_id', true)));
DROP POLICY IF EXISTS compliance_admin_incidentsafeguardingnote_select ON "IncidentSafeguardingNote";
CREATE POLICY compliance_admin_incidentsafeguardingnote_select ON "IncidentSafeguardingNote" FOR SELECT USING (current_setting('app.compliance_admin', true) = 'true');
DROP POLICY IF EXISTS compliance_admin_incidentsafeguardingnote_insert ON "IncidentSafeguardingNote";
CREATE POLICY compliance_admin_incidentsafeguardingnote_insert ON "IncidentSafeguardingNote" FOR INSERT WITH CHECK (current_setting('app.compliance_admin', true) = 'true' AND "authorId" = current_setting('app.user_id', true));
