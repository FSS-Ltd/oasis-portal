import { TIMETABLE_DAYS } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';
import { formatTermDates } from './timetable-format';
import { TimetableGrid, type TimetableGridEntry, type TimetableGridSlot } from './timetable-grid';
import styles from './timetable.module.css';

type Publication = NonNullable<RouterOutputs['timetable']['publishedForStudent']>;

interface PublishedTimetableViewProps {
  publication: Publication;
}

function publicationSlots(publication: Publication): TimetableGridSlot[] {
  const firstDay = publication.entries.filter((entry) => entry.day === TIMETABLE_DAYS[0]);
  const source = firstDay.length > 0 ? firstDay : publication.entries;
  const positions = new Set<number>();

  return source.flatMap((entry) => {
    if (positions.has(entry.slotPosition)) return [];
    positions.add(entry.slotPosition);
    return [
      {
        id: `slot-${String(entry.slotPosition)}`,
        position: entry.slotPosition,
        kind: entry.slotKind,
        label: entry.slotLabel,
        startMinutes: entry.startMinutes,
        endMinutes: entry.endMinutes,
      },
    ];
  });
}

export function PublishedTimetableView({ publication }: PublishedTimetableViewProps) {
  const slots = publicationSlots(publication);
  const entries: TimetableGridEntry[] = publication.entries.map((entry) => ({
    day: entry.day,
    slotId: `slot-${String(entry.slotPosition)}`,
    subjectId: entry.subjectId,
    subjectName: entry.subjectName,
    subjectColour: entry.subjectColour,
  }));

  return (
    <article className={styles.publishedCard}>
      <header className={styles.publishedHeader}>
        <div>
          <p>Oasis Learning Centre timetable</p>
          <h2>{publication.studentFirstName}</h2>
        </div>
        <div className={styles.publishedMeta}>
          <strong>{publication.termLabel}</strong>
          <span>{publication.registrationLevel}</span>
          <small>{formatTermDates(publication.termStartsOn, publication.termEndsOn)}</small>
        </div>
      </header>
      <TimetableGrid entries={entries} slots={slots} />
    </article>
  );
}
