'use client';

import type { RouterInputs } from '@/lib/trpc';

export type DraftSections = NonNullable<RouterInputs['report']['draft']['sections']>;
type SectionKey = keyof DraftSections;

interface ReportSectionPickerProps {
  disabled: boolean;
  onChange: (sections: DraftSections) => void;
  value: DraftSections;
}

const SECTION_OPTIONS: readonly { key: SectionKey; label: string }[] = [
  { key: 'attendance', label: 'Attendance' },
  { key: 'paceProgress', label: 'PACE Progress' },
  { key: 'paceStatus', label: 'PACE Status' },
  { key: 'behaviourSummary', label: 'Behaviour Summary' },
  { key: 'behaviourNotes', label: 'Behaviour Notes' },
  { key: 'generalNotes', label: 'General Notes' },
  { key: 'meritActivity', label: 'Merit Activity' },
  { key: 'balances', label: 'Balances' },
  { key: 'progressComment', label: 'Progress Comment' },
];

export function ReportSectionPicker({
  disabled,
  onChange,
  value,
}: ReportSectionPickerProps) {
  const selectedCount = Object.values(value).filter(Boolean).length;

  function updateSection(key: SectionKey, checked: boolean): void {
    if (key === 'paceProgress' && !checked) {
      onChange({ ...value, paceProgress: false, paceStatus: false });
      return;
    }
    onChange({ ...value, [key]: checked });
  }

  return (
    <fieldset className="report-section-picker" disabled={disabled}>
      <legend>Report Sections</legend>
      <p className="muted">{selectedCount} of {SECTION_OPTIONS.length} sections selected.</p>
      <div className="report-section-picker__grid">
        {SECTION_OPTIONS.map((option) => {
          const optionDisabled = disabled || (option.key === 'paceStatus' && !value.paceProgress);
          return (
            <label
              className={`report-section-picker__option${value[option.key] ? ' is-checked' : ''}`}
              key={option.key}
            >
              <input
                checked={value[option.key]}
                disabled={optionDisabled}
                onChange={(event) => {
                  updateSection(option.key, event.target.checked);
                }}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      <p className="muted report-section-picker__help">
        PACE Status is available only when PACE Progress is included.
      </p>
    </fieldset>
  );
}
