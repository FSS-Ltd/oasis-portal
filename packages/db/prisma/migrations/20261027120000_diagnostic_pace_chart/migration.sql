-- Diagnostics: Math and English record a PACE chart (attempted and circled PACEs);
-- Word Building and Reading record Level 1-9 Pass/Fail. Reading has no subject.
-- Additive only: existing rows keep their values and a NULL "test" marks a legacy
-- level result, so nothing is rewritten and no realtime change events fire.
CREATE TYPE "DiagnosticTest" AS ENUM ('Math', 'English', 'WordBuilding', 'Reading');

ALTER TABLE "DiagnosticResult"
  ADD COLUMN "test" "DiagnosticTest",
  ADD COLUMN "attemptedPaceNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "circledPaceNumbers" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "passedLevels" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "failedLevels" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ALTER COLUMN "subjectId" DROP NOT NULL,
  ALTER COLUMN "level" DROP NOT NULL,
  ALTER COLUMN "outcome" DROP NOT NULL;

ALTER TABLE "DiagnosticResult"
  DROP CONSTRAINT "DiagnosticResult_level_check";

ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_level_check"
  CHECK ("level" IS NULL OR ("level" >= 1 AND "level" <= 9));

ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_pace_numbers_check"
  CHECK (
    1001 <= ALL ("attemptedPaceNumbers")
    AND 1144 >= ALL ("attemptedPaceNumbers")
    AND "circledPaceNumbers" <@ "attemptedPaceNumbers"
  );

-- A Reading or Word Building sitting records Pass or Fail for each level tested.
ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_levels_check"
  CHECK (
    1 <= ALL ("passedLevels")
    AND 9 >= ALL ("passedLevels")
    AND 1 <= ALL ("failedLevels")
    AND 9 >= ALL ("failedLevels")
    AND NOT ("passedLevels" && "failedLevels")
  );

-- Legacy rows (test IS NULL) keep their subject and level result. New rows must be a
-- complete chart (Math, English) or a complete level result or sitting (Word Building, Reading).
ALTER TABLE "DiagnosticResult"
  ADD CONSTRAINT "DiagnosticResult_shape_check"
  CHECK (
    ("test" IS NULL AND "subjectId" IS NOT NULL)
    OR ("test" IN ('Math', 'English') AND "subjectId" IS NOT NULL
        AND cardinality("attemptedPaceNumbers") > 0)
    OR ("test" = 'WordBuilding' AND "subjectId" IS NOT NULL
        AND (("level" IS NOT NULL AND "outcome" IS NOT NULL)
          OR cardinality("passedLevels") + cardinality("failedLevels") > 0))
    OR ("test" = 'Reading' AND "subjectId" IS NULL
        AND (("level" IS NOT NULL AND "outcome" IS NOT NULL)
          OR cardinality("passedLevels") + cardinality("failedLevels") > 0))
  );

CREATE INDEX "DiagnosticResult_studentId_test_recordedAt_idx"
  ON "DiagnosticResult"("studentId", "test", "recordedAt");
