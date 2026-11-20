-- Demerits wait for Head approval before parents see them (docs/demerit-parent-release-design.md).
-- Existing rows default to Released so history and merit balances do not change.
CREATE TYPE "BehaviourReleaseStatus" AS ENUM ('Pending', 'Released');

ALTER TABLE "BehaviourEntry"
  ADD COLUMN "parentReleaseStatus" "BehaviourReleaseStatus" NOT NULL DEFAULT 'Released',
  ADD COLUMN "releasedAt" TIMESTAMP(3),
  ADD COLUMN "releasedById" TEXT;

ALTER TABLE "BehaviourEntry"
  ADD CONSTRAINT "BehaviourEntry_releasedById_fkey"
  FOREIGN KEY ("releasedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BehaviourEntry_parentReleaseStatus_idx" ON "BehaviourEntry"("parentReleaseStatus");
CREATE INDEX "BehaviourEntry_releasedById_idx" ON "BehaviourEntry"("releasedById");

CREATE TABLE "BehaviourNoteEdit" (
  "id" TEXT NOT NULL,
  "behaviourEntryId" TEXT NOT NULL,
  "previousNoteEnc" TEXT,
  "nextNoteEnc" TEXT,
  "editedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BehaviourNoteEdit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BehaviourNoteEdit_behaviourEntryId_createdAt_idx" ON "BehaviourNoteEdit"("behaviourEntryId", "createdAt");
CREATE INDEX "BehaviourNoteEdit_editedById_idx" ON "BehaviourNoteEdit"("editedById");

ALTER TABLE "BehaviourNoteEdit"
  ADD CONSTRAINT "BehaviourNoteEdit_behaviourEntryId_fkey"
  FOREIGN KEY ("behaviourEntryId") REFERENCES "BehaviourEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BehaviourNoteEdit"
  ADD CONSTRAINT "BehaviourNoteEdit_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Realtime: every note edit also updates its BehaviourEntry in the same transaction,
-- which already notifies the behaviour areas, so the edit log is excluded.
INSERT INTO oasis_private.model_coverage (model,areas,audience) VALUES
('BehaviourNoteEdit',ARRAY[]::text[],'excluded');

-- Managed Postgres runs migrations as postgres. Hand the new table and enum to oasis_owner,
-- grant only oasis_app, and close Supabase client roles. Plain CI/local databases skip missing roles.
DO $$
DECLARE client_role text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oasis_owner') THEN
    ALTER TABLE "BehaviourNoteEdit" OWNER TO oasis_owner;
    ALTER TYPE "BehaviourReleaseStatus" OWNER TO oasis_owner;
  END IF;
  REVOKE ALL ON TABLE "BehaviourNoteEdit" FROM PUBLIC;
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE "BehaviourNoteEdit" FROM %I', client_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oasis_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "BehaviourNoteEdit" TO oasis_app;
  END IF;
END;
$$;
