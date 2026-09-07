import { describe, expect, it } from 'vitest';
import {
  syncTimetableTasks,
  type StoredTimetableTask,
  type TimetableTaskDb,
} from '../services/timetable-tasks.js';

function calendarEvent(id: string, date: string) {
  return { id, startDate: new Date(`${date}T00:00:00.000Z`) };
}

function fakeTaskDb() {
  const heads = [{ id: 'head_1' }, { id: 'head_2' }];
  const memberships = [{ studentId: 'student_1' }, { studentId: 'student_2' }];
  const publications = [
    { studentId: 'student_1', termKey: '2026-27-term-1' },
    { studentId: 'student_1', termKey: '2026-27-term-1' },
    { studentId: 'student_1', termKey: '2026-27-term-2' },
    { studentId: 'student_2', termKey: '2026-27-term-2' },
  ];
  const tasks = new Map<string, StoredTimetableTask>();
  const events = [
    calendarEvent('calendar-2026-27-term-1-start', '2026-09-08'),
    calendarEvent('calendar-2026-27-term-1-end', '2026-10-16'),
    calendarEvent('calendar-2026-27-term-2-start', '2026-11-03'),
    calendarEvent('calendar-2026-27-term-2-end', '2026-12-18'),
  ];

  const db: TimetableTaskDb = {
    calendarEvent: { findMany: () => Promise.resolve(events) },
    user: { findMany: () => Promise.resolve(heads) },
    timetableAgeGroupMembership: { findMany: () => Promise.resolve(memberships) },
    studentTimetablePublication: { findMany: () => Promise.resolve(publications) },
    personalTask: {
      upsert: ({ where, create, update }) => {
        const key = `${where.ownerId_timetableTermKey.ownerId}:${where.ownerId_timetableTermKey.timetableTermKey}`;
        const current = tasks.get(key);
        const next = current ? { ...current, ...update } : { ...create };
        tasks.set(key, next);
        return Promise.resolve(next);
      },
    },
  };
  return { db, heads, memberships, publications, tasks };
}

describe('syncTimetableTasks', () => {
  it('can scope updates to the Head represented by the current RLS transaction', async () => {
    const fixture = fakeTaskDb();

    await syncTimetableTasks({
      db: fixture.db,
      headIds: ['head_2'],
      asOf: new Date('2026-09-04T22:00:00.000Z'),
    });

    expect([...fixture.tasks.keys()]).toEqual(['head_2:2026-27-term-1', 'head_2:2026-27-term-2']);
  });

  it('deduplicates Head tasks, shows live progress, completes, and reopens them', async () => {
    const fixture = fakeTaskDb();
    const asOf = new Date('2026-09-04T22:00:00.000Z');

    await expect(syncTimetableTasks({ db: fixture.db, asOf })).resolves.toEqual({
      heads: 2,
      terms: 2,
      updated: 4,
    });
    await syncTimetableTasks({ db: fixture.db, asOf });
    expect(fixture.tasks).toHaveLength(4);

    expect(fixture.tasks.get('head_1:2026-27-term-1')).toMatchObject({
      title: 'Complete Term 1 timetables · 1/2 done',
      dueAt: new Date('2026-09-01T09:00:00.000Z'),
      reminderAt: new Date('2026-09-01T09:00:00.000Z'),
      completedAt: null,
    });
    expect(fixture.tasks.get('head_1:2026-27-term-2')?.completedAt).toEqual(asOf);

    fixture.memberships.push({ studentId: 'student_3' });
    await syncTimetableTasks({ db: fixture.db, asOf: new Date('2026-09-05T09:00:00.000Z') });
    expect(fixture.tasks.get('head_1:2026-27-term-2')).toMatchObject({
      title: 'Complete Term 2 timetables · 2/3 done',
      completedAt: null,
    });
  });
});
