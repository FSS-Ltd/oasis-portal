ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ClubsLead';

CREATE TABLE "ClubLeadAssignment" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubLeadAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubLeadAssignment_clubId_userId_key"
  ON "ClubLeadAssignment"("clubId", "userId");
CREATE INDEX "ClubLeadAssignment_userId_idx" ON "ClubLeadAssignment"("userId");
CREATE INDEX "ClubLeadAssignment_assignedById_idx" ON "ClubLeadAssignment"("assignedById");

ALTER TABLE "ClubLeadAssignment"
  ADD CONSTRAINT "ClubLeadAssignment_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubLeadAssignment"
  ADD CONSTRAINT "ClubLeadAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubLeadAssignment"
  ADD CONSTRAINT "ClubLeadAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
