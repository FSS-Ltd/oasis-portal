-- Store tithe periods as timestamps so the Friday 13:00 Europe/London
-- settlement boundary is represented exactly instead of as a date-only week.
ALTER TABLE "TitheRun"
  ALTER COLUMN "periodStart" TYPE TIMESTAMP(3) USING "periodStart"::timestamp(3),
  ALTER COLUMN "periodEnd" TYPE TIMESTAMP(3) USING "periodEnd"::timestamp(3);
