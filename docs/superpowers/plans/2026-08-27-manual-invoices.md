# Manual Invoices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Let finance administrators create manual family invoices that remain visible and payable to parents but are excluded from school-fee accounting, including correction of OLC0059.

**Architecture:** Add a SchoolFeeInvoiceKind discriminator and encrypted manual title to the existing invoice record, retaining child links, status transitions, RLS, PDF storage, and parent payment confirmation. A dedicated manual-create API validates a single family and expands a per-child amount into one family invoice; school-fee queries filter explicitly to SchoolFee. The staff modal selects one of two focused forms, while the parent page separates school fees from other invoices.

**Tech Stack:** Prisma/PostgreSQL, TypeScript, tRPC, Zod, React/Next.js, Vitest, pdf-lib, existing encryption and RLS.

**Spec:** docs/superpowers/specs/2026-08-27-manual-invoices-design.md

## Global Constraints

- Add no dependencies.
- Existing invoices default to SchoolFee and retain their current PDF, payment, family-link, RLS, and access behaviour.
- The historical correction changes only the invoice whose invoice number is OLC0059.
- A manual amount is per selected child; one submission makes one family invoice and one line item per child.
- Manual invoices retain download, parent payment marking, and staff confirmation.
- Manual invoices never affect school-fee issued, paid, outstanding, remaining, or left-to-invoice totals.
- Keep the existing invoice-manager RBAC and guardian-link visibility boundary.

---

## File Structure

- packages/db/prisma/schema.prisma — invoice kind and encrypted title persistence.
- packages/db/prisma/migrations/20260827120000_manual_invoices/migration.sql — additive schema migration and exact historical correction.
- packages/db/src/index.ts — generated invoice-kind enum export.
- apps/api/src/invoices/school-fee-pdf.ts — generic title/copy in the shared PDF layout.
- apps/api/src/routers/invoice.ts — manual procedures, DTO fields, type-safe edits, and accounting filters.
- apps/api/src/__tests__/invoice.router.test.ts — creation, access, accounting, state-machine, and PDF tests.
- apps/web/src/components/invoices/manual-invoice-form.tsx — focused manual amount/family/children form.
- apps/web/src/components/invoices/admin-invoice-create-modal.tsx — single selector and school-fee shell.
- apps/web/src/components/invoices/admin-invoices-client.tsx — manual mutations and admin labels.
- apps/web/src/components/invoices/invoice-ui.tsx — shared invoice kind label and metadata.
- apps/web/src/components/invoices/parent-fees-client.tsx — separate school-fee and other-invoice sections.

### Task 1: Persist Invoice Classification and OLC0059 Correction

**Files:**

- Modify: packages/db/prisma/schema.prisma:2378-2450
- Create: packages/db/prisma/migrations/20260827120000_manual_invoices/migration.sql
- Modify: packages/db/src/index.ts:5-35
- Test: apps/api/src/__tests__/invoice.router.test.ts fixture helpers and list assertions

**Interfaces:**

- Produces: SchoolFeeInvoiceKind with SchoolFee and Manual values.
- Produces: SchoolFeeInvoice.kind and nullable encrypted SchoolFeeInvoice.invoiceTitleEnc.
- Consumed by: router, PDF, and web invoice DTOs.

- [ ] **Step 1: Write the failing kind/default regression test.**

The break this catches is a discriminator that is absent or defaults existing rows to Manual.

~~~ts
const corrected = makeInvoice({ invoiceNumber: 'OLC0059', kind: 'Manual' });
const ordinary = makeInvoice({ invoiceNumber: 'OLC0011', kind: 'SchoolFee' });

expect(parentList.invoices).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ invoiceNumber: corrected.invoiceNumber, kind: 'Manual' }),
    expect.objectContaining({ invoiceNumber: ordinary.invoiceNumber, kind: 'SchoolFee' }),
  ]),
);
~~~

- [ ] **Step 2: Run the focused test to verify it fails before the feature exists.**

Run: pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts

Expected: FAIL because the mapped DTO does not contain kind.

- [ ] **Step 3: Add the Prisma enum, fields, and additive SQL migration.**

Add this exact persistence shape beside the existing invoice enums/model fields:

~~~prisma
enum SchoolFeeInvoiceKind {
  SchoolFee
  Manual
}

model SchoolFeeInvoice {
  // existing fields
  kind            SchoolFeeInvoiceKind @default(SchoolFee)
  invoiceTitleEnc String?
}
~~~

The migration must default existing rows to SchoolFee and update only the supplied invoice number:

~~~sql
CREATE TYPE "SchoolFeeInvoiceKind" AS ENUM ('SchoolFee', 'Manual');

ALTER TABLE "SchoolFeeInvoice"
  ADD COLUMN "kind" "SchoolFeeInvoiceKind" NOT NULL DEFAULT 'SchoolFee',
  ADD COLUMN "invoiceTitleEnc" TEXT;

UPDATE "SchoolFeeInvoice"
SET "kind" = 'Manual'
WHERE "invoiceNumber" = 'OLC0059';
~~~

Use safe duplicate-object/column guards where the migration style requires them. Do not add a broad data rewrite. Re-export SchoolFeeInvoiceKind from packages/db/src/index.ts with the other generated invoice enums.

- [ ] **Step 4: Generate Prisma types and verify the focused test is green.**

Run: pnpm --filter @oasis/db generate

Run: pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts

Expected: kind/default assertions and pre-existing router tests pass.

- [ ] **Step 5: Commit the persistence slice.**

~~~bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260827120000_manual_invoices/migration.sql packages/db/src/index.ts apps/api/src/__tests__/invoice.router.test.ts
git commit -m "feat: classify manual invoices"
~~~

### Task 2: Create and Edit Manual Family Invoices in the Router

**Files:**

- Modify: apps/api/src/routers/invoice.ts:113-245, 429-490, 703-751, 1942-1997, 2489-2779
- Modify: apps/api/src/invoices/school-fee-pdf.ts:57-260
- Modify: apps/api/src/__tests__/invoice.router.test.ts generated-invoice and access coverage

**Interfaces:**

- Consumes: SchoolFeeInvoiceKind, invoiceTitleEnc, existing studentIdsInput and status/access helpers.
- Produces: invoice.createManual(input) and invoice.updateManual(input).
- Produces: invoice DTO fields kind and invoiceTitle.

- [ ] **Step 1: Write the failing manual-creation test using the real router harness.**

This catches a missing child link, a total charged once instead of per child, or a manual invoice invisible to a linked parent.

~~~ts
const invoice = await adminCaller.invoice.createManual({
  invoiceTitle: 'Sign-up fee',
  amountPence: 15_000,
  studentIds: [linkedStudentId, otherStudentId],
  familyLabel: 'Parent family',
  invoiceNumber: 'OLC-MANUAL-001',
  issuedOn: '2026-08-27',
  dueOn: '2026-09-10',
});

expect(invoice).toMatchObject({
  kind: 'Manual',
  invoiceTitle: 'Sign-up fee',
  subtotalAmountPence: 30_000,
  totalAmountPence: 30_000,
});
expect(invoice.lineItems.map((line) => line.totalAmountPence)).toEqual([15_000, 15_000]);
~~~

Add tests that reject a blank title, amountPence 0, a duplicate number, mixed-family children, and edit attempts after PaymentPending/Paid. Add linked and unlinked parent list/download/payment assertions.

- [ ] **Step 2: Run the test and verify it fails for the missing router procedure.**

Run: pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts

Expected: FAIL because createManual does not exist.

- [ ] **Step 3: Define a separate manual input and a focused creation/update path.**

Manual input must not reuse generated-school-fee input:

~~~ts
const createManualInput = z.object({
  invoiceTitle: z.string().trim().min(1).max(160),
  amountPence: z.number().int().positive().max(5_000_000),
  studentIds: studentIdsInput,
  familyLabel: z.string().trim().min(1).max(160),
  invoiceNumber: z.string().trim().min(1).max(80),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).nullable(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
});
~~~

Load the students, verify that they represent exactly one selectable family, generate child-specific encrypted lines, store kind Manual and encrypted title, and write no discounts:

~~~ts
const lineItems = students.map((student, index) => ({
  position: index + 1,
  descriptionEnc: ctx.db.$enc.encrypt([input.invoiceTitle, student.fullName].join(' - ')),
  quantity: 1,
  unitAmountPence: input.amountPence,
  totalAmountPence: input.amountPence,
}));
~~~

Map kind and decrypted invoiceTitle in mapInvoice. Implement updateManual with the existing Draft/Unpaid status guard; it preserves kind Manual and regenerates the PDF. It cannot cross-convert invoice types.

- [ ] **Step 4: Make the shared PDF title and billing copy type-aware.**

Extend the existing generator input and use these values in the current hard-coded header/banner positions:

~~~ts
export interface GenerateSchoolFeeInvoicePdfInput {
  documentTitle: string;
  billingLabel: string;
  // existing fields
}
~~~

School-fee calls pass School Fee Invoice and Invoice for Learning Centre Fees. Manual calls pass Invoice and the encrypted manual title. Manual documents omit zero-value discount rows and school-fee discount explanation copy; they retain the current line, total, date, student, and payment-reference layout.

- [ ] **Step 5: Verify the lifecycle and commit it.**

Run: pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts

Expected: manual creation, editing, access, payment state, and PDF title tests pass while school-fee tests remain green.

~~~bash
git add apps/api/src/routers/invoice.ts apps/api/src/invoices/school-fee-pdf.ts apps/api/src/__tests__/invoice.router.test.ts
git commit -m "feat: create manual family invoices"
~~~

### Task 3: Exclude Manual Invoices from Every School-Fee Calculation

**Files:**

- Modify: apps/api/src/routers/invoice.ts:983-1510 and 2116-2314
- Modify: apps/api/src/__tests__/invoice.router.test.ts parent/year-summary tests

**Interfaces:**

- Consumes: persisted kind on every invoice selection.
- Produces: school-fee stats/summaries that consider only SchoolFee.
- Preserves: parent/admin record lists containing both kinds.

- [ ] **Step 1: Write the failing accounting regression test.**

Seed one paid SchoolFee and one paid Manual invoice for the same family. The break this catches is a manual charge altering annual fee, issued, paid, remaining, or left-to-invoice values.

~~~ts
const result = await parentCaller.invoice.listParent({ status: 'All' });

expect(result.invoices.map((invoice) => invoice.kind)).toContain('Manual');
expect(result.stats.paidAmountPence).toBe(24_500);
expect(result.yearSummary?.issuedAmountPence).toBe(24_500);
expect(result.yearSummary?.leftToInvoiceAmountPence).toBe(269_500);
~~~

Add the equivalent assertion to listBillableFamilies and student finance summary coverage.

- [ ] **Step 2: Run the focused test to see the current incorrect inclusion.**

Run: pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts

Expected: FAIL because Manual invoice amounts are included in one or more school-fee totals.

- [ ] **Step 3: Filter at the database query boundary.**

Use an explicit discriminator in each fee-summary query, never a post-calculation subtraction:

~~~ts
where: {
  kind: 'SchoolFee',
  schoolYear,
  status: { not: 'Draft' },
}
~~~

Apply this to calculateFamilyYearSummary inputs, listBillableFamilies, listParent school-fee stats/year summary, and studentFinanceSummary. Leave listAdmin and parent record retrieval unfiltered so Manual records remain actionable.

- [ ] **Step 4: Verify manual payment transitions leave school-fee totals unchanged.**

Run: pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts

Expected: Manual Unpaid, PaymentPending, and Paid states are visible but do not change school-fee summary assertions.

- [ ] **Step 5: Commit the accounting boundary.**

~~~bash
git add apps/api/src/routers/invoice.ts apps/api/src/__tests__/invoice.router.test.ts
git commit -m "fix: exclude manual invoices from school fees"
~~~

### Task 4: Add a Focused Manual Form Behind the Single Create Button

**Files:**

- Create: apps/web/src/components/invoices/manual-invoice-form.tsx
- Modify: apps/web/src/components/invoices/admin-invoice-create-modal.tsx:449-1202
- Modify: apps/web/src/components/invoices/admin-invoices-client.tsx:1-680

**Interfaces:**

- Consumes: listBillableFamilies output and RouterInputs invoice createManual/updateManual.
- Produces: ManualInvoiceForm with typed submit, close, pending, and server-error props.
- Produces: one type selector with SchoolFee and Manual values.

- [ ] **Step 1: Keep the real API test as the UI form contract.**

The Task 2 test is the observable contract for title, per-child amount, family/children selection, and created total. Add a mounted UI test only if the repository has a real React test harness; do not add source-text or mock-only tests.

~~~ts
expect(invoice.totalAmountPence).toBe(
  15_000 * 2,
);
~~~

- [ ] **Step 2: Create ManualInvoiceForm as a separate component.**

The current school-fee modal is 1,200 lines, so manual-only state must not be added inline. Reuse or relocate shared invoice-number, due-date, and GBP parsing helpers. Use this typed boundary:

~~~ts
type CreateManualInvoiceInput = RouterInputs['invoice']['createManual'];

interface ManualInvoiceFormProps {
  families: readonly BillableFamily[];
  initialInvoice?: InvoiceDto;
  pending: boolean;
  serverError?: string | null;
  onClose(): void;
  onSubmit(input: CreateManualInvoiceInput): void;
}
~~~

Render labelled fields for title, Amount per child, family, child checkboxes, invoice number, issued date, and due date. Family change selects its children; child selection never crosses the selected family. Disable submit until all required values are valid. Do not show school year, cadence, free-form lines, or discounts.

- [ ] **Step 3: Add the type selector to the existing modal shell.**

Keep AdminInvoiceFormModal as the one overlay and add this labelled control only in create mode:

~~~tsx
<SelectInput
  aria-label="Invoice type"
  onChange={(event) => setInvoiceKind(event.target.value as 'SchoolFee' | 'Manual')}
  value={invoiceKind}
>
  <option value="SchoolFee">School fee</option>
  <option value="Manual">Manual</option>
</SelectInput>
~~~

Render the existing form only for SchoolFee and ManualInvoiceForm only for Manual. Existing Manual records open the manual editor; SchoolFee records open unchanged. Switching types unmounts the other form so fee discounts/cadence cannot leak into a manual request.

- [ ] **Step 4: Wire manual mutations in the admin client.**

Mirror existing generated mutation cache handling:

~~~ts
const createManual = api.invoice.createManual.useMutation({
  onSuccess: async () => {
    await utils.invoice.listAdmin.invalidate();
    await utils.invoice.listBillableFamilies.invalidate();
    setCreateOpen(false);
    showSuccessToast('Manual invoice created.');
  },
});
~~~

Route the matching typed callback to createManual/updateManual. Preserve existing pending, disabled, and error UI. Do not add another Create invoice button.

- [ ] **Step 5: Typecheck/lint and commit the admin flow.**

Run: pnpm --filter @oasis/web typecheck

Run: pnpm --filter @oasis/web lint

Expected: both form paths compile with no unused field/import errors.

~~~bash
git add apps/web/src/components/invoices/manual-invoice-form.tsx apps/web/src/components/invoices/admin-invoice-create-modal.tsx apps/web/src/components/invoices/admin-invoices-client.tsx
git commit -m "feat: add manual invoice creation form"
~~~

### Task 5: Present Manual Records Separately for Parents and Clearly for Staff

**Files:**

- Modify: apps/web/src/components/invoices/invoice-ui.tsx:7-242
- Modify: apps/web/src/components/invoices/admin-invoices-client.tsx invoice cards/details
- Modify: apps/web/src/components/invoices/parent-fees-client.tsx:120-385
- Test: apps/api/src/__tests__/invoice.router.test.ts parent list assertions

**Interfaces:**

- Consumes: invoice kind/title DTO fields and school-fee-only stats/year summary.
- Produces: text invoice kind labels and Manual-aware billing metadata.
- Produces: parent School fees and Other invoices collections that reuse current card actions.

- [ ] **Step 1: Write the failing parent visibility/split assertion.**

This catches the incorrect fix of hiding manual records from a parent instead of only excluding them from school-fee totals.

~~~ts
expect(result.invoices).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      invoiceNumber: 'OLC-MANUAL-001',
      kind: 'Manual',
      invoiceTitle: 'Sign-up fee',
    }),
  ]),
);
expect(result.stats.outstandingAmountPence).toBe(24_500);
~~~

- [ ] **Step 2: Add a reusable textual kind label and manual-aware metadata.**

~~~ts
export function invoiceKindLabel(kind: InvoiceDto['kind']): string {
  return kind === 'Manual' ? 'Manual' : 'School fee';
}
~~~

Show it beside the existing status in admin cards/details. InvoicePrimaryMeta shows invoiceTitle for Manual and retains cadence/term for SchoolFee. Family, student, date, line-item, total, PDF, and status controls remain shared.

- [ ] **Step 3: Split only the parent presentation.**

Use the one authorised result, not a second query:

~~~ts
const schoolFeeInvoices = invoices.filter((invoice) => invoice.kind === 'SchoolFee');
const manualInvoices = invoices.filter((invoice) => invoice.kind === 'Manual');
~~~

Bind the hero and ParentFeeCycleSummary to the school-fee router stats/year summary. Show schoolFeeInvoices in the existing School fees list. If manualInvoices is non-empty, render Other invoices with the same ParentInvoiceCard, so Download PDF, Mark as paid, pending state, and Message office all remain available. Its summary uses invoiceTitle rather than the school-fee fallback.

- [ ] **Step 4: Run focused API tests and web checks.**

Run: pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts

Run: pnpm --filter @oasis/api typecheck

Run: pnpm --filter @oasis/web typecheck

Run: pnpm --filter @oasis/web lint

Run: pnpm --filter @oasis/web build

Expected: Manual records are visible/actionable; school-fee figures exclude them; the Next.js build has no boundary error.

- [ ] **Step 5: Commit presentation changes.**

~~~bash
git add apps/web/src/components/invoices/invoice-ui.tsx apps/web/src/components/invoices/admin-invoices-client.tsx apps/web/src/components/invoices/parent-fees-client.tsx apps/api/src/__tests__/invoice.router.test.ts
git commit -m "feat: show manual invoices separately"
~~~

### Task 6: Final Verification and Production Evidence

**Files:**

- Modify: docs/superpowers/specs/2026-08-27-manual-invoices-design.md only if actual verification evidence changes its rollout notes.
- Test: affected DB, API, and web packages.

**Interfaces:**

- Consumes: all previous slices and the existing deployment migration pipeline.
- Produces: reproducible local checks and production-only OLC0059 verification.

- [ ] **Step 1: Inspect every changed file and run the relevant quality suite.**

~~~bash
pnpm --filter @oasis/db generate
pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts
pnpm --filter @oasis/api typecheck
pnpm --filter @oasis/api lint
pnpm --filter @oasis/db typecheck
pnpm --filter @oasis/web typecheck
pnpm --filter @oasis/web lint
pnpm --filter @oasis/web build
pnpm exec prettier --check packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260827120000_manual_invoices/migration.sql packages/db/src/index.ts apps/api/src/invoices/school-fee-pdf.ts apps/api/src/routers/invoice.ts apps/api/src/__tests__/invoice.router.test.ts apps/web/src/components/invoices/manual-invoice-form.tsx apps/web/src/components/invoices/admin-invoice-create-modal.tsx apps/web/src/components/invoices/admin-invoices-client.tsx apps/web/src/components/invoices/invoice-ui.tsx apps/web/src/components/invoices/parent-fees-client.tsx
git diff --check
~~~

Expected: every available command exits zero. Report unavailable checks honestly with their exact setup requirement.

- [ ] **Step 2: Verify the production correction through an authorised, read-only query after normal migration deployment.**

~~~sql
SELECT
  i."invoiceNumber",
  i."kind",
  i."status",
  i."totalAmountPence",
  COUNT(link."studentId") AS linked_child_count
FROM "SchoolFeeInvoice" i
LEFT JOIN "SchoolFeeInvoiceStudent" link ON link."invoiceId" = i."id"
WHERE i."invoiceNumber" = 'OLC0059'
GROUP BY i."id";
~~~

Expected: exactly one row, kind Manual, unchanged pre-existing status/amount/child-link count. Verify its linked family’s school-fee summary excludes the invoice while the parent record list retains it.

- [ ] **Step 3: Commit final documentation only if it changed, then perform the requirement-by-requirement completion audit.**

~~~bash
git add docs/superpowers/specs/2026-08-27-manual-invoices-design.md
git commit -m "docs: verify manual invoice rollout"
~~~

Do not create this commit when documentation has no changes. Before completion, review the spec acceptance criteria, UI selector, parent payment actions, school-fee filtering in every summary query, test output, and production OLC0059 evidence.
