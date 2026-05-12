-- Extend calendar visibility, categorisation, optional single-day times, and staff DOB storage.
ALTER TYPE "CalendarEventAudience" ADD VALUE IF NOT EXISTS 'Heads';

CREATE TYPE "CalendarEventCategory" AS ENUM (
    'HalfTerm',
    'Trips',
    'OasisDays',
    'Birthdays',
    'Meetings',
    'Trainings'
);

ALTER TABLE "User"
    ADD COLUMN "dobEnc" TEXT;

ALTER TABLE "CalendarEvent"
    ADD COLUMN "category" "CalendarEventCategory" NOT NULL DEFAULT 'OasisDays',
    ADD COLUMN "startTimeMinutes" INTEGER,
    ADD COLUMN "endTimeMinutes" INTEGER,
    ADD CONSTRAINT "CalendarEvent_single_day_time_check"
        CHECK (
            (
                "startTimeMinutes" IS NULL
                AND "endTimeMinutes" IS NULL
            )
            OR (
                "startTimeMinutes" IS NOT NULL
                AND "endTimeMinutes" IS NOT NULL
                AND "startTimeMinutes" >= 0
                AND "startTimeMinutes" <= 1439
                AND "endTimeMinutes" >= 0
                AND "endTimeMinutes" <= 1439
                AND "startTimeMinutes" < "endTimeMinutes"
                AND "startDate" = "endDate"
            )
        );

CREATE INDEX "CalendarEvent_active_category_startDate_endDate_idx"
    ON "CalendarEvent"("active", "category", "startDate", "endDate");
