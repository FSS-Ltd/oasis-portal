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
export const TITHE_CADENCES = ['Weekly', 'Monthly'] as const;
export const TITHE_PAYMENT_MODES = ['Percentage', 'FixedAmount'] as const;
export const TITHE_TIME_ZONE = 'Europe/London';
export const TITHE_WEEK_START_DAY = 5; // Friday, matching Date#getUTCDay.
export const TITHE_WEEK_START_HOUR = 13;
export type TithePercentage = (typeof TITHE_PERCENTAGES)[number];
export type TitheCadence = (typeof TITHE_CADENCES)[number];
export type TithePaymentMode = (typeof TITHE_PAYMENT_MODES)[number];

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

export function isValidTitheCadence(value: string): value is TitheCadence {
  return (TITHE_CADENCES as readonly string[]).includes(value);
}

export function isValidTithePaymentMode(value: string): value is TithePaymentMode {
  return (TITHE_PAYMENT_MODES as readonly string[]).includes(value);
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

export interface ManualTitheEarningEntry {
  source: 'BehaviourMerit' | 'BehaviourDemerit' | 'InvestmentReturn';
  amount: number;
}

export interface ManualTitheDueInput {
  mode: TithePaymentMode;
  entries: readonly ManualTitheEarningEntry[];
  percentage?: number | null;
  fixedAmount?: number | null;
}

export interface ManualTitheDue {
  grossMerits: number;
  minimumAmount: number;
  selectedAmount: number;
}

function positiveInteger(value: number | null | undefined, label: string): number {
  if (value === null || value === undefined || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

export function computeManualTitheDue(input: ManualTitheDueInput): ManualTitheDue {
  let grossMerits = 0;
  for (const entry of input.entries) {
    if (entry.source === 'BehaviourMerit' && entry.amount > 0) {
      grossMerits += entry.amount;
    }
    if (entry.source === 'InvestmentReturn' && entry.amount > 0) {
      grossMerits += entry.amount;
    }
  }

  const minimumAmount = Math.floor(grossMerits / 10);
  let selectedAmount: number;
  if (input.mode === 'Percentage') {
    const percentage = positiveInteger(input.percentage ?? 10, 'tithe percentage');
    if (percentage < 10) {
      throw new Error('tithe percentage cannot be less than 10%');
    }
    selectedAmount = Math.floor((grossMerits * percentage) / 100);
  } else {
    selectedAmount = positiveInteger(input.fixedAmount ?? 0, 'fixed tithe amount');
    if (selectedAmount < minimumAmount) {
      throw new Error('fixed tithe amount cannot be less than 10% of period earnings');
    }
  }

  return {
    grossMerits,
    minimumAmount,
    selectedAmount,
  };
}

export function planManualTithePayment(input: {
  studentId: string;
  amount: number;
  periodStart: Date;
  cadence: TitheCadence;
}): LedgerRow[] {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('tithe amount must be a positive integer');
  }
  const cadenceKey = input.cadence.toLowerCase();
  const reason = `tithe:${cadenceKey}:${input.periodStart.toISOString().slice(0, 10)}`;
  return [
    { studentId: input.studentId, account: 'Spend', delta: -input.amount, reason },
    { studentId: input.studentId, account: 'TithePaid', delta: input.amount, reason },
  ];
}

export interface CompletedTithePeriodInput {
  cadence: TitheCadence;
  now?: Date;
  weeklyDay?: number | null;
  monthlyDate?: number | null;
}

export interface CompletedTithePeriod {
  start: Date;
  end: Date;
}

function requireWeekday(value: number | null | undefined): number {
  const weekday = value ?? TITHE_WEEK_START_DAY;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error('weekly tithe day must be between 0 and 6');
  }
  return weekday;
}

function requireMonthDate(value: number | null | undefined): number {
  const date = value ?? 1;
  if (!Number.isInteger(date) || date < 1 || date > 31) {
    throw new Error('monthly tithe date must be between 1 and 31');
  }
  return date;
}

function localStartOfDay(input: Pick<LocalDateTimeParts, 'day' | 'month' | 'year'>): Date {
  return localDateTimeAsUtc({
    day: input.day,
    hour: 0,
    minute: 0,
    month: input.month,
    second: 0,
    year: input.year,
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  };
}

function monthlyBoundary(year: number, month: number, date: number): Date {
  return localStartOfDay({
    year,
    month,
    day: Math.min(date, daysInMonth(year, month)),
  });
}

export function latestCompletedTithePeriod(
  input: CompletedTithePeriodInput,
): CompletedTithePeriod {
  const now = input.now ?? new Date();
  const parts = localDateTimeParts(now);

  if (input.cadence === 'Weekly') {
    const weekday = requireWeekday(input.weeklyDay);
    const daysSinceBoundary = (parts.weekday - weekday + 7) % 7;
    let end = localStartOfDay({
      year: parts.year,
      month: parts.month,
      day: parts.day - daysSinceBoundary,
    });
    if (now < end) {
      const endParts = localDateTimeParts(end);
      end = localStartOfDay({
        year: endParts.year,
        month: endParts.month,
        day: endParts.day - 7,
      });
    }
    const endParts = localDateTimeParts(end);
    const start = localStartOfDay({
      year: endParts.year,
      month: endParts.month,
      day: endParts.day - 7,
    });
    return { start, end };
  }

  const date = requireMonthDate(input.monthlyDate);
  let endMonth = { year: parts.year, month: parts.month };
  let end = monthlyBoundary(endMonth.year, endMonth.month, date);
  if (now < end) {
    endMonth = addMonths(endMonth.year, endMonth.month, -1);
    end = monthlyBoundary(endMonth.year, endMonth.month, date);
  }
  const startMonth = addMonths(endMonth.year, endMonth.month, -1);
  return {
    start: monthlyBoundary(startMonth.year, startMonth.month, date),
    end,
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
