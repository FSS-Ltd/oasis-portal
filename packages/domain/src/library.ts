import { z } from 'zod';

export const LIBRARY_REMINDER_STAGES = ['DueInTwoDays', 'DueToday', 'OverdueOneDay'] as const;
export type LibraryReminderStage = (typeof LIBRARY_REMINDER_STAGES)[number];

const LONDON_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function libraryLondonDateKey(value: Date): string {
  const parts = LONDON_DATE_FORMATTER.formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const year = byType.get('year');
  const month = byType.get('month');
  const day = byType.get('day');
  if (!year || !month || !day) throw new Error('Could not resolve a London calendar date');
  return `${year}-${month}-${day}`;
}

function calendarDayNumber(value: string): number {
  return Math.floor(Date.parse(`${value}T00:00:00.000Z`) / 86_400_000);
}

export const libraryBarcodeSchema = z
  .string()
  .trim()
  .regex(/^\d{1,64}$/u, 'Barcode must contain digits only');

export const libraryBookDraftSchema = z.object({
  author: z.string().trim().min(1, 'Enter the author').max(200),
  barcode: libraryBarcodeSchema,
  cover: z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
    storageBucket: z.string().trim().min(1).max(120),
    storagePath: z.string().trim().min(1).max(1024),
  }),
  title: z.string().trim().min(1, 'Enter the title').max(200),
});

export const libraryCheckoutSchema = z.object({
  barcode: libraryBarcodeSchema,
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Enter a valid due date'),
  studentId: z.string().cuid(),
});

export function libraryReminderStageFor(dueOn: Date, asOf: Date): LibraryReminderStage | null {
  const daysUntilDue =
    calendarDayNumber(dueOn.toISOString().slice(0, 10)) -
    calendarDayNumber(libraryLondonDateKey(asOf));
  if (daysUntilDue === 2) return 'DueInTwoDays';
  if (daysUntilDue === 0) return 'DueToday';
  if (daysUntilDue === -1) return 'OverdueOneDay';
  return null;
}
