-- Add per-event required staff assignments for the shared calendar.
ALTER TYPE "CalendarEventAudience" ADD VALUE IF NOT EXISTS 'Custom';

CREATE TABLE "CalendarEventRequiredPerson" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taggedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEventRequiredPerson_pkey" PRIMARY KEY ("eventId", "userId")
);

CREATE INDEX "CalendarEventRequiredPerson_userId_eventId_idx"
    ON "CalendarEventRequiredPerson"("userId", "eventId");

CREATE INDEX "CalendarEventRequiredPerson_taggedById_createdAt_idx"
    ON "CalendarEventRequiredPerson"("taggedById", "createdAt");

ALTER TABLE "CalendarEventRequiredPerson"
    ADD CONSTRAINT "CalendarEventRequiredPerson_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEventRequiredPerson"
    ADD CONSTRAINT "CalendarEventRequiredPerson_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalendarEventRequiredPerson"
    ADD CONSTRAINT "CalendarEventRequiredPerson_taggedById_fkey"
    FOREIGN KEY ("taggedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
