import type { RouterOutputs } from '@/lib/trpc';

export type CalendarEvent = RouterOutputs['calendar']['listForAdmin'][number];
export type CalendarAudience = CalendarEvent['audience'];
export type CalendarMode = 'admin' | 'supervisor' | 'parent';

export interface CalendarFormState {
  title: string;
  description: string;
  audience: CalendarAudience;
  startDate: string;
  endDate: string;
}

export const audienceLabels: Record<CalendarAudience, string> = {
  All: 'All portals',
  Parents: 'Parents',
  Supervisors: 'Supervisors',
};

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
    startDate: todayKey(),
    endDate: '',
  };
}

export function formatDateRange(event: Pick<CalendarEvent, 'endDate' | 'startDate'>): string {
  if (event.startDate === event.endDate) return formatDate(event.startDate);
  return `${formatDate(event.startDate)} to ${formatDate(event.endDate)}`;
}

export function eventDayLabel(event: Pick<CalendarEvent, 'endDate' | 'startDate'>): string {
  if (event.startDate !== event.endDate) return 'Range';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${event.startDate}T00:00:00.000Z`));
}
