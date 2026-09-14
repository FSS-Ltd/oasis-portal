import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  createAndAssignTimetableSubject,
  customSubjectCodeBase,
  saveStudentTimetableDraft,
} from '../services/timetable-data.js';

const head: SessionUser = { id: 'head_1', role: 'Head', tags: [], requires2fa: false };

describe('customSubjectCodeBase', () => {
  it('creates a stable catalogue code that fits the existing 20-character boundary', () => {
    expect(customSubjectCodeBase(' French conversation ')).toBe('CUSTOM-FRENCH-CONVER');
    expect(customSubjectCodeBase('Art & Design')).toBe('CUSTOM-ART-DESIGN');
    expect(customSubjectCodeBase('日本語')).toBe('CUSTOM-SUBJECT');
  });
});

describe('createAndAssignTimetableSubject', () => {
  it('uses the canonical colour when an added subject has a recognised name', async () => {
    const db = {
      student: { findFirst: vi.fn().mockResolvedValue({ id: 'student_1' }) },
      subject: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(({ data }) => Promise.resolve({ id: 'subject_1', active: true, ...data })),
      },
      studentSubject: { upsert: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const ctx = {
      db: {},
      user: head,
      withRls: (operation: (tx: never) => Promise<unknown>) => operation(db as never),
    } as unknown as AppContext & { user: SessionUser };

    await expect(
      createAndAssignTimetableSubject(ctx, { studentId: 'student_1', name: 'Maths' }),
    ).resolves.toMatchObject({ colour: 'Yellow' });
    expect(db.subject.create).toHaveBeenCalledWith({
      data: {
        code: 'CUSTOM-MATHS',
        name: 'Maths',
        timetableColour: 'Yellow',
      },
    });
  });
});

describe('saveStudentTimetableDraft', () => {
  it('rejects a draft from an outdated shared timetable before replacing the child entries', async () => {
    const db = {
      calendarEvent: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'calendar-2026-27-term-1-start', startDate: new Date('2026-09-08T00:00:00.000Z') },
          { id: 'calendar-2026-27-term-1-end', startDate: new Date('2026-10-16T00:00:00.000Z') },
        ]),
      },
    };
    const tx = {
      student: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'student_1',
          ageBandId: 'band_primary',
          followsOwnTimetable: false,
          subjects: [],
        }),
      },
      timetableAgeGroupSchedule: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'schedule_current',
          updatedAt: new Date('2026-09-14T15:00:00.000Z'),
          slots: [{ id: 'slot_lesson', kind: 'Lesson' }],
        }),
      },
    };
    const ctx = {
      db,
      user: head,
      withRls: (operation: (database: never) => Promise<unknown>) => operation(tx as never),
    } as unknown as AppContext & { user: SessionUser };
    const staleDraft = {
      studentId: 'student_1',
      termKey: '2026-27-term-1',
      scheduleId: 'schedule_previous',
      scheduleUpdatedAt: new Date('2026-09-14T14:00:00.000Z'),
      entries: [],
    };

    await expect(saveStudentTimetableDraft(ctx, staleDraft)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'The shared timetable changed. Refresh before saving this child’s timetable.',
    });
  });

  it('moves entries from a legacy timetable schedule onto the current age-band lesson slots', async () => {
    const db = {
      calendarEvent: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'calendar-2026-27-term-1-start', startDate: new Date('2026-09-08T00:00:00.000Z') },
          { id: 'calendar-2026-27-term-1-end', startDate: new Date('2026-10-16T00:00:00.000Z') },
        ]),
      },
    };
    const tx = {
      student: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'student_1',
          ageBandId: 'band_primary',
          followsOwnTimetable: false,
          subjects: [{ subjectId: 'subject_math' }],
        }),
      },
      timetableAgeGroupSchedule: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'schedule_current',
          updatedAt: new Date('2026-09-14T15:00:00.000Z'),
          slots: [
            { id: 'current_lesson_1', kind: 'Lesson', position: 0 },
            { id: 'current_break', kind: 'Break', position: 1 },
            { id: 'current_lesson_2', kind: 'Lesson', position: 2 },
          ],
        }),
      },
      studentTimetable: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'timetable_1',
          scheduleId: 'schedule_legacy',
          schedule: {
            slots: [
              { id: 'legacy_lesson_1', kind: 'Lesson', position: 0 },
              { id: 'legacy_break', kind: 'Break', position: 1 },
              { id: 'legacy_lesson_2', kind: 'Lesson', position: 2 },
              { id: 'legacy_lesson_3', kind: 'Lesson', position: 3 },
            ],
          },
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'timetable_1' }),
      },
      studentTimetableEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const ctx = {
      db,
      user: head,
      withRls: (operation: (database: never) => Promise<unknown>) => operation(tx as never),
    } as unknown as AppContext & { user: SessionUser };

    await expect(
      saveStudentTimetableDraft(ctx, {
        studentId: 'student_1',
        termKey: '2026-27-term-1',
        scheduleId: 'schedule_current',
        scheduleUpdatedAt: new Date('2026-09-14T15:00:00.000Z'),
        entries: [
          { day: 'Tuesday', slotId: 'legacy_lesson_2', subjectId: 'subject_math' },
          { day: 'Wednesday', slotId: 'legacy_lesson_3', subjectId: 'subject_math' },
        ],
      }),
    ).resolves.toMatchObject({
      entries: [{ day: 'Tuesday', slotId: 'current_lesson_2', subjectId: 'subject_math' }],
    });

    expect(tx.studentTimetableEntry.createMany).toHaveBeenCalledWith({
      data: [{ day: 'Tuesday', slotId: 'current_lesson_2', subjectId: 'subject_math', timetableId: 'timetable_1' }],
    });
  });
});
