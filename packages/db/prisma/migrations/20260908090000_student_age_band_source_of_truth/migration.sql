ALTER TABLE "Student"
  ADD COLUMN "ageBandId" TEXT,
  ADD COLUMN "followsOwnTimetable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TimetableAgeGroupSchedule" ADD COLUMN "ageBandId" TEXT;
ALTER TABLE "StudentTimetable" ADD COLUMN "ageBandId" TEXT;
ALTER TABLE "StudentTimetablePublication" ADD COLUMN "ageBandName" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "TimetableAgeGroupSchedule_termKey_registrationLevel_key";

WITH canonical_students AS (
  SELECT
    s."id",
    CASE
      WHEN lower(trim(s."yearGroup")) = 'nursery' THEN 'Nursery'
      WHEN lower(trim(s."yearGroup")) IN ('reception', 'abc', 'r') THEN 'Reception'
      WHEN lower(trim(s."yearGroup")) ~ '^(year\s*|y)([1-9]|1[0-3])$'
        THEN 'Year ' || substring(lower(trim(s."yearGroup")) FROM '([1-9]|1[0-3])$')
      ELSE trim(s."yearGroup")
    END AS canonical_year
  FROM "Student" s
)
UPDATE "Student" s
SET "ageBandId" = matched."bandId"
FROM (
  SELECT DISTINCT ON (cs."id")
    cs."id" AS "studentId",
    b."id" AS "bandId"
  FROM canonical_students cs
  JOIN "YearGroupBand" b ON cs.canonical_year = ANY(b."standardYears")
  WHERE b."active" = true
  ORDER BY cs."id", b."sortOrder", b."name"
) matched
WHERE s."id" = matched."studentId";

UPDATE "StudentTimetable" t
SET "ageBandId" = s."ageBandId"
FROM "Student" s
WHERE s."id" = t."studentId";

UPDATE "StudentTimetablePublication"
SET "ageBandName" = "registrationLevel"::TEXT;

CREATE INDEX "Student_ageBandId_active_idx" ON "Student"("ageBandId", "active");
CREATE UNIQUE INDEX "TimetableAgeGroupSchedule_termKey_ageBandId_key"
  ON "TimetableAgeGroupSchedule"("termKey", "ageBandId");
CREATE INDEX "StudentTimetable_ageBandId_idx" ON "StudentTimetable"("ageBandId");

ALTER TABLE "Student"
  ADD CONSTRAINT "Student_ageBandId_fkey"
  FOREIGN KEY ("ageBandId") REFERENCES "YearGroupBand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimetableAgeGroupSchedule"
  ADD CONSTRAINT "TimetableAgeGroupSchedule_ageBandId_fkey"
  FOREIGN KEY ("ageBandId") REFERENCES "YearGroupBand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentTimetable"
  ADD CONSTRAINT "StudentTimetable_ageBandId_fkey"
  FOREIGN KEY ("ageBandId") REFERENCES "YearGroupBand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
