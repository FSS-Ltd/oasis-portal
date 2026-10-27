'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import {
  derivePacePlacement,
  diagnosticLevelsFor,
  firstPaceOfLevel,
  isDiagnosticChartTest,
  placementFromLevels,
  type DiagnosticTest,
} from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput } from '@/components/ui/field';
import { PaceDiagnosticChart } from './pace-diagnostic-chart';

const diagnosticTests: ReadonlyArray<{ value: DiagnosticTest; label: string }> = [
  { value: 'Math', label: 'Math' },
  { value: 'English', label: 'English' },
  { value: 'WordBuilding', label: 'Word Building' },
  { value: 'Reading', label: 'Reading' },
];

type DiagnosticOutcome = 'Pass' | 'Fail';
type LevelOutcomes = Record<number, DiagnosticOutcome>;

export type PaceDiagnosticSubmission =
  | {
      test: 'Math' | 'English';
      attemptedPaceNumbers: number[];
      circledPaceNumbers: number[];
    }
  | {
      test: 'WordBuilding' | 'Reading';
      levelResults: Array<{ level: number; outcome: DiagnosticOutcome }>;
    };

interface PaceDiagnosticFormProps {
  disabled: boolean;
  onSubmit: (submission: PaceDiagnosticSubmission) => void;
  pending: boolean;
  selectionLabel: string;
}

function isDiagnosticTest(value: string): value is DiagnosticTest {
  return diagnosticTests.some((test) => test.value === value);
}

function isLevelTest(test: DiagnosticTest): test is 'Reading' | 'WordBuilding' {
  return test === 'Reading' || test === 'WordBuilding';
}

function levelLabel(test: 'Reading' | 'WordBuilding', level: number): string {
  return test === 'WordBuilding' && level === 9 ? 'Level 9 (Etymology)' : `Level ${String(level)}`;
}

const FIRST_PACE = 1001;
const LAST_PACE = 1144;
/** The chart opens on the first row of twelve and is extended as far as the student got. */
const INITIAL_LAST_PACE = 1012;

function paceRange(lastPace: number): number[] {
  return Array.from({ length: lastPace - FIRST_PACE + 1 }, (_, index) => FIRST_PACE + index);
}

export function PaceDiagnosticForm({
  disabled,
  onSubmit,
  pending,
  selectionLabel,
}: PaceDiagnosticFormProps): ReactElement {
  const [test, setTest] = useState<DiagnosticTest>('Math');
  const [levelOutcomes, setLevelOutcomes] = useState<LevelOutcomes>({});
  const [lastPace, setLastPace] = useState(INITIAL_LAST_PACE);
  const [circled, setCircled] = useState<number[]>([]);
  const chartTest = isDiagnosticChartTest(test);
  const levelTest = isLevelTest(test) ? test : null;
  const attempted = paceRange(lastPace);
  const circledInRange = circled.filter((paceNumber) => attempted.includes(paceNumber));
  const placement = attempted.length > 0 ? derivePacePlacement(attempted, circledInRange) : null;
  const levels = levelTest ? diagnosticLevelsFor(levelTest) : [];
  const recorded = levels.flatMap((level) => {
    const outcome = levelOutcomes[level];
    return outcome ? [{ level, outcome }] : [];
  });
  const levelPlacement =
    levelTest && recorded.length > 0
      ? placementFromLevels(
          levelTest,
          recorded.filter((row) => row.outcome === 'Pass').map((row) => row.level),
          recorded.filter((row) => row.outcome === 'Fail').map((row) => row.level),
        )
      : null;
  const canSave = chartTest ? attempted.length > 0 : recorded.length > 0;

  function toggleCircle(paceNumber: number): void {
    setCircled((current) =>
      current.includes(paceNumber)
        ? current.filter((value) => value !== paceNumber)
        : [...current, paceNumber],
    );
  }

  function chooseOutcome(level: number, outcome: DiagnosticOutcome): void {
    setLevelOutcomes((current) =>
      // Choosing the active button again clears the level (not tested).
      current[level] === outcome
        ? Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== level))
        : { ...current, [level]: outcome },
    );
  }

  function submitDiagnostic(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || pending || !canSave) return;
    if (test === 'Math' || test === 'English') {
      onSubmit({
        test,
        attemptedPaceNumbers: attempted,
        circledPaceNumbers: [...circledInRange].sort((a, b) => a - b),
      });
      return;
    }
    onSubmit({ test, levelResults: recorded });
  }

  return (
    <form onSubmit={submitDiagnostic}>
      <p className="muted">{selectionLabel}</p>
      <div className="form-grid form-grid--two">
        <Field label="Test">
          <SelectInput
            disabled={disabled || pending}
            onChange={(event) => {
              const next = event.target.value;
              if (!isDiagnosticTest(next)) return;
              setTest(next);
              // Each test assesses its own levels, so start with a clean sheet.
              setLevelOutcomes({});
            }}
            value={test}
          >
            {diagnosticTests.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      {test === 'Reading' ? (
        <p className="field__hint">
          Reading is not a subject. Its result informs Science, Social Studies, Bible Reading and
          Literature and Creative Writing.
        </p>
      ) : null}
      {levelTest ? (
        <>
          <fieldset className="pace-levels">
            <legend>
              Mark Pass or Fail for each level tested, then save once. Leave untested levels blank.
            </legend>
            {levels.map((level) => {
              const outcome = levelOutcomes[level];
              return (
                <div
                  aria-label={levelLabel(levelTest, level)}
                  className="pace-levels__row"
                  key={level}
                  role="group"
                >
                  <span className="pace-levels__name">{levelLabel(levelTest, level)}</span>
                  <div className="pace-levels__choices">
                    {(['Pass', 'Fail'] as const).map((choice) => (
                      <button
                        aria-pressed={outcome === choice ? 'true' : 'false'}
                        className="pace-levels__choice"
                        data-outcome={choice}
                        disabled={disabled || pending}
                        key={choice}
                        onClick={() => {
                          chooseOutcome(level, choice);
                        }}
                        type="button"
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {recorded.length > 0 ? (
              <button
                className="pace-levels__clear"
                disabled={disabled || pending}
                onClick={() => {
                  setLevelOutcomes({});
                }}
                type="button"
              >
                Clear all levels
              </button>
            ) : null}
          </fieldset>
          <div className="pace-diagnostic-form__placement" aria-live="polite">
            {levelPlacement?.firstFailedLevel !== null &&
            levelPlacement?.firstFailedLevel !== undefined ? (
              <>
                <span>
                  <strong>First level failed:</strong>{' '}
                  {levelLabel(levelTest, levelPlacement.firstFailedLevel)}
                </span>
                <span>
                  <strong>Recommended start:</strong> PACE #{' '}
                  {String(levelPlacement.recommendedStartPace)} (first PACE of Level{' '}
                  {String(levelPlacement.firstFailedLevel)}, PACEs{' '}
                  {String(firstPaceOfLevel(levelPlacement.firstFailedLevel))}–
                  {String(firstPaceOfLevel(levelPlacement.firstFailedLevel) + 11)}). Provisional:
                  review the full diagnostic report.
                </span>
              </>
            ) : levelPlacement ? (
              <span>
                <strong>Recommended start:</strong> none. Every level tested passed, so review the
                full diagnostic report manually.
              </span>
            ) : (
              <span>
                <strong>Recommended start:</strong> appears here once you mark the levels. It begins
                at the first PACE of the first level failed.
              </span>
            )}
            {levelPlacement?.review === 'conflict' ? (
              <span role="alert">
                A higher level passed after a failed one. Results conflict, so review the full
                diagnostic report manually.
              </span>
            ) : null}
            {test === 'Reading' && levelPlacement?.firstFailedLevel === 1 ? (
              <span>Level 1 may need ABCs with Ace and Christi or a readiness assessment.</span>
            ) : null}
          </div>
        </>
      ) : null}
      {chartTest ? (
        <>
          <p className="field__hint">
            Tap every PACE scored below the minimum requirement to circle it. Extend the chart to
            the last PACE the student attempted.
          </p>
          <PaceDiagnosticChart
            attempted={attempted}
            circled={circledInRange}
            disabled={disabled || pending}
            onToggle={toggleCircle}
          />
          <div className="pace-chart-controls">
            <Button
              disabled={disabled || pending || lastPace >= LAST_PACE}
              onClick={() => {
                setLastPace((current) => Math.min(LAST_PACE, current + 12));
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Add next 12 PACEs
            </Button>
            <Button
              disabled={disabled || pending || lastPace >= LAST_PACE}
              onClick={() => {
                setLastPace((current) => Math.min(LAST_PACE, current + 1));
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Add next PACE
            </Button>
            <Button
              disabled={disabled || pending || lastPace <= FIRST_PACE}
              onClick={() => {
                setLastPace((current) => Math.max(FIRST_PACE, current - 1));
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Remove last PACE
            </Button>
            <span className="field__hint" aria-live="polite">
              Attempted: PACEs {String(FIRST_PACE)}–{String(lastPace)} ({String(attempted.length)})
            </span>
          </div>
          {placement ? (
            <div className="pace-diagnostic-form__placement" aria-live="polite">
              <span>
                <strong>Learning Gaps:</strong>{' '}
                {placement.learningGaps.length > 0
                  ? `PACEs # ${placement.learningGaps.join(', ')}`
                  : 'None'}
              </span>
              <span>
                <strong>Performance Level:</strong>{' '}
                {placement.performanceLevelPace === null
                  ? 'The student has passed every PACE.'
                  : `After completing any learning gaps, the student is ready to advance from PACE # ${String(placement.performanceLevelPace)}.`}
              </span>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="pace-inventory-actions">
        <Button disabled={disabled || !canSave} pending={pending} type="submit">
          Record diagnostic
        </Button>
        <span className="field__hint">
          This records a reference result only. It does not change the student&apos;s current PACE.
        </span>
      </div>
    </form>
  );
}
