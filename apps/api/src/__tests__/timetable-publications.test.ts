import { describe, expect, it } from 'vitest';
import {
  buildPublicationEntries,
  requireUnassignedAcknowledgement,
} from '../services/timetable-publications.js';

const slots = [
  {
    id: 'slot_lesson',
    position: 0,
    kind: 'Lesson' as const,
    label: 'Lesson 1',
    startMinutes: 540,
    endMinutes: 570,
  },
  {
    id: 'slot_break',
    position: 1,
    kind: 'Break' as const,
    label: 'Break',
    startMinutes: 570,
    endMinutes: 600,
  },
];

describe('buildPublicationEntries', () => {
  it('snapshots every Tuesday-Friday slot while leaving unassigned lessons empty', () => {
    const result = buildPublicationEntries(slots, [
      {
        day: 'Tuesday',
        slotId: 'slot_lesson',
        subjectId: 'subject_math',
        subject: { id: 'subject_math', name: 'Mathematics', timetableColour: 'Yellow' },
      },
    ]);

    expect(result.entries).toHaveLength(8);
    expect(result.unassignedLessonCount).toBe(3);
    expect(result.entries[0]).toEqual({
      day: 'Tuesday',
      slotPosition: 0,
      slotKind: 'Lesson',
      slotLabel: 'Lesson 1',
      startMinutes: 540,
      endMinutes: 570,
      subjectId: 'subject_math',
      subjectName: 'Mathematics',
      subjectColour: 'Yellow',
    });
    expect(result.entries[1]).toMatchObject({
      day: 'Tuesday',
      slotKind: 'Break',
      subjectId: null,
      subjectName: null,
      subjectColour: null,
    });
    expect(result.entries[2]).toMatchObject({
      day: 'Wednesday',
      slotKind: 'Lesson',
      subjectName: null,
    });
  });
});

describe('requireUnassignedAcknowledgement', () => {
  it('requires acknowledgement only when lesson periods are empty', () => {
    expect(() => {
      requireUnassignedAcknowledgement(3, false);
    }).toThrow('3 lesson periods have no subject');
    expect(() => {
      requireUnassignedAcknowledgement(3, true);
    }).not.toThrow();
    expect(() => {
      requireUnassignedAcknowledgement(0, false);
    }).not.toThrow();
  });
});
