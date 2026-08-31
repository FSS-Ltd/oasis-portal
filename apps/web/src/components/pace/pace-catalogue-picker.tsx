'use client';

import { availablePacesAhead, PACE_CATALOGUE } from '@oasis/domain';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface PaceCataloguePickerProps {
  availablePaceNumbers: readonly number[];
  currentPaceNumber: number;
  disabled: boolean;
  onChange: (paceNumbers: number[]) => void;
  selectedPaceNumbers: readonly number[];
  subjectLabel: string;
}

export const PACE_PICKER_WINDOW_SIZE = 12;

function sortedUniquePaceNumbers(paceNumbers: readonly number[]): number[] {
  return [...new Set(paceNumbers)].sort((left, right) => left - right);
}

export function PaceCataloguePicker({
  availablePaceNumbers,
  currentPaceNumber,
  disabled,
  onChange,
  selectedPaceNumbers,
  subjectLabel,
}: PaceCataloguePickerProps) {
  const [visibleCount, setVisibleCount] = useState(PACE_PICKER_WINDOW_SIZE);
  const available = new Set(availablePaceNumbers);
  const selected = new Set(selectedPaceNumbers);
  const futurePaceNumbers = availablePacesAhead(currentPaceNumber, PACE_CATALOGUE);
  const visiblePaceNumbers = futurePaceNumbers.slice(0, visibleCount);
  const hasMorePaces = visiblePaceNumbers.length < futurePaceNumbers.length;

  useEffect(() => {
    setVisibleCount(PACE_PICKER_WINDOW_SIZE);
  }, [currentPaceNumber, subjectLabel]);

  function togglePaceNumber(paceNumber: number): void {
    const nextSelection = selected.has(paceNumber)
      ? selectedPaceNumbers.filter((number) => number !== paceNumber)
      : [...selectedPaceNumbers, paceNumber];

    onChange(sortedUniquePaceNumbers(nextSelection));
  }

  return (
    <section aria-labelledby="pace-catalogue-picker-title" className="pace-catalogue-picker">
      <div className="pace-catalogue-picker__heading">
        <div>
          <p className="pace-catalogue-picker__eyebrow">{subjectLabel}</p>
          <h2 id="pace-catalogue-picker-title">PACEs to plan next</h2>
          <p className="muted">
            Starting after PACE #{String(currentPaceNumber)}. Choose the future PACEs to add to this
            student&apos;s supply or track as an order.
          </p>
        </div>
        <span aria-live="polite" className="badge badge--grey">
          {selectedPaceNumbers.length === 1
            ? '1 selected'
            : `${String(selectedPaceNumbers.length)} selected`}
        </span>
      </div>

      {visiblePaceNumbers.length > 0 ? (
        <div
          aria-label={`Future PACEs after ${String(currentPaceNumber)}`}
          className="pace-catalogue-picker__numbers"
          role="group"
        >
          {visiblePaceNumbers.map((paceNumber) => {
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
                <span className="pace-catalogue-picker__chip-number">#{String(paceNumber)}</span>
                {statusLabel ? (
                  <span className="pace-catalogue-picker__chip-status">{statusLabel}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="field__hint">This student is at the final supported PACE.</p>
      )}

      {hasMorePaces ? (
        <Button
          className="pace-catalogue-picker__more"
          onClick={() => {
            setVisibleCount((current) => current + PACE_PICKER_WINDOW_SIZE);
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          Show next {String(PACE_PICKER_WINDOW_SIZE)} PACEs
        </Button>
      ) : null}
    </section>
  );
}
