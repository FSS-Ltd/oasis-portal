ALTER TABLE "BehaviourEntry" ADD COLUMN "clubId" TEXT;

CREATE INDEX "BehaviourEntry_clubId_createdAt_idx" ON "BehaviourEntry"("clubId", "createdAt");

ALTER TABLE "BehaviourEntry"
ADD CONSTRAINT "BehaviourEntry_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
