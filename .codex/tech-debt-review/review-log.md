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

## 2026-05-31 - Pass 1

### Selected Files
1. `apps/web/src/components/incidents/incident-staff-workflow.tsx`
2. `apps/api/src/routers/permissionSlip.ts`
3. `apps/api/src/routers/incident.ts`
4. `packages/domain/src/invoice.ts`
5. `apps/api/src/routers/calendar.ts`

### Baseline Findings
- Lint: selected-file lint passed for web, API, and domain files before edits.
- Typecheck: `pnpm --filter @oasis/web typecheck`, `pnpm --filter @oasis/api typecheck`, and `pnpm --filter @oasis/domain typecheck` passed before edits.
- Tests: Not run at baseline; targeted router and domain tests were run after the behaviour-preserving cleanup.

### Changes Made
- `apps/web/src/components/incidents/incident-staff-workflow.tsx`: extracted incident form state, payload mapping, date-time helpers, progress calculation, and reportability constants into `incident-staff-workflow-state.ts`.
- `apps/api/src/routers/permissionSlip.ts`: reused shared API date/time helpers and encrypted-text helpers.
- `apps/api/src/routers/incident.ts`: reused shared encrypted-text helpers for optional and required PII fields.
- `packages/domain/src/invoice.ts`: named repeated invoice date-label arrays and invoice metadata word pattern.
- `apps/api/src/routers/calendar.ts`: reused shared API date/time helpers and encrypted-text helpers.

### Validation
- lint command: pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/api lint`; pass, `pnpm --filter @oasis/domain lint`
- typecheck command: pass, `pnpm --filter @oasis/web typecheck`; pass, `pnpm --filter @oasis/api typecheck`; pass, `pnpm --filter @oasis/domain typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/permissionSlip.router.test.ts src/__tests__/incident.router.test.ts src/__tests__/calendar.router.test.ts`; pass, `pnpm --filter @oasis/domain exec vitest run src/__tests__/invoice.test.ts`
- diff whitespace: pass, `git diff --check`
- graph update: pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger service/router splits remain warranted for incident, permission slip, and calendar, but were deferred because they would require broader regression coverage and product-owner review of module boundaries.

## 2026-06-02 - Pass 1

### Selected Files
1. `apps/api/src/routers/report.ts`
2. `apps/api/src/routers/message.ts`
3. `apps/api/src/routers/notice.ts`
4. `apps/api/src/routers/profile.ts`
5. `apps/api/src/routers/investment.ts`

### Baseline Findings
- Lint: selected-file lint passed before edits.
- Typecheck: `pnpm --filter @oasis/api typecheck` passed before edits.
- Tests: Not run at baseline; targeted router tests were run after the cleanup.

### Changes Made
- `apps/api/src/routers/report.ts`: reused the shared required-decryption helper for term report PII decrypt failures.
- `apps/api/src/routers/message.ts`: reused the shared required-decryption helper for message and participant PII decrypt failures.
- `apps/api/src/routers/notice.ts`: reused the shared required-decryption helper while preserving staff notice decrypt failure wording.
- `apps/api/src/routers/profile.ts`: reused the shared required-decryption helper for profile and invitation PII decrypt failures.
- `apps/api/src/routers/investment.ts`: reviewed for lint, type safety, and oversized structure; no safe local code change was needed.

### Validation
- lint command: pass, `pnpm --filter @oasis/api exec eslint src/routers/report.ts src/routers/message.ts src/routers/notice.ts src/routers/profile.ts src/routers/investment.ts`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/report.router.test.ts src/__tests__/message.router.test.ts src/__tests__/notice.router.test.ts src/__tests__/profile.router.test.ts src/__tests__/investment.router.test.ts`
- diff whitespace: pass, `git diff --check`
- graph update: pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger router/service splits remain warranted for report, message, notice, profile, and investment, but were deferred because they would require broader regression coverage.
- Oversized test-suite files remain unreviewed; broad test splitting was deferred to keep this production source cleanup small.
