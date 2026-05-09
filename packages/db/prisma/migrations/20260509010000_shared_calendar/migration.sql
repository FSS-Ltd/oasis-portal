-- CreateEnum
CREATE TYPE "CalendarEventAudience" AS ENUM ('All', 'Parents', 'Supervisors');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "descriptionEnc" TEXT,
    "audience" "CalendarEventAudience" NOT NULL DEFAULT 'All',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_active_audience_startDate_endDate_idx" ON "CalendarEvent"("active", "audience", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdById_createdAt_idx" ON "CalendarEvent"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
