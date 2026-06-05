import type { LedgerRow } from './meritLedger.js';

export const SAVINGS_ANNUAL_RATE_PCT = 6;

export function calculateMonthlySavingsInterest(input: {
  savingBalance: number;
  annualRatePct?: number;
}): number {
  if (!Number.isFinite(input.savingBalance) || input.savingBalance <= 0) return 0;
  const annualRatePct = input.annualRatePct ?? SAVINGS_ANNUAL_RATE_PCT;
  return Math.max(0, Math.round(input.savingBalance * (annualRatePct / 100 / 12)));
}

export function rowsForSavingsInterest(input: {
  studentId: string;
  amount: number;
  periodStart: Date;
}): LedgerRow[] {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('saving interest amount must be a positive integer');
  }
  return [
    {
      studentId: input.studentId,
      account: 'Saving',
      delta: input.amount,
      reason: `saving:interest:${input.periodStart.toISOString().slice(0, 7)}`,
    },
  ];
}
