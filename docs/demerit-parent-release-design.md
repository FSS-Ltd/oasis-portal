# Design note: Head approval before demerits reach parents

**Status:** In progress
**Last updated:** 2026-11-20

## Problem statement

Every non-sensitive demerit is emailed to guardians the moment staff log it,
appears in the parent dashboard, web and mobile, and deducts from the child's
merit balance at once. The Head has no chance to correct the wording or throw
out a demerit logged in error before the family sees it.

The Head wants every demerit to wait for a decision:

- **Approve as is**: the demerit is released to parents and applied.
- **Edit the note, then approve**: parents see only the final note. The edit
  history is visible to staff only.
- **Reject**: the demerit is deleted from the child's record.

Until the Head approves, the demerit is invisible to parents and students, sends
no email, and does not touch the merit balance.

## Architecture approach

### Release status on the entry

`BehaviourEntry` gains `parentReleaseStatus` (`Pending` | `Released`, default
`Released`), plus `releasedAt` and `releasedById`.

- The four demerit write paths in `apps/api/src/routers/behaviour.ts` (`log`,
  `logForStudents`, `logMany`, `logManyForStudents`) create demerits as
  `Pending`, skip `rowsForDemerit`, and skip `notifyBehaviourGuardians`.
- Merits and General marks are unchanged: `Released` on write, as today.
- Existing rows default to `Released`, so history and balances do not move.

Why a status column and not `visibility = 'Sensitive'`: `Sensitive` also hides
the entry from other staff (RLS `behaviour_supervisor_general`). A pending
demerit must stay visible to staff. Why not set `meritDelta = 0` while pending:
the daily demerit policy stages (`demeritPolicyStatusForEntries`) count units
from `meritDelta`, so zeroing it would let staff log several demerits that all
land at stage one.

### Held deduction

Pending demerits keep their policy-derived `meritDelta` (so staging still works)
but have no `MeritLedger` rows. On approval the API writes `rowsForDemerit` from
the final `meritDelta`. Readers that sum `meritDelta` for a child-facing number
filter to `Released`:

| Reader                                                           | Audience                | Change                              |
| ---------------------------------------------------------------- | ----------------------- | ----------------------------------- |
| `childLog.parentDashboard`                                       | Parent                  | `Released` only                     |
| `childLog.drillThrough` / `snapshot` via `visibleBehaviourWhere` | Parent, Student         | `Released` only for non-staff roles |
| `report` behaviour sections                                      | Parent (emailed report) | `Released` only                     |
| `meritLedger.activity`                                           | Student, Parent wallet  | `Released` only                     |
| `leaderboard` demerit totals                                     | Student-visible ranks   | `Released` only                     |
| `tithe-run` earnings                                             | Student wallet          | `Released` only                     |
| RLS `behaviour_guardian_own_child`, `behaviour_student_self`     | Parent, Student         | `Released` only (defence in depth)  |

Staff lists (`listForStudent`, `recentEntries`, staff drill-through) keep
showing pending demerits, flagged `Awaiting head`.

### Head decision procedures (full admin only)

New procedures on the behaviour router, gated by the existing
`fullAdminProcedure` (Head, Principal, Pastor, HeadOfDiscipline), which returns
`FORBIDDEN` to everyone else.

- `behaviour.parentReleaseQueue`: pending demerits with student, author,
  category, note, merit value, visibility, logged time and note edit log.
- `behaviour.releaseDemerit({ id, note? })`: inside one RLS transaction, the
  entry must be a non-deleted pending demerit (`updateMany` on status
  `Pending` so a double click cannot release twice). When `note` differs from
  the current note it writes a `BehaviourNoteEdit` row and the new `noteEnc`.
  It sets `Released`, `releasedAt`, `releasedById`, writes ledger rows, then
  audits. After commit it calls `notifyBehaviourGuardians`, which still skips
  `Sensitive` entries.
- `behaviour.rejectDemerit({ id })`: deletes a pending demerit outright, as the
  Head asked. No ledger rows exist, so no corrections are needed; note edits
  cascade. Audited as `Delete` with source `behaviour.parentRelease.reject`
  (student, category, merit value). A soft delete is not possible here: the
  `behaviour_full_admin_select` policy hides rows with `deletedAt` set, and
  Postgres checks the updated row against SELECT policies, so the update is
  refused. A narrow RLS policy, `behaviour_full_admin_delete_pending`, allows
  full admins to delete only `Pending` demerits.

`updateEntry` on a pending demerit skips the ledger correction row (no
deduction was applied yet) and logs note changes to `BehaviourNoteEdit`.

### Note edit log

New model `BehaviourNoteEdit { id, behaviourEntryId, previousNoteEnc,
nextNoteEnc, editedById, createdAt }`. Notes are PII, so both sides are
encrypted (ADR-005). Only full-admin and staff procedures select it; no parent
or student procedure does. Like `ChildNote`, access is enforced by tRPC RBAC.

### Web UI

A **Parent release** queue for the Head on the web admin, beside the existing
Sensitive Review page. Each card shows the child, category, merit value,
author, time, and the note in an editable field, with Approve and Reject.
Reject asks for confirmation because it removes the demerit from the record.

Accessibility work found during review, applied to the shared admin shell
because the page cannot pass without it: sidebar group labels raised to 7.4:1,
profile avatar initials to 5.3:1, and a "Skip to main content" link as the
first Tab stop. Toasts moved to bottom-right (above the tab bar on phones)
with a right-hand close button, and every mobile bottom-tab label is equally
readable. axe-core reports 0 violations on the page at 1440 and 390 px.

Merit tiles are tinted by severity (1 to 2, 3 to 5, 6 and up) so the queue
can be scanned by weight.

### Mobile

Out of scope for this change. The queue is added to the mobile redesign
hand-off so it ships when that work starts.

## Data model

```prisma
enum BehaviourReleaseStatus { Pending Released }

model BehaviourEntry {
  // ...existing fields
  parentReleaseStatus BehaviourReleaseStatus @default(Released)
  releasedAt          DateTime?
  releasedById        String?
  noteEdits           BehaviourNoteEdit[]
  @@index([parentReleaseStatus])
}

model BehaviourNoteEdit {
  id               String   @id @default(cuid())
  behaviourEntryId String
  previousNoteEnc  String?
  nextNoteEnc      String?
  editedById       String
  createdAt        DateTime @default(now())
}
```

## Failure modes and resilience

- **Double approval** (two tabs, double click): the status flip is a
  conditional `updateMany` on `Pending`. The loser gets `CONFLICT` and writes
  nothing.
- **Approve then email fails**: the release is committed first; email failures
  are already audited per guardian by `notifyBehaviourGuardians` and do not
  roll back the release.
- **Head never reviews**: the demerit stays pending and nothing reaches the
  family. The pending count shows as a badge on the "Demerit Approvals" nav
  item and on the page, so backlog is visible.
- **Policy stage drift after a rejection**: later demerits that day keep the
  stage computed when they were logged. Accepted; the Head can still edit
  values with `updateEntry` before approving.

## Security and privacy

- Decisions are full-admin only, enforced in tRPC and audited.
- Parent and student reads are filtered in the API and again by RLS.
- Edit history stays staff-side; parents only ever receive the final note.
- No new secrets or external services.

## Rollout and rollback

- Migration adds nullable/defaulted columns and a new table; existing rows read
  as `Released`, so deploying changes nothing for history.
- From deploy, new demerits wait for the Head. Tell the Head before release so
  the queue is checked daily.
- Rollback: release all pending demerits through the queue (or a one-off
  script that calls the same release path), then revert the app. The columns
  can stay.

## Success metrics

- Zero demerit emails sent without a `Released` status (audit log check).
- Median time from log to decision under one school day.
- Rejection and edit counts visible in the audit log for the Head's review.
