import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPublishedEntriesToCurrentLessonSlots } from '../src/components/timetable/timetable-version-mapping.ts';

test('maps a published lesson to the current lesson when breaks moved', () => {
  const entries = mapPublishedEntriesToCurrentLessonSlots(
    [
      { day: 'Tuesday', slotKind: 'Lesson', slotPosition: 0, subjectId: 'subject_reading' },
      { day: 'Tuesday', slotKind: 'Break', slotPosition: 1, subjectId: null },
      { day: 'Tuesday', slotKind: 'Lesson', slotPosition: 2, subjectId: 'subject_math' },
    ],
    [
      { id: 'break_arrival', kind: 'Break', position: 0 },
      { id: 'lesson_reading', kind: 'Lesson', position: 1 },
      { id: 'break_midmorning', kind: 'Break', position: 2 },
      { id: 'lesson_math', kind: 'Lesson', position: 3 },
    ],
  );

  assert.deepEqual(entries, [
    { day: 'Tuesday', slotId: 'lesson_reading', subjectId: 'subject_reading' },
    { day: 'Tuesday', slotId: 'lesson_math', subjectId: 'subject_math' },
  ]);
});
