import type { RealtimeArea } from './events.js';

/** Query families whose current-day windows or due-state can change without a write. */
export const REALTIME_CLOCK_AREAS = [
  'attendance',
  'behaviour',
  'childLog',
  'pace',
  'rota',
  'calendar',
  'timetable',
  'studentSettings',
  'report',
  'staffHome',
  'library',
  'leaderboard',
  'shop',
  'homework',
  'student',
  'personalTask',
  'invoice',
  'permissionSlip',
  'club',
  'investment',
] as const satisfies readonly RealtimeArea[];

const londonDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const londonOffset = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  timeZoneName: 'shortOffset',
});

/** A calendar deadline, including 23/25-hour days; callers use a one-shot timer. */
export function nextLondonMidnight(now: Date = new Date()): Date {
  const parts = londonDate.formatToParts(now);
  const field = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const nominalMidnight = new Date(Date.UTC(field('year'), field('month') - 1, field('day') + 1));
  const offsetName =
    londonOffset.formatToParts(nominalMidnight).find((part) => part.type === 'timeZoneName')
      ?.value ?? 'GMT';
  const offset = /GMT([+-])(\d{1,2})(?::(\d{2}))?/u.exec(offsetName);
  const offsetMinutes = offset
    ? (offset[1] === '+' ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0))
    : 0;
  return new Date(nominalMidnight.getTime() - offsetMinutes * 60_000);
}
