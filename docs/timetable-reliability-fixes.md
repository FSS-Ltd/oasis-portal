# Timetable and term rota fixes

The September 5 production failures affected transaction acquisition, term rota inserts, and publishing an unsaved timetable.

## Changes

- Rota batches use one bulk insert and return shifts in date order.
- Ordinary RLS transactions can wait up to 10 seconds for a connection. Execution timeout and RLS session variables remain unchanged. This mitigates transient contention; production pool metrics are still needed to identify sustained saturation.
- Timetable workspace reads and publication no longer repeat task reconciliation. The personal-task list owns reconciliation and is invalidated after publication.
- Publish saves the current child selections first. Save failure prevents publication; controls remain disabled across the sequence.
- Shared schedule saves refresh child drafts and reset editors to saved slot IDs.
- Recognised subject names use the requested colours, including legacy Maths records. Extra subjects use grey.

## Rollout

Apply `pnpm db:migrate` from a checkout containing these fixes with the configured migration database environment. The colour migration updates Subject colours and corresponding published-entry colours. It changes no lesson assignments, names, or publication dates. Previously exported PDFs are not changed.

The migration attempt in the isolated worktree failed with Prisma P1012 because DIRECT_URL was absent. No production database changes have been made by this task.

After deployment, verify a new child's timetable can publish directly, edited selections are included, shared-slot changes survive a second save, and a full-term rota batch saves. Check a previously published timetable and its newly downloaded PDF for subject colours.

## Verification

Targeted API tests cover timetable readers, publication snapshots, sparse lesson acknowledgement, task reconciliation, RLS settings, and rota batches. Component interaction tests verify saving before publishing and stopping after save failure. API and web typechecks and focused lint pass. Live database migration, browser end-to-end verification, and production load testing remain rollout checks.
