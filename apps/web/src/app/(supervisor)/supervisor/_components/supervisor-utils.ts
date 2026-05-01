export const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

const shortWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export type BehaviourType = 'Merit' | 'Demerit';
export type BehaviourVisibility = 'General' | 'Sensitive';
export type PaceTestType = 'SelfTest' | 'FinalTest';

export type AvailabilityDraft = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type DashboardMessageSummary = {
  id: string;
  subject: string;
  latestPreview: string;
  updatedAt: Date | null;
  unreadCount: number;
};

export type DashboardNoticeSummary = {
  id: string;
  title: string;
  bodyPreview: string;
  postedAt: Date | null;
  read: boolean;
};

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function asDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function mondayFor(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + offset);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toTimeValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function fromTimeValue(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? asDate(value) : value;
  const weekday = shortWeekdays[date.getUTCDay()] ?? '';
  const month = shortMonths[date.getUTCMonth()] ?? '';
  return `${weekday}, ${String(date.getUTCDate()).padStart(2, '0')} ${month}`;
}

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(value);
}

export function formatTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function formatShortDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export function formatShift(shift: {
  date: string;
  startsAt: Date;
  endsAt: Date;
  bandName: string | null;
}): string {
  return `${formatDate(shift.date)} · ${formatDateTime(shift.startsAt)}-${formatDateTime(shift.endsAt)} · ${
    shift.bandName ?? 'Unassigned band'
  }`;
}

export function dayLabel(date: Date): string {
  return shortWeekdays[date.getUTCDay()] ?? '';
}

export function dayNumber(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')} ${shortMonths[date.getUTCMonth()] ?? ''}`;
}

export function isSameDay(left: Date, right: Date): boolean {
  return dateKey(left) === dateKey(right);
}

export function messageDashboardAdapter(): DashboardMessageSummary[] {
  return [];
}

export function noticeDashboardAdapter(): DashboardNoticeSummary[] {
  return [];
}

export function emptyAvailabilityRow(): AvailabilityDraft {
  return {
    id: `draft_${String(Date.now())}_${Math.random().toString(36).slice(2)}`,
    dayOfWeek: 1,
    startMinute: 540,
    endMinute: 720,
  };
}
