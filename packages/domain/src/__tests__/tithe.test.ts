import { describe, expect, it } from 'vitest';
import {
  computeWeeklyTithe,
  endOfTitheWeek,
  isValidTithePercentage,
  startOfTitheWeek,
  TITHE_PERCENTAGES,
} from '../tithe.js';

const monday = new Date(Date.UTC(2026, 3, 20)); // 2026-04-20 is a Monday
const sunday = new Date(Date.UTC(2026, 3, 26));

describe('isValidTithePercentage', () => {
  it.each(TITHE_PERCENTAGES)('accepts %i', (p) => {
    expect(isValidTithePercentage(p)).toBe(true);
  });
  it.each([0, 5, 12, 25, 100])('rejects %i', (p) => {
    expect(isValidTithePercentage(p)).toBe(false);
  });
});

describe('computeWeeklyTithe', () => {
  const period = { periodStart: monday, periodEnd: sunday };

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
  it('snaps any day in a week to that Monday', () => {
    const wed = new Date(Date.UTC(2026, 3, 22));
    const start = startOfTitheWeek(wed);
    expect(start.toISOString().slice(0, 10)).toBe('2026-04-20');
  });

  it('end is exactly 7 days after start', () => {
    const start = startOfTitheWeek(monday);
    const end = endOfTitheWeek(start);
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
