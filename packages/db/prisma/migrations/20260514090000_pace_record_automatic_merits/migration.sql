ALTER TABLE "BehaviourEntry"
ADD COLUMN "paceRecordId" TEXT;

UPDATE "BehaviourEntry" AS b
SET "paceRecordId" = audit.meta->>'paceRecordId'
FROM "AuditLog" AS audit
WHERE audit.entity = 'BehaviourEntry'
  AND audit."entityId" = b.id
  AND audit.meta->>'source' = 'pace.record'
  AND audit.meta ? 'paceRecordId'
  AND EXISTS (
    SELECT 1
    FROM "PaceRecord" AS p
    WHERE p.id = audit.meta->>'paceRecordId'
  );

CREATE INDEX "BehaviourEntry_paceRecordId_idx" ON "BehaviourEntry"("paceRecordId");

ALTER TABLE "BehaviourEntry"
ADD CONSTRAINT "BehaviourEntry_paceRecordId_fkey"
FOREIGN KEY ("paceRecordId") REFERENCES "PaceRecord"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
