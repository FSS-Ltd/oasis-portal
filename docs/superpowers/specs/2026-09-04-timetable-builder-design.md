# Timetable Builder Design

**Date:** 4 September 2026
**Status:** Approved

## Purpose

Build a termly timetable system for Oasis Learning Centre that lets any active Head configure shared teaching schedules for the ABC, Primary, and Secondary age groups, create and publish a personalised timetable for each child, and download a professional printable PDF. Parents and students can view only the latest published timetable available to them.

The experience must work across the existing web portal and mobile/PWA app. It should feel calm, clear, responsive, and carefully made while preserving the established Oasis brand and component conventions.

## Authoritative term dates

The existing active `CalendarEvent` term-boundary records remain the source of truth. Timetable records reference stable teaching-term keys and do not create a second editable term-date configuration.

The 2026/27 teaching terms are:

| Term   | Starts                   | Ends                    |
| ------ | ------------------------ | ----------------------- |
| Term 1 | Tuesday 8 September 2026 | Friday 16 October 2026  |
| Term 2 | Tuesday 3 November 2026  | Friday 18 December 2026 |
| Term 3 | Tuesday 5 January 2027   | Friday 12 February 2027 |
| Term 4 | Tuesday 23 February 2027 | Thursday 25 March 2027  |
| Term 5 | Tuesday 13 April 2027    | Friday 28 May 2027      |
| Term 6 | Tuesday 8 June 2027      | Friday 23 July 2027     |

The timetable API will pair the existing program-owned `calendar-YYYY-YY-term-N-start` and `calendar-YYYY-YY-term-N-end` events into typed teaching terms. It will ignore unrelated calendar events and reject an incomplete selected term. Existing calendar administration, seasonal logic, and holiday behaviour remain unchanged.

## Core rules

- Tuesday through Friday are the fixed teaching days for every age group.
- Each term has one shared slot schedule for ABC, one for Primary, and one for Secondary.
- A Head can add, remove, rename, reorder, retime, or change the kind of any slot.
- A slot is either a lesson or a break. Break slots may appear anywhere in the sequence.
- New age-group schedules begin with sensible default lesson and break times based on the supplied timetable reference.
- Every child in an age group shares that group's ordered days and slot times for the term.
- Subject placement is personalised per child.
- Empty subject cells are valid because some children will not yet study every subject. The builder presents a non-blocking suggestion before publishing but does not require every cell to be filled.
- Publishing happens independently per child.
- Draft edits never change the last published timetable visible to a parent or student.
- A child is counted as complete for the term when that child has at least one published timetable version for the term.

## Subject catalogue and colours

The existing reusable subject catalogue remains authoritative. The timetable feature adds a semantic timetable colour to each subject.

| Subject             | Timetable colour |
| ------------------- | ---------------- |
| Maths               | Yellow           |
| English             | Red              |
| Literature          | Pale red         |
| Word building       | Purple           |
| Science             | Dark blue        |
| Animal science      | Light blue       |
| Social studies      | Green            |
| Bible studies       | Brown            |
| Newly added subject | Grey             |

Colours use accessible design tokens rather than arbitrary per-screen values. Every cell also displays the subject name, so meaning never depends on colour alone.

In a child's timetable, the subject picker shows subjects assigned to that child. An inline input lets the Head create an extra reusable school-wide subject. The new subject is assigned to the selected child and receives the grey timetable colour by default. Existing subject management and assignment behaviour must remain intact.

## Data model

Use a normalised relational model.

### Shared age-group schedule

One schedule record is unique by teaching-term key and registration level (`ABC`, `Primary`, or `Secondary`). It owns an ordered collection of slots. Each slot stores:

- kind (`Lesson` or `Break`);
- display label;
- start and end minutes;
- stable position.

Schedule writes validate that labels are present, ranges are positive, and ordered slots do not overlap. A break is not constrained to a predefined position.

### Child draft

One child timetable record is unique by child and teaching term. It stores the age-group schedule used by the draft and owns zero or one subject placement for each Tuesday-Friday and slot combination. Empty combinations remain valid.

### Published version

Publishing creates an immutable publication and publication-entry set. Each publication copies the display information required to reproduce the exact released timetable:

- term label and start/end dates resolved from the calendar at publication time;
- teaching day;
- slot position, kind, label, and time range;
- subject identifier where available;
- subject name and semantic colour at publication time.

This keeps the latest published portal view and historical PDFs stable while the Head edits a new draft, changes a shared schedule, or later renames a subject.

The child timetable points to its latest publication. Previous publications remain immutable audit history and are not exposed as editable records.

### Personal task linkage

System-generated timetable tasks use a stable system source/key per Head and teaching term. The uniqueness rule prevents duplicate automated tasks without affecting manually created personal tasks.

## Access control and audit

- Only an authenticated active user whose role is exactly `Head` may create or modify schedules, drafts, subjects through the timetable workflow, or publications.
- A Head may manage all active children.
- A Parent may read only the latest published timetable for a linked active child.
- A Student may read only their own latest published timetable.
- Other staff roles do not gain timetable-management access implicitly.
- All schedule, draft, subject-creation, and publication mutations validate access at the API boundary.
- Material timetable mutations write audit records without leaking encrypted personal data into audit metadata.

## Automated Head tasks

Every active Head receives one automated personal task for each teaching term resolved from the existing calendar records. The task is due and reminds the Head seven days before the term starts.

The visible title includes live publication progress, for example:

> Complete Term 1 timetables · 18/24 done

The denominator is the current number of active children. The numerator is the number of those children with a published timetable for the selected term.

Task synchronisation is idempotent. It runs from the Head timetable dashboard and the Head personal-task list, and after relevant publication changes. It creates a missing system task, refreshes its title and progress, and marks it complete once the total is greater than zero and `done === total`. If an active child is subsequently added and no longer has a publication for that term, synchronisation reopens the system task. A Head may still complete the task manually.

Each active Head receives their own task and sees the same centre-wide count.

## Head web experience

Add a dedicated **Timetables** destination to the Head administration navigation.

The workspace header contains:

- the selected teaching term and dates;
- an age-group filter;
- live `done/total` progress;
- a clear distinction between draft and published state.

The workspace has two focused modes.

### Age-group schedule

The Head selects ABC, Primary, or Secondary and edits the ordered slot list. Rows provide labelled start/end time inputs, a lesson/break control, and accessible reorder, add, and remove actions. Reordering must work with both pointer and keyboard input; no drag-only dependency is required.

### Child timetable

A child list can be filtered by age group, name, and draft/published completion state. Selecting a child opens a Tuesday-Friday grid using the applicable shared schedule. Each lesson cell opens a subject picker. Break cells are structural and not assignable.

The picker exposes the child's assigned subjects and an inline add-subject flow. A persistent action area provides **Save draft** and the primary **Publish timetable** action. Saving, pending, success, validation, and error states remain attached to the triggering action.

Publishing with unassigned lesson cells presents a non-blocking confirmation that names the count of unassigned periods. Structural schedule errors block publication and identify the affected slot.

## Mobile/PWA experience

Add a Head-only Timetables destination to the existing staff mobile portal.

The mobile builder uses the same API and records as web but adapts rather than squeezing the desktop grid:

- age-group slots render as touch-friendly ordered cards with explicit move-up/move-down actions;
- child selection and progress filters use existing mobile selection patterns;
- the timetable uses one weekday tab at a time;
- lesson cells are comfortably tappable and show both colour and subject text;
- save and publish actions remain reachable in a stable action area;
- all controls have accessible names and visible focus/touch states.

The Head can download the published child PDF from mobile. If a platform cannot display the PDF inline, it uses the platform's standard download/share handoff.

## Parent and student views

Add a read-only **Timetable** destination to both parent and student web and mobile portals.

- A parent selects among linked children using the existing child-switching pattern.
- A student sees only their own timetable.
- The latest published timetable is selected for the current or chosen term.
- Draft data, unpublished children, management controls, and publication history are never returned to these readers.
- An empty state explains that the timetable has not yet been published and offers no misleading edit action.
- Wide screens use the full grid. Narrow screens use day tabs/cards while preserving slot times, labels, subject text, and colours.

## PDF output

Generate the timetable PDF server-side using the repository's existing `pdf-lib` approach. Generation is available only for a published child timetable.

The output is A4 landscape and follows the supplied reference while using established Oasis assets and a more polished production layout:

- Oasis Learning Centre title and crest;
- the child's first name prominently displayed;
- term number and exact term dates;
- Tuesday-Friday rows;
- ordered lesson and break columns with labels and precise times;
- semantic subject colours plus readable subject names;
- break cells showing `B.R.E.A.K.` vertically;
- restrained borders, spacing, typography, and print-safe contrast.

Text remains vector text rather than being baked into an image. Long subject names wrap or scale within defined limits. File names are safe and include the child's first name and term label.

## Validation and error handling

Publication blocks only structural or referential errors:

- no usable schedule slots;
- a blank slot label;
- an end time that is not after its start time;
- overlapping ordered slots;
- a stale or inactive referenced subject;
- a draft tied to a different age group than the child's current registration level.

Unassigned lesson periods are suggestions, not errors. The Head may publish after acknowledging the warning.

Mutations return concise user-facing errors and preserve the current editing context. Failed saves do not present unsaved data as persisted. Queries provide intentional loading, empty, and retry states. Routine state changes use minimal transform/opacity feedback and respect reduced-motion preferences.

## Testing and verification

Use test-driven development for each behavioural slice.

### Domain tests

- term-key and reminder-date calculation;
- default subject-colour mapping;
- slot ordering and overlap validation;
- publication progress calculation.

### Database and API tests

- pairing the existing active calendar boundary records into the exact 2026/27 numbered terms;
- rejecting an incomplete selected term without duplicating calendar dates;
- migration structure and uniqueness constraints;
- Head-only mutation access;
- reusable subject creation and child assignment;
- schedule and draft CRUD validation;
- non-blocking unassigned periods;
- immutable publications and latest-publication selection;
- parent linked-child and student self-only reads;
- automated task creation, deduplication, title refresh, completion, and reopening;
- audit records for material mutations.

### PDF tests

- successful A4 landscape generation from a publication;
- safe filename containing the child's first name and term;
- extracted text includes the title, child first name, term, days, slot times, subject names, and vertical break letters;
- representative long subject names remain within the grid.

### Web and mobile tests

- role-gated navigation wiring;
- draft/published state handling;
- schedule editing and explicit accessible reorder controls;
- subject picker and inline reusable-subject flow;
- parent/student read-only boundaries;
- responsive desktop/mobile presentation contracts;
- loading, empty, warning, success, and error states.

Before completion, run the repository CI-equivalent checks from the root:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

Run affected web and mobile production builds where the environment supports them, inspect every changed file, and review the final diff for unrelated changes, unsafe access, duplication, and inaccessible interaction states.

## Out of scope

- Monday or weekend teaching days;
- staff timetable or room-allocation scheduling;
- automatic conflict optimisation;
- parent/student editing;
- custom per-subject colours for newly added subjects;
- bulk combined PDF packs;
- replacing the existing calendar, subject-management, or personal-task systems.
