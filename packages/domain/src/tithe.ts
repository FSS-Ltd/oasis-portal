/**
 * Weekly tithe engine.
 *
 * Policy (Director mandate):
 *   - Weekly cadence: Friday 13:00 to Friday 13:00, Europe/London.
 *   - Percentage of GROSS merits earned in the period (10 | 15 | 20). Default 10.
 *   - Demerits do NOT reduce the tithe base (you tithe on what you earned).
 *   - Debits Spend, credits TithePaid.
 *   - Idempotent per (student, periodStart) via the TitheRun table.
 *
 * Only Parent or full-admin can change percentage; students cannot.
 */
import type { LedgerRow } from './meritLedger.js';

export const TITHE_PERCENTAGES = [10, 15, 20] as const;
export const TITHE_TIME_ZONE = 'Europe/London';
export const TITHE_WEEK_START_DAY = 5; // Friday, matching Date#getUTCDay.
export const TITHE_WEEK_START_HOUR = 13;
export type TithePercentage = (typeof TITHE_PERCENTAGES)[number];

interface LocalDateTimeParts {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  weekday: number;
  year: number;
}

const weekdayByLabel: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const dateTimePartFormatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTithePercentage(n: number): n is TithePercentage {
  return (TITHE_PERCENTAGES as readonly number[]).includes(n);
}

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = dateTimePartFormatters.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    weekday: 'short',
    year: 'numeric',
  });
  dateTimePartFormatters.set(timeZone, formatter);
  return formatter;
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

function numericPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = partValue(parts, type);
  return value ? Number(value) : 0;
}

function localDateTimeParts(date: Date, timeZone = TITHE_TIME_ZONE): LocalDateTimeParts {
  const parts = dateTimeFormatter(timeZone).formatToParts(date);
  const weekdayLabel = partValue(parts, 'weekday');

  return {
    day: numericPart(parts, 'day'),
    hour: numericPart(parts, 'hour'),
    minute: numericPart(parts, 'minute'),
    month: numericPart(parts, 'month'),
    second: numericPart(parts, 'second'),
    weekday: weekdayByLabel[weekdayLabel] ?? date.getUTCDay(),
    year: numericPart(parts, 'year'),
  };
}

function timeZoneOffsetMs(date: Date, timeZone = TITHE_TIME_ZONE): number {
  const parts = localDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function localDateTimeAsUtc(
  input: Pick<LocalDateTimeParts, 'day' | 'hour' | 'minute' | 'month' | 'second' | 'year'>,
  timeZone = TITHE_TIME_ZONE,
): Date {
  const localAsUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second,
  );
  let utc = localAsUtc - timeZoneOffsetMs(new Date(localAsUtc), timeZone);
  utc = localAsUtc - timeZoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

export interface TitheInput {
  studentId: string;
  percentage: TithePercentage;
  periodStart: Date;
  periodEnd: Date;
  /** Behaviour entries falling inside [periodStart, periodEnd). */
  entries: readonly { type: 'Merit' | 'Demerit' | 'General'; meritDelta: number }[];
}

export interface TitheResult {
  studentId: string;
  periodStart: Date;
  periodEnd: Date;
  grossMerits: number;
  titheAmount: number;
  rows: LedgerRow[];
}

/**
 * Compute the tithe for a single student over a period.
 * Rounds DOWN (banker-friendly, student-friendly): 1 merit of tithe requires
 * 10 gross merits at 10%. Prevents fractional debits.
 */
export function computeWeeklyTithe(input: TitheInput): TitheResult {
  if (!isValidTithePercentage(input.percentage)) {
    throw new Error(`invalid tithe percentage: ${String(input.percentage)}`);
  }
  if (input.periodEnd <= input.periodStart) {
    throw new Error('periodEnd must be after periodStart');
  }

  let gross = 0;
  for (const e of input.entries) {
    if (e.type === 'Merit') gross += e.meritDelta;
  }

  const amount = Math.floor((gross * input.percentage) / 100);
  const reason = `tithe:${input.periodStart.toISOString().slice(0, 10)}:${String(input.percentage)}pct`;

  const rows: LedgerRow[] =
    amount > 0
      ? [
          { studentId: input.studentId, account: 'Spend', delta: -amount, reason },
          { studentId: input.studentId, account: 'TithePaid', delta: amount, reason },
        ]
      : [];

  return {
    studentId: input.studentId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    grossMerits: gross,
    titheAmount: amount,
    rows,
  };
}

/** Return the Friday 13:00 Europe/London start for the tithe week containing the instant. */
export function startOfTitheWeek(instant: Date): Date {
  const parts = localDateTimeParts(instant);
  const daysSinceFriday = (parts.weekday - TITHE_WEEK_START_DAY + 7) % 7;
  let boundaryDay = parts.day - daysSinceFriday;
  let boundary = localDateTimeAsUtc({
    day: boundaryDay,
    hour: TITHE_WEEK_START_HOUR,
    minute: 0,
    month: parts.month,
    second: 0,
    year: parts.year,
  });

  if (instant < boundary) {
    boundaryDay -= 7;
    boundary = localDateTimeAsUtc({
      day: boundaryDay,
      hour: TITHE_WEEK_START_HOUR,
      minute: 0,
      month: parts.month,
      second: 0,
      year: parts.year,
    });
  }

  return boundary;
}

export function endOfTitheWeek(weekStart: Date): Date {
  const parts = localDateTimeParts(weekStart);
  return localDateTimeAsUtc({
    day: parts.day + 7,
    hour: TITHE_WEEK_START_HOUR,
    minute: 0,
    month: parts.month,
    second: 0,
    year: parts.year,
  });
}
