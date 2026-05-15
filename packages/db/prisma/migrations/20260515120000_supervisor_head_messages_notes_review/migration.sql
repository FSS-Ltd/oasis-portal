CREATE TYPE "MessageThreadKind" AS ENUM ('ParentStaff', 'SupervisorHead');

ALTER TABLE "MessageThread"
  ADD COLUMN "kind" "MessageThreadKind" NOT NULL DEFAULT 'ParentStaff',
  ADD COLUMN "supervisorId" TEXT,
  ALTER COLUMN "parentId" DROP NOT NULL;

ALTER TABLE "MessageThread"
  ADD CONSTRAINT "MessageThread_supervisorId_fkey"
  FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageThread"
  ADD CONSTRAINT "MessageThread_kind_participant_check"
  CHECK (
    (
      "kind" = 'ParentStaff'
      AND "parentId" IS NOT NULL
      AND "supervisorId" IS NULL
    )
    OR (
      "kind" = 'SupervisorHead'
      AND "supervisorId" IS NOT NULL
      AND "parentId" IS NULL
    )
  );

CREATE INDEX "MessageThread_kind_idx" ON "MessageThread"("kind");
CREATE INDEX "MessageThread_supervisorId_idx" ON "MessageThread"("supervisorId");

ALTER TABLE "BehaviourEntry"
  ADD COLUMN "seenAt" TIMESTAMP(3),
  ADD COLUMN "seenById" TEXT,
  ADD COLUMN "headCommentEnc" TEXT;

ALTER TABLE "BehaviourEntry"
  ADD CONSTRAINT "BehaviourEntry_seenById_fkey"
  FOREIGN KEY ("seenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BehaviourEntry_seenAt_idx" ON "BehaviourEntry"("seenAt");
CREATE INDEX "BehaviourEntry_seenById_idx" ON "BehaviourEntry"("seenById");

ALTER TABLE "ChildNote"
  ADD COLUMN "seenAt" TIMESTAMP(3),
  ADD COLUMN "seenById" TEXT,
  ADD COLUMN "headCommentEnc" TEXT;

ALTER TABLE "ChildNote"
  ADD CONSTRAINT "ChildNote_seenById_fkey"
  FOREIGN KEY ("seenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ChildNote_seenAt_idx" ON "ChildNote"("seenAt");
CREATE INDEX "ChildNote_seenById_idx" ON "ChildNote"("seenById");
