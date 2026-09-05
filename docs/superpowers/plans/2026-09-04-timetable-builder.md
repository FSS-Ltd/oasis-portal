# Timetable Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a termly, child-specific timetable builder for Heads, with shared age-group times, immutable publication, Head task progress, printable PDFs, and read-only parent/student views on web and mobile.

**Architecture:** Add timetable domain primitives, a normalised Prisma model, and one role-aware tRPC router. Resolve numbered teaching terms from the existing `CalendarEvent` boundary rows, snapshot schedule and subject display data on publication, and drive every UI from the same typed API. Keep platform components focused: desktop grid editing on web, day-at-a-time cards on mobile, and a shared server-side PDF generator.

**Tech Stack:** TypeScript, Zod, Prisma/PostgreSQL RLS, tRPC, Next.js 15, React 18, Expo 52/React Native, `pdf-lib`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-timetable-builder-design.md`

## Global Constraints

- Only active users whose role is exactly `Head` may manage timetable data.
- Teaching days are always Tuesday through Friday.
- Term boundaries come from active `CalendarEvent` rows named `calendar-YYYY-YY-term-N-start|end`; do not duplicate editable dates.
- Empty lesson cells produce a publish suggestion, never a validation error.
- Parent and student APIs return only the latest immutable publication in their permitted scope.
- Use existing components and brand tokens; keep colour meaning redundant with visible subject text.
- Preserve strict TypeScript and avoid `any`, suppression comments, and unrelated refactors.
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before every commit; run web and mobile production builds before final completion.

---

### Task 1: Timetable domain contracts

**Files:**

- Create: `packages/domain/src/timetable.ts`
- Create: `packages/domain/src/__tests__/timetable.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**

- Produces `TIMETABLE_DAYS`, `REGISTRATION_LEVELS`, `DEFAULT_TIMETABLE_SLOTS`, `timetableScheduleInputSchema`, `timetableColourForSubject`, `findScheduleIssues`, `countTimetableProgress`, and `firstNameFromFullName`.
- Slot times are integer minutes after midnight; slot kinds are `Lesson | Break`; semantic colours are `Yellow | Red | PaleRed | Purple | DarkBlue | LightBlue | Green | Brown | Grey`.

- [x] **Step 1: Write failing domain tests**

```ts
expect(TIMETABLE_DAYS).toEqual(['Tuesday', 'Wednesday', 'Thursday', 'Friday']);
expect(
  DEFAULT_TIMETABLE_SLOTS.map(({ kind, startMinutes, endMinutes }) => [
    kind,
    startMinutes,
    endMinutes,
  ]),
).toEqual([
  ['Lesson', 540, 570],
  ['Lesson', 570, 600],
  ['Break', 600, 630],
  ['Lesson', 630, 650],
  ['Lesson', 650, 690],
  ['Break', 690, 700],
  ['Lesson', 700, 750],
]);
expect(timetableColourForSubject({ code: 'MATH', name: 'Mathematics' })).toBe('Yellow');
expect(findScheduleIssues(overlappingSlots)).toEqual([
  { position: 1, message: 'Starts before the previous slot ends' },
]);
expect(countTimetableProgress(['student-1', 'student-2'], ['student-2'])).toEqual({
  done: 1,
  total: 2,
});
```

- [x] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @oasis/domain test -- src/__tests__/timetable.test.ts`

Expected: FAIL because `../timetable.js` does not exist.

- [x] **Step 3: Implement the contracts and validation**

```ts
export const TIMETABLE_DAYS = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export const REGISTRATION_LEVELS = ['ABC', 'Primary', 'Secondary'] as const;

export function timetableColourForSubject(subject: {
  code: string;
  name: string;
}): TimetableColour {
  const key = `${subject.code} ${subject.name}`.toLowerCase();
  if (/\b(math|maths|mathematics)\b/.test(key)) return 'Yellow';
  if (/\benglish\b/.test(key)) return 'Red';
  if (/\bliterature\b/.test(key)) return 'PaleRed';
  if (/word\s*building|\bwb\b/.test(key)) return 'Purple';
  if (/animal\s*science/.test(key)) return 'LightBlue';
  if (/\bscience\b|\bsci\b/.test(key)) return 'DarkBlue';
  if (/social\s*studies|\bsoc\b/.test(key)) return 'Green';
  if (/bible\s*studies/.test(key)) return 'Brown';
  return 'Grey';
}
```

- [x] **Step 4: Re-run the domain test and package checks**

Run: `pnpm --filter @oasis/domain test -- src/__tests__/timetable.test.ts && pnpm --filter @oasis/domain typecheck`

Expected: PASS.

---

### Task 2: Normalised timetable persistence and RLS

**Files:**

- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260904120000_timetable_builder/migration.sql`
- Modify: `packages/db/prisma/rls.sql`
- Create: `packages/db/src/__tests__/timetable-builder-migration.test.ts`

**Interfaces:**

- Produces Prisma models `TimetableAgeGroupSchedule`, `TimetableScheduleSlot`, `StudentTimetable`, `StudentTimetableEntry`, `StudentTimetablePublication`, and `StudentTimetablePublicationEntry`.
- Adds `Subject.timetableColour` and `PersonalTask.timetableTermKey` with unique `(ownerId, timetableTermKey)` system-task linkage.

- [x] **Step 1: Write a failing migration integration contract**

```ts
const schema = await readFile(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
expect(schema).toContain('model TimetableAgeGroupSchedule');
expect(schema).toContain('@@unique([termKey, registrationLevel])');
expect(schema).toContain('model StudentTimetablePublicationEntry');
```

- [x] **Step 2: Run the database test and verify RED**

Run: `pnpm --filter @oasis/db test -- src/__tests__/timetable-builder-migration.test.ts`

Expected: FAIL because the timetable models are absent.

- [x] **Step 3: Add enums, relations, models, SQL migration, and matching RLS source**

```prisma
model TimetableAgeGroupSchedule {
  id                String                @id @default(cuid())
  termKey           String
  registrationLevel String
  slots             TimetableScheduleSlot[]
  timetables        StudentTimetable[]
  updatedById       String
  updatedBy         User                  @relation("TimetableSchedulesUpdated", fields: [updatedById], references: [id])
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt
  @@unique([termKey, registrationLevel])
}
```

The migration creates Head-only `FOR ALL` policies for mutable timetable tables. Publication tables additionally receive `FOR SELECT` policies guarded by either a linked `Guardian` row or a `Student.userId` match.

- [x] **Step 4: Generate Prisma and verify schema/tests**

Run: `pnpm --filter @oasis/db generate && pnpm --filter @oasis/db test -- src/__tests__/timetable-builder-migration.test.ts && pnpm --filter @oasis/db typecheck`

Expected: PASS.

---

### Task 3: Existing-calendar term resolver

**Files:**

- Create: `apps/api/src/services/timetable-terms.ts`
- Create: `apps/api/src/__tests__/timetable-terms.test.ts`

**Interfaces:**

- Produces `loadTeachingTerms(db): Promise<TeachingTerm[]>`, `requireTeachingTerm(db, termKey)`, and `TeachingTerm { key, academicYearLabel, number, label, startsOn, endsOn }`.
- Consumes only active `CalendarEvent` rows and pairs start/end IDs with `/^calendar-(\d{4})-(\d{2})-term-([1-6])-(start|end)$/`.

- [x] **Step 1: Write failing tests for exact pairing and incomplete terms**

```ts
expect(await loadTeachingTerms(db)).toEqual([
  {
    key: '2026-27-term-1',
    academicYearLabel: '2026/27',
    number: 1,
    label: 'Term 1',
    startsOn: new Date('2026-09-08T00:00:00.000Z'),
    endsOn: new Date('2026-10-16T00:00:00.000Z'),
  },
]);
await expect(requireTeachingTerm(incompleteDb, '2026-27-term-1')).rejects.toThrow(
  'Term dates are incomplete',
);
```

- [x] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable-terms.test.ts`

Expected: FAIL because the service is absent.

- [x] **Step 3: Implement the typed resolver**

Query `calendarEvent.findMany` with `active: true`, `category: 'OasisDays'`, and `id.startsWith: 'calendar-'`; normalise dates to UTC-day values; ignore nonmatching events; sort by start date and term number; throw a concise error only when a requested term has one missing boundary.

- [x] **Step 4: Re-run the focused test**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable-terms.test.ts`

Expected: PASS.

---

### Task 4: Head schedule, child draft, and subject API

**Files:**

- Create: `apps/api/src/routers/timetable.ts`
- Create: `apps/api/src/services/timetable-subjects.ts`
- Create: `apps/api/src/__tests__/timetable.router.test.ts`
- Modify: `apps/api/src/router.ts`

**Interfaces:**

- Produces tRPC procedures `timetable.terms`, `headWorkspace`, `saveSchedule`, `saveDraft`, and `createAndAssignSubject`.
- `headWorkspace({ termKey, registrationLevel })` returns the resolved term, schedule (defaults when absent), active children in that level, per-child status, selected-child assigned subjects, and `done/total`.
- `saveSchedule` replaces slots transactionally after `findScheduleIssues` passes. `saveDraft` replaces only the selected child's lesson entries.

- [x] **Step 1: Write failing router tests**

```ts
await expect(nonHead.timetable.saveSchedule(validSchedule)).rejects.toMatchObject({
  code: 'FORBIDDEN',
});
expect(await head.timetable.saveSchedule(validSchedule)).toMatchObject({
  registrationLevel: 'Primary',
  slots: expect.any(Array),
});
expect(await head.timetable.saveDraft({ termKey, studentId, entries: [] })).toMatchObject({
  unassignedLessonCount: 20,
});
expect(await head.timetable.createAndAssignSubject({ studentId, name: 'French' })).toMatchObject({
  colour: 'Grey',
  name: 'French',
});
```

- [x] **Step 2: Run the router test and verify RED**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable.router.test.ts`

Expected: FAIL because `timetable` is not registered.

- [x] **Step 3: Implement Head procedures and reusable subject creation**

Use `roleProcedure('Head')`, `ctx.withRls`, and explicit `AuditLog` writes. Derive child level from `registrationProfile.registrationLevel`, falling back to a mapped `yearGroup` only when the profile is absent. Decrypt names only after the scoped query. Generate custom codes as `CUSTOM-<NORMALISED-NAME>` and append `-2`, `-3`, etc. on code collision; reuse a case-insensitive active exact-name match before creating a duplicate.

- [x] **Step 4: Re-run the API tests and typecheck**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable.router.test.ts && pnpm --filter @oasis/api typecheck`

Expected: PASS.

---

### Task 5: Publication, reader boundaries, and automated Head tasks

**Files:**

- Modify: `apps/api/src/routers/timetable.ts`
- Create: `apps/api/src/services/timetable-tasks.ts`
- Create: `apps/api/src/__tests__/timetable-tasks.test.ts`
- Modify: `apps/api/src/routers/personalTask.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/web/src/app/api/cron/timetable-tasks/route.ts`
- Modify: `apps/web/vercel.json`

**Interfaces:**

- Adds `publish`, `publishedForParent`, `publishedForStudent`, and `publicationForHead`.
- `publish({ termKey, studentId, acknowledgeUnassigned })` snapshots the term, ordered slots, subject names/colours, and child first name in one transaction; returns `UNASSIGNED_PERIODS` metadata when acknowledgement is needed.
- Produces `syncTimetableTasks({ db, asOf? })` that upserts one task per active Head/term at `startsOn - 7 days`, updates `done/total`, completes/reopens automatically, and is idempotent.

- [x] **Step 1: Add failing publication/access/task tests**

```ts
await expect(
  head.timetable.publish({ termKey, studentId, acknowledgeUnassigned: false }),
).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
expect(
  (await head.timetable.publish({ termKey, studentId, acknowledgeUnassigned: true })).publication
    .entries,
).toHaveLength(28);
await expect(
  unlinkedParent.timetable.publishedForParent({ studentId, termKey }),
).rejects.toMatchObject({ code: 'NOT_FOUND' });
expect(await syncTimetableTasks({ db, asOf })).toEqual({ heads: 2, terms: 6, updated: 12 });
```

- [x] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable.router.test.ts src/__tests__/timetable-tasks.test.ts`

Expected: FAIL because publication and task synchronisation are absent.

- [x] **Step 3: Implement immutable snapshots, scoped readers, and task sync**

Reader queries use `ctx.withRls` and `findFirst({ orderBy: { publishedAt: 'desc' } })`. Parent lookup additionally requires `guardians.some.userId = ctx.user.id`; student lookup requires `student.userId = ctx.user.id`. The cron route accepts only `Authorization: Bearer ${CRON_SECRET}` and calls the exported service with the privileged server Prisma client.

- [x] **Step 4: Re-run focused tests and API/web typechecks**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable.router.test.ts src/__tests__/timetable-tasks.test.ts && pnpm --filter @oasis/api typecheck && pnpm --filter @oasis/web typecheck`

Expected: PASS.

---

### Task 6: Professional timetable PDF and download route

**Files:**

- Create: `apps/api/src/reports/timetable-pdf.ts`
- Create: `apps/api/src/__tests__/timetable-pdf.test.ts`
- Modify: `apps/api/src/routers/timetable.ts`
- Create: `apps/web/src/app/api/timetables/[publicationId]/pdf/route.ts`

**Interfaces:**

- Produces `generateTimetablePdf(publication): Promise<{ bytes: Uint8Array; filename: string }>` and tRPC `downloadPdf({ publicationId })` for Head users.
- The route turns the authenticated tRPC result into `application/pdf`, `Content-Disposition: attachment`, and `Cache-Control: private, no-store`.

- [x] **Step 1: Write a failing PDF contract test**

```ts
const result = await generateTimetablePdf(fixture);
expect(result.filename).toBe('Taleyah-Term-1-timetable.pdf');
expect(result.bytes.slice(0, 4)).toEqual(Uint8Array.from([0x25, 0x50, 0x44, 0x46]));
expect(await extractPdfText(result.bytes)).toContain('B . R . E . A . K .');
```

- [x] **Step 2: Run the PDF test and verify RED**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable-pdf.test.ts`

Expected: FAIL because the PDF generator is absent.

- [x] **Step 3: Implement the A4-landscape vector layout**

Draw an Oasis navy header, crest asset when available, child first name and term range, slot headers, Tuesday-Friday rows, semantic print-safe cell fills, wrapped subject labels, and one centred glyph per line for `B.R.E.A.K.`. Keep all text as PDF text and clamp font sizes for long labels.

- [x] **Step 4: Re-run PDF/API tests**

Run: `pnpm --filter @oasis/api test -- src/__tests__/timetable-pdf.test.ts src/__tests__/timetable.router.test.ts`

Expected: PASS.

---

### Task 7: Head web workspace

**Files:**

- Create: `apps/web/src/app/(admin)/admin/timetables/page.tsx`
- Create: `apps/web/src/components/timetable/head-timetable-client.tsx`
- Create: `apps/web/src/components/timetable/age-group-schedule-editor.tsx`
- Create: `apps/web/src/components/timetable/student-timetable-editor.tsx`
- Create: `apps/web/src/components/timetable/timetable-grid.tsx`
- Create: `apps/web/src/components/timetable/timetable.module.css`
- Create: `apps/web/src/components/timetable/__tests__/timetable-grid.test.tsx`
- Modify: `apps/web/src/components/admin/admin-nav.tsx`

**Interfaces:**

- The page gates exact `Head` access server-side.
- The client consumes the Task 4/5 router outputs, supports term/level/child filters, explicit move-up/down slot controls, add/remove/retime/retype, save draft, inline subject creation, warning acknowledgement, publication, and PDF download.
- `TimetableGrid` accepts immutable grid data plus optional `onAssign` and is read-only when that callback is omitted.

- [x] **Step 1: Write failing component tests**

```tsx
render(<TimetableGrid publication={fixture} />);
expect(screen.getByRole('table', { name: /taleyah.*term 1/i })).toBeInTheDocument();
expect(screen.getByText('B.R.E.A.K.', { selector: '[aria-label="Break"]' })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /assign subject/i })).not.toBeInTheDocument();
```

- [x] **Step 2: Run the web test and verify RED**

Run: `pnpm --filter @oasis/web test -- src/components/timetable/__tests__/timetable-grid.test.tsx`

Expected: FAIL because the components are absent.

- [x] **Step 3: Implement the Head page and components**

Use semantic buttons, labelled time inputs, `aria-live` status, disabled pending actions, visible draft/published badges, a sticky but non-obscuring action bar, and responsive overflow for the full desktop grid. Keep schedule and child-editor state in separate components.

- [x] **Step 4: Re-run web tests/typecheck**

Run: `pnpm --filter @oasis/web test -- src/components/timetable/__tests__/timetable-grid.test.tsx && pnpm --filter @oasis/web typecheck`

Expected: PASS.

---

### Task 8: Parent and student read-only web views

**Files:**

- Create: `apps/web/src/app/(parent)/parent/timetable/page.tsx`
- Create: `apps/web/src/app/(student)/student/timetable/page.tsx`
- Create: `apps/web/src/components/timetable/parent-timetable-client.tsx`
- Create: `apps/web/src/components/timetable/student-timetable-client.tsx`
- Modify: `apps/web/src/components/parent/parent-nav.tsx`
- Modify: `apps/web/src/components/student/student-nav.tsx`

**Interfaces:**

- Parent client selects a linked child and calls `publishedForParent`; student client calls `publishedForStudent`.
- Both reuse read-only `TimetableGrid`, show term selection and a deliberate unpublished empty state, and expose no draft, history, or management controls.

- [x] **Step 1: Extend the failing web tests with reader contracts**

```tsx
render(<PublishedTimetableEmptyState audience="parent" />);
expect(screen.getByText(/has not been published yet/i)).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /publish|save draft/i })).not.toBeInTheDocument();
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @oasis/web test -- src/components/timetable/__tests__/timetable-grid.test.tsx`

Expected: FAIL because the reader empty-state component is absent.

- [x] **Step 3: Implement routes, clients, and navigation**

Use the existing linked-child selection query for display choices, but let the timetable endpoint enforce the guardian relation independently. Keep Timetable in the full navigation for small screens without expanding the fixed five-item bottom navigation.

- [x] **Step 4: Re-run web tests/typecheck**

Run: `pnpm --filter @oasis/web test -- src/components/timetable/__tests__/timetable-grid.test.tsx && pnpm --filter @oasis/web typecheck`

Expected: PASS.

---

### Task 9: Mobile Head builder and read-only viewer

**Files:**

- Create: `apps/mobile/src/components/timetable/mobile-timetable-view.tsx`
- Create: `apps/mobile/src/components/staff/staff-timetable-screen.tsx`
- Create: `apps/mobile/src/components/parent/parent-timetable-screen.tsx`
- Create: `apps/mobile/src/components/student/student-timetable-screen.tsx`
- Create: `apps/mobile/src/components/timetable/__tests__/mobile-timetable-view.test.tsx`
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/mobile/src/components/staff/staff-portal-screen.tsx`
- Modify: `apps/mobile/src/components/staff/staff-home-screen.tsx`
- Modify: `apps/mobile/src/components/parent/parent-portal-screen.tsx`
- Modify: `apps/mobile/src/components/student/student-portal-screen.tsx`

**Interfaces:**

- `MobileTimetableView` renders one selected weekday at a time and accepts no edit callback for parent/student views.
- `StaffTimetableScreen` appears only for `role === 'Head'`, uses ordered slot cards with move-up/down actions, and exposes the same save/publish states as web.
- Published PDF download uses the authenticated `downloadPdf` tRPC response. Web creates a temporary Blob URL; native writes the base64 payload to the Expo cache with `expo-file-system` and opens the platform share sheet with `expo-sharing`, then removes the temporary file on the next successful download.

- [x] **Step 1: Write failing mobile component tests**

```tsx
const tree = renderer.create(<MobileTimetableView publication={fixture} />).root;
expect(
  tree.findByProps({ accessibilityRole: 'tab', accessibilityState: { selected: true } }).props
    .children,
).toBe('Tuesday');
expect(tree.findByProps({ accessibilityLabel: 'Break' }).props.children).toBeTruthy();
```

- [x] **Step 2: Run the mobile test and verify RED**

Run: `pnpm --filter @oasis/mobile test -- src/components/timetable/__tests__/mobile-timetable-view.test.tsx`

Expected: FAIL because the mobile timetable view is absent.

- [x] **Step 3: Install the Expo-compatible file handoff packages**

Run: `pnpm --filter @oasis/mobile exec expo install expo-file-system expo-sharing`

Expected: compatible Expo 52 versions are added to `apps/mobile/package.json` and `pnpm-lock.yaml`.

- [x] **Step 4: Implement mobile routes, day tabs, cards, builder, and read-only screens**

Use existing `MobileScreen`, `MobileCard`, `MobileButton`, spacing, typography, and colour tokens. Keep 44-point targets, explicit accessibility labels, `ScrollView` content insets, and visible pending/error/success copy. Do not render the Head destination for another staff role.

- [x] **Step 5: Re-run mobile tests/typecheck**

Run: `pnpm --filter @oasis/mobile test -- src/components/timetable/__tests__/mobile-timetable-view.test.tsx && pnpm --filter @oasis/mobile typecheck`

Expected: PASS.

---

### Task 10: Full integration, accessibility, and production verification

**Files:**

- Modify only files from Tasks 1-9 when verification exposes a defect.
- Update: `docs/superpowers/plans/2026-09-04-timetable-builder.md` checkbox state.

**Interfaces:**

- Produces a release-ready, repository-wide verified implementation with no red lines or untracked generated artefacts.

- [x] **Step 1: Run affected focused suites and inspect every changed file**

Run: `git diff --check && git status --short && pnpm --filter @oasis/domain test && pnpm --filter @oasis/db test && pnpm --filter @oasis/api test && pnpm --filter @oasis/web test && pnpm --filter @oasis/mobile test`

Expected: all exit 0; only intentional source, migration, tests, and docs are changed.

- [x] **Step 2: Run the CI-equivalent commands**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: all exit 0 with zero failures.

- [x] **Step 3: Run production builds**

Run: `pnpm --filter @oasis/web build && pnpm --filter @oasis/mobile build:web`

Expected: both exit 0. If an environment-only external service blocks a build, preserve the exact error and report it rather than claiming success.

- [x] **Step 4: Review the complete diff against the approved specification**

Confirm exact Head role gating, CalendarEvent-derived terms, ABC/Primary/Secondary shared times, Tuesday-Friday only, flexible breaks, colour/text redundancy, reusable grey subjects, non-blocking empty periods, immutable publication, `done/total` task completion/reopening, child first name in PDF, `B.R.E.A.K.` vertical text, and parent/student read-only isolation on both platforms.

- [x] **Step 5: Commit the verified implementation**

```bash
git add docs packages apps pnpm-lock.yaml
git commit -m "feat: add termly timetable builder"
```
