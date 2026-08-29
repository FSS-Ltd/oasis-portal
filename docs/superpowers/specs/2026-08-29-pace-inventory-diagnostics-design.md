# PACE inventory and diagnostic placement design

## Purpose

Give Heads a reliable, student-specific workflow for recording PACE supplies,
tracking delivery, identifying stock that will run out soon, and recording
subject diagnostic outcomes that place a student on the correct starting PACE.

## Scope and access

The feature is available to Heads through the staff portal.  Its server-side
procedures enforce the same Head-level administrative boundary; the mobile
navigation is only a convenience layer, not an authorisation mechanism.

The existing PACE score-entry workflow remains unchanged.

## Data model

`PaceInventoryOrder` represents one PACE supplied for one student and subject.
It contains `studentId`, `subjectId`, `paceNumber`, `status`, the user who
created it, and status timestamps.  `status` is an enum with `Ordered`,
`InTransit`, and `Delivered`.  A delivered row is stock available to that
student; rows in the other states are visible operationally but do not count
as stock.

`DiagnosticResult` represents one subject-level result.  It contains
`studentId`, `subjectId`, `level` (integer 1–5), `outcome` (`Pass` or `Fail`),
the recording user, and the recorded timestamp.  A result is immutable
academic history; correcting it creates a later result and applies the new
placement deliberately.

Both entities are indexed by student and subject.  Orders are additionally
indexed by status and PACE number to make the inventory screen and reorder
calculation efficient.  They use foreign keys to the existing `Student`,
`Subject`, and `User` records and receive RLS policies consistent with their
Head-only API boundary.

## Business rules

For each student/subject pair, the effective stock boundary is the highest
delivered `paceNumber`.  A reorder alert is required when the student's
`StudentSubject.currentPaceNumber` is greater than or equal to that boundary
minus two.  Orders that are merely ordered or in transit do not silence the
alert, because they are not available stock.

The alert is returned as a dedicated Head inventory notification in the
inventory summary, rather than sent to the student notification inbox.  It is
deduplicated per student, subject, and delivered stock boundary, so refreshing
the screen never creates repeated alerts.  It clears naturally once a later
PACE is marked delivered.

Saving a diagnostic result updates the matching `StudentSubject` to the first
PACE of the selected level.  The level-to-PACE mapping uses the established
12-PACE ACE ranges: Level 1 starts at 1001, Level 2 at 1013, through Level 5
at 1049.  Therefore a Level 1 pass followed by a Level 2 fail places the
student at the first PACE of Level 2 (1013), as requested.  The diagnostic
outcome is retained for reporting even though placement is determined by the
tested level.

## API

The new `academicInventory` tRPC router exposes:

- `summary`: active students, their subjects/current PACEs, recent orders,
  diagnostic history, and current two-PACE reorder alerts;
- `createOrder`: validates the selected student, subject, positive PACE
  number, then creates an `Ordered` row;
- `updateOrderStatus`: permits only forward state changes, records the
  timestamp, and recomputes affected alert data;
- `recordDiagnostic`: validates student, assigned subject, level 1–5, and
  outcome, records the result and updates the student's current PACE in one
  transaction.

Every mutation creates an audit log entry.  Student names are decrypted only
after authorised access and following the existing PII audit convention.

## Staff workflow

A new staff screen has two sections:

1. **PACE inventory** — creates a per-student, per-subject PACE order with
   a student dropdown, subject dropdown, and PACE number.  It lists existing
   orders with status controls and presents low-stock alerts first.
2. **Diagnostics** — records a student-selected, subject-selected diagnostic
   result with a Level 1–5 picker and Pass/Fail picker.  On success it shows
   the newly assigned starting PACE.

The staff-home quick action is shown only to authorised Heads.  Loading,
empty, mutation-pending, validation-error, and access-denied states follow
the existing mobile staff screen patterns.

## Verification

API tests will cover Head authorisation, order/status validation, per-student
and subject isolation, the two-PACE low-stock threshold, in-transit stock not
silencing an alert, delivered stock clearing it, and diagnostic level-to-PACE
placement (including a Level 2 failure).  Mobile wiring tests will cover the
new staff route and the linked student/subject dropdown workflow.  Typecheck,
lint, and the relevant API/mobile test suites will run after implementation.
