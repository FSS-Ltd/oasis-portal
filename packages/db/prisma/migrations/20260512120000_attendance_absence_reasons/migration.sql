CREATE TYPE "AbsenceReason" AS ENUM ('Sick', 'Holiday', 'NotScheduled', 'Excused', 'Unexcused');

ALTER TABLE "Attendance" ADD COLUMN "absenceReason" "AbsenceReason";
ALTER TABLE "StaffAttendance" ADD COLUMN "absenceReason" "AbsenceReason";
