# Oasis Report Periods and PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Oasis student report workflow with academic-year, term, and custom periods; selectable sections; report-specific note editing; PACE status and identifier formatting; and immutable branded PDF downloads.

**Architecture:** Keep the existing encrypted `TermReport` snapshot and draft/review/send lifecycle, but add typed period metadata and section visibility. Compile only selected source sections into a generic student-report snapshot, generate draft PDFs from that snapshot, and persist the exact encrypted final PDF during send. Split the web changes into focused period, section, note-editor, detail, and action components while preserving existing RBAC, guardian scoping, audit, and notification behavior.

**Tech Stack:** TypeScript 5.6, Zod, Prisma/PostgreSQL, tRPC, Vitest, Next.js 15, React 18, pdf-lib, pdfjs-dist, Playwright, pnpm/Turborepo.

## Global Constraints

- Academic year means 1 September through 31 August; term boundaries remain Spring 1 January-31 March, Summer 1 April-31 August, and Autumn 1 September-31 December.
- Custom ranges use valid ISO date-only values and include both endpoints.
- All nine report sections default visible; PACE Status cannot be selected unless PACE Progress is selected.
- Report-specific Behaviour and General Notes never mutate source `BehaviourEntry` or `ChildNote` rows; source entries remain read-only.
- PACE identifiers render with `String(currentPace)`, so `1025` never becomes `1,025`.
- PACE status reuses `paceProgressStatusForYear` and is frozen in the encrypted snapshot.
- Snapshot JSON, final PDF bytes, and PDF filename remain encrypted at rest.
- Full administrators prepare/download reports; linked guardians see/download only sent reports for their child.
- Send must not change status or notify guardians unless final PDF generation and encryption succeed.
- Use the existing `pdf-lib` dependency and Oasis branding; add no runtime dependency.
- Follow strict TypeScript, existing audit/error patterns, test-driven development, and focused file boundaries.

---

### Task 1: Typed report periods, section configuration, and generic snapshot model

**Files:**

- Create: `packages/domain/src/reportPeriod.ts`
- Create: `packages/domain/src/__tests__/reportPeriod.test.ts`
- Modify: `packages/domain/src/report.ts:1-102`
- Modify: `packages/domain/src/__tests__/report.test.ts:1-107`

**Interfaces:**

- Produces: `ReportPeriodInput`, `ReportPeriodSnapshot`, `ResolvedReportPeriod`, `resolveReportPeriod(input)`, `reportPeriodInputSchema`.
- Produces: `ReportSections`, `DEFAULT_REPORT_SECTIONS`, `reportSectionsSchema`.
- Produces: `formatPaceIdentifier(value)` and `reportAcademicYearOptions(referenceDate)`.
- Produces: `ReportEntryOrigin`, enriched `ReportTextEntrySnapshot`, enriched `PaceSnapshot`, and `compileStudentReport(input): CompiledReport`.
- Consumes: existing `PaceProgressStatusResult`, ledger, attendance, and balance types from `@oasis/domain`.

- [ ] **Step 1: Write failing period and section tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPORT_SECTIONS,
  formatPaceIdentifier,
  reportAcademicYearOptions,
  reportSectionsSchema,
  resolveReportPeriod,
} from '../report.js';

describe('resolveReportPeriod', () => {
  it('resolves academic year, term, and inclusive custom ranges', () => {
    expect(resolveReportPeriod({ type: 'AcademicYear', startYear: 2025 })).toMatchObject({
      snapshot: {
        type: 'AcademicYear',
        key: '2025-AcademicYear',
        label: '2025/26 Academic Year',
        from: '2025-09-01',
        to: '2026-08-31',
      },
      queryFrom: new Date('2025-09-01T00:00:00.000Z'),
      queryToExclusive: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(resolveReportPeriod({ type: 'Term', term: '2026-Summer' }).snapshot).toEqual({
      type: 'Term',
      key: '2026-Summer',
      label: 'Summer 2026',
      from: '2026-04-01',
      to: '2026-08-31',
    });
    expect(
      resolveReportPeriod({ type: 'Custom', from: '2026-05-01', to: '2026-05-31' }),
    ).toMatchObject({
      snapshot: {
        type: 'Custom',
        key: '2026-05-01_to_2026-05-31',
        label: '1 May 2026 - 31 May 2026',
      },
      queryToExclusive: new Date('2026-06-01T00:00:00.000Z'),
    });
  });

  it('rejects invalid dates and reversed custom ranges', () => {
    expect(() =>
      resolveReportPeriod({ type: 'Custom', from: '2026-02-30', to: '2026-03-01' }),
    ).toThrow('from must be a valid ISO date');
    expect(() =>
      resolveReportPeriod({ type: 'Custom', from: '2026-06-01', to: '2026-05-31' }),
    ).toThrow('from must not be after to');
  });
});

describe('reportSectionsSchema', () => {
  it('defaults every section to visible', () => {
    expect(reportSectionsSchema.parse(undefined)).toEqual(DEFAULT_REPORT_SECTIONS);
  });

  it('requires one section and rejects PACE status without PACE progress', () => {
    const none = Object.fromEntries(
      Object.keys(DEFAULT_REPORT_SECTIONS).map((key) => [key, false]),
    );
    expect(reportSectionsSchema.safeParse(none).success).toBe(false);
    expect(
      reportSectionsSchema.safeParse({
        ...DEFAULT_REPORT_SECTIONS,
        paceProgress: false,
        paceStatus: true,
      }).success,
    ).toBe(false);
  });
});

describe('report display helpers', () => {
  it('keeps PACE identifiers ungrouped and provides current report years', () => {
    expect(formatPaceIdentifier(1025)).toBe('1025');
    expect(reportAcademicYearOptions(new Date('2026-08-17T12:00:00.000Z'))).toEqual([
      2026, 2025, 2024, 2023, 2022, 2021, 2020,
    ]);
  });
});
```

- [ ] **Step 2: Run the tests and verify the expected missing-export failure**

Run: `pnpm --filter @oasis/domain test -- reportPeriod.test.ts`

Expected: FAIL because `resolveReportPeriod`, `reportSectionsSchema`, and `DEFAULT_REPORT_SECTIONS` do not exist.

- [ ] **Step 3: Implement period resolution in a focused module**

Create `reportPeriod.ts` with this public shape and exact UTC/date-key semantics:

```ts
import { z } from 'zod';

const isoDateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const termSchema = z.string().regex(/^\d{4}-(Spring|Summer|Autumn)$/u);

export const reportPeriodInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('AcademicYear'), startYear: z.number().int().min(2000).max(2100) }),
  z.object({ type: z.literal('Term'), term: termSchema }),
  z.object({ type: z.literal('Custom'), from: isoDateKeySchema, to: isoDateKeySchema }),
]);

export type ReportPeriodInput = z.infer<typeof reportPeriodInputSchema>;
export type ReportPeriodType = ReportPeriodInput['type'];

export interface ReportPeriodSnapshot {
  type: ReportPeriodType;
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface ResolvedReportPeriod {
  snapshot: ReportPeriodSnapshot;
  queryFrom: Date;
  queryToExclusive: Date;
}

export function resolveReportPeriod(input: ReportPeriodInput): ResolvedReportPeriod {
  if (input.type === 'AcademicYear') {
    const endYear = input.startYear + 1;
    return resolvedPeriod({
      type: input.type,
      key: `${String(input.startYear)}-AcademicYear`,
      label: `${String(input.startYear)}/${String(endYear).slice(-2)} Academic Year`,
      from: `${String(input.startYear)}-09-01`,
      to: `${String(endYear)}-08-31`,
    });
  }

  if (input.type === 'Term') {
    const match = /^(\d{4})-(Spring|Summer|Autumn)$/u.exec(input.term);
    if (!match) throw new Error('term must be a valid Oasis term id');
    const year = Number(match[1]);
    const season = match[2];
    const range =
      season === 'Spring'
        ? { from: `${String(year)}-01-01`, to: `${String(year)}-03-31` }
        : season === 'Summer'
          ? { from: `${String(year)}-04-01`, to: `${String(year)}-08-31` }
          : { from: `${String(year)}-09-01`, to: `${String(year)}-12-31` };
    return resolvedPeriod({
      type: input.type,
      key: input.term,
      label: `${season} ${String(year)}`,
      ...range,
    });
  }

  const from = parseDateKey(input.from, 'from');
  const to = parseDateKey(input.to, 'to');
  if (from > to) throw new Error('from must not be after to');
  return resolvedPeriod({
    type: input.type,
    key: `${input.from}_to_${input.to}`,
    label: `${formatDate(from)} - ${formatDate(to)}`,
    from: input.from,
    to: input.to,
  });
}
```

Implement `parseDateKey(value, field)` by splitting numeric UTC parts and round-tripping through `dateKey`; implement `resolvedPeriod(snapshot)` by parsing its endpoints and setting `queryToExclusive` to `addUtcDays(to, 1)`. Use an `en-GB` `Intl.DateTimeFormat` with `timeZone: 'UTC'` for `formatDate`. Do not parse date-only values through locale-dependent constructors. Ensure the assertions from Step 1 pass exactly.

- [ ] **Step 4: Add section and snapshot types to `report.ts`**

```ts
export const DEFAULT_REPORT_SECTIONS = {
  attendance: true,
  paceProgress: true,
  paceStatus: true,
  behaviourSummary: true,
  behaviourNotes: true,
  generalNotes: true,
  meritActivity: true,
  balances: true,
  progressComment: true,
} as const;

export type ReportSections = { [K in keyof typeof DEFAULT_REPORT_SECTIONS]: boolean };

export function formatPaceIdentifier(value: number): string {
  return String(value);
}

export function reportAcademicYearOptions(referenceDate: Date = new Date()): number[] {
  const year = referenceDate.getUTCFullYear();
  const currentStart = referenceDate.getUTCMonth() >= 8 ? year : year - 1;
  return Array.from({ length: 7 }, (_, index) => currentStart + 1 - index);
}

export const reportSectionsSchema = z
  .object({
    attendance: z.boolean(),
    paceProgress: z.boolean(),
    paceStatus: z.boolean(),
    behaviourSummary: z.boolean(),
    behaviourNotes: z.boolean(),
    generalNotes: z.boolean(),
    meritActivity: z.boolean(),
    balances: z.boolean(),
    progressComment: z.boolean(),
  })
  .default(DEFAULT_REPORT_SECTIONS)
  .superRefine((sections, ctx) => {
    if (!Object.values(sections).some(Boolean)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'select at least one report section' });
    }
    if (sections.paceStatus && !sections.paceProgress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PACE Status requires PACE Progress',
        path: ['paceStatus'],
      });
    }
  });
```

Update `PaceSnapshot` to require `status: PaceProgressStatusResult`. Update text entries to include `id: string` and `origin: 'Source' | 'Report'`. Replace the input's `term` with `period: ReportPeriodSnapshot` and `sections: ReportSections`. Rename `compileTermReport` to `compileStudentReport`, returning `period`, `sections`, frozen statuses, and `headSummary` for compatibility.

Re-export the period module from `report.ts` with `export * from './reportPeriod.js';` so both `@oasis/domain` and `@oasis/domain/report` expose the same API.

- [ ] **Step 5: Update compilation tests for ids, origins, period, sections, and status**

Modify `report.test.ts` fixtures to pass `period`, `sections`, source ids/origins, and a status object. Assert the compiled output preserves them and still computes attendance and balances. Keep the zero-attendance regression test.

- [ ] **Step 6: Run domain tests, typecheck, and lint**

Run:

```bash
pnpm --filter @oasis/domain test -- reportPeriod.test.ts report.test.ts subjects.test.ts
pnpm --filter @oasis/domain typecheck
pnpm --filter @oasis/domain lint
```

Expected: PASS with no warnings introduced by the changed files.

- [ ] **Step 7: Commit the domain model**

```bash
git add packages/domain/src/reportPeriod.ts packages/domain/src/report.ts packages/domain/src/__tests__/reportPeriod.test.ts packages/domain/src/__tests__/report.test.ts
git commit -m "feat: model flexible student report periods"
```

---

### Task 2: Additive report period and encrypted PDF persistence

**Files:**

- Create: `packages/db/prisma/migrations/20260817120000_report_periods_and_pdfs/migration.sql`
- Create: `packages/db/src/__tests__/report-periods-migration.test.ts`
- Modify: `packages/db/prisma/schema.prisma:2335-2359`

**Interfaces:**

- Produces Prisma enum: `ReportPeriodType` with `Term`, `AcademicYear`, `Custom`.
- Produces mapped Prisma fields: `periodKey`, `periodType`, `periodLabel`, `periodStart`, `periodEnd`, `pdfBytesEnc`, `pdfFileNameEnc`, `pdfGeneratedAt`.
- Preserves physical `TermReport.term` storage and `TermReport_studentId_term_key` index.

- [ ] **Step 1: Write a failing migration contract test**

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260817120000_report_periods_and_pdfs/migration.sql',
);

describe('report periods and PDFs migration', () => {
  it('backfills every legacy term before making period fields required', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const backfill = sql.indexOf('UPDATE "TermReport"');
    const notNull = sql.indexOf('ALTER COLUMN "periodLabel" SET NOT NULL');

    expect(sql).toContain('CREATE TYPE "ReportPeriodType"');
    expect(sql).toContain('WHEN "term" LIKE \'%-Spring\'');
    expect(sql).toContain('WHEN "term" LIKE \'%-Summer\'');
    expect(sql).toContain('WHEN "term" LIKE \'%-Autumn\'');
    expect(sql).toContain('ADD COLUMN "pdfBytesEnc" TEXT');
    expect(backfill).toBeGreaterThan(-1);
    expect(notNull).toBeGreaterThan(backfill);
    expect(sql).not.toContain('DROP COLUMN "term"');
  });
});
```

- [ ] **Step 2: Run the migration test and verify the missing-file failure**

Run: `pnpm --filter @oasis/db test -- report-periods-migration.test.ts`

Expected: FAIL with `ENOENT` for the planned migration.

- [ ] **Step 3: Extend the Prisma schema without renaming the physical table/column**

```prisma
enum ReportPeriodType {
  Term
  AcademicYear
  Custom
}

model TermReport {
  id              String           @id @default(cuid())
  studentId       String
  periodKey       String           @map("term")
  periodType      ReportPeriodType
  periodLabel     String
  periodStart     DateTime         @db.Date
  periodEnd       DateTime         @db.Date
  status          TermReportStatus @default(Draft)
  compiledJsonEnc String
  pdfBytesEnc     String?
  pdfFileNameEnc  String?
  pdfGeneratedAt  DateTime?
  sentAt          DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  student Student @relation(fields: [studentId], references: [id])

  @@unique([studentId, periodKey], map: "TermReport_studentId_term_key")
}
```

- [ ] **Step 4: Write the backfill migration**

The SQL must:

1. Create the enum.
2. Add nullable `periodType`, `periodLabel`, `periodStart`, and `periodEnd` plus nullable PDF fields.
3. Backfill legacy `YYYY-Spring`, `YYYY-Summer`, and `YYYY-Autumn` rows with the exact approved inclusive dates and labels.
4. Fail explicitly if any row remains unclassified instead of inventing a range.
5. Set the four period columns `NOT NULL` after backfill.
6. Preserve the `term` column and existing unique index.

Use PostgreSQL `make_date`, `split_part`, and a `DO $$ ... RAISE EXCEPTION ... $$` guard; do not depend on session time zone.

- [ ] **Step 5: Run migration test, Prisma validation/generation, DB typecheck, and lint**

Run:

```bash
pnpm --filter @oasis/db test -- report-periods-migration.test.ts
pnpm --filter @oasis/db exec prisma validate
pnpm --filter @oasis/db generate
pnpm --filter @oasis/db typecheck
pnpm --filter @oasis/db lint
```

Expected: PASS. If `DATABASE_URL` is required for `prisma validate`, use the repository's existing env wrapper rather than embedding credentials.

- [ ] **Step 6: Commit the persistence changes**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260817120000_report_periods_and_pdfs/migration.sql packages/db/src/__tests__/report-periods-migration.test.ts
git commit -m "feat: persist report periods and final PDFs"
```

---

### Task 3: Compile selected report periods and PACE status in the API

**Files:**

- Modify: `apps/api/src/routers/report.ts:1-460`
- Modify: `apps/api/src/__tests__/report.router.test.ts:1-599`

**Interfaces:**

- Consumes: Task 1 `reportPeriodInputSchema`, `reportSectionsSchema`, `resolveReportPeriod`, `compileStudentReport`, `paceProgressStatusForYear`.
- Consumes: Task 2 Prisma mapped period fields.
- Produces: `report.draft({ studentId, period, sections })` and period-aware `listForStudent` output.
- Preserves: encrypted snapshot, sensitive-note filtering, audit, full-admin draft access, guardian sent-only reads.

- [ ] **Step 1: Extend fake rows and write failing period/filter/status tests**

Add `yearGroup` and source ids to fake students/notes/behaviour rows. Replace stored `term` with period metadata and nullable PDF fields. Add tests equivalent to:

```ts
it.each([
  [
    { type: 'Term' as const, term: '2026-Summer' },
    { key: '2026-Summer', from: '2026-04-01', to: '2026-08-31' },
  ],
  [
    { type: 'AcademicYear' as const, startYear: 2025 },
    { key: '2025-AcademicYear', from: '2025-09-01', to: '2026-08-31' },
  ],
  [
    { type: 'Custom' as const, from: '2026-05-10', to: '2026-05-12' },
    { key: '2026-05-10_to_2026-05-12', from: '2026-05-10', to: '2026-05-12' },
  ],
])('compiles a %s period with frozen metadata', async (period, expected) => {
  const { caller } = makeCaller(headUser);
  const draft = await caller.report.draft({
    studentId,
    period,
    sections: DEFAULT_REPORT_SECTIONS,
  });
  expect(draft.period).toMatchObject(expected);
  expect(draft.compiled.period).toMatchObject(expected);
});

it('copies only selected sections and freezes PACE status', async () => {
  const { caller, db } = makeCaller(headUser);
  const draft = await caller.report.draft({
    studentId,
    period: { type: 'Term', term: '2026-Summer' },
    sections: {
      ...DEFAULT_REPORT_SECTIONS,
      behaviourNotes: false,
      generalNotes: false,
      meritActivity: false,
    },
  });

  expect(draft.compiled.sections.behaviourNotes).toBe(false);
  expect(draft.compiled.behaviour.generalEntries).toEqual([]);
  expect(draft.compiled.notes).toEqual([]);
  expect(draft.compiled.meritActivity).toEqual([]);
  expect(draft.compiled.paces[0]?.status.status).toBe('Ahead');
  expect(db.$enc.decrypt).not.toHaveBeenCalledWith(encrypt('Reading has improved'));
});
```

Track encrypted note ciphertexts directly in the fake DB so the last assertion proves hidden note payloads were not decrypted.

- [ ] **Step 2: Run focused API tests and verify input/type failures**

Run: `pnpm --filter @oasis/api test -- report.router.test.ts`

Expected: FAIL because `draft` still accepts `{ term }` and the output lacks period/section/status data.

- [ ] **Step 3: Replace hard-coded term input and range logic**

```ts
const draftInput = z.object({
  studentId: z.string().cuid(),
  period: reportPeriodInputSchema,
  sections: reportSectionsSchema,
});
```

Delete the router-local `termSchema` and `termRange`. Resolve once with `resolveReportPeriod(input.period)`. Add `yearGroup` to `loadActiveStudent`. Query with `queryFrom`/`queryToExclusive`, and short-circuit each source query when neither owning section is selected.

For each subject, set:

```ts
status: paceProgressStatusForYear(assignment.currentPaceNumber, student.yearGroup),
```

Select source record ids and set text-entry origin to `Source`. Never decrypt note text when its section is false. Pass `period.snapshot` and `input.sections` to `compileStudentReport`.

- [ ] **Step 4: Persist and map general period metadata**

Find an existing row through the mapped compound key `studentId_periodKey`. Create/update `periodType`, `periodLabel`, `periodStart`, and `periodEnd` from the resolved snapshot. Replace term-specific mapper output with:

```ts
period: {
  type: row.periodType,
  key: row.periodKey,
  label: row.periodLabel,
  from: dateKey(row.periodStart),
  to: dateKey(row.periodEnd),
},
```

Order history by `periodEnd desc, createdAt desc`. Update notification/path helpers to accept `periodLabel` while retaining their existing behavior until PDF integration.

- [ ] **Step 5: Add legacy encrypted snapshot normalisation**

Keep the stored schema tolerant of legacy `term`, missing `period`, missing `sections`, missing entry ids/origins, and missing PACE status. After validation, normalise to the strict `CompiledReport`:

- Period falls back to row metadata.
- Sections fall back to `DEFAULT_REPORT_SECTIONS`.
- Legacy source ids use deterministic `legacy:<kind>:<index>:<createdAt>` values.
- Legacy origins are `Source`.
- Legacy status is `{ status: 'Unavailable', tone: 'grey', testingLevel: null, testingLevelLabel: null, detail: 'Status unavailable' }`.

Do not decrypt and rewrite historical snapshots.

- [ ] **Step 6: Run API tests, typecheck, and lint**

Run:

```bash
pnpm --filter @oasis/api test -- report.router.test.ts
pnpm --filter @oasis/api typecheck
pnpm --filter @oasis/api lint
```

Expected: PASS, including existing permission and notification tests after fixture updates.

- [ ] **Step 7: Commit period-aware compilation**

```bash
git add apps/api/src/routers/report.ts apps/api/src/__tests__/report.router.test.ts
git commit -m "feat: compile configurable student report snapshots"
```

---

### Task 4: Persist report-specific notes and Progress Comment safely

**Files:**

- Modify: `apps/api/src/routers/report.ts:61-146,679-710`
- Modify: `apps/api/src/__tests__/report.router.test.ts:599-760`

**Interfaces:**

- Consumes: Task 1 `ReportTextEntrySnapshot` and Task 3 normalised snapshot.
- Produces: `report.review({ reportId, progressComment, behaviourNotes, generalNotes })`.
- Produces: draft refresh that preserves report-origin entries and existing `headSummary` while replacing source-origin entries.

- [ ] **Step 1: Write failing review and refresh tests**

```ts
it('adds, edits, and removes only report-specific notes', async () => {
  const { caller } = makeCaller(headUser);
  const draft = await caller.report.draft(defaultDraftInput());
  const manualId = '3caaf78c-c3be-4eb6-948b-0c93799c8d22';

  const reviewed = await caller.report.review({
    reportId: draft.id,
    progressComment: 'Jane is making steady progress.',
    behaviourNotes: [{ id: manualId, category: 'Character', note: 'Shows initiative.' }],
    generalNotes: [],
  });

  expect(reviewed.compiled.headSummary).toBe('Jane is making steady progress.');
  expect(reviewed.compiled.behaviour.generalEntries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: manualId, origin: 'Report', note: 'Shows initiative.' }),
      expect.objectContaining({ origin: 'Source', note: 'Served others well' }),
    ]),
  );

  const edited = await caller.report.review({
    reportId: draft.id,
    progressComment: 'Jane is making steady progress.',
    behaviourNotes: [{ id: manualId, category: 'Character', note: 'Shows consistent initiative.' }],
    generalNotes: [],
  });
  expect(edited.compiled.behaviour.generalEntries).toEqual(
    expect.arrayContaining([expect.objectContaining({ note: 'Shows consistent initiative.' })]),
  );
});

it('preserves report additions and progress comment when a draft is refreshed', async () => {
  const db = makeFakeDb();
  const { caller } = makeCaller(headUser, db);
  const draft = await caller.report.draft(defaultDraftInput());
  const manualId = '3caaf78c-c3be-4eb6-948b-0c93799c8d22';
  await caller.report.review({
    reportId: draft.id,
    progressComment: 'Keep this progress comment.',
    behaviourNotes: [{ id: manualId, category: 'Character', note: 'Keep this note.' }],
    generalNotes: [],
  });
  db.behaviourEntries.push({
    studentId,
    type: 'General',
    category: 'Service',
    noteEnc: encrypt('New source note'),
    visibility: 'General',
    meritDelta: 0,
    deletedAt: null,
    createdAt: day('2026-05-18'),
  });

  const refreshed = await caller.report.draft(defaultDraftInput());

  expect(refreshed.status).toBe('Draft');
  expect(refreshed.compiled.headSummary).toBe('Keep this progress comment.');
  expect(refreshed.compiled.behaviour.generalEntries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: manualId, origin: 'Report', note: 'Keep this note.' }),
      expect.objectContaining({ origin: 'Source', note: 'New source note' }),
    ]),
  );
});
```

Define `defaultDraftInput()` once in the test setup as `{ studentId, period: { type: 'Term', term: '2026-Summer' }, sections: DEFAULT_REPORT_SECTIONS }` and reuse it throughout the updated router tests.

Also test duplicate ids, blank/over-5,000-character text, and sent-report immutability.

- [ ] **Step 2: Run the router tests and verify review-input failures**

Run: `pnpm --filter @oasis/api test -- report.router.test.ts`

Expected: FAIL because review accepts only `headSummary` and cannot persist manual entries.

- [ ] **Step 3: Implement explicit editable-note schemas**

```ts
const reportEditableTextSchema = z.string().trim().min(1).max(5000);
const reportSpecificNoteSchema = z.object({
  id: z.string().uuid(),
  category: z.string().trim().min(1).max(120).optional(),
  note: reportEditableTextSchema,
});

const reviewInput = z.object({
  reportId: z.string().cuid(),
  progressComment: z.string().trim().max(5000),
  behaviourNotes: z.array(reportSpecificNoteSchema).max(50),
  generalNotes: z.array(reportSpecificNoteSchema.omit({ category: true })).max(50),
});
```

Add a `superRefine` or named `assertUniqueNoteIds` path-specific validation for duplicate ids within each array.

- [ ] **Step 4: Merge source and report entries without accepting source edits**

On review, retain every existing `origin === 'Source'` entry exactly and replace only `origin === 'Report'` entries with validated input:

```ts
function reportEntries(
  existing: readonly ReportTextEntrySnapshot[],
  input: readonly ReportSpecificNoteInput[],
  now: Date,
): ReportTextEntrySnapshot[] {
  const existingCreatedAt = new Map(
    existing.filter((entry) => entry.origin === 'Report').map((entry) => [entry.id, entry.createdAt]),
  );
  return [
    ...existing.filter((entry) => entry.origin === 'Source'),
    ...input.map((entry) => ({
      ...entry,
      origin: 'Report' as const,
      createdAt: existingCreatedAt.get(entry.id) ?? now.toISOString(),
    })),
  ];
}
```

Set `headSummary` from `progressComment`, update `compiledAt`, encrypt, and move to `UnderReview`. On draft refresh, carry forward `headSummary` and only report-origin entries from the existing unsent snapshot.

- [ ] **Step 5: Run API tests and checks**

Run:

```bash
pnpm --filter @oasis/api test -- report.router.test.ts
pnpm --filter @oasis/api typecheck
pnpm --filter @oasis/api lint
```

Expected: PASS with source-note immutability, manual-note lifecycle, refresh preservation, and sent guards covered.

- [ ] **Step 6: Commit editable report content**

```bash
git add apps/api/src/routers/report.ts apps/api/src/__tests__/report.router.test.ts
git commit -m "feat: edit report-specific student notes"
```

---

### Task 5: Generate professional multi-page student report PDFs

**Files:**

- Create: `apps/api/src/reports/student-report-pdf.ts`
- Create: `apps/api/src/__tests__/student-report-pdf.test.ts`

**Interfaces:**

- Consumes: Task 1 strict `CompiledReport`.
- Produces: `generateStudentReportPdf(input): Promise<GeneratedStudentReportPdf>`.
- Produces:

```ts
export interface GenerateStudentReportPdfInput {
  report: CompiledReport;
  generatedAt: Date;
}

export interface GeneratedStudentReportPdf {
  bytes: Uint8Array;
  fileName: string;
  mimeType: 'application/pdf';
}
```

- [ ] **Step 1: Write failing content, visibility, formatting, and pagination tests**

Use `pdfjs-dist/legacy/build/pdf.mjs` to extract text and `PDFDocument.load` to count pages. Build one full snapshot fixture with long notes and another with sections hidden.

```ts
it('renders selected sections, statuses, progress comment, and ungrouped PACE ids', async () => {
  const generated = await generateStudentReportPdf({ report: fullReport(), generatedAt: now });
  const text = await extractPdfText(generated.bytes);

  expect(Buffer.from(generated.bytes).subarray(0, 5).toString('utf8')).toBe('%PDF-');
  expect(generated.fileName).toBe('Jane-Learner-2025-26-Academic-Year-report.pdf');
  expect(text).toContain('Student Progress Report');
  expect(text).toContain('PACE Progress');
  expect(text).toContain('1025');
  expect(text).not.toContain('1,025');
  expect(text).toContain('On Track');
  expect(text).toContain('Progress Comment');
  expect(text).toContain('Jane is making steady progress.');
});

it('omits hidden sections and creates numbered continuation pages', async () => {
  const generated = await generateStudentReportPdf({ report: longReport(), generatedAt: now });
  const pdf = await PDFDocument.load(generated.bytes);
  const text = await extractPdfText(generated.bytes);

  expect(pdf.getPageCount()).toBeGreaterThan(1);
  expect(text).not.toContain('Behaviour Notes');
  expect(text).toContain(`Page 1 of ${String(pdf.getPageCount())}`);
  expect(text).toContain(`Page ${String(pdf.getPageCount())} of ${String(pdf.getPageCount())}`);
});
```

Define the referenced fixtures in the same test file with these concrete values:

```ts
const now = new Date('2026-08-17T12:00:00.000Z');

function fullReport(): CompiledReport {
  return compileStudentReport({
    studentId: 'student_1',
    studentDisplayName: 'Jane Learner',
    period: resolveReportPeriod({ type: 'AcademicYear', startYear: 2025 }).snapshot,
    sections: DEFAULT_REPORT_SECTIONS,
    attendance: { total: 100, present: 94, absent: 4, late: 2 },
    paces: [
      {
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        currentPace: 1025,
        pacesCompletedThisTerm: 8,
        averageTestScore: 91,
        status: paceProgressStatusForYear(1025, 'Year 3'),
      },
    ],
    behaviour: {
      meritsEarned: 35,
      demeritsCount: 1,
      demeritsMerits: 5,
      generalEntries: [
        {
          id: 'behaviour_1',
          origin: 'Source',
          createdAt: new Date('2026-06-01T12:00:00.000Z'),
          category: 'Character',
          note: 'Shows initiative and helps other learners.',
        },
      ],
    },
    notes: [
      {
        id: 'note_1',
        origin: 'Source',
        createdAt: new Date('2026-06-02T12:00:00.000Z'),
        note: 'Reading confidence has improved.',
      },
    ],
    ledgerRows: [
      {
        account: 'Spend',
        delta: 35,
        reason: 'Merit: Academic Excellence',
        createdAt: new Date('2026-06-03T12:00:00.000Z'),
      },
    ],
    headSummary: 'Jane is making steady progress.',
  });
}

function longReport(): CompiledReport {
  const report = fullReport();
  return {
    ...report,
    sections: { ...report.sections, behaviourNotes: false },
    behaviour: { ...report.behaviour, generalEntries: [] },
    notes: Array.from({ length: 60 }, (_, index) => ({
      id: `long_note_${String(index)}`,
      origin: 'Report' as const,
      createdAt: new Date(Date.UTC(2026, 5, (index % 28) + 1)).toISOString(),
      note: `Progress note ${String(index + 1)} with enough detail to verify wrapped multi-page layout.`,
    })),
  };
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  ensurePdfDomFallbacks();
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  const pdf = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages.join('\n');
  } finally {
    await pdf.destroy();
  }
}
```

Define `PdfJsModule`/proxy interfaces and the `DOMMatrix`, `ImageData`, and `Path2D` test fallbacks with the exact minimal method set already proven in `incident.router.test.ts`; keep those definitions test-only.

Support `REPORT_PDF_SAMPLE_PATH` in the test only: when set, write the generated long PDF to that explicit path for visual QA; ordinary test runs remain side-effect free.

- [ ] **Step 2: Run the PDF tests and verify the missing-module failure**

Run: `pnpm --filter @oasis/api test -- student-report-pdf.test.ts`

Expected: FAIL because the generator module does not exist.

- [ ] **Step 3: Implement branded PDF primitives**

Use A4 constants, 42-point margins, Helvetica/HelveticaBold, the invoice generator's logo candidate paths, and these focused helpers:

- `createPage(document, fonts, logo, input, continuation): PDFPage`
- `ensureSpace(context, requiredHeight): void`
- `drawSectionHeading(context, title): void`
- `drawWrappedText(context, text, options): void`
- `drawMetricCards(context, report): void`
- `drawPaceTable(context, report): void`
- `drawTextEntries(context, title, entries): void`
- `drawMeritActivity(context, report): void`
- `drawBalances(context, report): void`
- `drawProgressComment(context, report): void`
- `drawAllFooters(document, fonts): void`
- `wrapText(value, font, size, maxWidth): string[]`
- `safeFileName(value): string`

Use navy `rgb(0.106, 0.169, 0.369)`, crimson `rgb(0.49, 0.11, 0.173)`, existing pale-blue/border tones, and measured cursor movement. Reserve heading plus at least one content row before drawing a section. Split long text line-by-line across pages. Draw page numbers only after all content pages exist.

- [ ] **Step 4: Render only selected sections**

Condition every section on `report.sections`. The PACE table columns are Subject, Current PACE, Completed, Average Score, plus Status only when `paceStatus` is true. Render current PACE as `String(pace.currentPace)`. Show empty-state prose only for selected empty sections.

Metric cards must be individually conditional: Attendance, Behaviour Summary, and Balances cannot leak hidden values. Notes render their date/category/body without exposing the internal origin marker.

- [ ] **Step 5: Run PDF tests, API typecheck, and lint**

Run:

```bash
pnpm --filter @oasis/api test -- student-report-pdf.test.ts
pnpm --filter @oasis/api typecheck
pnpm --filter @oasis/api lint
```

Expected: PASS with `%PDF-`, extracted content/omission, ungrouped PACE, and multi-page footer assertions.

- [ ] **Step 6: Commit the PDF generator**

```bash
git add apps/api/src/reports/student-report-pdf.ts apps/api/src/__tests__/student-report-pdf.test.ts
git commit -m "feat: generate branded student report PDFs"
```

---

### Task 6: Freeze final PDFs on send and expose authorised downloads

**Files:**

- Modify: `apps/api/src/routers/report.ts:26-28,463-773`
- Modify: `apps/api/src/__tests__/report.router.test.ts:514-760`
- Create: `apps/web/src/app/api/reports/[reportId]/pdf/route.ts`

**Interfaces:**

- Consumes: Task 5 `generateStudentReportPdf`.
- Extends: `ReportRouterDeps` with injectable `pdfGenerator` for deterministic failure tests.
- Produces: `report.downloadPdf({ reportId }) -> { fileName, mimeType, pdfBase64 }`.
- Produces: `GET /api/reports/:reportId/pdf` with private no-store attachment response.

- [ ] **Step 1: Write failing send/download tests**

Add tests that prove:

```ts
it('stores the final encrypted PDF before marking a report sent', async () => {
  const pdfGenerator = vi.fn().mockResolvedValue({
    bytes: new Uint8Array(Buffer.from('%PDF-1.7\nfinal')),
    fileName: 'Jane-Learner-Summer-2026-report.pdf',
    mimeType: 'application/pdf' as const,
  });
  const { caller, db } = makeCaller(headUser, makeFakeDb(), { pdfGenerator });
  const draft = await caller.report.draft(defaultDraftInput());
  await caller.report.review(defaultReviewInput(draft.id));

  const sent = await caller.report.send({ reportId: draft.id });
  expect(sent.status).toBe('Sent');
  expect(decrypt(db.reports[0]?.pdfBytesEnc)).toBe(
    Buffer.from('%PDF-1.7\nfinal').toString('base64'),
  );
  expect(db.reports[0]?.pdfGeneratedAt).toBeInstanceOf(Date);
});

it('leaves the report unsent and does not notify when PDF generation fails', async () => {
  const email = makeFakeEmailClient();
  const pdfGenerator = vi.fn().mockRejectedValue(new Error('render failed'));
  const { caller, db } = makeCaller(headUser, makeFakeDb(), {
    emailClient: email.client,
    pdfGenerator,
  });
  const draft = await caller.report.draft(defaultDraftInput());

  await expect(caller.report.send({ reportId: draft.id })).rejects.toMatchObject({
    code: 'INTERNAL_SERVER_ERROR',
  });
  expect(db.reports[0]?.status).toBe('Draft');
  expect(email.send).not.toHaveBeenCalled();
});
```

Define `defaultReviewInput(reportId)` once in the test setup as `{ reportId, progressComment: '', behaviourNotes: [], generalNotes: [] }`. Change `makeCaller` to accept one dependency object (`ReportRouterDeps`) instead of a positional email client so every test uses the same constructor shape.

Also cover administrator draft download, linked-parent sent download, unlinked-parent rejection, parent draft rejection, stored sent bytes returned unchanged, and legacy `pdfGeneratedAt === null` fallback generation from frozen snapshot.

- [ ] **Step 2: Run router tests and verify missing PDF behavior**

Run: `pnpm --filter @oasis/api test -- report.router.test.ts`

Expected: FAIL because send does not generate/store a PDF and `downloadPdf` does not exist.

- [ ] **Step 3: Inject the PDF generator and make send atomic from the user's perspective**

Extend dependencies:

```ts
export interface ReportRouterDeps {
  emailClient?: EmailClient;
  pdfGenerator?: typeof generateStudentReportPdf;
}
```

In `send`, load/decrypt/validate the snapshot, generate bytes, convert to base64, encrypt bytes and filename, then perform the single report update that sets `status`, `sentAt`, `pdfBytesEnc`, `pdfFileNameEnc`, and `pdfGeneratedAt`. If generation/encryption throws, log a safe operational event and return `INTERNAL_SERVER_ERROR` without updating or notifying.

- [ ] **Step 4: Implement authorised PDF download**

Use `authedProcedure` and existing `assertCanReadReports`. Full admins may read any status; guardians require linked access and `Sent`. For sent rows with stored bytes, decrypt and return them. If `pdfGeneratedAt` is non-null but either encrypted field is missing, return an integrity error. If `pdfGeneratedAt` is null, generate from the frozen snapshot for legacy compatibility.

Audit PDF downloads with ids/status/period metadata only; never log bytes, filenames, student names, notes, or comments.

- [ ] **Step 5: Add the Next.js download route**

Follow the existing invoice route exactly:

```ts
import { Buffer } from 'node:buffer';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

interface ReportPdfRouteContext {
  params: Promise<{ reportId: string }>;
}

export async function GET(req: Request, context: ReportPdfRouteContext): Promise<Response> {
  try {
    const { reportId } = await context.params;
    const caller = await createCallerForRequest(req);
    const result = await caller.report.downloadPdf({ reportId });
    const bytes = Buffer.from(result.pdfBase64, 'base64');
    const safeName = result.fileName.replace(/["\r\n]/gu, '').trim() || 'student-report.pdf';
    return new Response(bytes, {
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
```

- [ ] **Step 6: Run API tests and web/API checks**

Run:

```bash
pnpm --filter @oasis/api test -- report.router.test.ts student-report-pdf.test.ts
pnpm --filter @oasis/api typecheck
pnpm --filter @oasis/api lint
pnpm --filter @oasis/web typecheck
pnpm --filter @oasis/web lint
```

Expected: PASS.

- [ ] **Step 7: Commit final PDF persistence and download**

```bash
git add apps/api/src/routers/report.ts apps/api/src/__tests__/report.router.test.ts apps/web/src/app/api/reports/[reportId]/pdf/route.ts
git commit -m "feat: freeze and download student report PDFs"
```

---

### Task 7: Build accessible period and section draft controls

**Files:**

- Create: `apps/web/src/components/reports/report-period-controls.tsx`
- Create: `apps/web/src/components/reports/report-section-picker.tsx`
- Modify: `apps/web/src/components/reports/report-workflow-client.tsx:1-331`
- Modify: `apps/web/src/components/reports/report-format.ts:1-53`
- Modify: `apps/web/src/components/reports/report-student-selector.tsx:21-92`
- Modify: `apps/web/src/components/reports/report-history-list.tsx:18-50`

**Interfaces:**

- Consumes: tRPC-generated `RouterInputs['report']['draft']` and Task 3 period-aware outputs.
- Produces: focused controlled components with typed `value` and `onChange` props.
- Consumes: Task 1 `formatPaceIdentifier(value)` and `reportAcademicYearOptions(referenceDate)`.
- Produces: period labels directly from persisted `report.period.label`.

- [ ] **Step 1: Verify the domain display contracts before production JSX**

Run the Task 1 display-helper test before changing the web components:

```bash
pnpm --filter @oasis/domain test -- reportPeriod.test.ts
```

Expected: PASS and specifically prove `formatPaceIdentifier(1025) === '1025'` plus current/previous/next academic-year options. The web package has no unit-test script, so do not add a second test runner; API/domain behavior is test-first and the rendered control flow is covered by the existing Playwright suite in Task 9.

- [ ] **Step 2: Implement controlled period controls**

`ReportPeriodControls` renders a `fieldset` with Report Type select and:

- Academic Year select using `2025/26` labels.
- Term year select plus Autumn/Spring/Summer select, producing the canonical term id.
- Two `type="date"` inputs for inclusive custom From/To.

Props:

```ts
interface ReportPeriodControlsProps {
  disabled: boolean;
  error?: string;
  onChange: (period: RouterInputs['report']['draft']['period']) => void;
  value: RouterInputs['report']['draft']['period'];
}
```

Use existing `Field`, `SelectInput`, and `TextInput`, and consume `reportAcademicYearOptions`. Show the resolved label/date range as help text; do not hard-code 2026 options.

- [ ] **Step 3: Implement section picker with dependency semantics**

Props:

```ts
interface ReportSectionPickerProps {
  disabled: boolean;
  onChange: (sections: RouterInputs['report']['draft']['sections']) => void;
  value: RouterInputs['report']['draft']['sections'];
}
```

Render one labelled checkbox per approved section. When `paceProgress` becomes false, update both `paceProgress: false` and `paceStatus: false`. Disable PACE Status while PACE Progress is false and show visible help text. Compute and display selected count. Use `fieldset`/`legend`, not an `aria-label` on an unlabelled `div`.

- [ ] **Step 4: Replace hard-coded term state in the workflow**

Store typed `period` and `sections` state, initialised to current academic year and `DEFAULT_REPORT_SECTIONS`. Pass both to `draftReport.mutateAsync`. When selecting a history row, read its stored period/sections instead of matching by term. Change page copy from `Term Reports` to `Student Reports` and draft help text to describe the chosen period.

Keep state orchestration in `report-workflow-client.tsx`; move all field markup into the two new components. Do not add manual-note state in this task.

- [ ] **Step 5: Update period labels in student/history components**

Replace `formatTerm(report.term)` with `report.period.label`. Update latest-report selection to match `period.key`. The parent page must continue to select the most recent sent report when no id is supplied.

- [ ] **Step 6: Run relevant tests, web typecheck, and lint**

Run:

```bash
pnpm --filter @oasis/web typecheck
pnpm --filter @oasis/web lint
```

Also rerun the Task 1 display-helper test. Expected: PASS with no unused imports or unsafe casts.

- [ ] **Step 7: Commit draft controls**

```bash
git add apps/web/src/components/reports/report-period-controls.tsx apps/web/src/components/reports/report-section-picker.tsx apps/web/src/components/reports/report-workflow-client.tsx apps/web/src/components/reports/report-format.ts apps/web/src/components/reports/report-student-selector.tsx apps/web/src/components/reports/report-history-list.tsx
git commit -m "feat: configure student report periods and sections"
```

---

### Task 8: Add report-note editing, conditional detail, PACE status, and PDF actions

**Files:**

- Create: `apps/web/src/components/reports/report-note-editor.tsx`
- Create: `apps/web/src/components/reports/report-actions.tsx`
- Modify: `apps/web/src/components/reports/report-workflow-client.tsx:61-331`
- Modify: `apps/web/src/components/reports/report-detail.tsx:1-277`
- Modify: `apps/web/src/app/(admin)/admin/admin.css:6507-6766,12580-12765`

**Interfaces:**

- Consumes: Task 4 review input and Task 6 `/api/reports/:id/pdf`.
- Produces: `ReportSpecificNoteDraft { id, category?, note }` UI state.
- Produces: `ReportNoteEditor` that renders source entries read-only and report entries editable.
- Produces: `ReportActions` for Save and Review, Download PDF, and Send.

- [ ] **Step 1: Define editor-state adapters before JSX changes**

Add focused functions beside the workflow or in `report-editor-state.ts` if they exceed 40 lines:

```ts
interface ReportSpecificNoteDraft {
  id: string;
  category?: string;
  note: string;
}

function reportSpecificNotes(
  entries: readonly ReportTextEntry[],
): ReportSpecificNoteDraft[] {
  return entries
    .filter((entry) => entry.origin === 'Report')
    .map(({ id, category, note }) => ({
      id,
      ...(category ? { category } : {}),
      note: note ?? '',
    }));
}
```

Define `type ReportTextEntry = TermReport['compiled']['notes'][number]` beside the adapter. Keep this deterministic mapping in `report-workflow-client.tsx`; its allowed shapes and persistence behavior are already driven by the failing API tests in Task 4, and the rendered editing flow is covered by Task 9 Playwright verification.

- [ ] **Step 2: Implement `ReportNoteEditor`**

Props:

```ts
interface ReportNoteEditorProps {
  allowCategory: boolean;
  disabled: boolean;
  emptyLabel: string;
  label: string;
  onChange: (entries: ReportSpecificNoteDraft[]) => void;
  reportEntries: readonly ReportSpecificNoteDraft[];
  sourceEntries: TermReport['compiled']['notes'];
}
```

Render source entries with date/category/body and no form controls. Render each report entry with labelled textarea, optional category input, and Remove button. Add creates `{ id: crypto.randomUUID(), note: '' }`. Enforce 5,000-character UI limits, prevent saving blank entries, and use stable ids for keys/labels.

- [ ] **Step 3: Implement conditional `ReportDetail` rendering**

Split focused section components inside the file or separate files if `report-detail.tsx` would exceed roughly 350 readable lines. Every section and summary metric is conditional on `compiled.sections`. Hidden sections render nothing. Selected empty sections render the existing empty-state treatment.

PACE rows render:

```tsx
<strong>{formatPaceIdentifier(pace.currentPace)}</strong>
{compiled.sections.paceStatus ? (
  <Badge tone={statusTone(pace.status.tone)}>{pace.status.status}</Badge>
) : null}
```

Rename all user-facing Head Summary copy/labels to Progress Comment while retaining `headSummary` only in typed data adapters.

- [ ] **Step 4: Wire editor state and dirty-state protection**

The workflow owns `progressComment`, `behaviourNotes`, `generalNotes`, and `editorDirty`. Reset them only when the selected report id changes or a review succeeds. Pass the exact arrays to `report.review`.

Disable PDF download while unsaved edits exist and show `Save and review changes before downloading the PDF.` Do not silently discard edits when changing student/report; use `window.confirm` only for this local unsaved-navigation guard, not for send.

- [ ] **Step 5: Implement report actions**

`ReportActions` renders:

- `Save and Review` for unsent editable reports.
- An anchor with `href={/api/reports/${report.id}/pdf}` and `download` semantics for saved reports.
- `Send` for unsent reports.
- `Sent` disabled state for sent reports.

Buttons retain pending/disabled state and existing toast handling. Parent mode renders only Download PDF for sent reports.

- [ ] **Step 6: Add focused responsive/accessibility styles**

Extend existing report CSS with:

- `.report-period-grid`
- `.report-section-picker` and checkbox card states
- `.report-note-editor` and editable/source row distinctions
- `.report-pace-status`
- `.report-unsaved-note`
- responsive collapse at existing report breakpoints

Use existing CSS variables and focus-visible patterns. Do not introduce inline colour values where an Oasis token already exists. Verify checkbox labels and action targets remain usable at 320px width.

- [ ] **Step 7: Run web typecheck, lint, and build**

Run:

```bash
pnpm --filter @oasis/web typecheck
pnpm --filter @oasis/web lint
pnpm --filter @oasis/web build
```

Expected: PASS. Inspect both changed TSX files after build for unused imports, invalid props, and inaccessible unlabelled controls.

- [ ] **Step 8: Commit report editing and display**

```bash
git add apps/web/src/components/reports/report-note-editor.tsx apps/web/src/components/reports/report-actions.tsx apps/web/src/components/reports/report-workflow-client.tsx apps/web/src/components/reports/report-detail.tsx apps/web/src/app/(admin)/admin/admin.css
git commit -m "feat: review and download configurable student reports"
```

---

### Task 9: End-to-end coverage, PDF visual QA, and full verification

**Files:**

- Modify: `apps/web/tests/e2e/phase-4-verification.spec.ts:17-85`
- Modify: `docs/architecture/component-relationships.md`

**Interfaces:**

- Consumes every prior task's public behavior.
- Produces regression evidence for the complete approved acceptance criteria.

- [ ] **Step 1: Update the gated Playwright report flow before final verification**

Change report headings to `Student Reports`. In the mutating Head test:

1. Select Custom Date Range.
2. Fill valid From/To dates.
3. Clear Behaviour Notes and assert PACE Status becomes disabled when PACE Progress is cleared, then re-enable PACE Progress/Status.
4. Generate the draft.
5. Add one report-specific General Note and a Progress Comment.
6. Save and Review.
7. Assert the PDF link targets `/api/reports/<id>/pdf`.
8. Send only when `E2E_ALLOW_REPORT_SEND=1`.

In the parent test, assert no editor controls exist and a selected sent report exposes Download PDF.

- [ ] **Step 2: Run focused and complete automated verification**

Run in this order:

```bash
pnpm --filter @oasis/domain test -- reportPeriod.test.ts report.test.ts subjects.test.ts
pnpm --filter @oasis/db test -- report-periods-migration.test.ts
pnpm --filter @oasis/api test -- report.router.test.ts student-report-pdf.test.ts
pnpm --filter @oasis/domain typecheck
pnpm --filter @oasis/db typecheck
pnpm --filter @oasis/api typecheck
pnpm --filter @oasis/web typecheck
pnpm --filter @oasis/domain lint
pnpm --filter @oasis/db lint
pnpm --filter @oasis/api lint
pnpm --filter @oasis/web lint
pnpm --filter @oasis/web build
pnpm --filter @oasis/db exec prisma validate
pnpm --filter @oasis/db generate
```

After the focused checks pass, run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Record pre-existing warnings separately; do not hide new warnings.

- [ ] **Step 3: Run credentials-gated browser verification when configured**

Run: `pnpm --filter @oasis/web test:e2e -- phase-4-verification.spec.ts`

Expected: configured Head/Parent tests pass; missing-credential tests report skipped with their existing explicit reasons. Do not claim skipped flows were run.

- [ ] **Step 4: Generate and render representative PDFs**

```bash
mkdir -p output/pdf tmp/pdfs
REPORT_PDF_SAMPLE_PATH=output/pdf/oasis-student-report-sample.pdf pnpm --filter @oasis/api test -- student-report-pdf.test.ts
pdftoppm -png output/pdf/oasis-student-report-sample.pdf tmp/pdfs/oasis-student-report
```

Inspect every PNG page for logo quality, top rule, hierarchy, wrapping, table alignment, status column, `1025`, margins, continuation headers, Progress Comment, confidentiality footer, page numbering, and absence of clipping/overlap. If `pdftoppm` is unavailable, install Poppler only with user approval or report the exact missing dependency; do not substitute text extraction for visual QA.

After recording the inspection result, remove only the generated `output/pdf/oasis-student-report-sample.pdf` and `tmp/pdfs/oasis-student-report-*.png` QA artifacts. Confirm `git status --short` contains no generated PDF/PNG files.

- [ ] **Step 5: Regenerate and verify component ownership**

Run: `pnpm docs:component-map`

Inspect the diff and verify the new report components have ownership edges. If the generator produces no diff, confirm the existing map intentionally excludes this component family and leave the file unchanged; discard no unrelated user changes.

- [ ] **Step 6: Perform the completion audit against every acceptance criterion**

Create a checklist from the approved spec and point each item to direct evidence:

- Domain/API tests for all period types and inclusive ranges.
- Snapshot/API tests for selected/hidden sections.
- UI/PDF evidence for PACE `1025` and status visibility.
- Router/UI evidence for report-specific Behaviour/General Notes and Progress Comment.
- PDF extraction/render evidence for professional output.
- Send failure/success tests for immutable encrypted final PDF.
- RBAC/guardian tests for view/download boundaries.
- Typecheck/lint/build/migration outputs.

Treat any missing or indirect evidence as incomplete and continue until it is direct.

- [ ] **Step 7: Self-review the complete diff**

Run:

```bash
git status --short
git diff --check 41465b8..HEAD
git diff --stat 41465b8..HEAD
```

Re-open every changed production/test file. Check strict types, imports, paths, no debug output/TODOs, encryption and tenant/guardian boundaries, mobile layout, PDF page breaks, and that every changed line traces to the approved scope.

- [ ] **Step 8: Commit verification/E2E updates**

```bash
git add apps/web/tests/e2e/phase-4-verification.spec.ts
git commit -m "test: verify flexible student report workflow"
```

If Step 5 changed `docs/architecture/component-relationships.md`, stage it with a separate `git add docs/architecture/component-relationships.md` before committing. Do not commit `output/pdf` or `tmp/pdfs`; they are verification artifacts.

---

## Completion Definition

Implementation is complete only when every approved acceptance criterion has direct test/runtime/render evidence, all relevant available checks pass, every generated PDF page has been visually inspected without defects, the worktree contains no accidental files, and the final diff has passed senior-engineer self-review.
