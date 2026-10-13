CREATE TYPE "UserAgreementKind" AS ENUM ('UserAgreement', 'SafeguardingDataAnnex');
CREATE TYPE "UserAgreementStatus" AS ENUM ('NeedsSigning', 'Signed', 'Superseded');
CREATE TYPE "UserAgreementSignatureMethod" AS ENUM ('Portal', 'HeadRecorded');
CREATE TYPE "UserAgreementEmailStatus" AS ENUM ('Queued', 'Sent', 'Failed', 'MissingEmail', 'NeedsReview');

CREATE TABLE "UserAgreement" (
  "id" TEXT NOT NULL,
  "titleEnc" TEXT NOT NULL,
  "kind" "UserAgreementKind" NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAgreement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserAgreement_kind_createdAt_idx" ON "UserAgreement"("kind", "createdAt");
ALTER TABLE "UserAgreement" ADD CONSTRAINT "UserAgreement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserAgreementVersion" (
  "id" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "originalFileNameEnc" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAgreementVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAgreementVersion_storagePath_key" ON "UserAgreementVersion"("storagePath");
CREATE UNIQUE INDEX "UserAgreementVersion_agreementId_version_key" ON "UserAgreementVersion"("agreementId", "version");
ALTER TABLE "UserAgreementVersion" ADD CONSTRAINT "UserAgreementVersion_agreementId_fkey"
  FOREIGN KEY ("agreementId") REFERENCES "UserAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserAgreementRequest" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "status" "UserAgreementStatus" NOT NULL DEFAULT 'NeedsSigning',
  "openedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAgreementRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserAgreementRequest_recipientId_status_createdAt_idx" ON "UserAgreementRequest"("recipientId", "status", "createdAt");
CREATE INDEX "UserAgreementRequest_versionId_recipientId_idx" ON "UserAgreementRequest"("versionId", "recipientId");
ALTER TABLE "UserAgreementRequest" ADD CONSTRAINT "UserAgreementRequest_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "UserAgreementVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserAgreementRequest" ADD CONSTRAINT "UserAgreementRequest_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserAgreementSignature" (
  "id" UUID NOT NULL,
  "requestId" TEXT NOT NULL,
  "method" "UserAgreementSignatureMethod" NOT NULL,
  "signedById" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "declaredSignedOn" DATE,
  "manualSourcePath" TEXT,
  "completedStoragePath" TEXT NOT NULL,
  "completedSha256" TEXT NOT NULL,
  "evidenceEnc" TEXT NOT NULL,
  "seal" TEXT NOT NULL,
  "signingKeyId" TEXT NOT NULL,
  CONSTRAINT "UserAgreementSignature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAgreementSignature_requestId_key" ON "UserAgreementSignature"("requestId");
CREATE UNIQUE INDEX "UserAgreementSignature_completedStoragePath_key" ON "UserAgreementSignature"("completedStoragePath");
CREATE UNIQUE INDEX "UserAgreementSignature_manualSourcePath_key" ON "UserAgreementSignature"("manualSourcePath");
CREATE INDEX "UserAgreementSignature_signedById_signedAt_idx" ON "UserAgreementSignature"("signedById", "signedAt");
ALTER TABLE "UserAgreementSignature" ADD CONSTRAINT "UserAgreementSignature_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "UserAgreementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserAgreementSignature" ADD CONSTRAINT "UserAgreementSignature_signedById_fkey"
  FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserAgreementDelivery" (
  "requestId" TEXT NOT NULL,
  "status" "UserAgreementEmailStatus" NOT NULL DEFAULT 'Queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimUntil" TIMESTAMP(3),
  "emailMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAgreementDelivery_pkey" PRIMARY KEY ("requestId")
);
CREATE INDEX "UserAgreementDelivery_status_nextAttemptAt_idx" ON "UserAgreementDelivery"("status", "nextAttemptAt");
ALTER TABLE "UserAgreementDelivery" ADD CONSTRAINT "UserAgreementDelivery_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "UserAgreementRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX user_agreement_one_current_request
  ON "UserAgreementRequest"("recipientId", "versionId") WHERE "supersededAt" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('user-agreements', 'user-agreements', false, 26214400, ARRAY['application/pdf'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

ALTER TABLE "UserAgreement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementVersion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementRequest" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementSignature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementSignature" FORCE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAgreementDelivery" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agreement_read ON "UserAgreement";
DROP POLICY IF EXISTS agreement_head_write ON "UserAgreement";
CREATE POLICY agreement_read ON "UserAgreement" FOR SELECT USING (
  current_setting('app.user_role', true) = 'Head'
  OR EXISTS (SELECT 1 FROM "UserAgreementVersion" v JOIN "UserAgreementRequest" r ON r."versionId" = v.id
    WHERE v."agreementId" = "UserAgreement"."id" AND r."recipientId" = current_setting('app.user_id', true))
);
CREATE POLICY agreement_head_write ON "UserAgreement" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) = 'Head');

DROP POLICY IF EXISTS agreement_version_read ON "UserAgreementVersion";
DROP POLICY IF EXISTS agreement_version_head_write ON "UserAgreementVersion";
CREATE POLICY agreement_version_read ON "UserAgreementVersion" FOR SELECT USING (
  current_setting('app.user_role', true) = 'Head'
  OR EXISTS (SELECT 1 FROM "UserAgreementRequest" r
    WHERE r."versionId" = "UserAgreementVersion"."id" AND r."recipientId" = current_setting('app.user_id', true))
);
CREATE POLICY agreement_version_head_write ON "UserAgreementVersion" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) = 'Head');

DROP POLICY IF EXISTS agreement_request_read ON "UserAgreementRequest";
DROP POLICY IF EXISTS agreement_request_insert ON "UserAgreementRequest";
DROP POLICY IF EXISTS agreement_request_update ON "UserAgreementRequest";
CREATE POLICY agreement_request_read ON "UserAgreementRequest" FOR SELECT USING (
  current_setting('app.user_role', true) = 'Head'
  OR "recipientId" = current_setting('app.user_id', true)
  OR current_setting('app.agreement_delivery_worker', true) = 'true'
);
CREATE POLICY agreement_request_insert ON "UserAgreementRequest" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY agreement_request_update ON "UserAgreementRequest" FOR UPDATE USING (
  current_setting('app.user_role', true) = 'Head' OR "recipientId" = current_setting('app.user_id', true)
) WITH CHECK (
  current_setting('app.user_role', true) = 'Head' OR "recipientId" = current_setting('app.user_id', true)
);

DROP POLICY IF EXISTS agreement_signature_read ON "UserAgreementSignature";
DROP POLICY IF EXISTS agreement_signature_insert ON "UserAgreementSignature";
CREATE POLICY agreement_signature_read ON "UserAgreementSignature" FOR SELECT USING (
  current_setting('app.user_role', true) = 'Head'
  OR EXISTS (SELECT 1 FROM "UserAgreementRequest" r
    WHERE r.id = "requestId" AND r."recipientId" = current_setting('app.user_id', true))
);
CREATE POLICY agreement_signature_insert ON "UserAgreementSignature" FOR INSERT WITH CHECK (
  (current_setting('app.user_role', true) = 'Head' AND "method" = 'HeadRecorded')
  OR ("method" = 'Portal' AND "signedById" = current_setting('app.user_id', true)
    AND EXISTS (SELECT 1 FROM "UserAgreementRequest" r
      WHERE r.id = "requestId" AND r."recipientId" = current_setting('app.user_id', true)))
);

DROP POLICY IF EXISTS agreement_delivery_head_worker ON "UserAgreementDelivery";
DROP POLICY IF EXISTS agreement_delivery_insert ON "UserAgreementDelivery";
DROP POLICY IF EXISTS agreement_delivery_read ON "UserAgreementDelivery";
DROP POLICY IF EXISTS agreement_delivery_update ON "UserAgreementDelivery";
CREATE POLICY agreement_delivery_insert ON "UserAgreementDelivery" FOR INSERT
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
CREATE POLICY agreement_delivery_read ON "UserAgreementDelivery" FOR SELECT USING (
  current_setting('app.user_role', true) = 'Head'
  OR current_setting('app.agreement_delivery_worker', true) = 'true'
);
CREATE POLICY agreement_delivery_update ON "UserAgreementDelivery" FOR UPDATE USING (
  current_setting('app.user_role', true) = 'Head'
  OR current_setting('app.agreement_delivery_worker', true) = 'true'
) WITH CHECK (
  current_setting('app.user_role', true) = 'Head'
  OR current_setting('app.agreement_delivery_worker', true) = 'true'
);
