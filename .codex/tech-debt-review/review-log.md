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

## 2026-05-29 - Pass 1

### Selected Files
1. `apps/api/src/routers/invoice.ts`
2. `apps/api/src/routers/club.ts`
3. `apps/api/src/routers/behaviour.ts`
4. `apps/api/src/routers/pace.ts`
5. `apps/api/src/routers/childLog.ts`

### Baseline Findings
- Lint: `pnpm --filter @oasis/api exec eslint src/routers/invoice.ts src/routers/club.ts src/routers/behaviour.ts src/routers/pace.ts src/routers/childLog.ts` passed before edits.
- Typecheck: `pnpm --filter @oasis/api typecheck` passed before edits.
- Tests: Not run at baseline; targeted router tests were run after the behaviour-preserving cleanup.

### Changes Made
- `apps/api/src/routers/invoice.ts`: centralized repeated student ID array validation into one local schema.
- `apps/api/src/routers/club.ts`: reused existing API UTC date helpers instead of router-local duplicates.
- `apps/api/src/routers/behaviour.ts`: reused existing API UTC date helpers instead of router-local duplicates.
- `apps/api/src/routers/pace.ts`: reused existing API UTC date helpers instead of router-local duplicates.
- `apps/api/src/routers/childLog.ts`: reused existing API UTC date helpers instead of router-local duplicates.

### Validation
- lint command: pass, `pnpm --filter @oasis/api lint`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/invoice.router.test.ts src/__tests__/club.router.test.ts src/__tests__/behaviour.router.test.ts src/__tests__/pace.router.test.ts src/__tests__/childNotes.router.test.ts`
- diff whitespace: pass, `git diff --check`
- graph update: pass with warning, `graphify update .` reported a lower node count than the previous graph before updating generated graph output; no graph files remained changed in git status.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger router splits remain warranted, especially for invoice and club, but were deferred because they would require broader service extraction and deeper regression coverage.

## 2026-05-30 - Pass 1

### Selected Files
1. `apps/api/src/routers/admin.ts`
2. `apps/api/src/routers/shop.ts`
3. `apps/api/src/routers/attendance.ts`
4. `apps/api/src/routers/rota.ts`
5. `apps/api/src/routers/registration.ts`

### Baseline Findings
- Lint: `pnpm exec eslint apps/api/src/routers/admin.ts apps/api/src/routers/shop.ts apps/api/src/routers/attendance.ts apps/api/src/routers/rota.ts apps/api/src/routers/registration.ts` passed before edits.
- Typecheck: `pnpm --filter @oasis/api typecheck` passed before edits.
- Tests: Not run at baseline; targeted router tests were run after the behaviour-preserving cleanup.

### Changes Made
- `apps/api/src/routers/admin.ts`: replaced the permission tag schema's double assertion with a named typed tuple.
- `apps/api/src/routers/shop.ts`: replaced dynamic object-key extension narrowing with a typed shop item photo extension tuple and formatted the selected file.
- `apps/api/src/routers/attendance.ts`: reused existing API UTC date helpers instead of router-local duplicates.
- `apps/api/src/routers/rota.ts`: reused existing API UTC date helpers instead of router-local duplicates.
- `apps/api/src/routers/registration.ts`: extracted duplicated guardian, emergency, and pickup contact response mapping into typed local helpers.

### Validation
- lint command: pass, `pnpm --filter @oasis/api lint`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/admin.router.test.ts src/__tests__/shop.router.test.ts src/__tests__/attendance.router.test.ts src/__tests__/rota.router.test.ts src/__tests__/registration.router.test.ts`
- formatting: pass, `pnpm exec prettier --check apps/api/src/routers/admin.ts apps/api/src/routers/shop.ts apps/api/src/routers/attendance.ts apps/api/src/routers/rota.ts apps/api/src/routers/registration.ts`
- diff whitespace: pass, `git diff --check`
- graph update: pass with warning, `graphify update .` reported a lower node count than the previous graph before updating generated graph output; no graph files remained changed in git status.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger API router splits remain warranted, but were deferred because this run was limited to small local cleanups and targeted router coverage.
