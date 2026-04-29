-- Migration: add PacePolicy singleton
-- PR-2.5: centre-level PACE test-limit policy configuration

CREATE TABLE "PacePolicy" (
    "id"                          TEXT         NOT NULL DEFAULT 'default',
    "dailyTestLimitEnabled"       BOOLEAN      NOT NULL DEFAULT false,
    "maxTestsPerStudentPerDay"    INTEGER      NOT NULL DEFAULT 2,
    "samePaceSameDayBlockEnabled" BOOLEAN      NOT NULL DEFAULT true,
    "passThreshold"               INTEGER      NOT NULL DEFAULT 80,
    "updatedAt"                   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacePolicy_pkey" PRIMARY KEY ("id")
);
