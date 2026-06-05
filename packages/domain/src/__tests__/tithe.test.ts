import { describe, expect, it } from 'vitest';
import {
  computeManualTitheDue,
  computeWeeklyTithe,
  endOfTitheWeek,
  isValidTithePercentage,
  latestCompletedTithePeriod,
  planManualTithePayment,
  startOfTitheWeek,
  TITHE_PERCENTAGES,
} from '../tithe.js';

const fridayOnePmLondon = new Date('2026-05-15T12:00:00.000Z'); // BST
const nextFridayOnePmLondon = new Date('2026-05-22T12:00:00.000Z');

describe('isValidTithePercentage', () => {
  it.each(TITHE_PERCENTAGES)('accepts %i', (p) => {
    expect(isValidTithePercentage(p)).toBe(true);
  });
  it.each([0, 5, 12, 25, 100])('rejects %i', (p) => {
    expect(isValidTithePercentage(p)).toBe(false);
  });
});

describe('computeWeeklyTithe', () => {
  const period = { periodStart: fridayOnePmLondon, periodEnd: nextFridayOnePmLondon };

  it('tithes 10% of gross merits earned', () => {
    const r = computeWeeklyTithe({
      studentId: 's1',
      percentage: 10,
      ...period,
      entries: [
        { type: 'Merit', meritDelta: 30 },
        { type: 'Merit', meritDelta: 20 },
        { type: 'Demerit', meritDelta: -5 },
      ],
    });
    expect(r.grossMerits).toBe(50);
    expect(r.titheAmount).toBe(5);
    expect(r.rows).toHaveLength(2);
    expect(r.rows.reduce((a, row) => a + row.delta, 0)).toBe(0);
  });

  it('tithes 15% and 20% correctly', () => {
    expect(
      computeWeeklyTithe({
        studentId: 's1',
        percentage: 15,
        ...period,
        entries: [{ type: 'Merit', meritDelta: 100 }],
      }).titheAmount,
    ).toBe(15);
    expect(
      computeWeeklyTithe({
        studentId: 's1',
        percentage: 20,
        ...period,
        entries: [{ type: 'Merit', meritDelta: 100 }],
      }).titheAmount,
    ).toBe(20);
  });

  it('rounds down fractional tithes (student-friendly)', () => {
    const r = computeWeeklyTithe({
      studentId: 's1',
      percentage: 10,
      ...period,
      entries: [{ type: 'Merit', meritDelta: 17 }],
    });
    expect(r.titheAmount).toBe(1);
  });

  it('emits no ledger rows when amount is zero', () => {
    const r = computeWeeklyTithe({
      studentId: 's1',
      percentage: 10,
      ...period,
      entries: [{ type: 'Merit', meritDelta: 9 }],
    });
    expect(r.titheAmount).toBe(0);
    expect(r.rows).toEqual([]);
  });

  it('ignores demerits from the tithe base', () => {
    const r = computeWeeklyTithe({
      studentId: 's1',
      percentage: 10,
      ...period,
      entries: [
        { type: 'Merit', meritDelta: 50 },
        { type: 'Demerit', meritDelta: -5 },
        { type: 'Demerit', meritDelta: -5 },
      ],
    });
    expect(r.grossMerits).toBe(50);
    expect(r.titheAmount).toBe(5);
  });

  it('rejects invalid percentages', () => {
    expect(() =>
      computeWeeklyTithe({
        studentId: 's1',
        percentage: 12 as 10,
        ...period,
        entries: [],
      }),
    ).toThrow();
  });
});

describe('startOfTitheWeek / endOfTitheWeek', () => {
  it('snaps summer dates to the Friday 13:00 London boundary', () => {
    const thursday = new Date('2026-05-21T09:30:00.000Z');
    const start = startOfTitheWeek(thursday);
    expect(start.toISOString()).toBe('2026-05-15T12:00:00.000Z');
  });

  it('uses the previous Friday before the local Friday 13:00 boundary', () => {
    const fridayBeforeBoundary = new Date('2026-05-15T11:59:59.000Z');
    const start = startOfTitheWeek(fridayBeforeBoundary);
    expect(start.toISOString()).toBe('2026-05-08T12:00:00.000Z');
  });

  it('uses the current Friday at the local Friday 13:00 boundary', () => {
    const start = startOfTitheWeek(fridayOnePmLondon);
    expect(start.toISOString()).toBe('2026-05-15T12:00:00.000Z');
  });

  it('handles winter GMT boundaries without shifting the local hour', () => {
    const winter = new Date('2026-01-14T15:00:00.000Z');
    const start = startOfTitheWeek(winter);
    expect(start.toISOString()).toBe('2026-01-09T13:00:00.000Z');
  });

  it('end is exactly 7 days after start', () => {
    const start = startOfTitheWeek(fridayOnePmLondon);
    const end = endOfTitheWeek(start);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('latestCompletedTithePeriod', () => {
  it('uses the selected weekly tithe day as the completed period boundary', () => {
    const period = latestCompletedTithePeriod({
      cadence: 'Weekly',
      now: new Date('2026-06-04T09:00:00.000Z'), // Thursday
      weeklyDay: 3, // Wednesday
    });

    expect(period.start.toISOString()).toBe('2026-05-26T23:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-06-02T23:00:00.000Z');
  });

  it('clamps monthly tithe dates to the last day of shorter months', () => {
    const period = latestCompletedTithePeriod({
      cadence: 'Monthly',
      monthlyDate: 31,
      now: new Date('2026-05-30T09:00:00.000Z'),
    });

    expect(period.start.toISOString()).toBe('2026-03-30T23:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-04-29T23:00:00.000Z');
  });
});

describe('computeManualTitheDue', () => {
  it('uses gross merits plus realized investment gains and ignores demerits', () => {
    const due = computeManualTitheDue({
      mode: 'Percentage',
      percentage: 12,
      entries: [
        { source: 'BehaviourMerit', amount: 80 },
        { source: 'BehaviourDemerit', amount: -10 },
        { source: 'InvestmentReturn', amount: 20 },
      ],
    });

    expect(due.grossMerits).toBe(100);
    expect(due.minimumAmount).toBe(10);
    expect(due.selectedAmount).toBe(12);
  });

  it('rejects fixed amounts below the 10 percent minimum', () => {
    expect(() =>
      computeManualTitheDue({
        mode: 'FixedAmount',
        fixedAmount: 9,
        entries: [{ source: 'BehaviourMerit', amount: 100 }],
      }),
    ).toThrow('fixed tithe amount cannot be less than 10% of period earnings');
  });
});

describe('planManualTithePayment', () => {
  it('debits Spend and credits TithePaid for the chosen due amount', () => {
    const plan = planManualTithePayment({
      studentId: 's1',
      amount: 12,
      periodStart: fridayOnePmLondon,
      cadence: 'Weekly',
    });

    expect(plan).toEqual([
      {
        studentId: 's1',
        account: 'Spend',
        delta: -12,
        reason: 'tithe:weekly:2026-05-15',
      },
      {
        studentId: 's1',
        account: 'TithePaid',
        delta: 12,
        reason: 'tithe:weekly:2026-05-15',
      },
    ]);
  });
});
