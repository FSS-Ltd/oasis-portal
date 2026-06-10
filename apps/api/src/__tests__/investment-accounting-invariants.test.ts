import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  auditCreates,
  day,
  headUser,
  linkedStudentId,
  makeCaller,
  makeFakeDb,
  makeInstrument,
  makeMarketSnapshot,
  makeStudent,
  studentUser,
} from './helpers/investment-fixtures.js';

function sumDeltas(rows: Array<{ delta: number }>): number {
  return rows.reduce((total, row) => total + row.delta, 0);
}

describe('investment accounting invariants', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    process.env['INVESTMENT_NAV_SEED'] = 'oasis-v1';
    process.env['TWELVE_DATA_API_KEY'] = 'test-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env['INVESTMENT_NAV_SEED'];
    delete process.env['TWELVE_DATA_API_KEY'];
    delete process.env['TWELVE_DATA_BASE_URL'];
  });

  it('keeps appended ledger rows balanced across buy and sell transactions', async () => {
    const initialLedger = [
      { studentId: linkedStudentId, account: 'Spend' as const, delta: 1000, reason: 'merit' },
    ];
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        instruments: [makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' })],
        ledger: initialLedger,
        navs: [{ date: day('2026-05-15'), nav: 120, dailyReturn: 0 }],
        students: [makeStudent({ id: linkedStudentId, userId: studentUser.id })],
      }),
    );

    const beforeFirstBuy = db.ledger.map((row) => ({ ...row }));
    await caller.investment.buy({ studentId: linkedStudentId, merits: 240 });
    const afterFirstBuy = db.ledger.map((row) => ({ ...row }));
    expect(afterFirstBuy.slice(beforeFirstBuy.length)).toHaveLength(2);
    expect(sumDeltas(afterFirstBuy.slice(beforeFirstBuy.length))).toBe(0);
    expect(afterFirstBuy.slice(0, beforeFirstBuy.length)).toEqual(beforeFirstBuy);

    const beforeSecondBuy = db.ledger.map((row) => ({ ...row }));
    await caller.investment.buy({ studentId: linkedStudentId, merits: 120 });
    const afterSecondBuy = db.ledger.map((row) => ({ ...row }));
    expect(afterSecondBuy.slice(beforeSecondBuy.length)).toHaveLength(2);
    expect(sumDeltas(afterSecondBuy.slice(beforeSecondBuy.length))).toBe(0);
    expect(afterSecondBuy.slice(0, beforeSecondBuy.length)).toEqual(beforeSecondBuy);

    const beforeSell = db.ledger.map((row) => ({ ...row }));
    await caller.investment.sell({ studentId: linkedStudentId, units: 1.5 });
    const afterSell = db.ledger.map((row) => ({ ...row }));
    expect(afterSell.slice(beforeSell.length)).toHaveLength(3);
    expect(sumDeltas(afterSell.slice(beforeSell.length))).toBe(0);
    expect(afterSell.slice(0, beforeSell.length)).toEqual(beforeSell);
  });

  it('treats stale valuation reads as read-only and surfaces stale state', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const initialLedger = [
      { studentId: linkedStudentId, account: 'Spend' as const, delta: 1000, reason: 'merit' },
    ];
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        instruments: [instrument],
        ledger: initialLedger,
        snapshots: [
          makeMarketSnapshot({
            id: 'snapshot-stale',
            instrument,
            serverFetchedAt: new Date('2026-05-15T08:00:00.000Z'),
          }),
        ],
        students: [makeStudent({ id: linkedStudentId, userId: studentUser.id })],
      }),
    );

    const result = await caller.investment.marketData();

    expect(result.freshness).toBe('stale');
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toMatchObject({ symbol: 'VUSA' });
    expect(db.ledger).toEqual(initialLedger);
  });

  it('falls back to the last known snapshot when the provider fails and leaves ledger rows alone', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const initialLedger = [
      { studentId: linkedStudentId, account: 'Spend' as const, delta: 1000, reason: 'merit' },
    ];
    const { caller, db } = makeCaller(
      headUser,
      makeFakeDb({
        instruments: [instrument],
        ledger: initialLedger,
        snapshots: [
          makeMarketSnapshot({
            id: 'snapshot-fallback',
            instrument,
            serverFetchedAt: new Date('2026-05-15T08:00:00.000Z'),
          }),
        ],
        students: [makeStudent({ id: linkedStudentId, userId: studentUser.id })],
      }),
    );
    vi.useRealTimers();

    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('provider down'));
    vi.stubGlobal('fetch', fetchImpl);

    const result = await caller.investment.refreshMarketData();

    expect(result.status).toBe('stale');
    expect(result.refreshedCount).toBe(0);
    expect(fetchImpl).toHaveBeenCalled();
    expect(db.ledger).toEqual(initialLedger);
    expect(auditCreates(db)).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'Update',
          entity: 'MarketDataSnapshot',
          meta: expect.objectContaining({ status: 'stale' }) as unknown,
        }),
      }),
    );
  });

  it('blocks refreshes when the daily quota window is exhausted and writes no ledger rows', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const initialLedger = [
      { studentId: linkedStudentId, account: 'Spend' as const, delta: 1000, reason: 'merit' },
    ];
    const snapshots = Array.from({ length: 8 }, (_, index) =>
      makeMarketSnapshot({
        id: `snapshot-${index}`,
        instrument,
        serverFetchedAt: new Date('2026-05-15T12:00:00.000Z'),
      }),
    );
    const { caller, db } = makeCaller(
      headUser,
      makeFakeDb({
        instruments: [instrument],
        ledger: initialLedger,
        snapshots,
        students: [makeStudent({ id: linkedStudentId, userId: studentUser.id })],
      }),
    );

    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchImpl);

    const result = await caller.investment.refreshMarketData();

    expect(result.status).toBe('quota_exhausted');
    expect(result.refreshedCount).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.ledger).toEqual(initialLedger);
    expect(auditCreates(db)).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'Update',
          entity: 'MarketDataSnapshot',
          meta: expect.objectContaining({ status: 'quota_exhausted' }) as unknown,
        }),
      }),
    );
  });

  it('surfaces learning-adjusted valuation changes without mutating ledger rows', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const initialLedger = [
      { studentId: linkedStudentId, account: 'Spend' as const, delta: 1000, reason: 'merit' },
    ];
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        instruments: [instrument],
        ledger: initialLedger,
        snapshots: [
          {
            ...makeMarketSnapshot({
              id: 'snapshot-multiplier',
              instrument,
              serverFetchedAt: new Date('2026-05-15T12:00:00.000Z'),
            }),
            dayChangePct: 1.25,
            gbpPrice: 100,
            previousCloseGbp: 90,
            providerTimestamp: new Date('2026-05-15T12:00:00.000Z'),
          },
        ],
        students: [makeStudent({ id: linkedStudentId, userId: studentUser.id })],
      }),
    );

    const result = await caller.investment.marketData();

    expect(result.freshness).toBe('fresh');
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0]).toMatchObject({
      dayChangePct: 1.25,
      learningDayChangePct: 8,
      learningDailyMovementMerits: 0.72,
      symbol: 'VUSA',
    });
    expect(db.ledger).toEqual(initialLedger);
  });
});
