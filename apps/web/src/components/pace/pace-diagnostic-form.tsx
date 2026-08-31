'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Field, SelectInput } from '@/components/ui/field';

const diagnosticLevels = [1, 2, 3, 4, 5] as const;
const diagnosticOutcomes = ['Pass', 'Fail'] as const;

type DiagnosticLevel = (typeof diagnosticLevels)[number];
type DiagnosticOutcome = (typeof diagnosticOutcomes)[number];

export interface PaceDiagnosticSelection {
  level: DiagnosticLevel;
  outcome: DiagnosticOutcome;
}

interface PaceDiagnosticFormProps {
  disabled: boolean;
  onSubmit: (selection: PaceDiagnosticSelection) => void;
  pending: boolean;
  selectionLabel: string;
}

function isDiagnosticLevel(value: number): value is DiagnosticLevel {
  return diagnosticLevels.some((level) => level === value);
}

function isDiagnosticOutcome(value: string): value is DiagnosticOutcome {
  return diagnosticOutcomes.some((outcome) => outcome === value);
}

export function PaceDiagnosticForm({
  disabled,
  onSubmit,
  pending,
  selectionLabel,
}: PaceDiagnosticFormProps): ReactElement {
  const [level, setLevel] = useState<DiagnosticLevel>(1);
  const [outcome, setOutcome] = useState<DiagnosticOutcome>('Pass');

  function submitDiagnostic(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || pending) return;
    onSubmit({ level, outcome });
  }

  return (
    <form onSubmit={submitDiagnostic}>
      <p className="muted">{selectionLabel}</p>
      <div className="form-grid form-grid--two">
        <Field label="Level">
          <SelectInput
            disabled={disabled || pending}
            onChange={(event) => {
              const nextLevel = Number(event.target.value);
              if (isDiagnosticLevel(nextLevel)) setLevel(nextLevel);
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
      </div>
      <div className="pace-inventory-actions">
        <Button disabled={disabled} pending={pending} type="submit">
          Record diagnostic
        </Button>
        <span className="field__hint">
          This records a reference result only. It does not change the student&apos;s current PACE.
        </span>
      </div>
    </form>
  );
}
