## 2026-05-28 - Pass 1

### Selected Files
1. `apps/web/src/app/registration/registration-form.tsx`
2. `apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx`
3. `apps/web/src/components/invoices/admin-invoices-client.tsx`
4. `apps/web/src/components/invoices/admin-invoice-upload-modal.tsx`
5. `apps/web/src/components/calendar/shared-calendar.tsx`

### Baseline Findings
- Lint: `pnpm --filter @oasis/web exec eslint ...selected files...` passed before edits.
- Typecheck: `pnpm --filter @oasis/web typecheck` passed before edits.
- Tests: Not run at baseline; selected package has e2e tests only and this pass is behaviour-preserving extraction.

### Changes Made
- `apps/web/src/app/registration/registration-form.tsx`: extracted registration payload conversion and validation issue mapping into `registration-form-helpers.ts`.
- `apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx`: extracted behaviour success message helpers into existing supervisor utilities and formatted an existing JSX indentation issue.
- `apps/web/src/components/invoices/admin-invoices-client.tsx`: extracted invoice loading/delete modals and invoice drawer into `admin-invoice-modals.tsx`.
- `apps/web/src/components/invoices/admin-invoice-upload-modal.tsx`: extracted PDF parsing, upload type guards, money/date helpers, and family matching into `admin-invoice-upload-utils.ts`.
- `apps/web/src/components/calendar/shared-calendar.tsx`: removed duplicate active-event filtering and reused a single required-people fallback array.

### Validation
- lint command: pass, `pnpm --filter @oasis/web lint`
- typecheck command: pass, `pnpm --filter @oasis/web typecheck`
- relevant tests: not run, no focused unit tests exist for these web-only UI extractions; lint and typecheck passed.
- diff whitespace: pass, `git diff --check`
- graph update: pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger splits remain possible in the selected oversized UI files, but were deferred to keep this daily pass small and low risk.
