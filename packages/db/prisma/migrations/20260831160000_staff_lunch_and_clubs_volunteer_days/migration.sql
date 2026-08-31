CREATE TABLE "StaffLunchAndClubsVolunteerDay" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLunchAndClubsVolunteerDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffLunchAndClubsVolunteerDay_staffUserId_date_key"
ON "StaffLunchAndClubsVolunteerDay"("staffUserId", "date");

CREATE INDEX "StaffLunchAndClubsVolunteerDay_date_idx"
ON "StaffLunchAndClubsVolunteerDay"("date");

ALTER TABLE "StaffLunchAndClubsVolunteerDay"
ADD CONSTRAINT "StaffLunchAndClubsVolunteerDay_staffUserId_fkey"
FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
