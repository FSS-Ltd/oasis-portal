'use client';

import { useId } from 'react';
import {
  STANDARD_SCHOOL_YEARS,
  canonicalSchoolYear,
  displaySchoolYearLabel,
  type ResolvedSchoolYear,
  type StandardSchoolYear,
} from '@oasis/domain';
import { Field, SelectInput, TextInput } from '@/components/ui/field';

interface StudentLevelFieldProps {
  error?: string | undefined;
  onChange: (year: StandardSchoolYear | null) => void;
  override: StandardSchoolYear | null;
  suggestedYear: ResolvedSchoolYear;
}

export function StudentLevelField({
  error,
  onChange,
  override,
  suggestedYear,
}: StudentLevelFieldProps) {
  const hintId = useId();
  const hint =
    override === null
      ? 'Suggested from date of birth for the school year starting in September.'
      : 'This level stays until you return to Automatic.';
  return (
    <>
      <Field label="Level mode">
        <SelectInput
          aria-label="Level mode"
          name="levelMode"
          onChange={(event) => {
            onChange(
              event.target.value === 'manual'
                ? (canonicalSchoolYear(suggestedYear) ?? STANDARD_SCHOOL_YEARS[0])
                : null,
            );
          }}
          value={override === null ? 'automatic' : 'manual'}
        >
          <option value="automatic">Automatic (date of birth)</option>
          <option value="manual">Manual override</option>
        </SelectInput>
      </Field>
      <Field error={error} label="Level">
        {override === null ? (
          <TextInput
            aria-describedby={hintId}
            aria-invalid={Boolean(error)}
            aria-label="Level"
            readOnly
            value={displaySchoolYearLabel(suggestedYear)}
          />
        ) : (
          <SelectInput
            aria-describedby={hintId}
            aria-invalid={Boolean(error)}
            aria-label="Level"
            name="yearGroupOverride"
            onChange={(event) => {
              const year = canonicalSchoolYear(event.target.value);
              if (year) onChange(year);
            }}
            value={override}
          >
            {STANDARD_SCHOOL_YEARS.map((year) => (
              <option key={year} value={year}>
                {displaySchoolYearLabel(year)}
              </option>
            ))}
          </SelectInput>
        )}
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      </Field>
    </>
  );
}
