import type { RouterOutputs } from '@/lib/trpc';

export type ManagedClub = RouterOutputs['club']['list'][number];
export type ClubSchedule = NonNullable<ManagedClub['schedule']>;

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toTimeValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function fromTimeValue(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

export function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function nextScheduledDate(club: ManagedClub): string {
  if (!club.schedule) return todayKey();
  const start = dateFromKey(club.schedule.startDate);
  const today = dateFromKey(todayKey());
  if (start.getTime() >= today.getTime()) return club.schedule.startDate;

  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  const weeksSinceStart = Math.ceil(daysSinceStart / 7);
  return dateKey(addDays(start, weeksSinceStart * 7));
}

export function asDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

export function formatDateLabel(date: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(
    typeof date === 'string' ? dateFromKey(date) : date,
  );
}

export function formatTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
