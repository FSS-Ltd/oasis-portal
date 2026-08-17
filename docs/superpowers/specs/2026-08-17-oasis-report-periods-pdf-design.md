# Oasis Report Periods and PDF Design

Status: Approved for implementation
Owner: Technical Agent
Date: 2026-08-17

## Problem

Oasis term reports currently support only three hard-coded 2026 terms. The Head can generate a snapshot, edit one Head Summary field, review it, and send it to linked parents. The report cannot use an academic-year or custom date range, staff cannot choose which sections appear, report-specific Behaviour or General Notes cannot be added, PACE identifiers use a thousands formatter, subject progress status is absent, and the workflow does not produce a student-report PDF.

## Goals

- Let authorised administrators generate a report for an academic year, an Oasis term, or an inclusive custom date range.
- Let the administrator choose the report sections before generating the draft.
- Add an editable Progress Comment section.
- Let the administrator append, edit, and remove report-specific Behaviour Notes and General Notes until the report is sent.
- Keep imported source notes read-only and keep report-specific additions out of the student's permanent Behaviour and Child Note records.
- Display PACE identifiers without thousands separators, for example `1025` rather than `1,025`.
- Snapshot each subject's Behind, On Track, Ahead, or Unavailable status using the existing Oasis PACE status rule.
- Let PACE status be included or hidden independently while PACE Progress is included.
- Preserve the existing draft, review, send, parent visibility, encryption, and audit behavior.
- Produce a professional Oasis-branded PDF that reflects the frozen report snapshot and selected sections.
- Let authorised administrators download draft/review PDFs and linked parents download sent PDFs.
- Store the exact encrypted final PDF when the report is sent.

## Non-Goals

- Report-specific notes do not create, edit, or delete source `BehaviourEntry` or `ChildNote` records.
- Imported source notes remain read-only inside the report editor.
- The report does not attach a PDF to notification emails; the existing notification links recipients to the parent portal.
- The work does not change PACE advancement or scoring policy.
- The work does not add configurable school term dates. It uses the existing Oasis term boundaries.
- The work does not add a mobile-native report editor.
- The work does not redesign unrelated invoice or incident PDF generators.

## Chosen Approach

Extend the existing encrypted snapshot workflow rather than building a browser print page or recompiling source records at download time. A draft records its period, selected sections, source data, progress comment, and report-specific notes. Review updates the editable report fields. Send generates and stores the final encrypted PDF before the report becomes visible to linked parents.

Draft and reviewed PDFs are generated from the saved snapshot on demand. Sent downloads return the stored PDF bytes so the final document cannot change after a later PDF template update. Existing sent reports that predate stored PDF fields may be generated from their frozen encrypted snapshot on first download; they must never be recompiled from current source records.

The API continues to use the repository's existing `pdf-lib` dependency and Oasis PDF visual language. No new runtime dependency is required.

## Report Periods

The report period is a discriminated value with these forms:

- `AcademicYear`: accepts the academic-year start year. The inclusive range is 1 September through 31 August, and the label is `2025/26 Academic Year` for start year 2025.
- `Term`: accepts an Oasis term id such as `2026-Spring`. Existing boundaries apply: Spring is 1 January through 31 March, Summer is 1 April through 31 August, and Autumn is 1 September through 31 December.
- `Custom`: accepts ISO date-only `from` and `to` values. Both endpoints are included, and `from` must not be after `to`.

Date-only input is resolved at the API boundary to a UTC half-open query range: the selected start at 00:00 UTC through 00:00 UTC on the day after the inclusive end. The UI and PDF always show the inclusive dates selected by the administrator.

Each period has a stable key so one student has at most one report for the same period:

- Term: `2026-Spring`
- Academic year: `2025-AcademicYear`
- Custom: `2026-01-15_to_2026-03-20`

Generating the same unsent period again refreshes source data while preserving its saved Progress Comment and report-specific notes. A sent report cannot be regenerated or edited.

## Section Selection

The draft controls show accessible checkboxes for:

- Attendance
- PACE Progress
- PACE Status
- Behaviour Summary
- Behaviour Notes
- General Notes
- Merit Activity
- Balances
- Progress Comment

All sections are selected by default. PACE Status is enabled only when PACE Progress is selected. Clearing PACE Progress also clears and disables PACE Status. The API validates the same invariant so a client cannot request a status column without the PACE section.

Selection happens before draft generation. Only source data needed by selected sections is decrypted and copied into the snapshot. The snapshot retains explicit section visibility so the editor, parent view, and PDF can distinguish an intentionally hidden section from an included section with no records. To change sections on an unsent report, the administrator changes the selection and regenerates the draft.

## Snapshot Shape

The compiled snapshot adds:

- `period`: type, stable key, display label, inclusive start, and inclusive end.
- `sections`: the nine visibility booleans.
- `paces[].status`: status label, tone, testing-level label, and explanatory detail.
- Stable ids and an origin marker for Behaviour and General Note entries.
- Report-specific note entries alongside imported source entries.
- The existing internal `headSummary` value, exposed in the UI and PDF as `Progress Comment` for encrypted-snapshot compatibility.

Imported entries use their source record id and `Source` origin. Report-specific entries use a generated id and `Report` origin. The origin is not presented as a judgment to parents; it exists to keep source entries immutable and report additions editable.

PACE status is calculated at draft generation with `paceProgressStatusForYear(currentPaceNumber, student.yearGroup)` and frozen into the snapshot. `Unavailable` is a valid result for PACE numbering or year groups that cannot be mapped. Current PACE is a numeric identifier, not a quantity; the report UI and PDF render it with `String(currentPace)` rather than the shared thousands formatter.

Legacy encrypted snapshots remain readable. Missing section visibility defaults to the legacy behavior of showing all existing sections, missing period metadata is derived from the legacy term key, and missing PACE status renders as Unavailable. No migration attempts to decrypt and rewrite historical snapshots.

## Data Model and Migration

Keep the Prisma model and database table name `TermReport` to avoid a destructive table rename, but treat it as the persisted student report record in application code.

Add a `ReportPeriodType` enum with `Term`, `AcademicYear`, and `Custom`. Extend `TermReport` with:

- `periodKey String @map("term")` so application code uses the general name while preserving the existing database column and unique index.
- `periodType ReportPeriodType`
- `periodLabel String`
- `periodStart DateTime @db.Date`
- `periodEnd DateTime @db.Date`
- `pdfBytesEnc String?`
- `pdfFileNameEnc String?`
- `pdfGeneratedAt DateTime?`

The migration adds period metadata as nullable, backfills every existing `YYYY-Season` row using the existing term boundaries, then makes the fields required. Existing `term` values remain valid period keys. PDF fields remain nullable for historical reports.

The existing unique constraint continues to enforce one row per student and period key. Report configuration, report-specific notes, and Progress Comment remain inside `compiledJsonEnc` because they are part of the encrypted, frozen snapshot and require no independent querying.

## API Design

The `report` router retains existing permissions and exposes these behaviors:

- `draft`: accepts student id, discriminated period input, and section selection. It compiles a new draft or refreshes an existing unsent report for the same key.
- `review`: accepts report id, Progress Comment, report-specific Behaviour Notes, and report-specific General Notes. It validates ids and text limits, preserves imported entries unchanged, encrypts the updated snapshot, and moves the report to `UnderReview`.
- `send`: generates the final PDF from the saved snapshot. Only after successful generation and encryption does it set `Sent`, store PDF bytes/name/time, and notify guardians.
- `downloadPdf`: returns a safe filename, `application/pdf`, and base64 bytes. Full administrators may download any accessible draft/review/sent report. Linked guardians may download only sent reports for their linked child.
- `listForStudent`: continues to return all states to full administrators and sent reports only to linked guardians, now with period metadata.

Boundary validation includes:

- Valid date-only values and ordered custom endpoints.
- Valid academic-year start and Oasis term ids.
- At least one report section selected.
- PACE Status cannot be selected without PACE Progress.
- Progress Comment and each added note are trimmed, non-empty when present, and limited to 5,000 characters.
- Added-note ids must be unique within their note type.
- Source-origin entries from the encrypted snapshot cannot be changed or removed through review input.

Draft refresh queries only the selected period and sections. Attendance, PACE records, General Behaviour entries, non-sensitive Child Notes, and merit rows retain their current filtering and permission rules. Sensitive Behaviour and Child Notes remain excluded.

Every compile, edit, send, PDF generation/download, PII decryption, and permission denial uses the existing audit patterns. Errors returned to users remain safe and do not expose encrypted values or implementation details.

## Admin UI

Keep `/admin/reports` within the existing report workflow, but split new responsibilities into focused components rather than expanding the existing workflow and detail files into monoliths:

- Period controls: report type plus type-specific inputs.
- Section picker: checkbox list with the PACE dependency behavior.
- Report detail: read-only source sections and status display.
- Report note editor: add/edit/remove report-specific entries for one note type.
- Report actions: review, PDF preview/download, and send states.

The workflow is:

1. Select a student.
2. Choose Academic Year, Term, or Custom Date Range.
3. Choose sections.
4. Generate Draft.
5. Add report-specific Behaviour or General Notes and enter the Progress Comment.
6. Save and Review.
7. Download the reviewed PDF for checking.
8. Send the report.

The UI shows clear pending, validation, success, and error states. It indicates unsaved editor changes and does not present them as part of a downloaded PDF until they have been saved through review. Sent reports render all fields read-only.

Report history displays the stored period label rather than assuming every report is a term. Selecting a history item restores its stored period and section summary without changing the report.

## Parent UI

The parent report page continues to show sent reports for linked children only. It uses the stored period label, renders only selected sections, calls the Progress Comment by that name, shows frozen PACE status when selected, and provides a Download PDF action.

An included empty section shows an appropriate empty state. A hidden section is absent rather than described as empty. Parents cannot see draft or reviewed reports, edit notes, regenerate a PDF, or infer hidden source data from API output.

## PDF Design

Add a focused student report PDF generator under the API report owner. It receives only a validated compiled snapshot and produces A4 portrait pages with:

- Oasis navy and crimson top rule and the existing Oasis logo.
- `OASIS LEARNING CENTRE` and `Student Progress Report` header.
- Student name, period label, inclusive date range, and generated/sent date.
- Selected high-level summary cards.
- A PACE table with Subject, Current PACE, Completed, Average Score, and optional Status columns.
- Dated Behaviour and General Note blocks when selected.
- Merit Activity and Balances sections when selected.
- A full-width Progress Comment section when selected.
- Repeated continuation header, consistent 42-point margins, and page numbering.
- A footer marking the document as a confidential student progress report.

Sections use measured text wrapping and cursor-based page breaks. Rows and headings must not overlap or clip. Long note text continues across pages. A section heading must not be left alone at the bottom of a page. PACE identifiers render without grouping separators. Hidden sections must contribute neither headings nor content to the PDF.

The filename is derived from a sanitised student name and period label, for example `Jane-Learner-2025-26-Academic-Year-report.pdf`. Response headers use the existing safe content-disposition pattern.

The web download endpoint follows the existing invoice and incident route pattern and delegates authorisation/data access to the typed API caller.

## Send and Immutability

Review writes all editable report content to the encrypted snapshot before PDF generation. Send performs these steps in order:

1. Load and authorise the unsent report.
2. Validate and decrypt its saved snapshot.
3. Generate the final PDF.
4. Encrypt PDF bytes and filename.
5. Persist `Sent`, `sentAt`, PDF fields, and the unchanged compiled snapshot.
6. Audit the transition.
7. Notify linked guardians.

If PDF generation or encryption fails, the report remains unsent and no guardian notification is issued. Source data changes after send do not alter the encrypted snapshot or stored PDF. Sent reports cannot be reviewed, regenerated, or re-drafted.

## Error Handling

- Invalid periods, section combinations, or editable note payloads return `BAD_REQUEST` validation errors.
- Missing reports return `NOT_FOUND`.
- Unauthorised report or PDF access returns `FORBIDDEN` and is audited.
- PDF generation failure returns a safe server error, keeps the report unsent, and emits an operational event without PII.
- Missing encrypted PDF bytes when `pdfGeneratedAt` is present is treated as an integrity error.
- A sent report with no `pdfGeneratedAt` is treated as legacy and generated only from its frozen snapshot.
- Client controls stay enabled after recoverable errors and show the existing toast/error treatment.

## Security and Privacy

- Full-administrator checks continue to protect draft, review, and send procedures.
- Guardian access remains limited to linked children and sent reports.
- Sensitive Behaviour and Child Notes remain excluded at query time.
- Snapshot JSON, stored PDF bytes, and PDF filename remain encrypted at rest.
- The PDF endpoint sets `Cache-Control: private, no-store` and does not log PDF content.
- Section selection reduces copied/decrypted data; hidden source sections are not returned to the client or embedded in the PDF.
- Report-specific additions never bypass the permanent-note audit and visibility rules because they remain scoped to the encrypted report.

## Accessibility and Responsive Behavior

- Period controls and section checkboxes use explicit labels and fieldsets.
- The PACE Status dependency is communicated in visible help text and disabled semantics.
- Add/edit/remove note actions are keyboard accessible and have descriptive button labels.
- Validation errors are associated with their fields and announced through existing form/error patterns.
- The report workflow remains usable at existing mobile and desktop admin breakpoints; multi-column controls collapse without horizontal overflow.
- Status is conveyed with text as well as colour.

## Testing and Verification

Implementation follows test-driven development. Required coverage includes:

- Domain tests for all three period ranges, inclusive custom dates, invalid date order, stable labels/keys, section invariants, and ungrouped PACE formatting.
- Domain or API tests for Behind, On Track, Ahead, and Unavailable snapshot values using the existing PACE rule.
- Router tests proving each period filters attendance, PACE, Behaviour, Child Notes, and merit activity correctly.
- Router tests proving hidden sections are not decrypted/copied, PACE Status depends on PACE Progress, and legacy snapshots remain readable.
- Router tests proving report-specific notes can be added/edited/removed while source entries cannot be changed.
- Router tests proving Progress Comment and manual entries survive draft refresh.
- Router tests proving sent reports are immutable and failed PDF generation leaves a report unsent and unnotified.
- PDF tests proving the output starts with `%PDF-`, visible headings/text are extractable, hidden sections are absent, `1025` appears while `1,025` does not, status and Progress Comment render, and multi-page output has page footers.
- Access tests proving full administrators can download unsent/sent PDFs, linked guardians can download their child's sent PDF, and other users or unlinked guardians cannot.
- Frontend typecheck, lint, and build verification.
- Relevant domain, API, and database tests plus Prisma generation.
- Credentials-gated Playwright coverage for period selection, section dependencies, report-note editing, review, PDF download, and parent sent-report access when the environment is available.

For visual PDF verification, generate representative single-page and long multi-page reports, render every page to PNG with `pdftoppm`, and inspect typography, wrapping, table alignment, margins, headers, footers, page numbering, empty states, and section transitions. No PDF is accepted while text is clipped, overlapping, or unreadable.

## Rollout and Compatibility

Deploy the additive/backfill migration before application code that requires period metadata. The application reads both legacy and new encrypted snapshots. Existing term report keys and parent links remain valid.

The default section selection reproduces the current report content plus PACE Status and Progress Comment. Existing sent reports remain frozen and visible. Historical rows without stored PDFs use their encrypted snapshot fallback; new sent reports must persist a final PDF.

Rollback can remove new UI/API behavior while leaving additive period/PDF columns in place. Existing `term` storage is preserved through Prisma mapping, so no destructive column rename is required.

## Acceptance Criteria

- An authorised administrator can generate a report for an academic year, term, or valid custom date range.
- The snapshot contains only the selected source sections, and the UI/PDF show only those sections.
- PACE Status can be hidden while PACE Progress remains visible, but cannot be selected on its own.
- PACE identifiers display as `1025`, never `1,025`.
- Every included subject displays its frozen Behind, On Track, Ahead, or Unavailable value when status is selected.
- An administrator can add/edit/remove report-specific Behaviour and General Notes and enter a Progress Comment before send.
- Imported notes cannot be edited through the report workflow, and report additions do not alter permanent student records.
- Review persists all editable content; send freezes it.
- A professional branded PDF can be downloaded for an unsent report by an authorised administrator.
- Sending stores the exact encrypted final PDF and notifies linked guardians only after PDF generation succeeds.
- A linked parent can view and download only the sent report for their child.
- The implementation passes the relevant tests, type checks, lint checks, build, migration checks, and rendered PDF inspection.
