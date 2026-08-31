DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PaceInventoryOrder"
    WHERE "paceNumber" NOT BETWEEN 1001 AND 1144
  ) THEN
    RAISE EXCEPTION
      'Invalid PaceInventoryOrder paceNumber values must be remediated to the supported range 1001-1144 before this migration can be applied.';
  END IF;
END
$$;

ALTER TABLE "PaceInventoryOrder"
  DROP CONSTRAINT "PaceInventoryOrder_paceNumber_check";

ALTER TABLE "PaceInventoryOrder"
  ADD CONSTRAINT "PaceInventoryOrder_paceNumber_check"
  CHECK ("paceNumber" BETWEEN 1001 AND 1144);
