CREATE TABLE "ParentVolunteerDay" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentVolunteerDay_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ParentVolunteerDay_slot_check" CHECK ("slot" IN (1, 2))
);

CREATE UNIQUE INDEX "ParentVolunteerDay_parentUserId_date_key"
ON "ParentVolunteerDay"("parentUserId", "date");

CREATE UNIQUE INDEX "ParentVolunteerDay_date_slot_key"
ON "ParentVolunteerDay"("date", "slot");

CREATE INDEX "ParentVolunteerDay_date_idx" ON "ParentVolunteerDay"("date");

ALTER TABLE "ParentVolunteerDay"
ADD CONSTRAINT "ParentVolunteerDay_parentUserId_fkey"
FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
