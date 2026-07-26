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

## 2026-06-04 - Pass 1

### Selected Files
1. `apps/api/src/routers/studentSettings.ts`
2. `apps/api/src/routers/student.ts`
3. `apps/api/src/invoices/school-fee-pdf.ts`
4. `packages/db/src/pace-score-backfill.ts`
5. `apps/api/src/lib/student-portal-access.ts`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: @oasis/api and @oasis/db typechecks passed before edits; current worktree later switched to existing uncommitted student-account feature changes that block API typecheck.
- Tests: not run before edits.

### Changes Made
- `apps/api/src/lib/utc-date.ts`: added a small API-local UTC date helper used by selected files.
- `apps/api/src/routers/studentSettings.ts`: reused shared UTC hour/day/week helpers.
- `apps/api/src/routers/student.ts`: reused shared UTC day helpers and centralized total merit balance calculation.
- `apps/api/src/invoices/school-fee-pdf.ts`: reviewed and left unchanged because no low-risk extraction was justified.
- `packages/db/src/pace-score-backfill.ts`: extracted repeated positive PACE number validation.
- `apps/api/src/lib/student-portal-access.ts`: reused shared UTC window helpers.

### Validation
- selected-file lint command: pass (`pnpm exec eslint apps/api/src/routers/studentSettings.ts apps/api/src/routers/student.ts apps/api/src/invoices/school-fee-pdf.ts apps/api/src/lib/student-portal-access.ts apps/api/src/lib/utc-date.ts packages/db/src/pace-score-backfill.ts`)
- API lint command: fail, blocked by unrelated existing errors in `apps/api/src/routers/registration.ts` and `apps/api/src/__tests__/registration.router.test.ts`.
- DB lint command: pass (`pnpm --filter @oasis/db lint`)
- API typecheck command: fail after `pnpm --filter @oasis/db generate`; remaining blockers are unrelated current worktree errors in student-account provisioning tests, nullable user email handling across existing routers, and registration symbol moves.
- DB typecheck command: pass (`pnpm --filter @oasis/db typecheck`)
- relevant tests: partial; DB tests passed, API focused tests failed due unrelated `student.create` email contract/test mismatch and registration missing symbol.
- generated client: pass, `pnpm --filter @oasis/db generate` completed against the current schema.
- diff whitespace: pass (`git diff --check`)
- graphify update: pass with existing lower-node-count warning.

### Guardrail Confirmation
- No new features.
- No API contract changes from this automation.
- No migrations from this automation.
- No database schema changes from this automation.
- Behaviour preserved for maintenance changes.

### Follow-Ups Deferred
- Current worktree contains unrelated uncommitted student-account provisioning schema/migration/router changes; resolving those typecheck/test failures requires the feature branch owner to update tests, generated Prisma types, and registration symbol moves.

## 2026-06-05 - Pass 1

### Selected Files
1. `apps/api/src/routers/leaderboard.ts`
2. `packages/domain/src/rbac.ts`
3. `apps/api/src/lib/email.ts`
4. `apps/api/src/routers/clerkWebhook.ts`
5. `apps/api/src/incidents/incident-report-pdf.ts`
6. `apps/api/src/routers/meritLedger.ts`
7. `apps/api/src/routers/childNotes.ts`
8. `packages/domain/src/shop.ts`
9. `packages/domain/src/studentPortalSettings.ts`
10. `packages/domain/src/tithe.ts`

### Baseline Findings
- Lint: selected-file ESLint passed for all 10 files after installing dependencies in the isolated worktree.
- Typecheck: @oasis/api and @oasis/domain typechecks passed before edits after installing dependencies in the isolated worktree.
- Tests: not run at baseline; focused API and domain tests were run after the cleanup.

### Changes Made
- `apps/api/src/routers/leaderboard.ts`: extracted repeated student metric candidate shaping into a private helper.
- `packages/domain/src/rbac.ts`: reviewed RBAC helpers and left unchanged to avoid unnecessary permission-semantic churn.
- `apps/api/src/lib/email.ts`: centralized repeated portal URL construction for message, invoice, and report notification emails.
- `apps/api/src/routers/clerkWebhook.ts`: extracted repeated pending-invitation ID de-duplication into private helpers.
- `apps/api/src/incidents/incident-report-pdf.ts`: reviewed PDF generation and left unchanged to avoid layout churn.
- `apps/api/src/routers/meritLedger.ts`: extracted repeated account balance aggregation into a private helper.
- `apps/api/src/routers/childNotes.ts`: extracted repeated sensitive child-note access checks into a private guard.
- `packages/domain/src/shop.ts`: extracted repeated reservation settlement ledger rows into a private helper.
- `packages/domain/src/studentPortalSettings.ts`: named the daily usage limit maximum.
- `packages/domain/src/tithe.ts`: extracted gross merit calculation into a private helper.

### Validation
- lint command: pass, `pnpm exec eslint apps/api/src/routers/leaderboard.ts packages/domain/src/rbac.ts apps/api/src/lib/email.ts apps/api/src/routers/clerkWebhook.ts apps/api/src/incidents/incident-report-pdf.ts apps/api/src/routers/meritLedger.ts apps/api/src/routers/childNotes.ts packages/domain/src/shop.ts packages/domain/src/studentPortalSettings.ts packages/domain/src/tithe.ts`; pass, `pnpm --filter @oasis/api lint`; pass, `pnpm --filter @oasis/domain lint`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`; pass, `pnpm --filter @oasis/domain typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/leaderboard.router.test.ts src/__tests__/clerkWebhook.test.ts src/__tests__/email.router.test.ts src/__tests__/incident.router.test.ts src/__tests__/meritLedger.router.test.ts src/__tests__/childNotes.router.test.ts`; pass, `pnpm --filter @oasis/domain exec vitest run src/__tests__/rbac.test.ts src/__tests__/shop.test.ts src/__tests__/studentPortalSettings.test.ts src/__tests__/tithe.test.ts`
- formatting: pass, `pnpm exec prettier --check apps/api/src/routers/leaderboard.ts packages/domain/src/rbac.ts apps/api/src/lib/email.ts apps/api/src/routers/clerkWebhook.ts apps/api/src/incidents/incident-report-pdf.ts apps/api/src/routers/meritLedger.ts apps/api/src/routers/childNotes.ts packages/domain/src/shop.ts packages/domain/src/studentPortalSettings.ts packages/domain/src/tithe.ts`
- diff whitespace: pass, `git diff --check`
- graph update: pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger API router and RBAC/domain module splits remain warranted, but were deferred because they would require broader permission and integration review.
- The dirty main checkout on `feat/student-portal-card` still contains unrelated student portal/tithe/savings work, so this run used isolated worktree `/private/tmp/oasis-daily-tech-debt-2026-06-05`.

## 2026-06-06 - Pass 1

### Selected Files
1. `apps/web/src/components/parent/parent-student-settings-client.tsx`
2. `apps/web/src/app/landing-page.tsx`
3. `apps/web/src/components/student/invest/student-invest-data.ts`
4. `apps/web/src/components/student/invest/student-invest-overview.tsx`
5. `apps/web/src/app/(admin)/admin/academic/academic-settings-client.tsx`
6. `apps/web/src/components/messages/message-centre.tsx`
7. `apps/web/src/components/permission-slips/admin-permission-slips-client.tsx`
8. `apps/web/src/components/student/invest/student-invest-market.tsx`
9. `apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx`
10. `apps/web/src/app/(admin)/admin/staff/_components/user-profile-panel.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: `pnpm --filter @oasis/web typecheck` and `pnpm --filter @oasis/mobile typecheck` passed before edits.
- Tests: not run at baseline; selected files are UI/helper maintenance without focused unit tests.

### Changes Made
- `apps/web/src/components/parent/parent-student-settings-client.tsx`: Formatted selected file to satisfy Prettier without changing behaviour.
- `apps/web/src/app/landing-page.tsx`: Cached landing page event day/month formatters instead of constructing Intl formatters per call.
- `apps/web/src/components/student/invest/student-invest-data.ts`: Named investment day-millisecond, live-holding, positive-holding, and percent-change helpers. Reused the live-holding helper inside portfolio series generation.
- `apps/web/src/components/student/invest/student-invest-overview.tsx`: Reused shared live-holding and percent-change helpers in overview and portfolio calculations.
- `apps/web/src/app/(admin)/admin/academic/academic-settings-client.tsx`: Extracted subject activity and checkbox-card class helpers.
- `apps/web/src/components/messages/message-centre.tsx`: Cached message date-time formatter. Extracted staff counterpart lookup used by label and role helpers.
- `apps/web/src/components/permission-slips/admin-permission-slips-client.tsx`: Extracted admin permission-slip filtering into a named local predicate.
- `apps/web/src/components/student/invest/student-invest-market.tsx`: Reused shared positive-holding, percent-change, and day-millisecond helpers.
- `apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx`: Cached Today date formatter. Extracted usage-limit message selection into a named helper.
- `apps/web/src/app/(admin)/admin/staff/_components/user-profile-panel.tsx`: Extracted Head/self role-change guard into a named helper.

### Validation
- lint command: pass, selected-file ESLint; pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/mobile lint`
- typecheck command: pass, `pnpm --filter @oasis/web typecheck`; pass, `pnpm --filter @oasis/mobile typecheck`
- relevant tests: not run; no focused unit tests exist for these UI/helper-only refactors.
- formatting: pass, selected-file `pnpm exec prettier --check`
- diff whitespace: pass, `git diff --check`
- graph update: pass, `graphify update .` regenerated graph output but left no graph artifacts changed in git status.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger UI splits remain warranted for the selected oversized screens, but were deferred to avoid broader workflow and visual-regression risk.

## 2026-06-07 - Pass 1

### Selected Files
1. `apps/web/src/components/clubs/parent-my-clubs-client.tsx`
2. `apps/api/src/services/market-data/twelve-data-refresh.ts`
3. `apps/mobile/src/components/smoke/parent-smoke-children.tsx`
4. `apps/web/src/components/student/invest/student-invest-ui.tsx`
5. `apps/web/src/components/permission-slips/admin-permission-slip-form.tsx`
6. `apps/web/src/app/(parent)/parent/parent-dashboard-client.tsx`
7. `apps/web/src/components/permission-slips/parent-permission-slips-client.tsx`
8. `apps/web/src/app/(admin)/admin/student-portal/student-portal-readiness-client.tsx`
9. `apps/web/src/components/clubs/club-rota-panel.tsx`
10. `apps/web/src/app/(parent)/parent/registration/sibling-add-modal.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: `pnpm --filter @oasis/web typecheck`, `pnpm --filter @oasis/mobile typecheck`, and `pnpm --filter @oasis/api typecheck` passed before edits.
- Tests: not run at baseline; focused API market-data tests were run after the cleanup.

### Changes Made
- `apps/web/src/components/clubs/parent-my-clubs-client.tsx`: Cached the notice date formatter instead of constructing it per format call.
- `apps/api/src/services/market-data/twelve-data-refresh.ts`: Named day/minute duration constants and extracted provider FX currency-code collection.
- `apps/mobile/src/components/smoke/parent-smoke-children.tsx`: Cached short date and date-time formatters used by parent smoke child cards.
- `apps/web/src/components/student/invest/student-invest-ui.tsx`: Reviewed chart and investment UI helpers; no safe local cleanup justified without visual regression risk.
- `apps/web/src/components/permission-slips/admin-permission-slip-form.tsx`: Extracted student ID, year grouping, and question payload helpers from the admin permission-slip form.
- `apps/web/src/app/(parent)/parent/parent-dashboard-client.tsx`: Cached parent dashboard date and date-time formatters.
- `apps/web/src/components/permission-slips/parent-permission-slips-client.tsx`: Extracted parent slip row flattening and outstanding/completed grouping helpers.
- `apps/web/src/app/(admin)/admin/student-portal/student-portal-readiness-client.tsx`: Named the visible PACE subject limit and extracted the visible-subject helper.
- `apps/web/src/components/clubs/club-rota-panel.tsx`: Extracted selected rota candidate ID collection into a named helper.
- `apps/web/src/app/(parent)/parent/registration/sibling-add-modal.tsx`: Replaced repeated sibling validation issue label branches with a typed lookup map.

### Validation
- lint command: pass, selected-file ESLint; pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/mobile lint`; pass, `pnpm --filter @oasis/api lint`
- typecheck command: pass, `pnpm --filter @oasis/web typecheck`; pass, `pnpm --filter @oasis/mobile typecheck`; pass, `pnpm --filter @oasis/api typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/twelve-data-refresh.test.ts`; UI-focused tests not run because the selected UI changes are helper-only and have no focused unit tests.
- formatting: pass, selected-file `pnpm exec prettier --check`
- diff whitespace: pass, `git diff --check`
- graph update: pass with existing lower-node-count warning, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger splits remain warranted for the oversized parent clubs, permission slips, dashboard, student portal, and club rota UI surfaces, but were deferred to keep this run low-risk.
- `apps/web/src/components/student/invest/student-invest-ui.tsx` was reviewed and left unchanged because chart/UI extraction would need visual regression coverage.

## 2026-06-08 - Pass 1

### Selected Files
1. `apps/web/src/components/student/student-wallet-client.tsx`
2. `apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx`
3. `apps/web/src/app/(supervisor)/supervisor/_components/supervisor-dashboard-overview.tsx`
4. `apps/web/src/app/registration/registration-form-model.ts`
5. `apps/web/src/components/shop/parent-shop-client.tsx`
6. `apps/web/src/app/(admin)/admin/audit/audit-log-viewer.tsx`
7. `apps/web/src/components/noticeboard/staff-noticeboard.tsx`
8. `apps/web/src/components/leaderboard/leaderboard-client.tsx`
9. `apps/web/src/components/attendance/attendance-capture.tsx`
10. `packages/domain/src/investmentMarketData.ts`

### Baseline Findings
- Lint: selected-file ESLint passed for web and domain files before edits.
- Typecheck: `pnpm --filter @oasis/web typecheck` and `pnpm --filter @oasis/domain typecheck` passed before edits.
- Tests: focused domain investment market data test command was reserved for post-change validation; UI files have no focused unit tests.
- Formatting: selected-file Prettier check failed before edits for `student-wallet-client.tsx`, `parent-shop-client.tsx`, and `audit-log-viewer.tsx`.

### Changes Made
- `apps/web/src/components/student/student-wallet-client.tsx`: Cached merit and wallet date Intl formatters instead of constructing them for each format call. Formatted selected wallet JSX to satisfy Prettier.
- `apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx`: Reviewed rota scheduler for lint, type, and formatting issues; no safe local source change was needed.
- `apps/web/src/app/(supervisor)/supervisor/_components/supervisor-dashboard-overview.tsx`: Grouped weekly shifts by date once per render instead of filtering the full shift list for every day card.
- `apps/web/src/app/registration/registration-form-model.ts`: Reviewed registration form model for lint, type, and formatting issues; no safe local source change was needed.
- `apps/web/src/components/shop/parent-shop-client.tsx`: Extracted parent shop category counting into a pure helper. Extracted visible-item filtering into a pure helper and memoized derived item lists. Formatted selected parent shop JSX to satisfy Prettier.
- `apps/web/src/app/(admin)/admin/audit/audit-log-viewer.tsx`: Cached audit date/time Intl formatters instead of constructing them for each row render. Formatted selected audit JSX to satisfy Prettier.
- `apps/web/src/components/noticeboard/staff-noticeboard.tsx`: Cached noticeboard date/time Intl formatter instead of constructing it for each notice date render.
- `apps/web/src/components/leaderboard/leaderboard-client.tsx`: Reviewed leaderboard client for lint, type, and formatting issues; no safe local source change was needed.
- `apps/web/src/components/attendance/attendance-capture.tsx`: Reviewed attendance capture for lint, type, and formatting issues; no safe local source change was needed.
- `packages/domain/src/investmentMarketData.ts`: Reused the existing money decimal-place constant when rounding normalized market prices.

### Validation
- lint command: pass, `pnpm --filter @oasis/web exec eslint ...selected files...`; pass, `pnpm --filter @oasis/domain exec eslint src/investmentMarketData.ts`; pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/domain lint`.
- typecheck command: pass, `pnpm --filter @oasis/web typecheck`; pass, `pnpm --filter @oasis/domain typecheck`.
- relevant tests: pass, `pnpm --filter @oasis/domain test -- investmentMarketData`.
- formatting: pass, selected-file `pnpm exec prettier --check ...`.
- graph: pass, `graphify update .`.
- diff hygiene: pass, `git diff --check`.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Large test files remain oversized; deferred because this pass prioritised production source files and avoiding broad test-suite restructuring.

## 2026-06-09 - Pass 1

### Selected Files
1. `apps/mobile/src/components/smoke/parent-message-conversation.tsx`
2. `apps/web/src/components/incidents/incident-parent-portal.tsx`
3. `apps/web/src/components/invoices/parent-fees-client.tsx`
4. `apps/web/src/app/(admin)/admin/access/access-account-panel.tsx`
5. `apps/web/src/components/pace/pace-workflow-client.tsx`
6. `apps/web/src/app/(admin)/admin/attendance/staff-attendance-roster.tsx`
7. `apps/web/src/components/clubs/club-management-detail.tsx`
8. `apps/mobile/src/components/smoke/sign-in-panel.tsx`
9. `apps/mobile/src/components/smoke/student-smoke-wallet.tsx`
10. `apps/web/src/components/noticeboard/noticeboard-attachments.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed for web and mobile files before edits.
- Typecheck: `pnpm --filter @oasis/web typecheck` and `pnpm --filter @oasis/mobile typecheck` passed before edits.
- Tests: not run at baseline; selected files are UI/helper surfaces without focused unit tests.
- Formatting: selected-file Prettier check failed before edits for `parent-message-conversation.tsx`, `incident-parent-portal.tsx`, and `pace-workflow-client.tsx`.

### Changes Made
- `apps/mobile/src/components/smoke/parent-message-conversation.tsx`: Extracted parent message metadata label formatting into a named helper. Formatted the selected file to satisfy Prettier.
- `apps/web/src/components/incidents/incident-parent-portal.tsx`: Cached the incident preview time formatter. Computed parent incident stats in one pass instead of repeated filters. Formatted the selected file to satisfy Prettier.
- `apps/web/src/components/invoices/parent-fees-client.tsx`: Reviewed for lint, type, formatting, and safe extraction opportunities; no source change was needed.
- `apps/web/src/app/(admin)/admin/access/access-account-panel.tsx`: Reviewed for lint, type, formatting, and safe extraction opportunities; no source change was needed.
- `apps/web/src/components/pace/pace-workflow-client.tsx`: Extracted active-or-first PACE subject selection into a named helper. Formatted the selected file to satisfy Prettier.
- `apps/web/src/app/(admin)/admin/attendance/staff-attendance-roster.tsx`: Cached the UTC staff schedule time formatter used by roster shift labels.
- `apps/web/src/components/clubs/club-management-detail.tsx`: Reviewed for lint, type, formatting, and safe extraction opportunities; no source change was needed.
- `apps/mobile/src/components/smoke/sign-in-panel.tsx`: Replaced second-factor priority map/find chaining with a typed priority constant and early-return loop.
- `apps/mobile/src/components/smoke/student-smoke-wallet.tsx`: Moved repeated tithe option labels into a small typed constant.
- `apps/web/src/components/noticeboard/noticeboard-attachments.tsx`: Extracted repeated attachment byte-signature comparisons into named signature constants and a bytesStartWith helper.

### Validation
- lint command: pass, selected-file ESLint for web and mobile files; pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/mobile lint`.
- typecheck command: pass, `pnpm --filter @oasis/web typecheck`; pass, `pnpm --filter @oasis/mobile typecheck`.
- relevant tests: not run; no focused unit tests exist for these UI/helper-only cleanups.
- formatting: pass, selected-file `pnpm exec prettier --check`.
- diff hygiene: pass, `git diff --check`.
- graph update: pass, `graphify update .`.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger component splits remain warranted for the selected oversized UI surfaces, but were deferred to avoid broader workflow and visual-regression risk.

## 2026-06-11 - Pass 1

### Selected Files
1. `apps/api/src/routers/homework.ts`
2. `apps/web/src/components/homework/admin-homework-client.tsx`
3. `apps/api/src/routers/faithCorner.ts`
4. `apps/web/src/components/clubs/club-assignment-panels.tsx`
5. `apps/web/src/components/reports/report-workflow-client.tsx`
6. `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
7. `apps/web/src/components/invoices/admin-invoice-upload-utils.ts`
8. `apps/web/src/components/clubs/my-club-rota-panel.tsx`
9. `apps/web/src/components/profile/self-profile-client.tsx`
10. `apps/web/src/components/attendance/special-attendance-capture.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed for API, web, and mobile files before edits.
- Typecheck: `pnpm --filter @oasis/api typecheck`, `pnpm --filter @oasis/web typecheck`, and `pnpm --filter @oasis/mobile typecheck` passed before edits.
- Tests: focused API homework and Faith Corner router tests were reserved for post-change validation.
- Formatting: selected-file Prettier check failed before edits for `apps/api/src/routers/homework.ts`, `apps/web/src/components/homework/admin-homework-client.tsx`, `apps/api/src/routers/faithCorner.ts`, `apps/web/src/components/reports/report-workflow-client.tsx`, and `apps/web/src/components/profile/self-profile-client.tsx`.

### Changes Made
- `apps/api/src/routers/homework.ts`: Extracted shared assignment band validation for create/update homework assignment paths. Formatted selected router file to satisfy Prettier.
- `apps/web/src/components/homework/admin-homework-client.tsx`: Extracted review row key construction into a named helper. Formatted selected homework admin component to satisfy Prettier.
- `apps/api/src/routers/faithCorner.ts`: Extracted repeated Faith Corner comment decrypt audit logging into a shared helper. Formatted selected router file to satisfy Prettier.
- `apps/web/src/components/clubs/club-assignment-panels.tsx`: Reviewed for lint, type, formatting, and safe extraction opportunities; no source change was needed.
- `apps/web/src/components/reports/report-workflow-client.tsx`: Formatted selected report workflow component to satisfy Prettier.
- `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`: Cached the parent portal full-date formatter instead of constructing it during render.
- `apps/web/src/components/invoices/admin-invoice-upload-utils.ts`: Cached the invoice term formatter used by uploaded invoice defaults.
- `apps/web/src/components/clubs/my-club-rota-panel.tsx`: Extracted repeated availability draft row updates into a local helper.
- `apps/web/src/components/profile/self-profile-client.tsx`: Cached the profile date formatter. Formatted selected profile component to satisfy Prettier.
- `apps/web/src/components/attendance/special-attendance-capture.tsx`: Extracted row-key removal into a local helper that satisfies lint rules without dynamic delete.

### Validation
- lint command: pass, selected-file ESLint; pass, `pnpm --filter @oasis/api lint`; pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/mobile lint`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`; pass, `pnpm --filter @oasis/web typecheck`; pass, `pnpm --filter @oasis/mobile typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/homework.router.test.ts src/__tests__/faithCorner.router.test.ts`
- formatting: pass, selected-file `pnpm exec prettier --check`
- diff hygiene: pass, `git diff --check`
- graph update: pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Larger splits remain warranted for the selected oversized homework, club, report, profile, and attendance UI surfaces, but were deferred to avoid broad workflow and visual-regression risk.

## 2026-06-12 - Pass 1

### Selected Files
1. `apps/web/src/components/pace/pace-score-modal.tsx`
2. `apps/web/src/components/admin/admin-nav.tsx`
3. `apps/web/src/components/admin/require-full-admin.tsx`
4. `apps/web/src/app/(admin)/admin/layout.tsx`
5. `apps/api/src/index.ts`
6. `apps/web/src/components/supervisor/supervisor-nav.tsx`
7. `packages/db/src/index.ts`
8. `apps/api/src/router.ts`
9. `apps/web/src/app/(supervisor)/supervisor/layout.tsx`
10. `packages/domain/src/index.ts`

### Baseline Findings
- Lint: initial selected-file ESLint was blocked until isolated-worktree dependencies were installed; selected-file ESLint then passed for web, API, DB, and domain files before edits.
- Typecheck: initial web typecheck was blocked until dependencies were installed; web, API, DB, and domain package typechecks passed before edits.
- Tests: not run at baseline; selected changes were UI/helper and entrypoint cleanups without focused unit tests.
- Formatting: selected-file Prettier check passed before edits.

### Changes Made
- `apps/web/src/components/pace/pace-score-modal.tsx`: Parsed the PACE number once and reused a single save-disabled guard for submit and button state.
- `apps/web/src/components/admin/admin-nav.tsx`: Consolidated repeated admin nav visibility filtering into a local helper. Removed the unused admin nav canManageCalendar prop while preserving the layout permission check.
- `apps/web/src/components/admin/require-full-admin.tsx`: Extracted the admin shell access predicate into a named local helper without changing permission checks.
- `apps/web/src/app/(admin)/admin/layout.tsx`: Stopped passing the now-removed unused canManageCalendar prop into admin nav props.
- `apps/api/src/index.ts`: Reviewed exports, imports, lint, typecheck, and formatting; no source change was needed.
- `apps/web/src/components/supervisor/supervisor-nav.tsx`: Consolidated supervisor nav visibility filtering into a local helper. Removed the always-true enabled flag and no-op aria-disabled=false output.
- `packages/db/src/index.ts`: Reviewed Prisma client export surface, lint, typecheck, and formatting; no source change was needed.
- `apps/api/src/router.ts`: Reviewed root tRPC router composition, lint, typecheck, and formatting; no source change was needed.
- `apps/web/src/app/(supervisor)/supervisor/layout.tsx`: Reviewed supervisor shell data loading, lint, typecheck, and formatting; no source change was needed.
- `packages/domain/src/index.ts`: Reviewed domain barrel exports, lint, typecheck, and formatting; no source change was needed.

### Validation
- lint command: pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/api lint`; pass, `pnpm --filter @oasis/db lint`; pass, `pnpm --filter @oasis/domain lint`.
- typecheck command: pass, `pnpm --filter @oasis/web typecheck`; pass, `pnpm --filter @oasis/api typecheck`; pass, `pnpm --filter @oasis/db typecheck`; pass, `pnpm --filter @oasis/domain typecheck`.
- relevant tests: not run; no focused tests cover these local nav/access-helper and entrypoint cleanups.
- formatting: pass, selected-file `pnpm exec prettier --check ...`.
- graph update: pass, `graphify update .`.
- diff hygiene: pass, `git diff --check`.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Oversized router test files remain candidates for a dedicated test-suite cleanup pass; deferred today to avoid mixing production-source maintenance with larger test restructuring.

## 2026-06-13 - Pass 1

### Selected Files
1. `packages/db/scripts/seed-parent-portal-demo.ts`
2. `apps/api/src/services/market-data/investment-market-refresh.ts`
3. `apps/api/src/routers/community.ts`
4. `packages/db/scripts/backfill-talia-pace-scores.ts`
5. `apps/api/src/services/market-data/investment-market-data-storage.ts`
6. `apps/web/src/components/student/invest/student-invest-pages.tsx`
7. `apps/web/src/components/student/invest/student-invest-client.tsx`
8. `apps/web/src/components/community/admin-community-client.tsx`
9. `packages/domain/src/investmentTransactions.ts`
10. `apps/web/src/components/community/student-community-client.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: API, web, domain, and DB typechecks passed before edits.
- Tests: focused tests were run after helper refactors; no baseline test failures were observed.

### Changes Made
- `packages/db/scripts/seed-parent-portal-demo.ts`: reviewed oversized seed script and left unchanged; no safe local cleanup was justified.
- `apps/api/src/services/market-data/investment-market-refresh.ts`: formatted selected service to satisfy Prettier.
- `apps/api/src/routers/community.ts`: named the repeated community group not-found message.
- `packages/db/scripts/backfill-talia-pace-scores.ts`: reviewed oversized backfill script and confirmed formatting passes; no safe local cleanup was justified.
- `apps/api/src/services/market-data/investment-market-data-storage.ts`: consolidated duplicate type imports and formatted the selected file.
- `apps/web/src/components/student/invest/student-invest-pages.tsx`: extracted whole-merit parsing and quick-amount constants.
- `apps/web/src/components/student/invest/student-invest-client.tsx`: formatted selected investment client to satisfy Prettier.
- `apps/web/src/components/community/admin-community-client.tsx`: extracted the empty messaging block form state constant.
- `packages/domain/src/investmentTransactions.ts`: extracted shared full-exit cost-basis and non-zero ledger row helpers.
- `apps/web/src/components/community/student-community-client.tsx`: named message length and typing/pending timing constants.

### Validation
- lint command: pass - `pnpm exec eslint -- <selected files>`; `pnpm --filter @oasis/api lint`; `pnpm --filter @oasis/web lint`; `pnpm --filter @oasis/domain lint`; `pnpm --filter @oasis/db lint`
- typecheck command: pass - `pnpm --filter @oasis/api typecheck`; `pnpm --filter @oasis/web typecheck`; `pnpm --filter @oasis/domain typecheck`; `pnpm --filter @oasis/db typecheck`
- relevant tests: pass - `pnpm --filter @oasis/domain test -- investmentTransactions.test.ts`; `pnpm --filter @oasis/api test -- community.router.test.ts investment-market-refresh.test.ts`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Large DB seed and backfill scripts remain oversized; deeper extraction was deferred because it would increase review risk without a local lint/type bug to fix.

## 2026-06-14 - Pass 1

### Selected Files
1. `apps/api/src/services/tithe-run.ts`
2. `apps/web/src/components/student/student-home-client.tsx`
3. `apps/web/src/components/clubs/linked-child-club-detail-client.tsx`
4. `apps/mobile/src/components/smoke/parent-message-inbox.tsx`
5. `apps/web/src/components/incidents/incident-staff-workflow-state.ts`
6. `apps/web/src/components/faith-corner/faith-corner-admin-client.tsx`
7. `apps/web/src/app/(admin)/admin/attendance/attendance-export-centre.tsx`
8. `apps/mobile/src/components/smoke/smoke-ui.tsx`
9. `apps/mobile/src/components/smoke/parent-smoke-clubs.tsx`
10. `apps/web/src/app/(admin)/admin/page.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed after rerunning with quoted route-group paths.
- Typecheck: `pnpm --filter @oasis/api typecheck`, `pnpm --filter @oasis/web typecheck`, and `pnpm --filter @oasis/mobile typecheck` passed before edits.
- Tests: not run before edits; focused API test discovery found tithe router coverage.
- Format: selected-file Prettier check failed for `apps/api/src/services/tithe-run.ts`, `apps/web/src/components/clubs/linked-child-club-detail-client.tsx`, and `apps/web/src/components/faith-corner/faith-corner-admin-client.tsx`.

### Changes Made
- `apps/api/src/services/tithe-run.ts`: Formatted selected service file to satisfy Prettier.
- `apps/web/src/components/student/student-home-client.tsx`: Cached repeated date formatters used by the student dashboard hero.
- `apps/web/src/components/clubs/linked-child-club-detail-client.tsx`: Cached repeated club detail date and date-time formatters. Formatted selected component to satisfy Prettier.
- `apps/mobile/src/components/smoke/parent-message-inbox.tsx`: Extracted the thread count label into a small local helper.
- `apps/web/src/components/incidents/incident-staff-workflow-state.ts`: Extracted duplicated incident staff-kind filtering into a typed local helper.
- `apps/web/src/components/faith-corner/faith-corner-admin-client.tsx`: Formatted selected admin Faith Corner component to satisfy Prettier.
- `apps/web/src/app/(admin)/admin/attendance/attendance-export-centre.tsx`: Extracted attendance status breakdown point creation into a local helper.
- `apps/mobile/src/components/smoke/smoke-ui.tsx`: Reviewed lint, format, type surface, and component structure; no safe source change needed.
- `apps/mobile/src/components/smoke/parent-smoke-clubs.tsx`: Extracted selected linked-child fallback lookup into a local helper.
- `apps/web/src/app/(admin)/admin/page.tsx`: Replaced repeated attendance status filtering with a single local counting helper.

### Validation
- lint command: pass, `pnpm exec eslint <selected files>`, `pnpm --filter @oasis/api lint`, `pnpm --filter @oasis/web lint`, `pnpm --filter @oasis/mobile lint`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`, `pnpm --filter @oasis/web typecheck`, `pnpm --filter @oasis/mobile typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api test -- src/__tests__/tithe.router.test.ts` completed 39 API test files / 821 tests
- graph update: pass, `graphify update .`
- diff hygiene: pass, `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- None.

## 2026-06-15 - Pass 1

### Selected Files
1. `apps/api/src/__tests__/admin.router.test.ts`
2. `apps/api/src/__tests__/club.router.test.ts`
3. `apps/api/src/__tests__/pace.router.test.ts`
4. `apps/api/src/__tests__/attendance.router.test.ts`
5. `apps/api/src/__tests__/behaviour.router.test.ts`
6. `apps/api/src/__tests__/invoice.router.test.ts`
7. `apps/api/src/__tests__/shop.router.test.ts`
8. `apps/api/src/__tests__/childNotes.router.test.ts`
9. `apps/api/src/__tests__/student.router.test.ts`
10. `apps/api/src/__tests__/investment.router.test.ts`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: `pnpm --filter @oasis/api typecheck` passed before edits.
- Tests: focused selected router tests were reserved for post-change validation.
- Formatting: selected-file Prettier check passed before edits.

### Changes Made
- `apps/api/src/__tests__/admin.router.test.ts`: Reused the shared fake encryption/decryption test helper.
- `apps/api/src/__tests__/club.router.test.ts`: Replaced duplicate local fake encryption helpers with the shared API test helper.
- `apps/api/src/__tests__/pace.router.test.ts`: Reviewed lint, type, formatting, and fixture structure; no safe source change was needed.
- `apps/api/src/__tests__/attendance.router.test.ts`: Replaced duplicate local fake encryption helpers with the shared API test helper.
- `apps/api/src/__tests__/behaviour.router.test.ts`: Replaced duplicate local fake encryption helpers and removed now-unnecessary string fallbacks.
- `apps/api/src/__tests__/invoice.router.test.ts`: Replaced duplicate local fake encryption helpers with the shared API test helper.
- `apps/api/src/__tests__/shop.router.test.ts`: Reviewed lint, type, formatting, and fixture structure; no safe source change was needed.
- `apps/api/src/__tests__/childNotes.router.test.ts`: Reused the shared fake decryption test helper.
- `apps/api/src/__tests__/student.router.test.ts`: Replaced duplicate local fake encryption helpers and removed now-unnecessary string fallbacks.
- `apps/api/src/__tests__/investment.router.test.ts`: Reviewed lint, type, formatting, and fixture structure; no safe source change was needed.
- `apps/api/src/__tests__/helpers/test-encryption.ts`: Added a shared helper for the selected API router tests' fake `enc:` convention.

### Validation
- lint command: pass, selected-file ESLint; pass, `pnpm --filter @oasis/api lint`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api test -- admin.router.test.ts club.router.test.ts pace.router.test.ts attendance.router.test.ts behaviour.router.test.ts invoice.router.test.ts shop.router.test.ts childNotes.router.test.ts student.router.test.ts investment.router.test.ts` (Vitest ran the API suite: 39 files, 821 tests)
- formatting: pass, selected-file `pnpm exec prettier --check`
- diff hygiene: pass, `git diff --check`
- graph update: pass, `graphify update .` completed with the existing lower-node-count warning and refreshed graph output.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Broader splits of the oversized router test fixtures remain deferred; extracting fake DB builders would be higher risk and better handled in dedicated test-suite cleanup branches.

## 2026-06-17 - Pass 1

### Selected Files
1. `apps/api/src/__tests__/incident.router.test.ts`
2. `apps/api/src/__tests__/community.router.test.ts`
3. `apps/api/src/__tests__/report.router.test.ts`
4. `apps/api/src/__tests__/meritLedger.router.test.ts`
5. `apps/api/src/__tests__/faithCorner.router.test.ts`
6. `apps/api/src/__tests__/clerkWebhook.test.ts`
7. `apps/api/src/__tests__/investment-market-refresh.test.ts`
8. `packages/domain/src/__tests__/rbac.test.ts`
9. `apps/api/src/__tests__/helpers/investment-fixtures.ts`
10. `apps/api/src/__tests__/profile.router.test.ts`

### Baseline Findings
- Lint: selected-file ESLint initially required isolated dependency setup and Prisma Client generation; after setup, selected-file ESLint passed before source edits.
- Typecheck: API typecheck was blocked before Prisma Client generation; after generation, API and domain typecheck passed before source edits.
- Tests: focused package tests were reserved for post-change validation.
- Formatting: selected-file Prettier failed for `apps/api/src/__tests__/faithCorner.router.test.ts`, `apps/api/src/__tests__/investment-market-refresh.test.ts`, and `apps/api/src/__tests__/helpers/investment-fixtures.ts`.

### Changes Made
- `apps/api/src/__tests__/faithCorner.router.test.ts`: formatted selected router tests to satisfy Prettier.
- `apps/api/src/__tests__/investment-market-refresh.test.ts`: formatted selected market refresh tests to satisfy Prettier.
- `apps/api/src/__tests__/helpers/investment-fixtures.ts`: formatted selected shared investment test fixtures to satisfy Prettier.
- Remaining selected files: reviewed lint, type, formatting, and fixture structure; no safe source change was needed.
- Review memory: carried forward the 2026-06-16 automation-reviewed test files so pass 1 does not repeat them.

### Validation
- lint command: pass, selected-file ESLint; pass, `pnpm --filter @oasis/api lint`; pass, `pnpm --filter @oasis/domain lint`
- typecheck command: pass, `pnpm --filter @oasis/api typecheck`; pass, `pnpm --filter @oasis/domain typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api test -- incident.router.test.ts community.router.test.ts report.router.test.ts meritLedger.router.test.ts faithCorner.router.test.ts clerkWebhook.test.ts investment-market-refresh.test.ts profile.router.test.ts` ran the API suite: 39 files / 827 tests; pass, `pnpm --filter @oasis/domain test -- rbac.test.ts` ran the domain suite: 23 files / 340 tests
- formatting: pass, selected-file `pnpm exec prettier --check`
- diff hygiene: pass, `git diff --check`
- graph update: pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Broader extraction of the oversized router test fixtures remains deferred; there was no local lint/type failure after Prisma generation, and fixture-builder refactors would be higher-risk than today’s formatting cleanup.

## 2026-06-19 - Pass 1

### Selected Files
1. `packages/domain/src/__tests__/invoice.test.ts`
2. `apps/mobile/src/components/staff/staff-home-screen.tsx`
3. `apps/mobile/src/components/staff/staff-club-lead-screen.tsx`
4. `apps/api/src/__tests__/email.router.test.ts`
5. `apps/api/src/__tests__/twelve-data-refresh.test.ts`
6. `apps/api/src/__tests__/tithe.router.test.ts`
7. `apps/api/src/__tests__/investment-market-data-storage.test.ts`
8. `apps/mobile/src/components/staff/staff-pace-screen.tsx`
9. `packages/domain/src/__tests__/investmentTransactions.test.ts`
10. `apps/mobile/src/components/staff/staff-rota-screen.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: @oasis/mobile, @oasis/api, and @oasis/domain typechecks passed before edits.
- Tests: focused API and domain Vitest files passed before edits.

### Changes Made
- `apps/mobile/src/components/staff/staff-home-screen.tsx`: replaced repeated quick-action conditional rendering with a typed handler map.
- `apps/api/src/__tests__/email.router.test.ts`: extracted repeated APP_URL setup/restore into `withAppUrl`.
- `packages/domain/src/__tests__/investmentTransactions.test.ts`: extracted repeated ledger-balance assertions into `expectBalancedLedgerRows`.
- Remaining selected files were reviewed and left unchanged because no safe local cleanup was justified.

### Validation
- lint command: pass, `pnpm exec eslint packages/domain/src/__tests__/invoice.test.ts apps/mobile/src/components/staff/staff-home-screen.tsx apps/mobile/src/components/staff/staff-club-lead-screen.tsx apps/api/src/__tests__/email.router.test.ts apps/api/src/__tests__/twelve-data-refresh.test.ts apps/api/src/__tests__/tithe.router.test.ts apps/api/src/__tests__/investment-market-data-storage.test.ts apps/mobile/src/components/staff/staff-pace-screen.tsx packages/domain/src/__tests__/investmentTransactions.test.ts apps/mobile/src/components/staff/staff-rota-screen.tsx`; pass, `pnpm --filter @oasis/mobile lint`; pass, `pnpm --filter @oasis/api lint`; pass, `pnpm --filter @oasis/domain lint`
- typecheck command: pass, `pnpm --filter @oasis/mobile typecheck`; pass, `pnpm --filter @oasis/api typecheck`; pass, `pnpm --filter @oasis/domain typecheck`
- relevant tests: pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/email.router.test.ts src/__tests__/twelve-data-refresh.test.ts src/__tests__/tithe.router.test.ts src/__tests__/investment-market-data-storage.test.ts`; pass, `pnpm --filter @oasis/domain exec vitest run src/__tests__/invoice.test.ts src/__tests__/investmentTransactions.test.ts`
- other checks: pass, `pnpm exec prettier --check packages/domain/src/__tests__/investmentTransactions.test.ts apps/api/src/__tests__/email.router.test.ts apps/mobile/src/components/staff/staff-home-screen.tsx`; pass, `git diff --check`; pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Broader decomposition of the remaining oversized mobile staff screens is deferred to future passes; no obvious low-risk extraction was available in this 10-file scope.

## 2026-06-20 - Pass 1

### Selected Files
1. `apps/mobile/src/components/parent/parent-profile-registration-screen.tsx`
2. `apps/mobile/src/components/staff/staff-club-manager-screen.tsx`
3. `apps/mobile/src/components/staff/staff-pace-form.tsx`
4. `apps/mobile/src/components/staff/staff-communications-screen.tsx`
5. `packages/domain/src/__tests__/shop.test.ts`
6. `apps/mobile/src/components/staff/staff-shop-counter-screen.tsx`
7. `apps/mobile/src/components/staff/staff-incident-screen.tsx`
8. `apps/mobile/src/components/staff/staff-behaviour-screen.tsx`
9. `apps/mobile/src/components/staff/staff-club-lead-behaviour.tsx`
10. `apps/mobile/src/components/staff/staff-incident-form.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: `pnpm --filter @oasis/mobile typecheck` and `pnpm --filter @oasis/domain typecheck` passed before edits.
- Tests: `pnpm --filter @oasis/domain test -- src/__tests__/shop.test.ts` passed before edits.

### Changes Made
- `apps/mobile/src/components/parent/parent-profile-registration-screen.tsx`: extracted pure parent profile registration form and API-input mapping helpers into `parent-profile-registration-utils.ts`.
- `packages/domain/src/__tests__/shop.test.ts`: extracted a typed zero-sum ledger assertion helper for repeated financial invariant checks.
- Remaining selected files: reviewed and left unchanged because lint/type baselines were clean and no safe local cleanup justified churn.

### Validation
- lint command: pass - `pnpm exec eslint <selected files plus extracted utility>`; pass - `pnpm --filter @oasis/mobile lint`; pass - `pnpm --filter @oasis/domain lint`
- typecheck command: pass - `pnpm --filter @oasis/mobile typecheck`; pass - `pnpm --filter @oasis/domain typecheck`
- relevant tests: pass - `pnpm --filter @oasis/domain test -- src/__tests__/shop.test.ts`
- graphify: pass - `graphify update .`
- diff check: pass - `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Broader mobile screen component extraction deferred; current screens are already split around child panels, and deeper changes would create review risk without a focused product request.

## 2026-06-23 - Pass 1

### Selected Files
1. `apps/mobile/src/components/support/technical-support-portal-screen.tsx`
2. `apps/mobile/src/components/student/student-markets-trade-ticket.tsx`
3. `apps/mobile/src/components/staff/staff-special-attendance-roster.tsx`
4. `apps/mobile/src/components/parent/parent-fees-invoices-detail.tsx`
5. `apps/mobile/src/components/core/sign-in-panel.tsx`
6. `apps/mobile/src/components/messages/mobile-message-inbox.tsx`
7. `apps/mobile/src/components/student/student-home-screen.tsx`
8. `apps/mobile/src/components/staff/staff-attendance-roster.tsx`
9. `apps/api/src/__tests__/studentNotification.router.test.ts`
10. `apps/mobile/src/components/staff/staff-club-manager-attendance.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: `pnpm --filter @oasis/mobile typecheck` and `pnpm --filter @oasis/api typecheck` passed before edits.
- Tests: focused API and mobile tests were reserved for post-change validation.
- Formatting: selected-file Prettier failed for `apps/mobile/src/components/support/technical-support-portal-screen.tsx`, `apps/mobile/src/components/parent/parent-fees-invoices-detail.tsx`, and `apps/api/src/__tests__/studentNotification.router.test.ts`.

### Changes Made
- `apps/mobile/src/components/support/technical-support-portal-screen.tsx`: formatted the selected file and extracted access-role/count helpers.
- `apps/mobile/src/components/student/student-markets-trade-ticket.tsx`: extracted the trade action label helper.
- `apps/mobile/src/components/staff/staff-special-attendance-roster.tsx`: extracted status badge variant selection.
- `apps/mobile/src/components/parent/parent-fees-invoices-detail.tsx`: formatted the selected file and extracted invoice discount-breakdown lookup.
- `apps/mobile/src/components/core/sign-in-panel.tsx`: reviewed lint, type, and auth surface; no safe source change was needed.
- `apps/mobile/src/components/messages/mobile-message-inbox.tsx`: extracted conversation contact selection and reused the message-count label helper.
- `apps/mobile/src/components/student/student-home-screen.tsx`: extracted notification meta label formatting.
- `apps/mobile/src/components/staff/staff-attendance-roster.tsx`: extracted status badge variant selection.
- `apps/api/src/__tests__/studentNotification.router.test.ts`: formatted the selected router test.
- `apps/mobile/src/components/staff/staff-club-manager-attendance.tsx`: named the marked-over-total attendance badge label.
- Review memory: carried forward the 2026-06-21 and 2026-06-22 automation-reviewed files from the prior daily branch.

### Validation
- lint command: pass, selected-file ESLint; pass, `pnpm --filter @oasis/mobile lint`; pass, `pnpm --filter @oasis/api lint`
- typecheck command: pass, `pnpm --filter @oasis/mobile typecheck`; pass, `pnpm --filter @oasis/api typecheck`
- relevant tests: pass, `pnpm --filter @oasis/mobile test`; pass, `pnpm --filter @oasis/api exec vitest run src/__tests__/studentNotification.router.test.ts`
- formatting: pass, selected-file `pnpm exec prettier --check`
- diff hygiene: pass, `git diff --check`
- graph update: pass, `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Broader shared extraction between staff club manager and club lead attendance remains deferred because the club lead file was outside today's selected 10-file scope.

## 2026-06-25 - Pass 1

### Selected Files
1. `apps/mobile/src/components/staff/staff-club-lead-attendance.tsx`
2. `apps/mobile/src/components/staff/staff-rota-availability-panel.tsx`
3. `apps/mobile/src/components/student/student-mobile-access-gate.tsx`
4. `apps/mobile/src/components/core/mobile-ui.tsx`
5. `apps/web/src/components/reports/report-detail.tsx`
6. `apps/web/src/components/pace/pace-progress-table.tsx`
7. `apps/web/src/components/student/student-faith-client.tsx`
8. `packages/domain/src/__tests__/registration.test.ts`
9. `apps/mobile/src/components/parent/parent-shop-catalog.tsx`
10. `apps/mobile/src/components/student/student-shop-screen.tsx`

### Baseline Findings
- Lint: initial selected-file ESLint passed after deferring `apps/web/tests/e2e/supervisor-dashboard.spec.ts`, which is outside the ESLint TypeScript project service.
- Typecheck: `pnpm --filter @oasis/mobile typecheck` and `pnpm --filter @oasis/domain typecheck` passed; `pnpm --filter @oasis/web typecheck` failed on existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` route typing.
- Tests: focused domain registration tests were reserved for post-change validation.
- Formatting: selected-file Prettier failed for `apps/mobile/src/components/student/student-mobile-access-gate.tsx`, `apps/web/src/components/student/student-faith-client.tsx`, and `apps/mobile/src/components/parent/parent-shop-catalog.tsx`.

### Changes Made
- `apps/mobile/src/components/student/student-mobile-access-gate.tsx`: formatted the selected file and stored usage metadata once instead of recomputing it during render.
- `apps/web/src/components/student/student-faith-client.tsx`: formatted the selected file with Prettier.
- `apps/mobile/src/components/parent/parent-shop-catalog.tsx`: formatted the selected file with Prettier.
- Remaining selected files: reviewed lint, type, formatting, imports, and local structure; no safe source change was needed.

### Validation
- lint command: pass, selected-file ESLint; pass, `pnpm --filter @oasis/mobile lint`; pass, `pnpm --filter @oasis/web lint`; pass, `pnpm --filter @oasis/domain lint`
- typecheck command: pass, `pnpm --filter @oasis/mobile typecheck`; pass, `pnpm --filter @oasis/domain typecheck`; fail, `pnpm --filter @oasis/web typecheck` on existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` route typing
- relevant tests: pass, `pnpm --filter @oasis/domain exec vitest run src/__tests__/registration.test.ts`
- formatting: pass, selected-file `pnpm exec prettier --check`
- diff hygiene: pass, `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- `apps/web/tests/e2e/supervisor-dashboard.spec.ts`: selected-file ESLint project-service coverage is a config-level issue and was deferred.
- `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx`: existing web typecheck route typing failure is outside today’s selected files.

## 2026-06-26 - Pass 1

### Selected Files
1. `apps/mobile/src/components/parent/parent-shop-reservations-screen.tsx`
2. `apps/web/src/components/invoices/invoice-ui.tsx`
3. `apps/web/src/components/clubs/clubs-management-client.tsx`
4. `apps/web/src/components/rota/monthly-availability-editor.tsx`
5. `apps/web/src/components/community/student-community-contacts.tsx`
6. `apps/web/src/components/clubs/club-attendance-panel.tsx`
7. `apps/web/src/components/invoices/admin-invoice-modals.tsx`
8. `apps/mobile/src/components/staff/staff-shop-counter-purchase.tsx`
9. `apps/web/src/app/(admin)/admin/access/access-management-client.tsx`
10. `apps/web/src/components/child-log/snapshot-controls.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed with the local repo binary after pnpm exec attempted an interactive module purge.
- Typecheck: mobile typecheck passed; web typecheck failed on existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` route typing.
- Tests: not run because this run made formatting-only source changes.
- Formatting: selected-file Prettier failed for five files before editing.

### Changes Made
- `apps/mobile/src/components/parent/parent-shop-reservations-screen.tsx`: formatted selected file with Prettier.
- `apps/web/src/components/invoices/invoice-ui.tsx`: formatted selected file with Prettier.
- `apps/web/src/components/rota/monthly-availability-editor.tsx`: formatted selected file with Prettier.
- `apps/web/src/components/community/student-community-contacts.tsx`: formatted selected file with Prettier.
- `apps/mobile/src/components/staff/staff-shop-counter-purchase.tsx`: formatted selected file with Prettier.
- Remaining selected files: reviewed lint, type, formatting, imports, suppressions, debug logs, and local structure; no safe source change was needed.

### Validation
- lint command: pass, `./node_modules/.bin/eslint` on the 10 selected files
- typecheck command: pass, `./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json`; fail, `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` on existing unselected route typing
- relevant tests: not run, formatting-only source changes
- formatting: pass, `./node_modules/.bin/prettier --check` on the 10 selected files
- diff hygiene: pass, `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx`: existing web typecheck route typing failure is outside today’s selected files.
- pnpm command wrapper/install state: `pnpm exec` attempted interactive module purge; local binaries were used to avoid dependency changes.

## 2026-06-27 - Pass 1

### Selected Files
1. `apps/web/src/app/landing-data.ts`
2. `apps/web/src/lib/user-facing-errors.ts`
3. `apps/mobile/src/components/student/student-clubs-panel.tsx`
4. `apps/api/src/__tests__/audit.router.test.ts`
5. `apps/web/src/components/homework/student-homework-client.tsx`
6. `apps/api/src/__tests__/investment-accounting-invariants.test.ts`
7. `apps/web/src/app/(admin)/admin/students/[id]/student-registration-panel.tsx`
8. `apps/web/src/app/(admin)/admin/staff/_components/attendance-history-panel.tsx`
9. `apps/web/src/components/messages/message-contact-list.tsx`
10. `apps/web/src/components/calendar/calendar-model.ts`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: mobile, API, and DB typecheck passed before edits; web typecheck failed on existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` route typing.
- Tests: focused API tests were reserved for post-change validation.
- Formatting: selected-file Prettier failed for four files before editing.

### Changes Made
- `apps/web/src/lib/user-facing-errors.ts`: formatted selected file with Prettier.
- `apps/api/src/__tests__/audit.router.test.ts`: formatted selected file with Prettier.
- `apps/web/src/components/homework/student-homework-client.tsx`: formatted selected file with Prettier.
- `apps/web/src/app/(admin)/admin/staff/_components/attendance-history-panel.tsx`: formatted selected file with Prettier.
- Remaining selected files: reviewed lint, type, formatting, imports, suppressions, debug logs, and local structure; no safe source change was needed.

### Validation
- lint command: pass, `./node_modules/.bin/eslint` on the 10 selected files
- typecheck command: pass, `./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json`; pass, `./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json`; pass, `./node_modules/.bin/tsc --noEmit -p packages/db/tsconfig.json`; fail, `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` on existing unselected route typing
- relevant tests: pass, `./node_modules/.bin/vitest run src/__tests__/audit.router.test.ts src/__tests__/investment-accounting-invariants.test.ts` from `apps/api`
- formatting: pass, `./node_modules/.bin/prettier --check` on the 10 selected files
- diff hygiene: pass, `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx`: existing web typecheck route typing failure is outside today’s selected files.
- `apps/web/tests/e2e/supervisor-dashboard.spec.ts`: selected-file ESLint project-service coverage is a config-level issue and remains deferred.
- pnpm command wrapper/install state: `pnpm --filter` attempted an interactive module purge and registry metadata fetch; local binaries were used to avoid dependency changes.

## 2026-07-19 - Pass 1

### Selected Files
1. `packages/db/scripts/smoke-rls.ts`
2. `apps/web/src/app/(admin)/admin/students/students-list.tsx`
3. `apps/mobile/src/components/student/student-notifications-list.tsx`
4. `apps/web/src/components/rota/my-availability-editor.tsx`
5. `apps/mobile/src/components/student/student-homework-activity-list.tsx`
6. `apps/web/src/components/parent/child-icon-photo-upload.tsx`
7. `apps/web/src/components/shop/shop-photo-upload.tsx`
8. `apps/mobile/src/components/student/student-club-detail-panel.tsx`
9. `apps/api/src/emails/_components/oasis-email-shell.tsx`
10. `apps/mobile/src/components/staff/staff-club-manager-overview.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: DB, mobile, and API typechecks passed before edits; web typecheck failed on existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` route typing.
- Tests: no focused tests were run before edits because selected-file baseline was lint/format/type oriented and no behavioural bug was being changed.
- Formatting: selected-file Prettier failed for `apps/web/src/app/(admin)/admin/students/students-list.tsx`, `apps/mobile/src/components/student/student-homework-activity-list.tsx`, and `apps/mobile/src/components/student/student-club-detail-panel.tsx`.

### Changes Made
- `apps/web/src/lib/photo-upload-validation.ts`: added a shared web photo validation helper for extension, MIME fallback, size, and signature checks.
- `apps/web/src/components/parent/child-icon-photo-upload.tsx`: reused the shared photo validation helper while preserving the child icon upload endpoint and payload.
- `apps/web/src/components/shop/shop-photo-upload.tsx`: reused the shared photo validation helper while preserving the shop item upload endpoint and payload.
- `apps/web/src/app/(admin)/admin/students/students-list.tsx`: formatted selected file with Prettier.
- `apps/mobile/src/components/student/student-homework-activity-list.tsx`: formatted selected file with Prettier.
- `apps/mobile/src/components/student/student-club-detail-panel.tsx`: formatted selected file with Prettier.
- Remaining selected files: reviewed lint, type, formatting, imports, debug logs, and local structure; no safe source change was needed.

### Validation
- lint command: pass - `pnpm exec eslint <10 selected files plus photo-upload-validation.ts>`
- typecheck command: pass - `pnpm --filter @oasis/db typecheck`; pass - `pnpm --filter @oasis/mobile typecheck`; pass - `pnpm --filter @oasis/api typecheck`; fail - `pnpm --filter @oasis/web typecheck` on existing unselected clubs-lead route typing
- relevant tests: not run - no behaviour-changing logic or targeted test surface for the extracted browser file validation helper
- formatting: pass - `pnpm exec prettier --check <10 selected files plus photo-upload-validation.ts>`
- diff hygiene: pass - `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx`: existing web route typing failure remains outside today’s selected files.
- Broader upload component consolidation deferred; only duplicated validation helpers were extracted to avoid changing upload flow semantics.

## 2026-07-20 - Pass 1

### Selected Files
1. `apps/web/src/components/student/student-nav.tsx`
2. `apps/web/src/app/(parent)/parent/layout.tsx`
3. `apps/web/src/components/parent/parent-nav.tsx`
4. `apps/web/src/app/post-sign-in/resolve/page.tsx`
5. `apps/web/src/app/api/trpc/[trpc]/route.ts`
6. `apps/web/src/lib/profile-display.ts`
7. `apps/web/src/app/(admin)/admin/students/new/new-student-form.tsx`
8. `apps/web/src/app/(admin)/admin/students/page.tsx`
9. `packages/domain/src/__tests__/users.test.ts`
10. `apps/api/src/trpc.ts`

### Baseline Findings
- Lint: selected-file ESLint passed for web, API, and domain before edits.
- Typecheck: package typecheck baseline was not run before editing; post-edit API/domain typecheck passed and web typecheck reproduced the existing unselected clubs-lead typed-route failure.
- Tests: focused domain users test was run after review and passed.

### Changes Made
- `apps/web/src/components/student/student-nav.tsx`: Extracted a local nav item class-name helper used by sidebar and bottom navigation.
- `apps/web/src/app/(parent)/parent/layout.tsx`: Reviewed parent shell layout; no safe source edits needed.
- `apps/web/src/components/parent/parent-nav.tsx`: Extracted local nav item class-name and mobile-label helpers to remove repeated inline logic.
- `apps/web/src/app/post-sign-in/resolve/page.tsx`: Reviewed post-sign-in resolver; no safe source edits needed.
- `apps/web/src/app/api/trpc/[trpc]/route.ts`: Reviewed tRPC route handler; no safe source edits needed.
- `apps/web/src/lib/profile-display.ts`: Hoisted role, person-type, and permission-tag label maps to module constants.
- `apps/web/src/app/(admin)/admin/students/new/new-student-form.tsx`: Reviewed new student form; no safe source edits needed.
- `apps/web/src/app/(admin)/admin/students/page.tsx`: Reviewed student list page shell; no safe source edits needed.
- `packages/domain/src/__tests__/users.test.ts`: Reviewed user domain tests; no safe source edits needed.
- `apps/api/src/trpc.ts`: Reviewed API tRPC base procedures; no safe source edits needed.

### Validation
- lint command: pass - `pnpm --filter @oasis/web exec eslint ...`, `pnpm --filter @oasis/domain exec eslint src/__tests__/users.test.ts`, `pnpm --filter @oasis/api exec eslint src/trpc.ts`
- typecheck command: partial - `pnpm --filter @oasis/api typecheck` passed; `pnpm --filter @oasis/domain typecheck` passed; `pnpm --filter @oasis/web typecheck` failed on existing unselected `src/app/(clubs-lead)/clubs-lead/layout.tsx` typed-route issue.
- relevant tests: pass - `pnpm --filter @oasis/domain exec vitest run src/__tests__/users.test.ts`
- format/diff: pass - `pnpm exec prettier --check ...`; `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Existing unselected web typecheck failure in `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` remains deferred because it is outside today's selected 10 files.

## 2026-07-22 - Pass 1

### Selected Files
1. `apps/mobile/src/components/staff/staff-shop-counter-pickup-queue.tsx`
2. `apps/mobile/src/components/student/student-markets-browse-card.tsx`
3. `packages/domain/src/schoolYears.ts`
4. `apps/mobile/src/components/staff/staff-incident-form-controls.tsx`
5. `apps/mobile/src/components/student/student-faith-corner-panel.tsx`
6. `apps/web/src/app/(admin)/admin/rota/_components/rota-week-schedule.tsx`
7. `apps/web/src/components/landing/hero-preview.tsx`
8. `apps/web/src/components/student/student-portal-gate.tsx`
9. `apps/mobile/src/components/student/student-homework-activity-submit-panel.tsx`
10. `apps/web/src/components/clubs/club-management-model.ts`

### Baseline Findings
- Lint: final selected-file ESLint passed before edits; deferred `apps/web/tests/e2e/phase-3-verification.spec.ts` because ESLint project-service coverage failed outside local source scope.
- Typecheck: mobile and domain typechecks passed before edits; web typecheck reproduced existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` typed-route failure.
- Tests: focused school-year domain test reserved for post-change validation because `packages/domain/src/schoolYears.ts` was selected.
- Formatting: selected-file Prettier failed for five files before editing.

### Changes Made
- `apps/mobile/src/components/staff/staff-shop-counter-pickup-queue.tsx`: applied Prettier formatting.
- `packages/domain/src/schoolYears.ts`: replaced the double assertion for the Zod enum with a typed readonly tuple alias.
- `apps/mobile/src/components/student/student-faith-corner-panel.tsx`: applied Prettier formatting.
- `apps/web/src/app/(admin)/admin/rota/_components/rota-week-schedule.tsx`: computed shift colour once per shift and reused it for the border and marker styles; applied Prettier formatting.
- `apps/mobile/src/components/student/student-homework-activity-submit-panel.tsx`: applied Prettier formatting.
- `apps/web/src/components/clubs/club-management-model.ts`: applied Prettier formatting.
- Remaining selected files: reviewed lint, type usage, imports, hook dependencies, debug logs, and local structure; no safe source edits needed.

### Validation
- lint command: pass - `node -e 'spawnSync("./node_modules/.bin/eslint", files)'` on the 10 selected files
- typecheck command: pass - `./node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json`; pass - `./node_modules/.bin/tsc --noEmit -p packages/domain/tsconfig.json`; partial - `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` failed on existing unselected clubs-lead typed-route issue
- relevant tests: pass - `./node_modules/.bin/vitest run src/__tests__/schoolYears.test.ts` from `packages/domain`
- formatting: pass - `node -e 'spawnSync("./node_modules/.bin/prettier", ["--check", ...files])'` on the 10 selected files
- diff hygiene: pass - `git diff --check`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- `apps/web/tests/e2e/phase-3-verification.spec.ts`: ESLint project-service coverage requires config-level work outside this run.
- `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx`: existing web typed-route failure remains outside today's selected files.

## 2026-07-24 - Pass 1

### Selected Files
1. `apps/mobile/src/components/staff/staff-incident-utils.ts`
2. `apps/api/src/__tests__/staffHome.router.test.ts`
3. `apps/mobile/src/components/student/student-markets-utils.ts`
4. `apps/api/src/lib/daily-year-band-scope.ts`
5. `apps/mobile/src/components/parent/parent-profile-registration-utils.ts`
6. `apps/mobile/src/components/staff/staff-behaviour-utils.ts`
7. `apps/api/src/students/delete-archived-student.ts`
8. `apps/api/src/services/market-data/yahoo-finance-provider.ts`
9. `packages/db/src/encryption.ts`
10. `apps/api/src/routers/studentNotification.ts`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: mobile, API, and DB typechecks passed before edits.
- Tests: no baseline selected test failure; staff home focused test was selected for post-edit validation.

### Changes Made
- `apps/api/src/lib/daily-year-band-scope.ts`: reused the existing year-group band select constant in the staff shift scope delegate type.
- `apps/api/src/students/delete-archived-student.ts`: returned the delete result directly instead of keeping a single-use variable.
- `apps/api/src/services/market-data/yahoo-finance-provider.ts`: cached the trimmed currency string before normalisation.
- `packages/db/src/encryption.ts`: applied selected-file Prettier wrapping.
- Remaining selected files: reviewed with no safe source edits required.
- Repo-local memory: carried forward reviewed-file records found in automation memory but missing from JSON.

### Validation
- lint command: pass - `node_modules/.bin/eslint apps/mobile/src/components/staff/staff-incident-utils.ts apps/api/src/__tests__/staffHome.router.test.ts apps/mobile/src/components/student/student-markets-utils.ts apps/api/src/lib/daily-year-band-scope.ts apps/mobile/src/components/parent/parent-profile-registration-utils.ts apps/mobile/src/components/staff/staff-behaviour-utils.ts apps/api/src/students/delete-archived-student.ts apps/api/src/services/market-data/yahoo-finance-provider.ts packages/db/src/encryption.ts apps/api/src/routers/studentNotification.ts`
- typecheck command: pass - `pnpm --filter @oasis/api typecheck`, `pnpm --filter @oasis/mobile typecheck`, `pnpm --filter @oasis/db typecheck`
- relevant tests: pass - `pnpm --filter @oasis/api exec vitest run src/__tests__/staffHome.router.test.ts`
- formatting: pass - selected-file Prettier check
- diff whitespace: pass - `git diff --check`
- note: an accidental broad API test invocation ran the full API suite and failed only in existing unselected `invoice.router.test.ts` expectations. The direct selected test passed afterward.

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- Existing unselected `apps/api/src/__tests__/invoice.router.test.ts` finance summary expectation mismatch observed during accidental broad API test run; outside today's selected-file scope.

## 2026-07-25 - Pass 1

### Selected Files
1. `apps/web/src/app/registration/registration-form-helpers.ts`
2. `apps/mobile/src/components/staff/staff-rota-swap-panel.tsx`
3. `apps/web/src/components/navigation/mobile-side-menu.tsx`
4. `apps/mobile/src/components/student/student-learning-ranks-panel.tsx`
5. `apps/web/src/components/student-drillthrough/attendance-calendar.tsx`
6. `apps/mobile/src/components/parent/parent-student-settings-status.tsx`
7. `apps/web/src/components/child-log/sensitive-review-client.tsx`
8. `apps/web/src/components/clubs/parent-club-card.tsx`
9. `packages/domain/src/demeritPolicy.ts`
10. `apps/mobile/src/components/parent/parent-permission-slips-list.tsx`

### Baseline Findings
- Lint: selected source-file ESLint passed; initial e2e candidates failed project-service coverage and were deferred.
- Typecheck: mobile and domain typechecks passed; web typecheck reproduced the existing unselected clubs-lead typed-route failure.
- Tests: no baseline focused test failure; selected edits were formatting-only.

### Changes Made
- `apps/web/src/app/registration/registration-form-helpers.ts`: Reviewed validation helper extraction from a prior pass; no additional safe source change needed.
- `apps/mobile/src/components/staff/staff-rota-swap-panel.tsx`: Reviewed swap request panel for lint, types, hook usage, and local structure; no safe source change needed.
- `apps/web/src/components/navigation/mobile-side-menu.tsx`: Reviewed focus-trap, menu close handlers, imports, and client boundary; no safe source change needed.
- `apps/mobile/src/components/student/student-learning-ranks-panel.tsx`: Reviewed leaderboard panel for lint, types, and responsive text structure; no safe source change needed.
- `apps/web/src/components/student-drillthrough/attendance-calendar.tsx`: Applied Prettier formatting to wrap long date, section, and blank-day JSX lines.
- `apps/mobile/src/components/parent/parent-student-settings-status.tsx`: Applied Prettier formatting to wrap the password-change status expression.
- `apps/web/src/components/child-log/sensitive-review-client.tsx`: Reviewed sensitive review UI for lint, mutation handling, imports, and error display; no safe source change needed.
- `apps/web/src/components/clubs/parent-club-card.tsx`: Applied Prettier formatting to status tone and badge JSX.
- `packages/domain/src/demeritPolicy.ts`: Reviewed demerit policy helpers for type safety, exported API stability, and policy logic; no safe source change needed.
- `apps/mobile/src/components/parent/parent-permission-slips-list.tsx`: Reviewed permission slip list for lint, imports, UI states, and type usage; no safe source change needed.

### Validation
- lint command: pass - `node_modules/.bin/eslint <10 selected source files>`
- typecheck command: pass - `pnpm --filter @oasis/mobile typecheck`; pass - `pnpm --filter @oasis/domain typecheck`; partial - `pnpm --filter @oasis/web typecheck` failed on existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` typed-route issue.
- relevant tests: not run - selected edits were formatting-only and no behaviour-changing logic was touched.
- formatting: pass - `node_modules/.bin/prettier --check <10 selected source files>`
- diff whitespace: pass - `git diff --check`
- graphify: pass - `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- `apps/web/tests/e2e/supervisor-dashboard.spec.ts`: direct ESLint project-service coverage requires config-level work outside today's source-file cleanup.
- `apps/web/tests/e2e/phase-3-verification.spec.ts`: same e2e ESLint project-service coverage issue.
- `apps/web/tests/e2e/phase-3-5-clubs.spec.ts`: same e2e ESLint project-service coverage issue.
- `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx`: existing web typed-route failure remains outside today's selected files.

## 2026-07-26 - Pass 1

### Selected Files
1. `apps/web/src/components/incidents/incident-report-detail.tsx`
2. `apps/web/src/app/(admin)/admin/behaviour/behaviour-report-client.tsx`
3. `apps/mobile/src/components/staff/staff-club-lead-utils.ts`
4. `apps/web/src/components/parent/parent-usage-limit-controls.tsx`
5. `apps/mobile/src/components/parent/parent-fees-invoices-list.tsx`
6. `apps/mobile/src/components/student/student-markets-trend-card.tsx`
7. `apps/mobile/src/components/smoke/student-smoke-leaderboard.tsx`
8. `apps/web/src/app/(admin)/admin/rota/_components/rota-utils.ts`
9. `apps/web/src/components/student/student-attendance-client.tsx`
10. `apps/mobile/src/components/staff/staff-incident-review-panel.tsx`

### Baseline Findings
- Lint: selected-file ESLint passed before edits.
- Typecheck: mobile, API, and domain typechecks passed before edits; web typecheck reproduced the existing unselected clubs-lead typed-route failure.
- Tests: no focused test baseline failure; selected edits were formatting-only.
- Formatting: selected-file Prettier failed for two files before editing.

### Changes Made
- `apps/mobile/src/components/smoke/student-smoke-leaderboard.tsx`: Applied Prettier formatting to the core mobile UI import and row item props.
- `apps/web/src/components/student/student-attendance-client.tsx`: Applied Prettier formatting to attendance summary and recent-records JSX wrapping.
- Remaining selected files: reviewed lint, type usage, imports/exports, hook dependencies, accessibility labels, UI structure, and local helper shape; no safe source edits needed.

### Validation
- lint command: pass - `node_modules/.bin/eslint <10 selected source files>`
- typecheck command: pass - `pnpm --filter @oasis/mobile typecheck`; pass - `pnpm --filter @oasis/api typecheck`; pass - `pnpm --filter @oasis/domain typecheck`; partial - `pnpm --filter @oasis/web typecheck` failed on existing unselected `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx` typed-route issue.
- relevant tests: not run - selected edits were formatting-only and no behaviour-changing logic was touched.
- formatting: pass - `node_modules/.bin/prettier --check <10 selected source files>`
- diff whitespace: pass - `git diff --check`
- graphify: pass - `graphify update .`

### Guardrail Confirmation
- No new features.
- No API contract changes.
- No migrations.
- No database schema changes.
- Behaviour preserved.

### Follow-Ups Deferred
- `apps/web/src/app/(clubs-lead)/clubs-lead/layout.tsx`: existing web typed-route failure remains outside today's selected files.
- E2E test files with ESLint project-service coverage issues remain deferred because they need config-level cleanup, not selected source-file formatting.
