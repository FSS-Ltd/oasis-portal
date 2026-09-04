CREATE TABLE "ClubYearGroupBand" (
    "clubId" TEXT NOT NULL,
    "yearGroupBandId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubYearGroupBand_pkey" PRIMARY KEY ("clubId", "yearGroupBandId")
);

CREATE INDEX "ClubYearGroupBand_yearGroupBandId_idx" ON "ClubYearGroupBand"("yearGroupBandId");

ALTER TABLE "ClubYearGroupBand"
    ADD CONSTRAINT "ClubYearGroupBand_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubYearGroupBand"
    ADD CONSTRAINT "ClubYearGroupBand_yearGroupBandId_fkey"
    FOREIGN KEY ("yearGroupBandId") REFERENCES "YearGroupBand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ClubYearGroupBand" ("clubId", "yearGroupBandId")
SELECT club."id", band."id"
FROM "Club" AS club
CROSS JOIN "YearGroupBand" AS band
WHERE (
    club."name" IN (
      'Chess Club Junior',
      'Computer Science Junior',
      'Dance Club Junior',
      'French Junior'
    )
    AND band."name" IN ('Lower Primary', 'Upper Primary')
  )
  OR (
    club."name" IN (
      'Chess Club Senior',
      'Computer Science Club Senior',
      'French Senior',
      'Politics & History'
    )
    AND band."name" = 'Secondary'
  )
ON CONFLICT DO NOTHING;

-- For legacy clubs which do not have one of the production-verified names
-- above, preserve the audience demonstrated by their existing signups. This
-- avoids making an established club disappear when its historical name did
-- not appear in the production inference report.
INSERT INTO "ClubYearGroupBand" ("clubId", "yearGroupBandId")
SELECT DISTINCT signup."clubId", band."id"
FROM "ClubSignup" AS signup
JOIN "Student" AS student ON student."id" = signup."studentId"
JOIN "YearGroupBand" AS band ON student."yearGroup" = ANY (band."standardYears")
WHERE signup."status" IN ('Active', 'Pending')
  AND signup."clubId" NOT IN (
    SELECT "id"
    FROM "Club"
    WHERE "name" IN (
      'Chess Club Junior',
      'Computer Science Junior',
      'Dance Club Junior',
      'French Junior',
      'Chess Club Senior',
      'Computer Science Club Senior',
      'French Senior',
      'Politics & History'
    )
  )
ON CONFLICT DO NOTHING;
