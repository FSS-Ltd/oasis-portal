import { z } from 'zod';
import { REGISTRATION_LEVEL_OPTIONS } from './registration.js';

export const TIMETABLE_DAYS = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type TimetableDay = (typeof TIMETABLE_DAYS)[number];

export const REGISTRATION_LEVELS = REGISTRATION_LEVEL_OPTIONS;
export type TimetableRegistrationLevel = (typeof REGISTRATION_LEVELS)[number];

export const TIMETABLE_SLOT_KINDS = ['Lesson', 'Break'] as const;
export type TimetableSlotKind = (typeof TIMETABLE_SLOT_KINDS)[number];

export const TIMETABLE_COLOURS = [
  'Yellow',
  'Red',
  'PaleRed',
  'Purple',
  'DarkBlue',
  'LightBlue',
  'Green',
  'Brown',
  'Grey',
] as const;
export type TimetableColour = (typeof TIMETABLE_COLOURS)[number];

export const timetableSlotInputSchema = z
  .object({
    kind: z.enum(TIMETABLE_SLOT_KINDS),
    label: z.string().trim().min(1, 'Enter a slot label').max(50),
    startMinutes: z.number().int().min(0).max(1_439),
    endMinutes: z.number().int().min(1).max(1_440),
  })
  .strict();

export type TimetableSlotInput = z.infer<typeof timetableSlotInputSchema>;

export const timetableScheduleInputSchema = z
  .object({
    slots: z.array(timetableSlotInputSchema).min(1, 'Add at least one timetable slot').max(16),
  })
  .strict();

export const timetableEntryInputSchema = z
  .object({
    day: z.enum(TIMETABLE_DAYS),
    slotId: z.string().trim().min(1),
    subjectId: z.string().trim().min(1),
  })
  .strict();

export type TimetableEntryInput = z.infer<typeof timetableEntryInputSchema>;

export interface TimetableScheduleIssue {
  position: number;
  message: string;
}

export const DEFAULT_TIMETABLE_SLOTS: readonly TimetableSlotInput[] = [
  { kind: 'Lesson', label: 'Lesson 1', startMinutes: 9 * 60, endMinutes: 9 * 60 + 30 },
  { kind: 'Lesson', label: 'Lesson 2', startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 },
  { kind: 'Break', label: 'Break', startMinutes: 10 * 60, endMinutes: 10 * 60 + 30 },
  {
    kind: 'Lesson',
    label: 'Lesson 3',
    startMinutes: 10 * 60 + 30,
    endMinutes: 10 * 60 + 50,
  },
  {
    kind: 'Lesson',
    label: 'Lesson 4',
    startMinutes: 10 * 60 + 50,
    endMinutes: 11 * 60 + 30,
  },
  {
    kind: 'Break',
    label: 'Break',
    startMinutes: 11 * 60 + 30,
    endMinutes: 11 * 60 + 40,
  },
  {
    kind: 'Lesson',
    label: 'Lesson 5',
    startMinutes: 11 * 60 + 40,
    endMinutes: 12 * 60 + 30,
  },
] as const;

export function timetableColourForSubject(subject: {
  code: string;
  name: string;
}): TimetableColour {
  const code = subject.code.trim().toUpperCase();
  const name = subject.name.trim().toLowerCase();

  if (code === 'MATH' || /\bmath(?:s|ematics)?\b/.test(name)) return 'Yellow';
  if (code === 'ENG' || /\benglish\b/.test(name)) return 'Red';
  if (code === 'LIT' || /\bliterature\b/.test(name)) return 'PaleRed';
  if (code === 'WB' || /word\s*building/.test(name)) return 'Purple';
  if (code === 'ANSCI' || /animal\s*science/.test(name)) return 'LightBlue';
  if (code === 'SCI' || /\bscience\b/.test(name)) return 'DarkBlue';
  if (code === 'SOC' || /social\s*studies/.test(name)) return 'Green';
  if (code === 'BIBLE' || /bible\s*studies/.test(name)) return 'Brown';
  return 'Grey';
}

export function findScheduleIssues(slots: readonly TimetableSlotInput[]): TimetableScheduleIssue[] {
  const issues: TimetableScheduleIssue[] = [];

  slots.forEach((slot, position) => {
    if (!slot.label.trim()) issues.push({ position, message: 'Enter a slot label' });
    if (slot.endMinutes <= slot.startMinutes) {
      issues.push({ position, message: 'End time must be after start time' });
    }
    const previous = slots[position - 1];
    if (previous && slot.startMinutes < previous.endMinutes) {
      issues.push({ position, message: 'Starts before the previous slot ends' });
    }
  });

  return issues;
}

export function countTimetableProgress(
  activeStudentIds: readonly string[],
  publishedStudentIds: readonly string[],
): { done: number; total: number } {
  const active = new Set(activeStudentIds);
  const published = new Set(publishedStudentIds.filter((studentId) => active.has(studentId)));
  return { done: published.size, total: active.size };
}

export function firstNameFromFullName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'Student';
}

export function timetableReminderAt(termStartsOn: Date): Date {
  const reminder = new Date(
    Date.UTC(
      termStartsOn.getUTCFullYear(),
      termStartsOn.getUTCMonth(),
      termStartsOn.getUTCDate() - 7,
      9,
    ),
  );
  return reminder;
}
