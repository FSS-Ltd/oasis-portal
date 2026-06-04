CREATE TABLE "CharityPot" (
  "id" TEXT NOT NULL,
  "goalMerits" INTEGER NOT NULL DEFAULT 0,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CharityPot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CharityPot_updatedById_idx" ON "CharityPot"("updatedById");

ALTER TABLE "CharityPot"
  ADD CONSTRAINT "CharityPot_updatedById_fkey"
  FOREIGN KEY ("updatedById")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
