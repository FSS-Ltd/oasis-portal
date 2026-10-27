# Diagnostic tests: PACE chart for Math and English

## Problem

Diagnostic results are stored as one `Level 1-5 + Pass/Fail` row per subject. That fits
Word Building, but not Math and English, which are scored on the printed PACE chart
(`Example.pdf`): the student attempts PACEs in order, any score below the minimum is
circled, and the result is a list of **Learning Gaps** plus a **Performance Level** (the PACE
the student advances from). Reading is not a subject; its level decides where the student
starts Science and Social Studies.

## Decisions

| Test | Entry | Stored against |
| --- | --- | --- |
| Math, English | PACE chart: attempted PACEs, circled PACEs | the student's Math / English assignment |
| Word Building | Level 1-10 + Pass/Fail | the student's Word Building assignment |
| Reading | Level 1-10 + Pass/Fail | the student only (no subject) |

- Diagnostics stay reference records. They do not move `currentPaceNumber`.
- A chart result with gaps offers **Set up Gap PACEs**, which opens the existing gap plan
  panel prefilled. The Head reviews and saves. Nothing is created automatically.
- Decided with the Head: with no run of three circled PACEs, the student advances from the
  PACE after the last one they passed (passed up to 1026, so 1027).

## Derivation (`derivePacePlacement`, pure, `packages/domain`)

Input: `attempted` (unique PACEs 1001-1144) and `circled` (subset of attempted).

1. Sort `attempted`. Find the first run of **three adjacent circled** entries in that order.
2. Run found: performance level = first PACE of the run.
3. No run: performance level = highest passed PACE + 1 (passed = attempted minus circled).
   Nothing passed: the first attempted PACE. Beyond 1144: `null` (catalogue complete).
4. Learning gaps = circled PACEs below the performance level.

Check against the PDF: attempted 1001-1017, circled 1008, 1015, 1016, 1017 gives gaps
`[1008]` and performance level `1015`.

## Data model (additive migration)

- New enum `DiagnosticTest { Math English WordBuilding Reading }`.
- `DiagnosticResult.test DiagnosticTest?` (null only for legacy rows we cannot map).
- `subjectId`, `level`, `outcome` become nullable. Reading rows have no subject; chart rows
  have no level or outcome.
- New `attemptedPaceNumbers Int[]` and `circledPaceNumbers Int[]`, default `{}`.
- Level check widens from 1-5 to `level IS NULL OR 1-10`. Row shape is enforced by zod,
  not by SQL, so legacy Math/English level rows stay valid.
- Backfill `test` from the subject code: MATH/MA, ENG/EN, WB/CUSTOM-WORD-BUILDING.
  Other legacy rows keep `test = NULL` and still display as `Level N Pass/Fail`.
- Same table, so no new realtime coverage entry. The Head-only RLS policy is unchanged.

## API

- `recordDiagnostic` takes a union: chart input (`Math | English`) or level input
  (`WordBuilding | Reading`). The server resolves the student's active assignment by code;
  it returns a clear error when the subject is not assigned. Reading needs no assignment.
- `summary` and `diagnosticsHistory` also return `test`, the chart arrays and the derived
  placement, and include Reading rows (no subject) for active students.
- `createOrderInput` no longer uses `.pick()` on the diagnostic schema (a union has none).

## Failure modes

- Circled not a subset of attempted, duplicates, or out-of-range PACEs: rejected by zod.
- Subject not assigned: `BAD_REQUEST`, nothing written.
- Legacy rows: render as before. Deleting still soft-deletes.

## Security and privacy

Head-only (`roleProcedure('Head')`) and Head-only RLS, unchanged. Audit rows for create and
delete now include `test` and the chart arrays.

## Rollout and rollback

Additive migration, deployed before the apps. Old app builds keep working until the API
changes, because old columns remain and legacy rows keep valid values. Rollback: redeploy
the previous API, then drop the new columns and enum (no data is lost from old rows). Mobile
and web must ship together with the API, since the input shape changes.

## Success

The PDF example renders as gaps `1008` and "advance from PACE 1015" on web and mobile;
Word Building and Reading accept Level 1-10; Set up Gap PACEs prefills the gap panel.
