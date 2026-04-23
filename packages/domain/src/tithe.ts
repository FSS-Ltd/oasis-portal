/**
 * Weekly tithe engine.
 *
 * Policy (Director mandate):
 *   - Weekly cadence.
 *   - Percentage of GROSS merits earned in the period (10 | 15 | 20). Default 10.
 *   - Demerits do NOT reduce the tithe base (you tithe on what you earned).
 *   - Debits Spend, credits TithePaid.
 *   - Idempotent per (student, periodStart) via the TitheRun table.
 *
 * Only Parent or full-admin can change percentage; students cannot.
 */
import type { LedgerRow } from './meritLedger.js';

export const TITHE_PERCENTAGES = [10, 15, 20] as const;
export type TithePercentage = (typeof TITHE_PERCENTAGES)[number];

export function isValidTithePercentage(n: number): n is TithePercentage {
  return (TITHE_PERCENTAGES as readonly number[]).includes(n);
}

export interface TitheInput {
  studentId: string;
  percentage: TithePercentage;
  periodStart: Date;
  periodEnd: Date;
  /** Behaviour entries falling inside [periodStart, periodEnd). */
  entries: readonly { type: 'Merit' | 'Demerit'; meritDelta: number }[];
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

/**
 * Return the start of the current tithe week (Monday 00:00 UTC) for a given instant.
 * Centre runs Tue–Fri, but Monday-start makes "this week" consistent in the UI.
 */
export function startOfTitheWeek(instant: Date): Date {
  const d = new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun, 1 Mon, ...
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

export function endOfTitheWeek(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}
