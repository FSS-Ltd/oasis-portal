ALTER TABLE "StudentPortalSettings"
ADD COLUMN "paceStatusVisible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "StudentRegistrationProfile"
ADD COLUMN "registrationLevel" TEXT NOT NULL DEFAULT 'Primary';

UPDATE "StudentRegistrationProfile" AS profile
SET "registrationLevel" = CASE
  WHEN student."yearGroup" IN ('Nursery', 'Reception', 'ABC', 'R', 'N') THEN 'ABC'
  WHEN student."yearGroup" IN ('Year 7', 'Y7', 'Year 8', 'Y8', 'Year 9', 'Y9', 'Year 10', 'Y10', 'Year 11', 'Y11', 'Year 12', 'Y12', 'Year 13', 'Y13') THEN 'Secondary'
  ELSE 'Primary'
END
FROM "Student" AS student
WHERE student."id" = profile."studentId";

ALTER TABLE "StudentRegistrationProfile"
ADD CONSTRAINT "StudentRegistrationProfile_registrationLevel_check"
CHECK ("registrationLevel" IN ('ABC', 'Primary', 'Secondary'));
