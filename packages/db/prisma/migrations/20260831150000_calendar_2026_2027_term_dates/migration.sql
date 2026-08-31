-- Publish the 2026–27 academic calendar supplied by Oasis. Calendar events require an owner, so
-- these records are attributed to the first active full administrator (preferring the Head).
WITH calendar_owner AS (
    SELECT "id"
    FROM "User"
    WHERE "active" = true
      AND "role" IN ('Head', 'Principal', 'Pastor', 'HeadOfDiscipline')
    ORDER BY
      CASE "role"
        WHEN 'Head' THEN 0
        WHEN 'Principal' THEN 1
        WHEN 'Pastor' THEN 2
        ELSE 3
      END,
      "createdAt" ASC
    LIMIT 1
), calendar_dates ("id", "title", "category", "startDate", "endDate") AS (
    VALUES
      ('calendar-2026-27-term-1-start', 'Term 1 starts', 'OasisDays', '2026-09-08', '2026-09-08'),
      ('calendar-2026-27-term-1-end', 'Term 1 ends', 'OasisDays', '2026-10-16', '2026-10-16'),
      ('calendar-2026-27-autumn-half-term', 'Autumn half-term break', 'HalfTerm', '2026-10-17', '2026-11-02'),
      ('calendar-2026-27-term-2-start', 'Term 2 starts', 'OasisDays', '2026-11-03', '2026-11-03'),
      ('calendar-2026-27-term-2-end', 'Term 2 ends', 'OasisDays', '2026-12-18', '2026-12-18'),
      ('calendar-2026-27-christmas-holiday', 'Christmas holiday', 'HalfTerm', '2026-12-19', '2027-01-04'),
      ('calendar-2026-27-term-3-start', 'Term 3 starts', 'OasisDays', '2027-01-05', '2027-01-05'),
      ('calendar-2026-27-term-3-end', 'Term 3 ends', 'OasisDays', '2027-02-12', '2027-02-12'),
      ('calendar-2026-27-spring-half-term', 'Spring half-term break', 'HalfTerm', '2027-02-13', '2027-02-22'),
      ('calendar-2026-27-term-4-start', 'Term 4 starts', 'OasisDays', '2027-02-23', '2027-02-23'),
      ('calendar-2026-27-term-4-end', 'Term 4 ends (Good Friday morning)', 'OasisDays', '2027-03-25', '2027-03-25'),
      ('calendar-2026-27-easter-holiday', 'Easter holiday', 'HalfTerm', '2027-03-26', '2027-04-12'),
      ('calendar-2026-27-term-5-start', 'Term 5 starts', 'OasisDays', '2027-04-13', '2027-04-13'),
      ('calendar-2026-27-term-5-end', 'Term 5 ends', 'OasisDays', '2027-05-28', '2027-05-28'),
      ('calendar-2026-27-summer-half-term', 'Summer half-term break', 'HalfTerm', '2027-05-29', '2027-06-07'),
      ('calendar-2026-27-term-6-start', 'Term 6 starts', 'OasisDays', '2027-06-08', '2027-06-08'),
      ('calendar-2026-27-term-6-end', 'Term 6 ends', 'OasisDays', '2027-07-23', '2027-07-23')
)
INSERT INTO "CalendarEvent" (
    "id",
    "title",
    "descriptionEnc",
    "audience",
    "category",
    "startDate",
    "endDate",
    "active",
    "createdById",
    "createdAt",
    "updatedAt"
)
SELECT
    calendar_dates."id",
    calendar_dates."title",
    NULL,
    'All'::"CalendarEventAudience",
    calendar_dates."category"::"CalendarEventCategory",
    calendar_dates."startDate"::DATE,
    calendar_dates."endDate"::DATE,
    true,
    calendar_owner."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM calendar_dates
CROSS JOIN calendar_owner
ON CONFLICT ("id") DO NOTHING;
