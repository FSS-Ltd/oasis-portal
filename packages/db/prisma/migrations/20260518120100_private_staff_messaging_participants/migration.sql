ALTER TABLE "MessageThread" DROP CONSTRAINT IF EXISTS "MessageThread_kind_participant_check";

ALTER TABLE "MessageThread" ALTER COLUMN "adminId" DROP NOT NULL;

CREATE TABLE "MessageThreadParticipant" (
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageThreadParticipant_pkey" PRIMARY KEY ("threadId", "userId")
);

CREATE INDEX "MessageThreadParticipant_userId_threadId_idx"
  ON "MessageThreadParticipant"("userId", "threadId");

ALTER TABLE "MessageThreadParticipant"
  ADD CONSTRAINT "MessageThreadParticipant_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageThreadParticipant"
  ADD CONSTRAINT "MessageThreadParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MessageThreadParticipant" ("threadId", "userId", "createdAt")
SELECT "id", "parentId", "createdAt"
FROM "MessageThread"
WHERE "kind" = 'ParentStaff' AND "parentId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "MessageThreadParticipant" ("threadId", "userId", "createdAt")
SELECT "id", "adminId", "createdAt"
FROM "MessageThread"
WHERE "kind" IN ('ParentStaff', 'SupervisorHead') AND "adminId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "MessageThreadParticipant" ("threadId", "userId", "createdAt")
SELECT "id", "supervisorId", "createdAt"
FROM "MessageThread"
WHERE "kind" = 'SupervisorHead' AND "supervisorId" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "MessageThread"
  ADD CONSTRAINT "MessageThread_kind_participant_check"
  CHECK (
    (
      "kind" = 'ParentStaff'
      AND "parentId" IS NOT NULL
      AND "supervisorId" IS NULL
      AND "adminId" IS NOT NULL
    )
    OR (
      "kind" = 'SupervisorHead'
      AND "supervisorId" IS NOT NULL
      AND "parentId" IS NULL
      AND "adminId" IS NOT NULL
    )
    OR (
      "kind" = 'StaffDirect'
      AND "parentId" IS NULL
      AND "supervisorId" IS NULL
      AND "adminId" IS NULL
    )
    OR (
      "kind" = 'Staffroom'
      AND "parentId" IS NULL
      AND "supervisorId" IS NULL
      AND "adminId" IS NULL
    )
  );

CREATE UNIQUE INDEX "MessageThread_staffroom_singleton_idx"
  ON "MessageThread"("kind")
  WHERE "kind" = 'Staffroom';
