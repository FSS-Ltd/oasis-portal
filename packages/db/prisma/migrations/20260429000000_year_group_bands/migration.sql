-- CreateTable
CREATE TABLE "YearGroupBand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardYears" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "colour" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearGroupBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YearGroupBand_name_key" ON "YearGroupBand"("name");

-- CreateIndex
CREATE INDEX "YearGroupBand_active_sortOrder_idx" ON "YearGroupBand"("active", "sortOrder");

-- Seed default Oasis bands
INSERT INTO "YearGroupBand" (
    "id",
    "name",
    "standardYears",
    "active",
    "sortOrder",
    "colour",
    "updatedAt"
)
VALUES
    (
        'yeargroupband_lower_primary',
        'Lower Primary',
        ARRAY['Reception', 'Year 1']::TEXT[],
        true,
        10,
        '#5B90C5',
        CURRENT_TIMESTAMP
    ),
    (
        'yeargroupband_upper_primary',
        'Upper Primary',
        ARRAY['Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']::TEXT[],
        true,
        20,
        '#2F8F6B',
        CURRENT_TIMESTAMP
    ),
    (
        'yeargroupband_secondary',
        'Secondary',
        ARRAY['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13']::TEXT[],
        true,
        30,
        '#8A5A9E',
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("name") DO NOTHING;
