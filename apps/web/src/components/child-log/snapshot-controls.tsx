import type { CSSProperties } from 'react';
import { avatarColour, firstName, getInitials, SNAPSHOT_AVATAR_COLOURS } from '@/lib/display';
import { formatRange, type RangePreset, type SnapshotTab } from './snapshot-utils';

type StudentOption = {
  fullName: string;
  id: string;
  yearGroup: string;
};

type SnapshotStudentSummary = {
  fullName: string;
  supervisorName: string | null;
  totalMerits: number;
  yearGroup: string;
};

type SnapshotTabItem = {
  count: number;
  id: SnapshotTab;
  label: string;
};

interface SnapshotStudentPickerProps {
  onSelect: (studentId: string) => void;
  selectedStudentId: string;
  students: readonly StudentOption[];
}

export function SnapshotStudentPicker({
  onSelect,
  selectedStudentId,
  students,
}: SnapshotStudentPickerProps) {
  return (
    <div className="snapshot-student-picker" aria-label="Select student">
      {students.map((student, index) => {
        const colour = avatarColour(index, SNAPSHOT_AVATAR_COLOURS);
        const selected = selectedStudentId === student.id;
        return (
          <button
            className={selected ? 'snapshot-student-card is-selected' : 'snapshot-student-card'}
            key={student.id}
            onClick={() => {
              onSelect(student.id);
            }}
            style={{ '--student-colour': colour } as CSSProperties}
            type="button"
          >
            <span>{getInitials(student.fullName)}</span>
            <strong>{firstName(student.fullName)}</strong>
            <small>{student.yearGroup}</small>
          </button>
        );
      })}
    </div>
  );
}

interface SnapshotHeroProps {
  colour: string;
  selectedStudent: StudentOption | null;
  snapshotStudent: SnapshotStudentSummary | undefined;
}

export function SnapshotHeroStudent({ colour, selectedStudent, snapshotStudent }: SnapshotHeroProps) {
  const name = snapshotStudent?.fullName ?? selectedStudent?.fullName ?? 'Select a student';
  const yearGroup = snapshotStudent?.yearGroup ?? selectedStudent?.yearGroup ?? 'Year group';

  return (
    <div className="snapshot-hero__student">
      <span className="snapshot-hero__avatar" style={{ backgroundColor: colour }}>
        {snapshotStudent ? getInitials(snapshotStudent.fullName) : selectedStudent ? getInitials(selectedStudent.fullName) : '--'}
      </span>
      <div>
        <h2>{name}</h2>
        <p>
          {yearGroup} · Supervisor: {snapshotStudent?.supervisorName ?? 'Not assigned'}
        </p>
      </div>
      <div className="snapshot-hero__merits">
        <strong>{snapshotStudent?.totalMerits ?? 0}</strong>
        <span>total merits</span>
      </div>
    </div>
  );
}

interface SnapshotRangePickerProps {
  from: string;
  onFromChange: (value: string) => void;
  onPresetChange: (value: RangePreset) => void;
  onToChange: (value: string) => void;
  rangePreset: RangePreset;
  to: string;
}

export function SnapshotRangePicker({
  from,
  onFromChange,
  onPresetChange,
  onToChange,
  rangePreset,
  to,
}: SnapshotRangePickerProps) {
  return (
    <div className="snapshot-range">
      <h3>Viewing period</h3>
      <div className="snapshot-range__controls">
        {[
          ['previous-day', 'Yesterday'],
          ['previous-week', 'Last 7 days'],
          ['custom', 'Custom'],
        ].map(([value, label]) => (
          <button
            className={rangePreset === value ? 'is-selected' : undefined}
            key={value}
            onClick={() => {
              onPresetChange(value as RangePreset);
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {rangePreset === 'custom' ? (
        <div className="snapshot-range__custom">
          <input
            aria-label="Snapshot from"
            onChange={(event) => {
              onFromChange(event.target.value);
            }}
            type="date"
            value={from}
          />
          <span>to</span>
          <input
            aria-label="Snapshot to"
            onChange={(event) => {
              onToChange(event.target.value);
            }}
            type="date"
            value={to}
          />
        </div>
      ) : null}
      <p>{formatRange(from, to, rangePreset)}</p>
    </div>
  );
}

interface SnapshotTabsProps {
  activeTab: SnapshotTab;
  onSelect: (tab: SnapshotTab) => void;
  tabs: readonly SnapshotTabItem[];
}

export function SnapshotTabs({ activeTab, onSelect, tabs }: SnapshotTabsProps) {
  return (
    <div className="snapshot-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? 'is-selected' : undefined}
          key={tab.id}
          onClick={() => {
            onSelect(tab.id);
          }}
          role="tab"
          type="button"
        >
          {tab.label}
          {tab.count > 0 ? <span>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
