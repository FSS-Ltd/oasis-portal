import type { ReactElement } from 'react';

interface PaceDiagnosticChartProps {
  /** PACEs attempted, in chart order. */
  attempted: readonly number[];
  /** Attempted PACEs scored below the minimum requirement. */
  circled: readonly number[];
  /** When provided the chart is editable and tapping a PACE toggles its circle. */
  onToggle?: (paceNumber: number) => void;
  disabled?: boolean;
}

/** The printed diagnostic chart: attempted PACEs in rows of twelve, circled in red when below the minimum. */
export function PaceDiagnosticChart({
  attempted,
  circled,
  onToggle,
  disabled = false,
}: PaceDiagnosticChartProps): ReactElement {
  const circledSet = new Set(circled);
  return (
    <div className="pace-chart" role="group" aria-label="PACE diagnostic chart">
      {attempted.map((paceNumber) => {
        const isCircled = circledSet.has(paceNumber);
        const label = `PACE ${String(paceNumber)}${isCircled ? ', circled' : ''}`;
        return onToggle ? (
          <button
            aria-label={label}
            aria-pressed={isCircled}
            className="pace-chart__cell"
            data-circled={isCircled}
            disabled={disabled}
            key={paceNumber}
            onClick={() => {
              onToggle(paceNumber);
            }}
            type="button"
          >
            {paceNumber}
          </button>
        ) : (
          <span
            aria-label={label}
            className="pace-chart__cell"
            data-circled={isCircled}
            key={paceNumber}
            role="img"
          >
            {paceNumber}
          </span>
        );
      })}
    </div>
  );
}
