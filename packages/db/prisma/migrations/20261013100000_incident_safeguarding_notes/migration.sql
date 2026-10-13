CREATE TABLE "IncidentSafeguardingNote" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "bodyEnc" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentSafeguardingNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IncidentSafeguardingNote_reportId_createdAt_idx"
  ON "IncidentSafeguardingNote"("reportId", "createdAt");

ALTER TABLE "IncidentSafeguardingNote" ADD CONSTRAINT "IncidentSafeguardingNote_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentSafeguardingNote" ADD CONSTRAINT "IncidentSafeguardingNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncidentSafeguardingNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentSafeguardingNote" FORCE ROW LEVEL SECURITY;

CREATE POLICY incident_safeguarding_note_select ON "IncidentSafeguardingNote"
  FOR SELECT
  USING (current_setting('app.user_role', true) IN ('Head', 'SafeguardingLead'));

CREATE POLICY incident_safeguarding_note_insert ON "IncidentSafeguardingNote"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) = 'SafeguardingLead'
    AND "authorId" = current_setting('app.user_id', true)
  );
