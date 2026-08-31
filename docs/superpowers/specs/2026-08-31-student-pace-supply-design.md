# Student PACE Supply and Ordering Design

## Purpose

Give a Head a calm, internal workspace for tracking each student's PACE supply and planning orders made separately on the external CEE/A.C.E. site. The portal never places third-party orders.

The most important job is knowing, at a glance, which student needs more PACEs soon and recording the selected PACEs without entering one number at a time.

## Scope

- Record student-specific PACE supply by subject and PACE number.
- Add a student's existing supply in bulk using a subject-aware multi-select catalogue.
- Create one tracked order line for each selected PACE number, retaining the existing Ordered → InTransit → Delivered workflow.
- Trigger a Head alert when a student has only two available PACEs ahead of their current PACE in a subject.
- Keep diagnostics as Head reference records only; they do not modify student PACE progress.
- Allow a Head to remove a mistaken diagnostic record with confirmation and an audit trail.
- Ensure `/admin/pace` is not active while `/admin/pace/inventory` is active.

Out of scope:

- Integration with CEE/A.C.E. ordering systems.
- Shared centre stock or transfer of PACEs between students.
- Automatically setting or rewinding a student's current PACE from diagnostic results.

## Domain model

### Student-specific supply

Add a `StudentPaceSupply` record keyed by `(studentId, subjectId, paceNumber)`. A record means that one copy of that PACE is available to the named student in the named subject.

The record keeps its source (`CurrentStock` or `DeliveredOrder`), timestamps, and actor for auditability. A PACE is a one-time-use booklet, so duplicate copies of the same PACE for the same student/subject are not represented as a quantity.

### Orders

Keep `PaceInventoryOrder` as one line per student, subject, and PACE number. A bulk selection creates multiple independent order lines, all scoped to the selected student and subject. This preserves per-PACE status transitions and lets delivery create the corresponding `StudentPaceSupply` record.

Existing delivery semantics remain: only a Delivered order adds a PACE to that student's available supply. Current supply entered by the Head is immediately available without creating an external order.

### Alerts

For each active student-subject assignment, derive available future PACEs from the student's supply records whose `paceNumber` is greater than their `currentPaceNumber`.

Create an alert when fewer than three future PACEs are available. In other words, an alert is present when the student has two or fewer PACEs left after their current one. Ordered and InTransit lines appear in history but do not count as available supply.

### Diagnostics

`DiagnosticResult` remains a Head reference record. Recording it does not change `StudentSubject.currentPaceNumber`.

Delete is a soft delete: preserve the record and actor/timestamp for audit purposes, hide it from the normal diagnostic history, and never change the student's current PACE. A confirmation dialog explains that deletion removes the reference result only.

## PACE catalogue

Use an application-owned catalogue based on the centre's established PACE sequence: 12 PACEs per level, numbered from 1001 through 1144 for Levels 1 through 12. The selected subject controls the catalogue context and all added/ordered items are bound to that subject.

This is intentionally not a live scrape or external-store integration. A.C.E. publishes the 12-PACE-per-subject-level convention, but course ranges and editions can differ; a local deterministic catalogue keeps this operational screen reliable.

## User experience

The web inventory route keeps the existing portal components and tokens. The page has one primary flow:

1. Choose a student and one assigned subject.
2. See the student's current PACE, current available PACE chips, and any two-PACE alert.
3. Use the primary PACE picker to select multiple numbered PACEs, grouped by level, then either add them as current supply or create tracked order lines.
4. Advance order-line statuses as they change externally; Delivered lines move into that student's supply.

Diagnostic reference is visually separate from supply and ordering. It uses the same student and subject context, provides Level/Pass-Fail controls, a concise explanation that it does not alter progress, and an explicit labelled delete action for each saved result.

This applies Apple-inspired product-design principles without copying Apple styling: clear hierarchy, a single obvious next action, concise status feedback, keyboard-accessible selections, visible labels alongside status colour, confirmation for deletion, and responsive reflow. Any motion is limited to existing list feedback and respects reduced-motion preferences.

## Access, validation, and audit

- All procedures and RLS rules remain Head-only.
- Supply and orders can be created only for active student-subject assignments.
- The server validates every selected PACE number against the supported catalogue range and rejects duplicates for a student-subject supply.
- Order transitions remain forward-only.
- Create, delivery/supply, and diagnostic deletion actions are audited.

## Navigation

Extend admin navigation route matching so PACE Progress is active only for its exact `/admin/pace` route. PACE Inventory owns `/admin/pace/inventory` and all of its nested routes.

## Verification

- Domain tests for catalogue grouping, availability calculation, and the two-PACE reorder threshold.
- API tests for bulk supply/order inputs, delivery creating supply, duplicate protection, Head-only access, and diagnostic soft deletion without PACE mutation.
- Web tests for active navigation and key workflow surface contracts.
- Web lint, typecheck, formatting, and relevant test suites.
