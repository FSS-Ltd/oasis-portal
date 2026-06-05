CREATE TYPE "SpecialAttendanceRegister" AS ENUM ('FieldTrip', 'MinibusInbound', 'MinibusOutbound', 'TheCedars');

CREATE TABLE "SpecialAttendanceSession" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "register" "SpecialAttendanceRegister" NOT NULL,
  "destinationEnc" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SpecialAttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialAttendanceRecord" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SpecialAttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecialAttendanceSession_date_register_key" ON "SpecialAttendanceSession"("date", "register");
CREATE INDEX "SpecialAttendanceSession_register_date_idx" ON "SpecialAttendanceSession"("register", "date");
CREATE INDEX "SpecialAttendanceSession_createdById_idx" ON "SpecialAttendanceSession"("createdById");
CREATE UNIQUE INDEX "SpecialAttendanceRecord_sessionId_studentId_key" ON "SpecialAttendanceRecord"("sessionId", "studentId");
CREATE INDEX "SpecialAttendanceRecord_studentId_idx" ON "SpecialAttendanceRecord"("studentId");
CREATE INDEX "SpecialAttendanceRecord_recordedById_idx" ON "SpecialAttendanceRecord"("recordedById");

ALTER TABLE "SpecialAttendanceSession"
  ADD CONSTRAINT "SpecialAttendanceSession_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SpecialAttendanceRecord"
  ADD CONSTRAINT "SpecialAttendanceRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "SpecialAttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialAttendanceRecord"
  ADD CONSTRAINT "SpecialAttendanceRecord_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SpecialAttendanceRecord"
  ADD CONSTRAINT "SpecialAttendanceRecord_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
