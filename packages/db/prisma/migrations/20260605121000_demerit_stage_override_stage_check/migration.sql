ALTER TABLE "DemeritStageOverride"
  ADD CONSTRAINT "DemeritStageOverride_stage_check"
  CHECK ("stage" BETWEEN 1 AND 5);
