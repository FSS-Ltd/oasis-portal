-- Add structured weekly club schedules, club-only attendance, and club cover rota.

CREATE TYPE "ClubScheduleFrequency" AS ENUM ('Weekly');

ALTER TABLE "Club"
  ADD COLUMN "scheduleStartDate" DATE,
  ADD COLUMN "scheduleStartMinute" INTEGER,
  ADD COLUMN "scheduleEndMinute" INTEGER,
  ADD COLUMN "scheduleFrequency" "ClubScheduleFrequency";

CREATE TABLE "ClubAttendance" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "sessionDate" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClubAttendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClubRotaParticipant" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "selectedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubRotaParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClubRotaShift" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "participantUserId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClubRotaShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClubAvailabilityWindow" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClubAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubAttendance_clubId_studentId_sessionDate_key"
  ON "ClubAttendance"("clubId", "studentId", "sessionDate");
CREATE INDEX "ClubAttendance_clubId_sessionDate_idx" ON "ClubAttendance"("clubId", "sessionDate");
CREATE INDEX "ClubAttendance_studentId_idx" ON "ClubAttendance"("studentId");

CREATE UNIQUE INDEX "ClubRotaParticipant_clubId_userId_key"
  ON "ClubRotaParticipant"("clubId", "userId");
CREATE INDEX "ClubRotaParticipant_userId_idx" ON "ClubRotaParticipant"("userId");
CREATE INDEX "ClubRotaParticipant_selectedById_idx" ON "ClubRotaParticipant"("selectedById");

CREATE INDEX "ClubRotaShift_clubId_date_idx" ON "ClubRotaShift"("clubId", "date");
CREATE INDEX "ClubRotaShift_participantUserId_date_idx"
  ON "ClubRotaShift"("participantUserId", "date");

CREATE INDEX "ClubAvailabilityWindow_clubId_userId_idx"
  ON "ClubAvailabilityWindow"("clubId", "userId");
CREATE INDEX "ClubAvailabilityWindow_userId_dayOfWeek_idx"
  ON "ClubAvailabilityWindow"("userId", "dayOfWeek");

ALTER TABLE "ClubAttendance"
  ADD CONSTRAINT "ClubAttendance_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubAttendance"
  ADD CONSTRAINT "ClubAttendance_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubAttendance"
  ADD CONSTRAINT "ClubAttendance_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClubRotaParticipant"
  ADD CONSTRAINT "ClubRotaParticipant_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubRotaParticipant"
  ADD CONSTRAINT "ClubRotaParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubRotaParticipant"
  ADD CONSTRAINT "ClubRotaParticipant_selectedById_fkey"
  FOREIGN KEY ("selectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClubRotaShift"
  ADD CONSTRAINT "ClubRotaShift_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubRotaShift"
  ADD CONSTRAINT "ClubRotaShift_participantUserId_fkey"
  FOREIGN KEY ("participantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClubAvailabilityWindow"
  ADD CONSTRAINT "ClubAvailabilityWindow_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubAvailabilityWindow"
  ADD CONSTRAINT "ClubAvailabilityWindow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
