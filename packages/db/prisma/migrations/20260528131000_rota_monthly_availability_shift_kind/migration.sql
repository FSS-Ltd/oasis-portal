CREATE TYPE "StaffShiftKind" AS ENUM ('Cover', 'Meeting');

ALTER TABLE "StaffShift"
  ADD COLUMN "kind" "StaffShiftKind" NOT NULL DEFAULT 'Cover',
  ALTER COLUMN "yearGroupBandId" DROP NOT NULL;

CREATE TABLE "StaffMonthlyAvailabilityWindow" (
  "id" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffMonthlyAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffMonthlyAvailabilityWindow_staffUserId_date_idx"
  ON "StaffMonthlyAvailabilityWindow"("staffUserId", "date");

CREATE INDEX "StaffMonthlyAvailabilityWindow_date_idx"
  ON "StaffMonthlyAvailabilityWindow"("date");

ALTER TABLE "StaffMonthlyAvailabilityWindow"
  ADD CONSTRAINT "StaffMonthlyAvailabilityWindow_staffUserId_fkey"
  FOREIGN KEY ("staffUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
