# Manual Invoices Design

Status: Awaiting review
Owner: Technical Agent
Date: 2026-08-27

## Problem

The existing `SchoolFeeInvoice` record is used for every invoice. Its linked
students and totals are therefore included in school-fee balances, annual
targets, and remaining-to-invoice calculations, even for non-tuition charges
such as a sign-up fee. Invoice `OLC0059` is one such charge and must remain
visible to its linked family while no longer affecting their school-fee record.

Administrators also need one invoice-creation entry point that lets them choose
between the existing school-fee workflow and a manual charge for a family.

## Goals

- Add an explicit invoice type: `SchoolFee` or `Manual`.
- Preserve every existing invoice as a school-fee invoice by default.
- Reclassify only `OLC0059` as a manual invoice in the production migration.
- Let authorised invoice managers create one manual family invoice with a title,
  one amount per selected child, and selected children from one family.
- Keep manual invoices visible to linked parents and allow the existing payment
  confirmation flow.
- Exclude manual invoices from school-fee balances, annual fee targets, and
  left-to-invoice calculations.
- Keep one Create invoice button with a dropdown for `School fee` and `Manual`.

## Non-Goals

- Do not create a second payment or invoice table.
- Do not add manual discounts, partial payments, or automatic payment capture.
- Do not change school-fee pricing, discount rules, proration, or parent access
  rules for existing school-fee invoices.
- Do not infer or expose family data while applying the historical correction;
  the migration uses only invoice number `OLC0059`.

## Chosen Approach

Extend the existing invoice table rather than building parallel manual-invoice
tables. Both invoice kinds already require encrypted PDFs, linked-child access,
parent payment marking, finance-admin confirmation, audit records, and the same
RLS boundary. A discriminating field lets those shared behaviours remain in one
well-tested flow while school-fee reporting filters explicitly on `SchoolFee`.

The alternatives were rejected because they either duplicate the whole invoice
lifecycle (a second table) or use missing school-year/cadence fields as an
implicit type, which would misclassify legacy records and make reporting brittle.

## Data Model and Historical Correction

Add this enum and nullable encrypted title to the existing model, retaining the
existing physical table name:

```prisma
enum SchoolFeeInvoiceKind {
  SchoolFee
  Manual
}

model SchoolFeeInvoice {
  // existing fields
  kind            SchoolFeeInvoiceKind @default(SchoolFee)
  invoiceTitleEnc String?
}
```

The migration adds the enum and columns with `SchoolFee` as the database
default, so existing rows preserve their present behaviour. It then runs this
idempotent, invoice-number-only correction:

```sql
UPDATE "SchoolFeeInvoice"
SET "kind" = 'Manual'
WHERE "invoiceNumber" = 'OLC0059';
```

The statement deliberately does nothing in environments that do not contain
the live invoice. Production deployment verification must confirm that exactly
one invoice with that number is now `Manual`, has unchanged linked children,
status, PDF, and payment fields, and is absent from its family's school-fee
summary. No child or guardian name is part of the migration.

`invoiceTitleEnc` is the user-entered title for manual charges, for example
`Sign-up fee`. School-fee invoices keep their established term and cadence
metadata; their UI title remains `School fees` and they need no encrypted title
backfill.

## API and Accounting Behaviour

Expose `kind` and `invoiceTitle` on the shared invoice DTO. The existing
generated-school-fee procedures remain school-fee-only and continue to require
school year, cadence, school-fee line items, and optional discounts.

Add a separate `invoice.createManual` procedure for finance-authorised users.
It accepts:

- `invoiceTitle`: trimmed, 1–160 characters;
- `amountPence`: positive whole pence amount charged to each selected child;
- `studentIds`: one to twenty distinct children from one billable family;
- `familyLabel`, invoice number, issue date, and due date.

The server validates that all selected children belong to the supplied family,
builds one line item per child with the same amount, and stores one invoice with
`kind: Manual`. Its total is `amountPence × selected child count`. Manual
invoices do not accept school year, cadence, or discounts. They use the existing
invoice status state machine, PDF download route, parent payment marker,
staff confirmation, permissions, encryption, and audit calls.

The existing manual-edit behaviour is mirrored for manual invoices while they
are Draft or Unpaid. Changes retain the original kind and regenerate the PDF;
they cannot convert a manual invoice into a school-fee invoice or vice versa.

Every school-fee calculation in the invoice router filters to
`kind: SchoolFee`, including:

- parent year summaries and child balances;
- parent school-fee summary cards and outstanding totals;
- billable-family generation context and per-child already-issued amounts;
- student finance summaries and year-to-date fee reporting.

Parent and admin invoice record lists include both kinds. Admin collection
statistics may continue to cover all issued invoices because that page is an
invoice-management view, but each row has an explicit type badge. This prevents
a manual charge from being mistaken for tuition while preserving finance
visibility.

## PDF and Parent Experience

Refactor the existing invoice PDF input only enough to accept a document title.
School-fee PDFs continue to render their current school-fee heading and cadence
details. A manual PDF renders `Invoice` with the encrypted manual title, linked
children, individual child line items, total, dates, and payment reference. It
does not show school-fee discount or annual-cycle copy.

The parent fees page has two explicit sections:

1. **School fees** retains the existing balance, cycle summary, and list. Its
   figures contain only `SchoolFee` invoices.
2. **Other invoices** lists linked `Manual` invoices with their title, amount,
   status, PDF download, and `Mark as paid` action. The latter continues to
   become `PaymentPending` until a finance administrator confirms it.

Thus a manual invoice remains in the family record and can be confirmed, but
cannot reduce annual tuition remaining or inflate school-fee outstanding totals.

## Admin Experience

The invoice page retains a single **Create invoice** button. The first control
in its modal is a labelled invoice-type select:

- **School fee** displays the current school-year, cadence, family, child,
  line-item, and discount workflow unchanged.
- **Manual** displays title, amount per child, family, and child selections,
  plus the existing invoice-number and date fields. Selecting a family and two
  children creates one family invoice with two child-specific line items.

The type selector resets fields that belong to the other type so a prior
school-fee discount or cadence can never reach the manual request. The manual
amount field has visible `per child` help text. Required fields use existing
labels, validation feedback, pending state, and keyboard-accessible controls.

Admin invoice cards and detail views show `School fee` or `Manual` as text in
addition to colour. Manual invoices show their title in place of a school-fee
term/cadence. Draft, unpaid, payment-pending, paid, edit, delete, download, and
confirm-payment actions retain their current permissions and status guards.

## Security and Privacy

The feature stays in the existing `SchoolFeeInvoice`/line-item/student-link
tables, so current RLS family-link checks continue to control parent visibility.
The API keeps the stricter invoice-manager authorisation before data writes.
Manual titles, family labels, line descriptions, and PDFs remain encrypted at
rest. Parent list and download authorisation still requires a guardian link to
at least one child on the invoice; no manual invoice is visible to an unrelated
parent.

## Testing and Verification

Implementation follows test-driven development. Required evidence includes:

- Router tests proving `createManual` creates one manual invoice, one line per
  selected child, the expected total, and linked-parent visibility.
- Validation tests rejecting empty titles, non-positive amounts, duplicate or
  mixed-family children, discounts, and school-fee-only fields in a manual
  request.
- Accounting tests proving manual paid, unpaid, and payment-pending invoices do
  not alter school-fee issued, paid, remaining, or left-to-invoice amounts.
- Access tests proving a linked parent can mark a manual invoice paid and an
  unrelated parent cannot list, update, or download it.
- Tests proving the PDF uses the manual title without school-fee-only content.
- Tests proving `OLC0059` is represented as a manual invoice when fixture data
  matches the migration target, and that school-fee invoices retain their
  current defaults.
- API, domain, web typecheck, lint, focused test, and relevant build checks.
- Production migration verification of the exact `OLC0059` reclassification and
  its family's recalculated school-fee summary after deployment.

## Rollout and Compatibility

The additive migration ships before the application code. Old rows default to
`SchoolFee`; linked-child records, status history, payment records, encrypted
PDFs, and RLS relationships are untouched. A rollback can hide manual-invoice
UI/API behaviour while retaining the additive columns and the correctly
classified historical invoice.

## Acceptance Criteria

- An invoice manager has one Create invoice button and can select School fee or
  Manual.
- A Manual invoice requires a title, per-child amount, family, and child
  selection and produces one family invoice with one line per child.
- A linked family can view, download, mark paid, and see confirmation status for
  a manual invoice.
- Manual invoices are visibly labelled and do not affect school-fee balances,
  annual targets, or outstanding school-fee calculations.
- `OLC0059` is a Manual invoice after the production migration while preserving
  its existing family links, payment state, and record visibility.
- Existing school-fee invoice creation, discount, parent access, and accounting
  behaviour remain unchanged.
