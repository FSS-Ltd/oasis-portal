ALTER TABLE "BehaviourEntry" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "BehaviourEntry" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "ChildNote" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ChildNote" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "BehaviourEntry"
  ADD CONSTRAINT "BehaviourEntry_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChildNote"
  ADD CONSTRAINT "ChildNote_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BehaviourEntry_deletedAt_idx" ON "BehaviourEntry"("deletedAt");
CREATE INDEX "BehaviourEntry_deletedById_idx" ON "BehaviourEntry"("deletedById");
CREATE INDEX "ChildNote_deletedAt_idx" ON "ChildNote"("deletedAt");
CREATE INDEX "ChildNote_deletedById_idx" ON "ChildNote"("deletedById");
