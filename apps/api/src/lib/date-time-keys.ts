import { TRPCError } from '@trpc/server';

export function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function dateFromKey(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateKey(date) !== value) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter a valid date' });
  }
  return date;
}

export function todayKey(now = new Date()): string {
  return dateKey(now);
}

export function minutesFromTime(value: string): number {
  const [hoursValue, minutesValue] = value.split(':');
  return Number(hoursValue) * 60 + Number(minutesValue);
}

export function timeFromMinutes(value: number | null): string | null {
  if (value === null) return null;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
