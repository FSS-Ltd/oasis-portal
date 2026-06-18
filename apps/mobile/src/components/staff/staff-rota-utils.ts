export type RotaMode = 'today' | 'week' | 'month';

export type AvailabilityDraft = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type MonthlyAvailabilityDraft = {
  id: string;
  date: string;
  startMinute: number;
  endMinute: number;
};

export const weekdays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const;

const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
  weekday: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + offset);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function monthRange(month: string): { from: Date; to: Date } {
  const [yearValue = '1970', monthValue = '01'] = month.split('-');
  const year = Number(yearValue);
  const monthIndex = Number(monthValue) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 0)),
  };
}

export function currentMonthKey(): string {
  return dateKey(new Date()).slice(0, 7);
}

export function firstDateForMonth(month: string): string {
  return `${month}-01`;
}

export function formatMonth(month: string): string {
  return monthFormatter.format(dateFromKey(firstDateForMonth(month)));
}

export function formatDate(value: string): string {
  return dateFormatter.format(dateFromKey(value));
}

export function formatTime(value: string | Date): string {
  return timeFormatter.format(new Date(value));
}

export function toTimeValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function fromTimeValue(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

export function availabilityLabel(window: {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}): string {
  const day = weekdays.find((item) => item.value === window.dayOfWeek)?.label ?? 'Day';
  return `${day} ${toTimeValue(window.startMinute)}-${toTimeValue(window.endMinute)}`;
}

export function monthlyAvailabilityLabel(window: {
  date: string;
  startMinute: number;
  endMinute: number;
}): string {
  if (window.startMinute === 0 && window.endMinute === 1440) {
    return `${formatDate(window.date)} all day`;
  }
  return `${formatDate(window.date)} ${toTimeValue(window.startMinute)}-${toTimeValue(
    window.endMinute,
  )}`;
}

export function newAvailabilityDraft(): AvailabilityDraft {
  return {
    id: `draft_${String(Date.now())}`,
    dayOfWeek: 1,
    startMinute: 540,
    endMinute: 720,
  };
}

export function newMonthlyAvailabilityDraft(month: string): MonthlyAvailabilityDraft {
  return {
    id: `draft_${String(Date.now())}`,
    date: firstDateForMonth(month),
    startMinute: 0,
    endMinute: 1440,
  };
}
