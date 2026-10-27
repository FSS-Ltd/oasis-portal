'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import {
  DIAGNOSTIC_LEVEL_MAX,
  derivePacePlacement,
  isDiagnosticChartTest,
  type DiagnosticTest,
} from '@oasis/domain';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { PaceDiagnosticChart } from './pace-diagnostic-chart';

const diagnosticTests: ReadonlyArray<{ value: DiagnosticTest; label: string }> = [
  { value: 'Math', label: 'Math' },
  { value: 'English', label: 'English' },
  { value: 'WordBuilding', label: 'Word Building' },
  { value: 'Reading', label: 'Reading' },
];
const diagnosticLevels = Array.from({ length: DIAGNOSTIC_LEVEL_MAX }, (_, index) => index + 1);
const diagnosticOutcomes = ['Pass', 'Fail'] as const;

type DiagnosticOutcome = (typeof diagnosticOutcomes)[number];

export type PaceDiagnosticSubmission =
  | {
      test: 'Math' | 'English';
      attemptedPaceNumbers: number[];
      circledPaceNumbers: number[];
    }
  | { test: 'WordBuilding' | 'Reading'; level: number; outcome: DiagnosticOutcome };

interface PaceDiagnosticFormProps {
  disabled: boolean;
  onSubmit: (submission: PaceDiagnosticSubmission) => void;
  pending: boolean;
  selectionLabel: string;
}

function isDiagnosticTest(value: string): value is DiagnosticTest {
  return diagnosticTests.some((test) => test.value === value);
}

function isDiagnosticOutcome(value: string): value is DiagnosticOutcome {
  return diagnosticOutcomes.some((outcome) => outcome === value);
}

function paceRange(first: string, last: string): { paceNumbers: number[]; error: string } {
  const from = Number(first);
  const to = Number(last);
  if (!Number.isInteger(from) || !Number.isInteger(to) || first === '' || last === '') {
    return { paceNumbers: [], error: 'Enter the first and last PACE attempted.' };
  }
  if (from < 1001 || to > 1144 || from > to) {
    return {
      paceNumbers: [],
      error: 'Use PACEs from 1001 to 1144, with the last at or after the first.',
    };
  }
  return {
    paceNumbers: Array.from({ length: to - from + 1 }, (_, index) => from + index),
    error: '',
  };
}

export function PaceDiagnosticForm({
  disabled,
  onSubmit,
  pending,
  selectionLabel,
}: PaceDiagnosticFormProps): ReactElement {
  const [test, setTest] = useState<DiagnosticTest>('Math');
  const [level, setLevel] = useState(1);
  const [outcome, setOutcome] = useState<DiagnosticOutcome>('Pass');
  const [firstPace, setFirstPace] = useState('1001');
  const [lastPace, setLastPace] = useState('');
  const [circled, setCircled] = useState<number[]>([]);
  const chartTest = isDiagnosticChartTest(test);
  const { paceNumbers: attempted, error: rangeError } = paceRange(firstPace, lastPace);
  const circledInRange = circled.filter((paceNumber) => attempted.includes(paceNumber));
  const placement = attempted.length > 0 ? derivePacePlacement(attempted, circledInRange) : null;

  function toggleCircle(paceNumber: number): void {
    setCircled((current) =>
      current.includes(paceNumber)
        ? current.filter((value) => value !== paceNumber)
        : [...current, paceNumber],
    );
  }

  function submitDiagnostic(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || pending) return;
    if (test === 'Math' || test === 'English') {
      if (attempted.length === 0) return;
      onSubmit({
        test,
        attemptedPaceNumbers: attempted,
        circledPaceNumbers: [...circledInRange].sort((a, b) => a - b),
      });
      return;
    }
    onSubmit({ test, level, outcome });
  }

  return (
    <form onSubmit={submitDiagnostic}>
      <p className="muted">{selectionLabel}</p>
      <div className="form-grid form-grid--two">
        <Field label="Test">
          <SelectInput
            disabled={disabled || pending}
            onChange={(event) => {
              if (isDiagnosticTest(event.target.value)) setTest(event.target.value);
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
        {chartTest ? null : (
          <>
            <Field label="Level">
              <SelectInput
                disabled={disabled || pending}
                onChange={(event) => {
                  setLevel(Number(event.target.value));
                }}
                value={level}
              >
                {diagnosticLevels.map((value) => (
                  <option key={value} value={value}>
                    Level {String(value)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Outcome">
              <SelectInput
                disabled={disabled || pending}
                onChange={(event) => {
                  if (isDiagnosticOutcome(event.target.value)) setOutcome(event.target.value);
                }}
                value={outcome}
              >
                {diagnosticOutcomes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </>
        )}
      </div>
      {test === 'Reading' ? (
        <p className="field__hint">
          Reading is not a subject. Its level sets where this student starts Science and Social
          Studies.
        </p>
      ) : null}
      {chartTest ? (
        <>
          <div className="form-grid form-grid--two">
            <Field label="First PACE">
              <TextInput
                disabled={disabled || pending}
                inputMode="numeric"
                onChange={(event) => {
                  setFirstPace(event.target.value);
                }}
                value={firstPace}
              />
            </Field>
            <Field label="Last PACE attempted">
              <TextInput
                disabled={disabled || pending}
                inputMode="numeric"
                onChange={(event) => {
                  setLastPace(event.target.value);
                }}
                value={lastPace}
              />
            </Field>
          </div>
          {rangeError && lastPace !== '' ? (
            <p className="field__error" role="alert">
              {rangeError}
            </p>
          ) : null}
          {attempted.length > 0 ? (
            <>
              <p className="field__hint">
                Tap every PACE scored below the minimum requirement to circle it.
              </p>
              <PaceDiagnosticChart
                attempted={attempted}
                circled={circledInRange}
                disabled={disabled || pending}
                onToggle={toggleCircle}
              />
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
        </>
      ) : null}
      <div className="pace-inventory-actions">
        <Button
          disabled={disabled || (chartTest && attempted.length === 0)}
          pending={pending}
          type="submit"
        >
          Record diagnostic
        </Button>
        <span className="field__hint">
          This records a reference result only. It does not change the student&apos;s current PACE.
        </span>
      </div>
    </form>
  );
}
