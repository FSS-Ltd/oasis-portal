import { describe, expect, it } from 'vitest';
import {
  IncompleteTeachingTermError,
  TeachingTermNotFoundError,
  loadTeachingTerms,
  requireTeachingTerm,
  type TimetableTermDb,
} from '../services/timetable-terms.js';

function event(id: string, date: string) {
  return { id, startDate: new Date(`${date}T00:00:00.000Z`) };
}

function termDb(rows: ReturnType<typeof event>[]): TimetableTermDb {
  return {
    calendarEvent: {
      findMany: () => Promise.resolve(rows),
    },
  };
}

describe('loadTeachingTerms', () => {
  it('pairs and sorts active program-owned calendar boundaries', async () => {
    const db = termDb([
      event('calendar-2026-27-term-2-end', '2026-12-18'),
      event('calendar-2026-27-term-1-start', '2026-09-08'),
      event('calendar-2026-27-autumn-half-term', '2026-10-17'),
      event('calendar-2026-27-term-1-end', '2026-10-16'),
      event('calendar-2026-27-term-2-start', '2026-11-03'),
    ]);

    expect(await loadTeachingTerms(db)).toEqual([
      {
        key: '2026-27-term-1',
        academicYearLabel: '2026/27',
        number: 1,
        label: 'Term 1',
        startsOn: new Date('2026-09-08T00:00:00.000Z'),
        endsOn: new Date('2026-10-16T00:00:00.000Z'),
      },
      {
        key: '2026-27-term-2',
        academicYearLabel: '2026/27',
        number: 2,
        label: 'Term 2',
        startsOn: new Date('2026-11-03T00:00:00.000Z'),
        endsOn: new Date('2026-12-18T00:00:00.000Z'),
      },
    ]);
  });

  it('keeps incomplete terms out of the normal list', async () => {
    const db = termDb([event('calendar-2026-27-term-1-start', '2026-09-08')]);
    expect(await loadTeachingTerms(db)).toEqual([]);
  });
});

describe('requireTeachingTerm', () => {
  it('distinguishes an incomplete selected term from an unknown key', async () => {
    const db = termDb([event('calendar-2026-27-term-1-start', '2026-09-08')]);

    await expect(requireTeachingTerm(db, '2026-27-term-1')).rejects.toBeInstanceOf(
      IncompleteTeachingTermError,
    );
    await expect(requireTeachingTerm(db, '2026-27-term-2')).rejects.toBeInstanceOf(
      TeachingTermNotFoundError,
    );
  });
});
