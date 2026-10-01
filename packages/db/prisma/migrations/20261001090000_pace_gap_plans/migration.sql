CREATE TYPE "PaceGapPlanStatus" AS ENUM ('Active', 'Completed', 'Cancelled');

CREATE TABLE "PaceGapPlan" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "jumpToPaceNumber" INTEGER NOT NULL,
  "status" "PaceGapPlanStatus" NOT NULL DEFAULT 'Active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reviewRequiredAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "PaceGapPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaceGapPlan_jumpToPaceNumber_check" CHECK ("jumpToPaceNumber" BETWEEN 1001 AND 1144),
  CONSTRAINT "PaceGapPlan_version_check" CHECK ("version" > 0)
);

CREATE TABLE "PaceGapPlanItem" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "paceNumber" INTEGER NOT NULL,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "PaceGapPlanItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaceGapPlanItem_paceNumber_check" CHECK ("paceNumber" BETWEEN 1001 AND 1144)
);

CREATE UNIQUE INDEX "PaceGapPlanItem_planId_paceNumber_key" ON "PaceGapPlanItem"("planId", "paceNumber");
CREATE INDEX "PaceGapPlan_studentId_subjectId_status_idx" ON "PaceGapPlan"("studentId", "subjectId", "status");
CREATE INDEX "PaceGapPlan_studentId_subjectId_reviewRequiredAt_idx" ON "PaceGapPlan"("studentId", "subjectId", "reviewRequiredAt");
CREATE INDEX "PaceGapPlanItem_planId_removedAt_paceNumber_idx" ON "PaceGapPlanItem"("planId", "removedAt", "paceNumber");
CREATE UNIQUE INDEX "PaceGapPlan_one_active_per_assignment_key" ON "PaceGapPlan"("studentId", "subjectId") WHERE "status" = 'Active';
CREATE INDEX "PaceGapPlan_unresolved_review_idx" ON "PaceGapPlan"("studentId", "subjectId") WHERE "reviewRequiredAt" IS NOT NULL AND "status" <> 'Cancelled';

ALTER TABLE "PaceGapPlan"
  ADD CONSTRAINT "PaceGapPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PaceGapPlan_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaceGapPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaceGapPlan_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaceGapPlanItem"
  ADD CONSTRAINT "PaceGapPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PaceGapPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaceGapPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaceGapPlan" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PaceGapPlanItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaceGapPlanItem" FORCE ROW LEVEL SECURITY;

CREATE POLICY pace_gap_plan_head_all ON "PaceGapPlan"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');

CREATE POLICY pace_gap_plan_scoped_select ON "PaceGapPlan"
  FOR SELECT
  USING (
    "studentId" = COALESCE(
      NULLIF(current_setting('app.pace_gap_read_student_id', true), ''),
      NULLIF(current_setting('app.pace_gap_write_student_id', true), '')
    )
  );

CREATE POLICY pace_gap_plan_scoped_update ON "PaceGapPlan"
  FOR UPDATE
  USING (
    "studentId" = NULLIF(current_setting('app.pace_gap_write_student_id', true), '')
  )
  WITH CHECK (
    "studentId" = NULLIF(current_setting('app.pace_gap_write_student_id', true), '')
  );

CREATE POLICY pace_gap_plan_item_head_all ON "PaceGapPlanItem"
  FOR ALL
  USING (current_setting('app.user_role', true) = 'Head')
  WITH CHECK (current_setting('app.user_role', true) = 'Head');

CREATE POLICY pace_gap_plan_item_scoped_select ON "PaceGapPlanItem"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "PaceGapPlan" p
      WHERE p."id" = "PaceGapPlanItem"."planId"
        AND p."studentId" = COALESCE(
          NULLIF(current_setting('app.pace_gap_read_student_id', true), ''),
          NULLIF(current_setting('app.pace_gap_write_student_id', true), '')
        )
    )
  );

CREATE FUNCTION enforce_pace_gap_runtime_update_scope() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.user_role', true) IS DISTINCT FROM 'Head'
     AND NULLIF(current_setting('app.pace_gap_write_student_id', true), '') IS NOT NULL
     AND (
       NEW."studentId" IS DISTINCT FROM OLD."studentId"
       OR NEW."subjectId" IS DISTINCT FROM OLD."subjectId"
       OR NEW."jumpToPaceNumber" IS DISTINCT FROM OLD."jumpToPaceNumber"
       OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
       OR NEW."cancelledAt" IS DISTINCT FROM OLD."cancelledAt"
       OR (NEW."status" IS DISTINCT FROM OLD."status" AND NOT (OLD."status" = 'Active' AND NEW."status" = 'Completed'))
       OR (OLD."reviewRequiredAt" IS NOT NULL AND NEW."reviewRequiredAt" IS DISTINCT FROM OLD."reviewRequiredAt")
     ) THEN
    RAISE EXCEPTION 'PACE runtime scope cannot change gap configuration';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pace_gap_runtime_update_scope
  BEFORE UPDATE ON "PaceGapPlan"
  FOR EACH ROW EXECUTE FUNCTION enforce_pace_gap_runtime_update_scope();
