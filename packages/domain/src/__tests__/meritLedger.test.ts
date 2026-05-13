import { describe, expect, it } from 'vitest';
import {
  DEMERIT_COST,
  applyRows,
  emptyBalances,
  getMeritActivity,
  rowsForDemerit,
  rowsForMerit,
  rowsForTransfer,
} from '../meritLedger.js';

describe('rowsForMerit', () => {
  it('credits Spend by the merit amount', () => {
    const rows = rowsForMerit({
      studentId: 's1',
      amount: 7,
      reason: 'kindness',
      behaviourEntryId: 'b1',
    });
    expect(rows).toEqual([
      {
        studentId: 's1',
        account: 'Spend',
        delta: 7,
        reason: 'kindness',
        relatedEntryId: 'b1',
      },
    ]);
  });

  it('rejects non-positive or non-integer amounts', () => {
    expect(() =>
      rowsForMerit({ studentId: 's1', amount: 0, reason: 'x', behaviourEntryId: 'b' }),
    ).toThrow();
    expect(() =>
      rowsForMerit({ studentId: 's1', amount: -1, reason: 'x', behaviourEntryId: 'b' }),
    ).toThrow();
    expect(() =>
      rowsForMerit({ studentId: 's1', amount: 1.5, reason: 'x', behaviourEntryId: 'b' }),
    ).toThrow();
  });
});

describe('rowsForDemerit', () => {
  it('debits Spend by the default DEMERIT_COST (5)', () => {
    const rows = rowsForDemerit({
      studentId: 's1',
      reason: 'disruption',
      behaviourEntryId: 'b2',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.delta).toBe(-DEMERIT_COST);
    expect(DEMERIT_COST).toBe(5);
  });

  it('debits Spend by a chosen positive amount', () => {
    const rows = rowsForDemerit({
      studentId: 's1',
      amount: 3,
      reason: 'disruption',
      behaviourEntryId: 'b2',
    });
    expect(rows[0]?.delta).toBe(-3);
  });

  it('rejects non-positive or non-integer amounts', () => {
    expect(() =>
      rowsForDemerit({ studentId: 's1', amount: 0, reason: 'x', behaviourEntryId: 'b' }),
    ).toThrow();
    expect(() =>
      rowsForDemerit({ studentId: 's1', amount: -1, reason: 'x', behaviourEntryId: 'b' }),
    ).toThrow();
    expect(() =>
      rowsForDemerit({ studentId: 's1', amount: 1.5, reason: 'x', behaviourEntryId: 'b' }),
    ).toThrow();
  });
});

describe('rowsForTransfer', () => {
  it('produces a matching debit and credit', () => {
    const rows = rowsForTransfer({
      studentId: 's1',
      from: 'Spend',
      to: 'Saving',
      amount: 10,
      reason: 'save-up',
    });
    expect(rows).toHaveLength(2);
    const sum = rows.reduce((a, r) => a + r.delta, 0);
    expect(sum).toBe(0);
  });

  it('rejects same-account transfers', () => {
    expect(() =>
      rowsForTransfer({
        studentId: 's1',
        from: 'Spend',
        to: 'Spend',
        amount: 1,
        reason: 'x',
      }),
    ).toThrow();
  });

  it('rejects non-positive amounts', () => {
    expect(() =>
      rowsForTransfer({
        studentId: 's1',
        from: 'Spend',
        to: 'Saving',
        amount: 0,
        reason: 'x',
      }),
    ).toThrow();
  });
});

describe('applyRows', () => {
  it('sums deltas per account', () => {
    const b = applyRows([
      { account: 'Spend', delta: 10 },
      { account: 'Spend', delta: -3 },
      { account: 'Saving', delta: 5 },
    ]);
    expect(b.Spend).toBe(7);
    expect(b.Saving).toBe(5);
    expect(b.Investment).toBe(0);
  });

  it('starts at zero for an empty ledger', () => {
    expect(applyRows([])).toEqual(emptyBalances());
  });
});

describe('getMeritActivity', () => {
  it('separates merits and demerits', () => {
    const a = getMeritActivity([
      { type: 'Merit', meritDelta: 4 },
      { type: 'Merit', meritDelta: 2 },
      { type: 'Demerit', meritDelta: -5 },
      { type: 'Demerit', meritDelta: -5 },
    ]);
    expect(a.meritsEarned).toBe(6);
    expect(a.demeritsCount).toBe(2);
    expect(a.demeritsMerits).toBe(10);
    expect(a.net).toBe(-4);
  });
});
