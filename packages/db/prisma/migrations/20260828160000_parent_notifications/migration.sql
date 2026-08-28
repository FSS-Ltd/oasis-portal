CREATE TYPE "ParentNotificationKind" AS ENUM (
  'InvoiceIssued'
);

CREATE TABLE "ParentNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "ParentNotificationKind" NOT NULL,
  "title" TEXT NOT NULL,
  "bodyEnc" TEXT NOT NULL,
  "href" TEXT,
  "sourceEntity" TEXT,
  "sourceId" TEXT,
  "createdById" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParentNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentNotification_userId_readAt_createdAt_idx"
ON "ParentNotification"("userId", "readAt", "createdAt");

CREATE INDEX "ParentNotification_userId_kind_createdAt_idx"
ON "ParentNotification"("userId", "kind", "createdAt");

CREATE INDEX "ParentNotification_sourceEntity_sourceId_idx"
ON "ParentNotification"("sourceEntity", "sourceId");

CREATE INDEX "ParentNotification_createdById_createdAt_idx"
ON "ParentNotification"("createdById", "createdAt");

ALTER TABLE "ParentNotification"
ADD CONSTRAINT "ParentNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentNotification"
ADD CONSTRAINT "ParentNotification_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParentNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentNotification" FORCE ROW LEVEL SECURITY;

CREATE POLICY parent_notifications_full_admin_all ON "ParentNotification"
  FOR ALL
  USING (current_setting('app.full_admin', true) = 'true')
  WITH CHECK (current_setting('app.full_admin', true) = 'true');

CREATE POLICY parent_notifications_technical_support_all ON "ParentNotification"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'TechnicalSupport')
  WITH CHECK (current_setting('app.user_role', true) = 'TechnicalSupport');

CREATE POLICY parent_notifications_staff_insert ON "ParentNotification"
  FOR INSERT
  WITH CHECK (
    current_setting('app.user_role', true) IN (
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'ClubsLead',
      'Supervisor'
    )
  );

CREATE POLICY parent_notifications_parent_select ON "ParentNotification"
  FOR SELECT
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND "ParentNotification"."userId" = current_setting('app.user_id', true)
  );

CREATE POLICY parent_notifications_parent_update ON "ParentNotification"
  FOR UPDATE
  USING (
    current_setting('app.user_role', true) = 'Parent'
    AND "ParentNotification"."userId" = current_setting('app.user_id', true)
  )
  WITH CHECK (
    current_setting('app.user_role', true) = 'Parent'
    AND "ParentNotification"."userId" = current_setting('app.user_id', true)
  );
