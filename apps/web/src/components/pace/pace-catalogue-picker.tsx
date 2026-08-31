'use client';

import { PACE_CATALOGUE, paceLevelForNumber } from '@oasis/domain';

interface PaceCataloguePickerProps {
  availablePaceNumbers: readonly number[];
  disabled: boolean;
  onChange: (paceNumbers: number[]) => void;
  selectedPaceNumbers: readonly number[];
  subjectLabel: string;
}

const levels = Array.from({ length: 12 }, (_, index) => index + 1);

function sortedUniquePaceNumbers(paceNumbers: readonly number[]): number[] {
  return [...new Set(paceNumbers)].sort((left, right) => left - right);
}

export function PaceCataloguePicker({
  availablePaceNumbers,
  disabled,
  onChange,
  selectedPaceNumbers,
  subjectLabel,
}: PaceCataloguePickerProps) {
  const available = new Set(availablePaceNumbers);
  const selected = new Set(selectedPaceNumbers);

  function togglePaceNumber(paceNumber: number): void {
    const nextSelection = selected.has(paceNumber)
      ? selectedPaceNumbers.filter((number) => number !== paceNumber)
      : [...selectedPaceNumbers, paceNumber];

    onChange(sortedUniquePaceNumbers(nextSelection));
  }

  return (
    <section aria-labelledby="pace-catalogue-picker-title" className="pace-catalogue-picker">
      <div className="section-title">
        <div>
          <h2 id="pace-catalogue-picker-title">Choose PACEs</h2>
          <p className="muted">{subjectLabel}</p>
        </div>
        <span aria-live="polite" className="badge badge--grey">
          {selectedPaceNumbers.length === 1
            ? '1 PACE selected'
            : `${String(selectedPaceNumbers.length)} PACEs selected`}
        </span>
      </div>
      <p className="field__hint">
        Select PACE numbers to add to current supply or create tracked orders. Unavailable PACEs are
        disabled.
      </p>
      <div className="pace-catalogue-picker__levels">
        {levels.map((level) => (
          <fieldset className="pace-catalogue-picker__level" key={level}>
            <legend>Level {level}</legend>
            <div className="pace-catalogue-picker__numbers">
              {PACE_CATALOGUE.filter((paceNumber) => paceLevelForNumber(paceNumber) === level).map(
                (paceNumber) => {
                  const isAvailable = available.has(paceNumber);
                  const isSelected = selected.has(paceNumber);

                  return (
                    <label
                      className="pace-catalogue-picker__chip"
                      data-selected={isSelected || undefined}
                      key={paceNumber}
                    >
                      <input
                        checked={isSelected}
                        disabled={disabled || !isAvailable}
                        onChange={() => {
                          togglePaceNumber(paceNumber);
                        }}
                        type="checkbox"
                      />
                      <span>#{String(paceNumber)}</span>
                    </label>
                  );
                },
              )}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
