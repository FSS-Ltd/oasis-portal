ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SafeguardingLead';

CREATE TYPE "DbsApplicationType" AS ENUM ('Basic', 'Standard', 'Enhanced');
CREATE TYPE "DbsCertificateStatus" AS ENUM ('AwaitingCertificate', 'RecordedCurrent', 'NoLongerCurrent');

CREATE TABLE "AdultCompliance" (
  "userId" TEXT NOT NULL,
  "dbsCertificateNumberEnc" TEXT,
  "dbsApplicationReferenceEnc" TEXT,
  "dbsCompletedAt" DATE,
  "dbsIssueDate" DATE,
  "dbsApplicationType" "DbsApplicationType",
  "dbsStatus" "DbsCertificateStatus" NOT NULL DEFAULT 'AwaitingCertificate',
  "firstAidCompletedAt" DATE,
  "firstAidLevel" TEXT,
  "safeguardingCompletedAt" DATE,
  "safeguardingLevel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdultCompliance_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "AdultCompliance" ADD CONSTRAINT "AdultCompliance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdultCompliance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdultCompliance" FORCE ROW LEVEL SECURITY;

CREATE POLICY adult_compliance_staff_select ON "AdultCompliance" FOR SELECT
  USING (current_setting('app.user_role', true) IN (
    'Head', 'Pastor', 'SafeguardingLead', 'Principal', 'HeadOfDiscipline',
    'TechnicalSupport', 'ClubsAdmin', 'ClubsLead', 'Supervisor'
  ));

CREATE POLICY adult_compliance_manager_insert ON "AdultCompliance" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor', 'SafeguardingLead'));

CREATE POLICY adult_compliance_manager_update ON "AdultCompliance" FOR UPDATE
  USING (current_setting('app.user_role', true) IN ('Head', 'Pastor', 'SafeguardingLead'))
  WITH CHECK (current_setting('app.user_role', true) IN ('Head', 'Pastor', 'SafeguardingLead'));
