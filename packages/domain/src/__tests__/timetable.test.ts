import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMETABLE_SLOTS,
  TIMETABLE_DAYS,
  countTimetableProgress,
  findScheduleIssues,
  firstNameFromFullName,
  timetableColourForSubject,
  timetableReminderAt,
  timetableScheduleInputSchema,
  type TimetableSlotInput,
} from '../timetable.js';

describe('timetable defaults', () => {
  it('uses Tuesday through Friday and the supplied default sequence', () => {
    expect(TIMETABLE_DAYS).toEqual(['Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(
      DEFAULT_TIMETABLE_SLOTS.map(({ kind, startMinutes, endMinutes }) => [
        kind,
        startMinutes,
        endMinutes,
      ]),
    ).toEqual([
      ['Lesson', 540, 570],
      ['Lesson', 570, 600],
      ['Break', 600, 630],
      ['Lesson', 630, 650],
      ['Lesson', 650, 690],
      ['Break', 690, 700],
      ['Lesson', 700, 750],
    ]);
  });
});

describe('timetableColourForSubject', () => {
  it.each([
    [{ code: 'MATH', name: 'Mathematics' }, 'Yellow'],
    [{ code: 'ENG', name: 'English' }, 'Red'],
    [{ code: 'LIT', name: 'Literature & Creative Writing' }, 'PaleRed'],
    [{ code: 'WB', name: 'Word Building' }, 'Purple'],
    [{ code: 'SCI', name: 'Science' }, 'DarkBlue'],
    [{ code: 'ANSCI', name: 'Animal Science' }, 'LightBlue'],
    [{ code: 'SOC', name: 'Social Studies' }, 'Green'],
    [{ code: 'BIBLE', name: 'Bible Studies' }, 'Brown'],
    [{ code: 'CUSTOM-FRENCH', name: 'French' }, 'Grey'],
    [{ code: 'CUSTOM-MATHS', name: 'Maths' }, 'Yellow'],
    [{ code: 'CUSTOM-ANIMAL', name: 'Animal Science' }, 'LightBlue'],
  ] as const)('maps $0 to $1', (subject, expected) => {
    expect(timetableColourForSubject(subject)).toBe(expected);
  });
});

describe('findScheduleIssues', () => {
  const base: TimetableSlotInput[] = [
    { kind: 'Lesson', label: 'Lesson 1', startMinutes: 540, endMinutes: 570 },
    { kind: 'Break', label: 'Break', startMinutes: 570, endMinutes: 600 },
  ];

  it('accepts breaks at any position and adjacent time ranges', () => {
    expect(findScheduleIssues(base)).toEqual([]);
  });

  it('reports blank labels, reversed times, and overlap at the affected position', () => {
    expect(
      findScheduleIssues([
        { kind: 'Lesson', label: 'Lesson 1', startMinutes: 540, endMinutes: 600 },
        { kind: 'Break', label: ' ', startMinutes: 590, endMinutes: 580 },
      ]),
    ).toEqual([
      { position: 1, message: 'Enter a slot label' },
      { position: 1, message: 'End time must be after start time' },
      { position: 1, message: 'Starts before the previous slot ends' },
    ]);
  });

  it('rejects an empty schedule at the input boundary', () => {
    expect(() => timetableScheduleInputSchema.parse({ slots: [] })).toThrow(
      'Add at least one timetable slot',
    );
  });
});

describe('timetable progress and child names', () => {
  it('counts only active children with a publication and ignores duplicate publications', () => {
    expect(
      countTimetableProgress(
        ['student-1', 'student-2'],
        ['student-2', 'student-2', 'inactive-student'],
      ),
    ).toEqual({ done: 1, total: 2 });
  });

  it('extracts a safe first name for timetable display', () => {
    expect(firstNameFromFullName('  Taleyah   Dolphy ')).toBe('Taleyah');
    expect(firstNameFromFullName('')).toBe('Student');
  });

  it('places the timetable task reminder seven UTC days before term start', () => {
    expect(timetableReminderAt(new Date('2026-09-08T00:00:00.000Z'))).toEqual(
      new Date('2026-09-01T09:00:00.000Z'),
    );
  });
});
