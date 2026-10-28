-- PermissionSlip and PermissionSlipRecipient policies read each other, so Postgres refuses to rewrite any
-- query on them (42P17, infinite recursion detected in policy). Make PermissionSlip a leaf: its parent
-- policy asks a SECURITY DEFINER helper instead of reading the recipient table.
--
-- The helper answers only for the caller's own session (app.user_id) and returns a boolean. The slip
-- tables use FORCE ROW LEVEL SECURITY, so the helper only bypasses RLS when its owner has BYPASSRLS, as
-- the other definer helpers assume. row_security = off makes an owner without it fail with an explicit
-- error instead of recursing.
CREATE OR REPLACE FUNCTION public.oasis_guardian_can_see_permission_slip(slip_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."PermissionSlipRecipient" psr
    JOIN public."Guardian" g ON g."studentId" = psr."studentId"
    WHERE psr."slipId" = slip_id
      AND g."userId" = current_setting('app.user_id', true)
  )
$$;

DROP POLICY IF EXISTS permission_slip_parent_select ON "PermissionSlip";

CREATE POLICY permission_slip_parent_select ON "PermissionSlip"
  FOR SELECT
  USING (
    "active" = true
    AND current_setting('app.user_role', true) IN (
      'Parent',
      'Head',
      'Principal',
      'Pastor',
      'HeadOfDiscipline',
      'TechnicalSupport',
      'ClubsAdmin',
      'Supervisor'
    )
    AND public.oasis_guardian_can_see_permission_slip("PermissionSlip"."id")
  );
