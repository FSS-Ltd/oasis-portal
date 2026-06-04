CREATE TABLE "FaithCornerContent" (
  "id" TEXT NOT NULL,
  "weeklyTheme" TEXT NOT NULL,
  "memoryVerseReference" TEXT NOT NULL,
  "memoryVerseTextEnc" TEXT NOT NULL,
  "reflectionPromptEnc" TEXT NOT NULL,
  "verseOfDayReference" TEXT,
  "verseOfDayTextEnc" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FaithCornerContent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FaithCornerContent_active_publishedAt_idx" ON "FaithCornerContent"("active", "publishedAt");
CREATE INDEX "FaithCornerContent_createdById_publishedAt_idx" ON "FaithCornerContent"("createdById", "publishedAt");
CREATE INDEX "FaithCornerContent_updatedById_updatedAt_idx" ON "FaithCornerContent"("updatedById", "updatedAt");

ALTER TABLE "FaithCornerContent"
  ADD CONSTRAINT "FaithCornerContent_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FaithCornerContent"
  ADD CONSTRAINT "FaithCornerContent_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
