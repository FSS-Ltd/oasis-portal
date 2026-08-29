# PACE Inventory and Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build Head-controlled per-student PACE orders, two-PACE stock alerts, and subject diagnostic placement.

**Architecture:** A dedicated inventory router owns order, alert, and diagnostic operations. Delivered order rows are the source of stock; diagnostics retain history and atomically change the child’s assigned PACE. A focused staff screen consumes the typed tRPC API.

**Tech Stack:** Prisma/PostgreSQL RLS, TypeScript, tRPC, Zod, Vitest, Expo React Native.

**Spec:** docs/superpowers/specs/2026-08-29-pace-inventory-diagnostics-design.md

## Global Constraints

- Add no dependencies.
- Authorise every procedure with roleProcedure('Head') and apply Head-only RLS policies; mobile visibility is never the access control.
- Use PaceInventoryOrder and DiagnosticResult as model names.
- Use only Ordered, InTransit, and Delivered states; transitions only move forward.
- Each order must contain an active student, an assigned active subject, and a positive PACE number.
- Alert when current PACE is greater than or equal to highest delivered PACE minus two. Ordered and InTransit rows never count as stock.
- A diagnostic level is 1–5. Pass and Fail both place the child at 1001 + ((level - 1) * 12).
- Audit each mutation and preserve existing PII decryption auditing.

---

### Task 1: Add domain contracts and stock calculations

**Files:**
- Create: packages/domain/src/academicInventory.ts
- Create: packages/domain/src/__tests__/academicInventory.test.ts
- Modify: packages/domain/src/index.ts

**Interfaces:**
- Produces paceInventoryOrderInput, paceInventoryStatusInput, diagnosticResultInput, firstPaceNumberForDiagnosticLevel, and requiresPaceReorder.
- Consumed by the API router and mobile helpers.

- [ ] **Step 1: Write failing domain tests**

    import {
      diagnosticResultInput,
      firstPaceNumberForDiagnosticLevel,
      requiresPaceReorder,
    } from '../academicInventory.js';

    it('places a failed Level 2 diagnostic at PACE 1013', () => {
      expect(firstPaceNumberForDiagnosticLevel(2)).toBe(1013);
      expect(diagnosticResultInput.parse({
        studentId: 'student_1', subjectId: 'subject_1', level: 2, outcome: 'Fail',
      }).outcome).toBe('Fail');
    });

    it('alerts at two PACEs remaining but not three', () => {
      expect(requiresPaceReorder(1011, 1013)).toBe(true);
      expect(requiresPaceReorder(1010, 1013)).toBe(false);
    });

- [ ] **Step 2: Verify RED**

Run: pnpm --filter @oasis/domain test -- academicInventory.test.ts

Expected: FAIL because the academicInventory module does not exist.

- [ ] **Step 3: Add minimal contracts**

    export const paceInventoryOrderStatus = z.enum(['Ordered', 'InTransit', 'Delivered']);
    export const diagnosticOutcome = z.enum(['Pass', 'Fail']);
    export const diagnosticResultInput = z.object({
      studentId: z.string().trim().min(1),
      subjectId: z.string().trim().min(1),
      level: z.number().int().min(1).max(5),
      outcome: diagnosticOutcome,
    });
    export function firstPaceNumberForDiagnosticLevel(level: number): number {
      return 1001 + ((level - 1) * 12);
    }
    export function requiresPaceReorder(current: number, delivered: number | null): boolean {
      return delivered !== null && current >= delivered - 2;
    }

Add matching order creation and status schemas, then export the module from the domain index.

- [ ] **Step 4: Verify GREEN**

Run: pnpm --filter @oasis/domain test -- academicInventory.test.ts && pnpm --filter @oasis/domain typecheck

Expected: PASS.

- [ ] **Step 5: Commit**

    git add packages/domain/src/academicInventory.ts packages/domain/src/__tests__/academicInventory.test.ts packages/domain/src/index.ts
    git commit -m "feat: add academic inventory domain rules"

### Task 2: Persist orders and diagnostic history

**Files:**
- Modify: packages/db/prisma/schema.prisma
- Create: packages/db/prisma/migrations/20260829130000_pace_inventory_diagnostics/migration.sql
- Create: packages/db/src/__tests__/pace-inventory-diagnostics-migration.test.ts

**Interfaces:**
- Produces Prisma delegates paceInventoryOrder and diagnosticResult and reverse relations on Student, Subject, and User.
- Consumed by Task 3.

- [ ] **Step 1: Write a failing migration contract test**

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TYPE "PaceInventoryOrderStatus"');
    expect(sql).toContain('CREATE TABLE "PaceInventoryOrder"');
    expect(sql).toContain('CREATE TABLE "DiagnosticResult"');
    expect(sql).toContain('CHECK ("level" >= 1 AND "level" <= 5)');
    expect(sql).toContain('pace_inventory_orders_head_all');
    expect(sql).toContain('diagnostic_results_head_all');

- [ ] **Step 2: Verify RED**

Run: pnpm --filter @oasis/db test -- pace-inventory-diagnostics-migration.test.ts

Expected: FAIL because the migration is absent.

- [ ] **Step 3: Add schema and handwritten migration**

Add Prisma enums PaceInventoryOrderStatus and DiagnosticOutcome.

Add PaceInventoryOrder with studentId, subjectId, paceNumber, status, orderedAt, inTransitAt, deliveredAt, createdById, createdAt, and updatedAt. Add relations to Student, Subject, and creator User plus an index on studentId, subjectId, status, paceNumber.

Add DiagnosticResult with studentId, subjectId, level, outcome, recordedById, recordedAt, and createdAt. Add relations to Student, Subject, and recorder User plus an index on studentId, subjectId, recordedAt.

The migration must create matching enum/table/index/foreign-key objects, positive paceNumber and level range checks, status timestamp checks, RLS enable/force statements, and Head-only FOR ALL policies for both tables using current_setting('app.user_role', true) = 'Head'.

- [ ] **Step 4: Verify GREEN**

Run: pnpm --filter @oasis/db generate && pnpm --filter @oasis/db test -- pace-inventory-diagnostics-migration.test.ts && pnpm --filter @oasis/db typecheck

Expected: PASS and generated Prisma types expose both model delegates.

- [ ] **Step 5: Commit**

    git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260829130000_pace_inventory_diagnostics/migration.sql packages/db/src/__tests__/pace-inventory-diagnostics-migration.test.ts
    git commit -m "feat: persist pace inventory and diagnostics"

### Task 3: Create and register the Head inventory API

**Files:**
- Create: apps/api/src/routers/academicInventory.ts
- Create: apps/api/src/__tests__/academicInventory.router.test.ts
- Modify: apps/api/src/router.ts

**Interfaces:**
- Produces academicInventory.summary, academicInventory.createOrder, academicInventory.updateOrderStatus, and academicInventory.recordDiagnostic.
- Consumes Tasks 1–2.

- [ ] **Step 1: Write failing router tests**

Use the pace.router.test.ts in-memory context pattern. Verify:
- A Head creates an order for a student, subject, and PACE number.
- A Supervisor receives FORBIDDEN.
- An unassigned subject receives BAD_REQUEST.
- Only Ordered to InTransit to Delivered succeeds.
- Current PACE 1011 and delivered 1013 produces an alert, while current 1010 does not.
- An InTransit 1013 order does not suppress an alert.
- A Level 2 Fail writes a result and updates currentPaceNumber to 1013.
- Two students’ orders and alerts remain separate.

    await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID, subjectId: SUBJECT_ID, level: 2, outcome: 'Fail',
    });
    expect(db.studentSubject.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentPaceNumber: 1013 },
    }));

- [ ] **Step 2: Verify RED**

Run: pnpm --filter @oasis/api test -- academicInventory.router.test.ts

Expected: FAIL because academicInventoryRouter does not exist.

- [ ] **Step 3: Implement thin procedures**

Use roleProcedure('Head') for every procedure. Summary selects active students with assigned active subjects, decrypts names after access is checked, returns recent orders and diagnostic history, and derives alerts using the highest Delivered row per student/subject pair.

CreateOrder validates the assignment before making an Ordered row and Create audit. UpdateOrderStatus loads the order, rejects backward and skipped transitions, writes only the timestamp newly reached, and writes an Update audit. RecordDiagnostic validates the assignment, then uses ctx.db.$transaction to create the result and update the composite student-subject assignment to firstPaceNumberForDiagnosticLevel(level), followed by a Create audit.

- [ ] **Step 4: Register and verify GREEN**

Add academicInventory: academicInventoryRouter to the root router.

Run: pnpm --filter @oasis/api test -- academicInventory.router.test.ts && pnpm --filter @oasis/api typecheck

Expected: PASS.

- [ ] **Step 5: Commit**

    git add apps/api/src/routers/academicInventory.ts apps/api/src/__tests__/academicInventory.router.test.ts apps/api/src/router.ts
    git commit -m "feat: add academic inventory API"

### Task 4: Add small, testable mobile helpers

**Files:**
- Create: apps/mobile/src/components/staff/staff-academic-inventory-utils.ts
- Create: apps/mobile/src/components/staff/staff-academic-inventory-utils.test.ts

**Interfaces:**
- Produces canOpenAcademicInventory, diagnosticPlacementLabel, and nextOrderStatus.
- Consumed by Task 5.

- [ ] **Step 1: Write failing helper tests**

    expect(canOpenAcademicInventory({ role: 'Head' })).toBe(true);
    expect(canOpenAcademicInventory({ role: 'Supervisor' })).toBe(false);
    expect(diagnosticPlacementLabel(2)).toBe('Level 2 starts at PACE #1013');
    expect(nextOrderStatus('Ordered')).toBe('InTransit');
    expect(nextOrderStatus('Delivered')).toBeNull();

- [ ] **Step 2: Verify RED**

Run: pnpm --filter @oasis/mobile test -- staff-academic-inventory-utils.test.ts

Expected: FAIL because the helper module is absent.

- [ ] **Step 3: Implement helpers**

    export function canOpenAcademicInventory(user: { role?: string } | undefined): boolean {
      return user?.role === 'Head';
    }
    export function diagnosticPlacementLabel(level: number): string {
      return 'Level ' + String(level) + ' starts at PACE #' + String(1001 + ((level - 1) * 12));
    }
    export function nextOrderStatus(status: 'Ordered' | 'InTransit' | 'Delivered') {
      if (status === 'Ordered') return 'InTransit';
      return status === 'InTransit' ? 'Delivered' : null;
    }

- [ ] **Step 4: Verify GREEN and commit**

Run: pnpm --filter @oasis/mobile test -- staff-academic-inventory-utils.test.ts && pnpm --filter @oasis/mobile typecheck

    git add apps/mobile/src/components/staff/staff-academic-inventory-utils.ts apps/mobile/src/components/staff/staff-academic-inventory-utils.test.ts
    git commit -m "feat: add academic inventory mobile helpers"

### Task 5: Add and wire the Head staff workflow

**Files:**
- Create: apps/mobile/src/components/staff/staff-academic-inventory-screen.tsx
- Create: apps/mobile/src/components/staff/staff-academic-inventory-wiring.test.ts
- Modify: apps/mobile/src/components/staff/staff-portal-screen.tsx
- Modify: apps/mobile/src/components/staff/staff-home-model.ts
- Modify: apps/mobile/src/components/staff/staff-home-screen.tsx

**Interfaces:**
- Consumes Task 3 procedures and Task 4 helpers.
- Produces the academic-inventory route and Head-only quick action.

- [ ] **Step 1: Write the failing source-wiring test**

Read the new screen, portal, and staff-home source. Assert source strings exist for:
- api.academicInventory.summary.useQuery
- api.academicInventory.createOrder.useMutation
- api.academicInventory.updateOrderStatus.useMutation
- api.academicInventory.recordDiagnostic.useMutation
- academic-inventory
- onOpenAcademicInventory
- canOpenAcademicInventory

- [ ] **Step 2: Verify RED**

Run: pnpm --filter @oasis/mobile test -- staff-academic-inventory-wiring.test.ts

Expected: FAIL because the screen and route are absent.

- [ ] **Step 3: Implement screen and route**

StaffAcademicInventoryScreen uses one summary query. Display alerts first, then a student dropdown/picker, assigned-subject dropdown/picker, numeric PACE field, order submit button, existing-order list, and forward-only status buttons.

Its diagnostics card reuses the selected student/subject, provides level 1–5 controls and Pass/Fail controls, invokes recordDiagnostic, and displays the assigned PACE after success. Success handlers invalidate academicInventory.summary plus related student and pace query caches. Provide loading, empty, validation, pending, error, and access-denied states with SafeAreaView, PortalMobileHeader, Card, Field, and MobileButton.

Add the route and callback to the staff portal. Add the quick action only when canOpenAcademicInventory(user) returns true; do not show it to other staff roles.

- [ ] **Step 4: Verify GREEN**

Run: pnpm --filter @oasis/mobile test -- staff-academic-inventory-utils.test.ts staff-academic-inventory-wiring.test.ts && pnpm --filter @oasis/mobile typecheck

Expected: PASS.

- [ ] **Step 5: Commit**

    git add apps/mobile/src/components/staff/staff-academic-inventory-screen.tsx apps/mobile/src/components/staff/staff-academic-inventory-wiring.test.ts apps/mobile/src/components/staff/staff-portal-screen.tsx apps/mobile/src/components/staff/staff-home-model.ts apps/mobile/src/components/staff/staff-home-screen.tsx
    git commit -m "feat: add head pace inventory workflow"

### Task 6: Integrated verification and review

**Files:**
- Review: all Task 1–5 files.

- [ ] **Step 1: Run targeted tests**

    pnpm --filter @oasis/domain test -- academicInventory.test.ts
    pnpm --filter @oasis/db test -- pace-inventory-diagnostics-migration.test.ts
    pnpm --filter @oasis/api test -- academicInventory.router.test.ts
    pnpm --filter @oasis/mobile test -- staff-academic-inventory-utils.test.ts staff-academic-inventory-wiring.test.ts

Expected: all PASS.

- [ ] **Step 2: Run quality checks**

Run: pnpm typecheck && pnpm lint

Expected: PASS with no TypeScript or lint errors.

- [ ] **Step 3: Review database and source changes**

Run: git diff --check && git status --short

Expected: no whitespace errors. Inspect the migration’s RLS policies, checks, indexes, and foreign keys. Inspect every changed TypeScript file for unused imports, mutation error handling, and invalid props or tRPC names.

- [ ] **Step 4: Commit a concrete verification correction only if needed**

If review changes a source file, stage its exact path and commit with message: fix: verify pace inventory workflow. Otherwise, make no additional commit.
