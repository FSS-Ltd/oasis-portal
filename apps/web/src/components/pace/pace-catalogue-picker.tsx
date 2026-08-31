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
        normally disabled, but an already selected unavailable PACE can still be removed.
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
                  const statusLabel = isSelected
                    ? isAvailable
                      ? 'Selected'
                      : 'Selected · unavailable'
                    : isAvailable
                      ? null
                      : 'Unavailable';

                  return (
                    <label
                      className="pace-catalogue-picker__chip"
                      data-selected={isSelected || undefined}
                      data-unavailable={!isAvailable || undefined}
                      key={paceNumber}
                    >
                      <input
                        checked={isSelected}
                        disabled={disabled || (!isAvailable && !isSelected)}
                        onChange={() => {
                          togglePaceNumber(paceNumber);
                        }}
                        type="checkbox"
                      />
                      <span className="pace-catalogue-picker__chip-number">
                        #{String(paceNumber)}
                      </span>
                      {statusLabel ? (
                        <span className="pace-catalogue-picker__chip-status">{statusLabel}</span>
                      ) : null}
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
