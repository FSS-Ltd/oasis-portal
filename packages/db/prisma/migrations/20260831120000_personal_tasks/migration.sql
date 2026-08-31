CREATE TABLE "PersonalTask" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "reminderAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PersonalTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PersonalTask"
  ADD CONSTRAINT "PersonalTask_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PersonalTask_ownerId_completedAt_dueAt_idx"
  ON "PersonalTask"("ownerId", "completedAt", "dueAt");

CREATE INDEX "PersonalTask_ownerId_createdAt_idx"
  ON "PersonalTask"("ownerId", "createdAt");

CREATE INDEX "PersonalTask_ownerId_reminderAt_idx"
  ON "PersonalTask"("ownerId", "reminderAt");
