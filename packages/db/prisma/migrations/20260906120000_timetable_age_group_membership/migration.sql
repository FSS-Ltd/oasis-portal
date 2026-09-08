CREATE TABLE "TimetableAgeGroupMembership" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "registrationLevel" "TimetableRegistrationLevel" NOT NULL,
  "isOwnTimetable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimetableAgeGroupMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimetableAgeGroupMembership_studentId_key"
  ON "TimetableAgeGroupMembership" ("studentId");
CREATE INDEX "TimetableAgeGroupMembership_registrationLevel_isOwnTimetable_idx"
  ON "TimetableAgeGroupMembership" ("registrationLevel", "isOwnTimetable");

ALTER TABLE "TimetableAgeGroupMembership"
  ADD CONSTRAINT "TimetableAgeGroupMembership_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TimetableAgeGroupMembership" (
  "id",
  "studentId",
  "registrationLevel",
  "isOwnTimetable"
)
SELECT
  'timetable-age-group-membership-' || s.id,
  s.id,
  CASE
    WHEN p."registrationLevel" IN ('ABC', 'Primary', 'Secondary') THEN p."registrationLevel"::"TimetableRegistrationLevel"
    WHEN lower(trim(s."yearGroup")) IN ('abc', 'nursery', 'reception') THEN 'ABC'
    WHEN lower(trim(s."yearGroup")) ~ '(^|[^a-z])(year|level|y)\s*(\d{1,2})'
      AND substring(lower(trim(s."yearGroup")) FROM '(?:year|level|y)\s*(\d{1,2})')::int >= 7
      THEN 'Secondary'
    ELSE 'Primary'
  END,
  false
FROM "Student" s
LEFT JOIN "StudentRegistrationProfile" p
  ON p."studentId" = s.id
WHERE s."active" = true
ON CONFLICT ("studentId") DO NOTHING;

ALTER TABLE "TimetableAgeGroupMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimetableAgeGroupMembership" FORCE ROW LEVEL SECURITY;

CREATE POLICY timetable_age_group_membership_head_all
  ON "TimetableAgeGroupMembership"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');
