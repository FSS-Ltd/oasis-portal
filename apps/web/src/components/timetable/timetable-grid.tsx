'use client';

import { TIMETABLE_DAYS, type TimetableColour, type TimetableDay } from '@oasis/domain';
import { formatMinutes, timetableCellKey } from './timetable-format';
import styles from './timetable.module.css';

export interface TimetableGridSlot {
  endMinutes: number;
  id: string;
  kind: 'Lesson' | 'Break';
  label: string;
  position: number;
  startMinutes: number;
}

export interface TimetableGridSubject {
  colour: TimetableColour;
  id: string;
  name: string;
}

export interface TimetableGridEntry {
  day: TimetableDay;
  slotId: string;
  subjectColour?: TimetableColour | null;
  subjectId?: string | null;
  subjectName?: string | null;
}

interface TimetableGridProps {
  editable?: boolean;
  entries: readonly TimetableGridEntry[];
  onSubjectChange?: (day: TimetableDay, slotId: string, subjectId: string) => void;
  slots: readonly TimetableGridSlot[];
  subjects?: readonly TimetableGridSubject[];
}

export function TimetableGrid({
  editable = false,
  entries,
  onSubjectChange,
  slots,
  subjects = [],
}: TimetableGridProps) {
  const entryByCell = new Map(
    entries.map((entry) => [timetableCellKey(entry.day, entry.slotId), entry]),
  );
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  return (
    <div className={styles.gridScroller}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.dayHeading} scope="col">
              Day
            </th>
            {slots.map((slot) => (
              <th key={slot.id} scope="col">
                <strong>{slot.label}</strong>
                <span>
                  {formatMinutes(slot.startMinutes)}–{formatMinutes(slot.endMinutes)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIMETABLE_DAYS.map((day) => (
            <tr key={day}>
              <th className={styles.dayCell} scope="row">
                {day.slice(0, 3).toUpperCase()}
              </th>
              {slots.map((slot) => {
                if (slot.kind === 'Break') {
                  if (day !== TIMETABLE_DAYS[0]) return null;

                  return (
                    <td className={styles.breakCell} key={slot.id} rowSpan={TIMETABLE_DAYS.length}>
                      <span style={{ writingMode: 'vertical-rl' }}>B.R.E.A.K.</span>
                    </td>
                  );
                }

                const entry = entryByCell.get(timetableCellKey(day, slot.id));
                const selectedSubject = entry?.subjectId
                  ? subjectById.get(entry.subjectId)
                  : undefined;
                const subjectName = entry?.subjectName ?? selectedSubject?.name ?? null;
                const subjectColour =
                  entry?.subjectColour ?? selectedSubject?.colour ?? (subjectName ? 'Grey' : null);

                return (
                  <td
                    className={styles.lessonCell}
                    data-colour={subjectColour ?? 'Unassigned'}
                    key={slot.id}
                  >
                    {editable ? (
                      <select
                        disabled={!onSubjectChange}
                        aria-label={`${day} ${slot.label}`}
                        onChange={(event) => {
                          onSubjectChange?.(day, slot.id, event.target.value);
                        }}
                        value={entry?.subjectId ?? ''}
                      >
                        <option value="">Unassigned</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <strong>{subjectName ?? '—'}</strong>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
