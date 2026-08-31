# Student PACE Supply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Heads a student-specific PACE supply and bulk ordering workspace that warns when only two available PACEs remain, while keeping diagnostics as removable reference records.

**Architecture:** Persist student-specific available PACEs separately from external-order tracking. Delivery upserts that student's available PACE; manually entered current supply creates the same availability record directly. The API returns the selected student's supply, outstanding orders, diagnostics, and derived alerts; focused web components render the bulk PACE picker and the calm Head workflow.

**Tech Stack:** Next.js 15, React 18, TypeScript, tRPC, Prisma/PostgreSQL with RLS, Zod, Vitest, Node test runner, existing portal UI primitives.

**Spec:** `docs/superpowers/specs/2026-08-31-student-pace-supply-design.md`

## Global Constraints

- Keep the portal as an internal tracker only; do not integrate with CEE/A.C.E. ordering.
- Scope all supply and order data to one active student and one active subject.
- Use the local 1001–1144, 12-PACEs-per-level catalogue; do not scrape external catalogues at runtime.
- Show an alert when a student has two or fewer available PACEs ahead of their current PACE.
- Count only available supply, never Ordered or InTransit lines, when deriving alerts.
- Diagnostics are Head-only reference records and must never change `StudentSubject.currentPaceNumber`.
- Diagnostic deletion is soft, audited, confirmed in the UI, and never changes progress.
- Reuse existing portal tokens/components; do not add dependencies or imitate Apple branding.
- Preserve Head-only RLS and `roleProcedure('Head')` access checks.

---

### Task 1: Student-specific supply persistence and domain rules

**Files:**
- Modify: `packages/domain/src/academicInventory.ts`
- Modify: `packages/domain/src/__tests__/academicInventory.test.ts`
- Modify: `packages/domain/src/index.ts` only if new exports require it
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/db/prisma/rls.sql`
- Create: `packages/db/prisma/migrations/20260831110000_student_pace_supply/migration.sql`
- Create: `packages/db/src/__tests__/student-pace-supply-migration.test.ts`

**Interfaces:**
- Produces `PACE_CATALOGUE`, `paceLevelForNumber`, `availablePacesAhead`, `requiresPaceReorder`, `bulkPaceInventoryOrderInput`, `currentStudentPaceSupplyInput`, and `deleteDiagnosticResultInput` from `@oasis/domain`.
- Produces Prisma `StudentPaceSupply` with a unique `(studentId, subjectId, paceNumber)` constraint.
- Produces soft-delete fields on `DiagnosticResult`: `deletedAt` and `deletedById`.

- [ ] **Step 1: Write failing domain tests for catalogue and supply alerts**

  Replace the obsolete diagnostic-placement and highest-delivered tests with cases proving that the catalogue starts at `1001`, ends at `1144`, has 12 PACEs in Level 2 (`1013–1024`), ignores PACEs at or behind `currentPaceNumber`, and triggers at two but not three available future PACEs. Keep the Level 1–5 Pass/Fail validation test.

  ```ts
  expect(availablePacesAhead(1010, [1009, 1010, 1011, 1012])).toEqual([1011, 1012]);
  expect(requiresPaceReorder(1010, [1011, 1012])).toBe(true);
  expect(requiresPaceReorder(1010, [1011, 1012, 1013])).toBe(false);
  expect(paceLevelForNumber(1013)).toBe(2);
  ```

- [ ] **Step 2: Run the domain tests to verify the alert API is absent or incorrect**

  Run: `pnpm --filter @oasis/domain test`

  Expected: FAIL because the new supply-aware helpers and 1001–1144 range do not exist.

- [ ] **Step 3: Implement the minimal deterministic catalogue and Zod contracts**

  In `academicInventory.ts`, replace the highest-delivered-number rule with supply-list semantics and define bounded integer inputs:

  ```ts
  export const PACE_CATALOGUE = Array.from({ length: 144 }, (_, index) => 1001 + index);

  export function availablePacesAhead(currentPaceNumber: number, paceNumbers: readonly number[]) {
    return [...new Set(paceNumbers)]
      .filter((paceNumber) => paceNumber > currentPaceNumber)
      .sort((left, right) => left - right);
  }

  export function requiresPaceReorder(currentPaceNumber: number, availablePaceNumbers: readonly number[]) {
    return availablePacesAhead(currentPaceNumber, availablePaceNumbers).length <= 2;
  }

  export const bulkPaceInventoryOrderInput = z.object({
    studentId: z.string().trim().min(1),
    subjectId: z.string().trim().min(1),
    paceNumbers: z.array(z.number().int().min(1001).max(1144)).min(1),
  }).superRefine(rejectDuplicatePaceNumbers);
  ```

  Export a matching `currentStudentPaceSupplyInput` and a minimal `deleteDiagnosticResultInput` containing the diagnostic id. Keep `diagnosticResultInput` for its existing Level 1–5 and Pass/Fail validation.

- [ ] **Step 4: Write the failing migration contract test**

  Test the new migration SQL for the table, the unique student/subject/PACE constraint, Head-only RLS policy, delivered-order backfill, soft-delete diagnostic fields, and `deletedById` foreign key.

  ```ts
  expect(sql).toContain('CREATE TABLE "StudentPaceSupply"');
  expect(sql).toContain('UNIQUE ("studentId", "subjectId", "paceNumber")');
  expect(sql).toContain('INSERT INTO "StudentPaceSupply"');
  expect(sql).toContain('ADD COLUMN "deletedAt" TIMESTAMP(3)');
  expect(sql).toContain("current_setting('app.user_role', true) = 'Head'");
  ```

- [ ] **Step 5: Run the migration test to verify it fails**

  Run: `pnpm --filter @oasis/db test -- student-pace-supply-migration.test.ts`

  Expected: FAIL because the migration does not exist.

- [ ] **Step 6: Add the Prisma schema, migration, and RLS source entry**

  Add `StudentPaceSupply` with `source` enum values `CurrentStock` and `DeliveredOrder`, relations to Student, Subject, and its creating User, and indexes on student/subject/PACE. Add `DiagnosticResult.deletedAt`, nullable `deletedById`, and the relation from User.

  The migration must:

  ```sql
  CREATE TABLE "StudentPaceSupply" (...);
  ALTER TABLE "StudentPaceSupply" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "student_pace_supply_head_all" ON "StudentPaceSupply"
    USING (current_setting('app.user_role', true) = 'Head')
    WITH CHECK (current_setting('app.user_role', true) = 'Head');

  INSERT INTO "StudentPaceSupply" (..., "source", ...)
  SELECT ..., 'DeliveredOrder', ...
  FROM "PaceInventoryOrder"
  WHERE "status" = 'Delivered'
  ON CONFLICT ("studentId", "subjectId", "paceNumber") DO NOTHING;
  ```

  Add the matching `StudentPaceSupply` RLS block to `packages/db/prisma/rls.sql`, the repository's source-of-truth RLS script. It must enable and force RLS, drop the named policy idempotently, then recreate `student_pace_supply_head_all` with Head-only `USING` and `WITH CHECK` clauses. Add this file to the Task 1 file list and commit command.

- [ ] **Step 7: Run focused tests and regenerate Prisma**

  Run:

  ```bash
  pnpm --filter @oasis/domain test
  pnpm --filter @oasis/db generate
  pnpm --filter @oasis/db test -- student-pace-supply-migration.test.ts
  ```

  Expected: PASS.

- [ ] **Step 8: Commit the persistence and domain change**

  ```bash
  git add packages/domain/src/academicInventory.ts packages/domain/src/__tests__/academicInventory.test.ts packages/domain/src/index.ts packages/db/prisma/schema.prisma packages/db/prisma/rls.sql packages/db/prisma/migrations/20260831110000_student_pace_supply/migration.sql packages/db/src/__tests__/student-pace-supply-migration.test.ts
  git commit -m "feat: track student-specific pace supply"
  ```

### Task 2: Head-only bulk supply, order, and diagnostic API

**Files:**
- Modify: `apps/api/src/routers/academicInventory.ts`
- Modify: `apps/api/src/__tests__/academicInventory.router.test.ts`

**Interfaces:**
- Consumes Task 1 domain inputs and `StudentPaceSupply`.
- Produces `academicInventory.addCurrentSupply`, `academicInventory.createOrders`, and `academicInventory.deleteDiagnostic`.
- Changes `academicInventory.summary` to return `supply` for each student/subject and alerts with `availablePaceNumbers` and `remainingPaceCount`.

- [ ] **Step 1: Write failing router tests for the new commands**

  Add test cases that mock the RLS transaction and assert:

  ```ts
  await caller.addCurrentSupply({ studentId, subjectId, paceNumbers: [1011, 1012] });
  expect(tx.studentPaceSupply.createMany).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.arrayContaining([expect.objectContaining({ paceNumber: 1011, source: 'CurrentStock' })]),
  }));

  await caller.createOrders({ studentId, subjectId, paceNumbers: [1013, 1014] });
  expect(tx.paceInventoryOrder.createMany).toHaveBeenCalled();

  await caller.deleteDiagnostic({ diagnosticId });
  expect(tx.diagnosticResult.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ deletedById: head.id, deletedAt: expect.any(Date) }),
  }));
  ```

  Include a summary test where current PACE 1010 with supply `[1011, 1012]` returns an alert, supply `[1011, 1012, 1013]` does not, and an Ordered/ InTransit line alone never counts as supply.

- [ ] **Step 2: Run router tests to verify they fail**

  Run: `pnpm --filter @oasis/api test -- academicInventory.router.test.ts`

  Expected: FAIL because bulk procedures, supply queries, and diagnostic deletion do not exist.

- [ ] **Step 3: Implement summary and current-supply entry**

  Read student assignments, current supply, active diagnostics, and recent orders inside `ctx.withRls`. Return supply by student and subject; filter deleted diagnostics with `deletedAt: null`.

  Implement `addCurrentSupply` by validating the active assignment, rejecting any selected PACE already in supply, creating all records with `source: 'CurrentStock'`, and writing one audit entry with the selected numbers. Return a `BAD_REQUEST` explaining which PACE numbers already exist.

- [ ] **Step 4: Implement bulk order creation and delivery supply upsert**

  `createOrders` must validate the selected assignment, reject duplicate input and selected PACEs already supplied or awaiting delivery, and call `createMany` with one Ordered row per PACE number. Audit the bulk action with `paceNumbers`.

  In the existing forward-only status update, when status becomes Delivered, upsert `StudentPaceSupply` by `(studentId, subjectId, paceNumber)` with `source: 'DeliveredOrder'`. Preserve a pre-existing `CurrentStock` source if the same PACE was already entered.

- [ ] **Step 5: Make diagnostics reference-only and soft-deletable**

  Remove `firstPaceNumberForDiagnosticLevel` and the `studentSubject.update` from `recordDiagnostic`. Its audit metadata contains only student, subject, level, and outcome.

  `deleteDiagnostic` must find a non-deleted result inside RLS, update `deletedAt` and `deletedById`, write a Delete audit row, and return `{ id }`. It must not query or mutate `StudentSubject`.

- [ ] **Step 6: Run router tests to verify they pass**

  Run: `pnpm --filter @oasis/api test -- academicInventory.router.test.ts`

  Expected: PASS, including Head-only rejection, duplicate protection, delivery upsert, and diagnostic non-mutation/deletion.

- [ ] **Step 7: Commit the API change**

  ```bash
  git add apps/api/src/routers/academicInventory.ts apps/api/src/__tests__/academicInventory.router.test.ts
  git commit -m "feat: manage student pace supply in inventory api"
  ```

### Task 3: Reusable bulk PACE picker and focused web page state

**Files:**
- Create: `apps/web/src/components/pace/pace-catalogue-picker.tsx`
- Modify: `apps/web/src/components/pace/pace-inventory-client.tsx`
- Modify: `apps/web/src/app/(admin)/admin/admin.css`
- Modify: `apps/web/tests/pace-inventory-dashboard-surface.test.mjs`

**Interfaces:**
- Consumes `PACE_CATALOGUE` and `paceLevelForNumber` from Task 1 and summary data from Task 2.
- `PaceCataloguePicker` receives `availablePaceNumbers`, `disabled`, `onChange`, `selectedPaceNumbers`, and `subjectLabel`.

- [ ] **Step 1: Write a failing web surface contract for bulk selection**

  Extend the existing Node surface test to require a dedicated catalogue picker, semantic checkbox controls, and the two bulk API mutations:

  ```js
  assert.match(clientSource, /PaceCataloguePicker/);
  assert.match(clientSource, /api\.academicInventory\.addCurrentSupply\.useMutation/);
  assert.match(clientSource, /api\.academicInventory\.createOrders\.useMutation/);
  assert.match(pickerSource, /type="checkbox"/);
  assert.match(pickerSource, /Level \{level\}/);
  ```

- [ ] **Step 2: Run the web surface contract to verify it fails**

  Run: `node --test apps/web/tests/pace-inventory-dashboard-surface.test.mjs`

  Expected: FAIL because the picker and bulk mutations do not exist.

- [ ] **Step 3: Implement the accessible catalogue picker**

  Build `PaceCataloguePicker` from semantic checkboxes grouped in Level 1–12 fieldsets using the domain catalogue and level helper. Its label includes the selected subject and its summary announces the number selected; it supports keyboard selection and does not rely on colour alone. It returns a sorted, de-duplicated selection through `onChange`.

  Use existing input, button, badge, panel, and motion classes. Add only page-specific responsive rules needed for compact level groups, selectable number chips, current-supply chips, and 720px single-column reflow. Add a reduced-motion override if a new transition is introduced.

- [ ] **Step 4: Run the web surface contract to verify it passes**

  Run: `node --test apps/web/tests/pace-inventory-dashboard-surface.test.mjs`

  Expected: PASS.

- [ ] **Step 5: Replace number input flow with the student-specific supply workflow**

  Refactor `PaceInventoryClient` to keep student, subject, and selected PACE numbers as its only picker state. It should:

  - display the selected assignment's current PACE and available PACE numbers first;
  - make “Add to current supply” the primary action for selected PACEs;
  - provide “Create order” as the secondary action using the same selection;
  - clear selection and invalidate summary after success;
  - render alerts with current PACE, remaining available count, and available number labels;
  - render order history using every PACE line and forward-only action;
  - remove diagnostic placement copy that claims it sets current PACE.

- [ ] **Step 6: Commit the picker and page-state change**

  ```bash
  git add apps/web/src/components/pace/pace-catalogue-picker.tsx apps/web/src/components/pace/pace-inventory-client.tsx apps/web/src/app/(admin)/admin/admin.css apps/web/tests/pace-inventory-dashboard-surface.test.mjs
  git commit -m "feat: add bulk student pace selection"
  ```

### Task 4: Diagnostic correction UX and exact PACE navigation state

**Files:**
- Modify: `apps/web/src/components/pace/pace-inventory-client.tsx`
- Modify: `apps/web/src/components/admin/admin-nav.tsx`
- Modify: `apps/web/tests/pace-inventory-dashboard-surface.test.mjs`

**Interfaces:**
- Consumes `academicInventory.deleteDiagnostic` from Task 2.
- Uses existing `ConfirmationDialog` from `apps/web/src/components/admin/confirmation-dialog.tsx`.
- Keeps `isActiveRoute(pathname, href, label)` exact for `'/admin/pace'` and descendant-aware for `'/admin/pace/inventory'`.

- [ ] **Step 1: Write failing web surface tests**

  Extend the Node contract test to require:

  ```js
  assert.match(inventorySource, /api\.academicInventory\.deleteDiagnostic\.useMutation/);
  assert.match(inventorySource, /Delete diagnostic/);
  assert.match(inventorySource, /ConfirmationDialog/);
  assert.match(adminNavSource, /href === '\/admin\/pace'[^\n]*pathname === href/);
  ```

  Also assert that the inventory route remains the only PACE navigation item active for `/admin/pace/inventory`.

- [ ] **Step 2: Run the web surface test to verify it fails**

  Run: `node --test apps/web/tests/pace-inventory-dashboard-surface.test.mjs`

  Expected: FAIL because diagnostic deletion and exact PACE route matching are absent.

- [ ] **Step 3: Add diagnostic deletion with a recovery-focused confirmation**

  In `PaceInventoryClient`, hold a pending diagnostic id, render a clearly labelled Delete button in the diagnostic table, and use `ConfirmationDialog` with:

  ```tsx
  <ConfirmationDialog
    confirmLabel="Delete diagnostic"
    onConfirm={() => deleteDiagnostic.mutate({ diagnosticId })}
    title="Delete diagnostic result?"
    variant="danger"
  >
    This removes the diagnostic reference only. It does not change the student&apos;s current PACE.
  </ConfirmationDialog>
  ```

  Disable the relevant action while pending, close the dialog only on success, show the existing error toast on failure, and invalidate summary after success.

- [ ] **Step 4: Correct PACE route matching**

  Keep the generic descendant behaviour for inventory and other routes, but make the PACE Progress item exact:

  ```ts
  if (href === '/admin/pace') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
  ```

  This lets PACE Inventory own its active state without changing the dashboard route rule.

- [ ] **Step 5: Run focused test and web quality checks**

  Run:

  ```bash
  node --test apps/web/tests/pace-inventory-dashboard-surface.test.mjs
  pnpm --filter @oasis/web lint
  pnpm --filter @oasis/web typecheck
  pnpm exec prettier --check apps/web/src/components/pace/pace-inventory-client.tsx apps/web/src/components/pace/pace-catalogue-picker.tsx apps/web/src/components/admin/admin-nav.tsx
  ```

  Expected: PASS.

- [ ] **Step 6: Commit the diagnostic correction and navigation change**

  ```bash
  git add apps/web/src/components/pace/pace-inventory-client.tsx apps/web/src/components/admin/admin-nav.tsx apps/web/tests/pace-inventory-dashboard-surface.test.mjs
  git commit -m "feat: add pace inventory diagnostic corrections"
  ```

### Task 5: End-to-end verification and migration smoke test

**Files:**
- Modify only if a concrete defect is found in Tasks 1–4.

**Interfaces:**
- Consumes all completed domain, database, API, and web interfaces.
- Produces a validated Head workflow on `/admin/pace/inventory`.

- [ ] **Step 1: Apply migrations to the local database**

  Run:

  ```bash
  pnpm db:dev:up
  pnpm db:migrate
  ```

  Expected: the student-supply migration and RLS statements apply successfully.

- [ ] **Step 2: Run the relevant automated suites**

  Run:

  ```bash
  pnpm --filter @oasis/domain test
  pnpm --filter @oasis/db test
  pnpm --filter @oasis/api test -- academicInventory.router.test.ts
  pnpm --filter @oasis/web test
  pnpm --filter @oasis/web lint
  pnpm --filter @oasis/web typecheck
  ```

  Expected: PASS.

- [ ] **Step 3: Manually verify the Head journey**

  With the local web server running and a Head session:

  1. Open `/admin/pace/inventory`; confirm only PACE Inventory is active in navigation.
  2. Select a student and subject; select multiple PACEs and add them to current supply.
  3. Confirm an alert appears at two available future PACEs and clears at three.
  4. Select multiple PACEs to create order lines; advance one to Delivered and confirm it becomes supply.
  5. Record and delete a diagnostic; confirm the student's current PACE remains unchanged.
  6. Check keyboard navigation, narrow viewport reflow, pending buttons, empty states, and destructive-action confirmation.

- [ ] **Step 4: Inspect the final diff and commit any verification fixes**

  Run:

  ```bash
  git diff --check
  git status --short
  ```

  If a fix is needed, add a focused test first, make the minimal correction, rerun the affected suite, then commit with a precise message.
