CREATE TYPE "ParentVolunteerPlacement" AS ENUM (
    'Centre',
    'LunchAndClubsPrimary',
    'LunchAndClubsSecondary'
);

ALTER TABLE "User"
ADD COLUMN "lunchAndClubsVolunteerExempt" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ParentVolunteerDay"
ADD COLUMN "placement" "ParentVolunteerPlacement" NOT NULL DEFAULT 'Centre';

ALTER TABLE "ParentVolunteerDay"
ALTER COLUMN "placement" DROP DEFAULT;

ALTER TABLE "ParentVolunteerDay"
DROP CONSTRAINT "ParentVolunteerDay_slot_check";

DROP INDEX "ParentVolunteerDay_parentUserId_date_key";
DROP INDEX "ParentVolunteerDay_date_slot_key";
DROP INDEX "ParentVolunteerDay_date_idx";

ALTER TABLE "ParentVolunteerDay"
ADD CONSTRAINT "ParentVolunteerDay_slot_check"
CHECK (
    ("placement" = 'Centre' AND "slot" BETWEEN 1 AND 2)
    OR ("placement" = 'LunchAndClubsPrimary' AND "slot" BETWEEN 1 AND 3)
    OR ("placement" = 'LunchAndClubsSecondary' AND "slot" BETWEEN 1 AND 2)
);

CREATE UNIQUE INDEX "ParentVolunteerDay_parentUserId_date_placement_key"
ON "ParentVolunteerDay"("parentUserId", "date", "placement");

CREATE UNIQUE INDEX "ParentVolunteerDay_date_placement_slot_key"
ON "ParentVolunteerDay"("date", "placement", "slot");

CREATE INDEX "ParentVolunteerDay_date_placement_idx"
ON "ParentVolunteerDay"("date", "placement");
