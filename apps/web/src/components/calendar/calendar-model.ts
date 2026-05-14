import type { RouterOutputs } from '@/lib/trpc';

export type CalendarEvent = RouterOutputs['calendar']['listForAdmin'][number];
export type CalendarAudience = CalendarEvent['audience'];
export type CalendarCategory = CalendarEvent['category'];
export type CalendarMode = 'admin' | 'supervisor' | 'parent';
export type CalendarSelectionMode = 'single' | 'range';

export interface CalendarFormState {
  title: string;
  description: string;
  audience: CalendarAudience;
  category: Exclude<CalendarCategory, 'Birthdays'>;
  requiredPersonIds: string[];
  selectionMode: CalendarSelectionMode;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

export interface CalendarMonthDay {
  key: string;
  dayNumber: number;
  currentMonth: boolean;
  today: boolean;
  events: CalendarEvent[];
}

export const audienceLabels: Record<CalendarAudience, string> = {
  All: 'All portals',
  Parents: 'Parents',
  Supervisors: 'Supervisors',
  Heads: 'Heads only',
  Custom: 'Tagged people only',
};

export const categoryLabels: Record<CalendarCategory, string> = {
  HalfTerm: 'Half term',
  Trips: 'Trips',
  OasisDays: 'Oasis days',
  Birthdays: 'Birthdays',
  Meetings: 'Meetings',
  Trainings: 'Trainings',
};

export const categoryClassNames: Record<CalendarCategory, string> = {
  HalfTerm: 'calendar-category--half-term',
  Trips: 'calendar-category--trips',
  OasisDays: 'calendar-category--oasis-days',
  Birthdays: 'calendar-category--birthdays',
  Meetings: 'calendar-category--meetings',
  Trainings: 'calendar-category--trainings',
};

export const editableCategories: readonly Exclude<CalendarCategory, 'Birthdays'>[] = [
  'HalfTerm',
  'Trips',
  'OasisDays',
  'Meetings',
  'Trainings',
];

export const legendCategories: readonly CalendarCategory[] = [
  'HalfTerm',
  'Trips',
  'OasisDays',
  'Birthdays',
  'Meetings',
  'Trainings',
];

export const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const pageCopy: Record<
  CalendarMode,
  {
    eyebrow: string;
    heading: string;
    listTitle: string;
    listDescription: string;
    loading: string;
    empty: string;
  }
> = {
  admin: {
    eyebrow: 'Centre calendar',
    heading: 'Key Dates',
    listTitle: 'Calendar Dates',
    listDescription: 'Published dates, ranges, and archived records.',
    loading: 'Loading calendar dates...',
    empty: 'No calendar dates have been added.',
  },
  supervisor: {
    eyebrow: 'Staff calendar',
    heading: 'Key Dates',
    listTitle: 'Supervisor Calendar',
    listDescription: 'Dates visible to supervisors and all portals.',
    loading: 'Loading supervisor dates...',
    empty: 'No supervisor dates are published.',
  },
  parent: {
    eyebrow: 'Family calendar',
    heading: 'Key Dates',
    listTitle: 'Parent Calendar',
    listDescription: 'Dates visible to parents and all portals.',
    loading: 'Loading parent dates...',
    empty: 'No parent dates are published.',
  },
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function emptyCalendarForm(): CalendarFormState {
  return {
    title: '',
    description: '',
    audience: 'All',
    category: 'OasisDays',
    requiredPersonIds: [],
    selectionMode: 'single',
    startDate: todayKey(),
    endDate: '',
    startTime: '',
    endTime: '',
  };
}

export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

export function addMonths(monthKey: string, amount: number): string {
  const [yearValue, monthValue] = monthKey.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);
  const next = new Date(Date.UTC(year, month - 1 + amount, 1));
  return dateKey(next).slice(0, 7);
}

export function formatMonthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(`${monthKey}-01`));
}

export function formatDateRange(event: Pick<CalendarEvent, 'endDate' | 'startDate'>): string {
  if (event.startDate === event.endDate) return formatDate(event.startDate);
  return `${formatDate(event.startDate)} to ${formatDate(event.endDate)}`;
}

export function formatEventSchedule(
  event: Pick<CalendarEvent, 'endDate' | 'endTime' | 'startDate' | 'startTime'>,
): string {
  const dateRange = formatDateRange(event);
  if (!event.startTime || !event.endTime) return dateRange;
  return `${dateRange}, ${event.startTime} to ${event.endTime}`;
}

export function eventDayLabel(event: Pick<CalendarEvent, 'endDate' | 'startDate'>): string {
  if (event.startDate !== event.endDate) return 'Range';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${event.startDate}T00:00:00.000Z`));
}

export function buildCalendarMonth(
  monthKey: string,
  events: readonly CalendarEvent[],
): CalendarMonthDay[] {
  const monthStart = dateFromKey(`${monthKey}-01`);
  const firstDayOffset = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - firstDayOffset);
  const today = todayKey();

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    const key = dateKey(day);

    return {
      key,
      dayNumber: day.getUTCDate(),
      currentMonth: key.startsWith(monthKey),
      today: key === today,
      events: events
        .filter((event) => event.active && event.startDate <= key && event.endDate >= key)
        .sort(
          (left, right) =>
            left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title),
        ),
    };
  });
}
