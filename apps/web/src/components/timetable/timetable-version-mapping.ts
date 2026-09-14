import { TIMETABLE_DAYS, type TimetableDay, type TimetableSlotKind } from '@oasis/domain';

interface PublishedTimetableEntry {
  day: TimetableDay;
  slotKind: TimetableSlotKind;
  slotPosition: number;
  subjectId: string | null;
}

interface CurrentTimetableSlot {
  id: string;
  kind: TimetableSlotKind;
  position: number;
}

interface DraftTimetableEntry {
  day: TimetableDay;
  slotId: string;
  subjectId: string;
}

export function mapPublishedEntriesToCurrentLessonSlots(
  publishedEntries: readonly PublishedTimetableEntry[],
  currentSlots: readonly CurrentTimetableSlot[],
): DraftTimetableEntry[] {
  const currentLessonSlots = [...currentSlots]
    .filter((slot) => slot.kind === 'Lesson')
    .sort((left, right) => left.position - right.position);

  return TIMETABLE_DAYS.flatMap((day) => {
    const publishedLessons = publishedEntries
      .filter((entry) => entry.day === day && entry.slotKind === 'Lesson')
      .sort((left, right) => left.slotPosition - right.slotPosition);

    return publishedLessons.flatMap((entry, lessonIndex) => {
      const currentSlot = currentLessonSlots[lessonIndex];
      if (!currentSlot || !entry.subjectId) return [];
      return [{ day, slotId: currentSlot.id, subjectId: entry.subjectId }];
    });
  });
}
