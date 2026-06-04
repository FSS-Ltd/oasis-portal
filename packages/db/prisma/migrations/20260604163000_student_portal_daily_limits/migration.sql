ALTER TABLE "StudentPortalSettings"
ADD COLUMN "offLimitWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "StudentPortalSettings"
DROP COLUMN "hourlyUsageLimitMinutes",
DROP COLUMN "weeklyUsageLimitMinutes";

ALTER TABLE "StudentPortalSettings"
ADD CONSTRAINT "StudentPortalSettings_offLimitWeekdays_check"
CHECK ("offLimitWeekdays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[]);
