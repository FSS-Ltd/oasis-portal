import { describe, expect, it } from 'vitest';
import { calculateMonthlySavingsInterest, rowsForSavingsInterest } from '../savings.js';

describe('calculateMonthlySavingsInterest', () => {
  it('uses 6 percent APR paid monthly and rounds to the nearest merit', () => {
    expect(calculateMonthlySavingsInterest({ savingBalance: 200 })).toBe(1);
    expect(calculateMonthlySavingsInterest({ savingBalance: 300 })).toBe(2);
  });

  it('does not pay interest for tiny or non-positive balances', () => {
    expect(calculateMonthlySavingsInterest({ savingBalance: 49 })).toBe(0);
    expect(calculateMonthlySavingsInterest({ savingBalance: 0 })).toBe(0);
    expect(calculateMonthlySavingsInterest({ savingBalance: -10 })).toBe(0);
  });
});

describe('rowsForSavingsInterest', () => {
  it('credits the Saving account for a monthly interest payout', () => {
    expect(
      rowsForSavingsInterest({
        studentId: 's1',
        amount: 2,
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
      }),
    ).toEqual([
      {
        studentId: 's1',
        account: 'Saving',
        delta: 2,
        reason: 'saving:interest:2026-05',
      },
    ]);
  });
});
