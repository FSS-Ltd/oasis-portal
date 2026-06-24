import type { RouterOutputs } from '../../lib/trpc';

export type ParentCalendarEvent = RouterOutputs['calendar']['listVisible'][number];
export type ParentCalendarAudience = ParentCalendarEvent['audience'];
export type ParentCalendarCategory = ParentCalendarEvent['category'];

export const parentCalendarAudienceLabels = {
  All: 'All portals',
  Custom: 'Tagged people only',
  Heads: 'Heads only',
  Parents: 'Parents',
  Supervisors: 'Supervisors',
} as const satisfies Record<ParentCalendarAudience, string>;

export const parentCalendarCategoryLabels = {
  Birthdays: 'Birthdays',
  HalfTerm: 'Half term',
  Meetings: 'Meetings',
  OasisDays: 'Oasis days',
  TheCedars: 'The Cedars',
  Trainings: 'Trainings',
  Trips: 'Trips',
} as const satisfies Record<ParentCalendarCategory, string>;

export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function formatMonthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

export function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatDateRange(
  event: Pick<ParentCalendarEvent, 'endDate' | 'startDate'>,
): string {
  if (event.startDate === event.endDate) return formatCalendarDate(event.startDate);
  return `${formatCalendarDate(event.startDate)} to ${formatCalendarDate(event.endDate)}`;
}

export function formatEventSchedule(
  event: Pick<ParentCalendarEvent, 'endDate' | 'endTime' | 'startDate' | 'startTime'>,
): string {
  const dateRange = formatDateRange(event);
  if (!event.startTime || !event.endTime) return dateRange;
  return `${dateRange}, ${event.startTime} to ${event.endTime}`;
}

export function eventDayLabel(event: Pick<ParentCalendarEvent, 'endDate' | 'startDate'>): string {
  if (event.startDate !== event.endDate) return 'Range';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${event.startDate}T00:00:00.000Z`));
}

export function eventOverlapsMonth(
  event: Pick<ParentCalendarEvent, 'endDate' | 'startDate'>,
  monthKey: string,
): boolean {
  const [yearValue, monthValue] = monthKey.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);
  const firstDate = `${monthKey}-01`;
  const lastDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return event.startDate <= lastDate && event.endDate >= firstDate;
}

export function upcomingCalendarEvents(
  events: readonly ParentCalendarEvent[],
): ParentCalendarEvent[] {
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((event) => event.active && event.endDate >= today)
    .sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title),
    );
}

export function monthCalendarEvents(
  events: readonly ParentCalendarEvent[],
  monthKey: string,
): ParentCalendarEvent[] {
  return events
    .filter((event) => event.active && eventOverlapsMonth(event, monthKey))
    .sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title),
    );
}
