-- CreateEnum
CREATE TYPE "ReportPeriodType" AS ENUM ('Term', 'AcademicYear', 'Custom');

-- Add period metadata and encrypted final-PDF storage without renaming the
-- legacy physical term column or its unique index.
ALTER TABLE "TermReport"
ADD COLUMN "periodType" "ReportPeriodType",
ADD COLUMN "periodLabel" TEXT,
ADD COLUMN "periodStart" DATE,
ADD COLUMN "periodEnd" DATE,
ADD COLUMN "pdfBytesEnc" TEXT,
ADD COLUMN "pdfFileNameEnc" TEXT,
ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3);

-- Backfill the three legacy Oasis term shapes with inclusive UTC date values.
UPDATE "TermReport"
SET
  "periodType" = 'Term'::"ReportPeriodType",
  "periodLabel" = CASE
    WHEN "term" LIKE '%-Spring' THEN 'Spring ' || split_part("term", '-', 1)
    WHEN "term" LIKE '%-Summer' THEN 'Summer ' || split_part("term", '-', 1)
    WHEN "term" LIKE '%-Autumn' THEN 'Autumn ' || split_part("term", '-', 1)
  END,
  "periodStart" = CASE
    WHEN "term" LIKE '%-Spring' THEN make_date(split_part("term", '-', 1)::INTEGER, 1, 1)
    WHEN "term" LIKE '%-Summer' THEN make_date(split_part("term", '-', 1)::INTEGER, 4, 1)
    WHEN "term" LIKE '%-Autumn' THEN make_date(split_part("term", '-', 1)::INTEGER, 9, 1)
  END,
  "periodEnd" = CASE
    WHEN "term" LIKE '%-Spring' THEN make_date(split_part("term", '-', 1)::INTEGER, 3, 31)
    WHEN "term" LIKE '%-Summer' THEN make_date(split_part("term", '-', 1)::INTEGER, 8, 31)
    WHEN "term" LIKE '%-Autumn' THEN make_date(split_part("term", '-', 1)::INTEGER, 12, 31)
  END
WHERE
  "term" LIKE '%-Spring'
  OR "term" LIKE '%-Summer'
  OR "term" LIKE '%-Autumn';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TermReport"
    WHERE "periodType" IS NULL
      OR "periodLabel" IS NULL
      OR "periodStart" IS NULL
      OR "periodEnd" IS NULL
  ) THEN
    RAISE EXCEPTION 'TermReport contains an unsupported legacy term value';
  END IF;
END $$;

ALTER TABLE "TermReport"
ALTER COLUMN "periodType" SET NOT NULL,
ALTER COLUMN "periodLabel" SET NOT NULL,
ALTER COLUMN "periodStart" SET NOT NULL,
ALTER COLUMN "periodEnd" SET NOT NULL;
