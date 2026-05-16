import { describe, expect, it } from 'vitest';
import { planInvestmentBuy } from '../investmentTransactions.js';
import {
  applyRows,
  rowsForDemerit,
  rowsForMerit,
  rowsForTransfer,
  type LedgerRow,
} from '../meritLedger.js';
import { compileTermReport } from '../report.js';
import { prepareShopPurchase } from '../shop.js';
import { computeWeeklyTithe } from '../tithe.js';
import type { SessionUser } from '../rbac.js';

const studentId = 'phase4_student_1';
const shopkeeper: SessionUser = {
  id: 'phase4_shopkeeper',
  role: 'Supervisor',
  tags: ['shopkeeper'],
  requires2fa: false,
};

function expectBalanced(rows: readonly LedgerRow[]): void {
  expect(rows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
}

describe('Phase 4 accounting invariants', () => {
  it('keeps transfer, tithe, investment, and shop writes balanced around behaviour mint/burn rows', () => {
    const behaviourRows = [
      ...rowsForMerit({
        studentId,
        amount: 100,
        reason: 'Merit: academic excellence',
        behaviourEntryId: 'behaviour_merit_1',
      }),
      ...rowsForDemerit({
        studentId,
        amount: 5,
        reason: 'Demerit: correction',
        behaviourEntryId: 'behaviour_demerit_1',
      }),
    ];
    const transferRows = rowsForTransfer({
      studentId,
      from: 'Spend',
      to: 'Saving',
      amount: 30,
      reason: 'weekly saving',
    });
    const tithe = computeWeeklyTithe({
      studentId,
      percentage: 10,
      periodStart: new Date('2026-05-04T00:00:00.000Z'),
      periodEnd: new Date('2026-05-11T00:00:00.000Z'),
      entries: [
        { type: 'Merit', meritDelta: 100 },
        { type: 'Demerit', meritDelta: -5 },
      ],
    });
    const investmentBuy = planInvestmentBuy({ studentId, merits: 20, nav: 10 });
    const shopPurchase = prepareShopPurchase({
      shopkeeper,
      studentId,
      item: { id: 'phase4_shop_item', active: true, priceIncVat: 15, stockCount: 3 },
      unitsBought: 2,
      spendBalance: 100,
    });

    expectBalanced(transferRows);
    expectBalanced(tithe.rows);
    expectBalanced(investmentBuy.ledgerRows);
    expectBalanced(shopPurchase.ledger);

    const balances = applyRows([
      ...behaviourRows,
      ...transferRows,
      ...tithe.rows,
      ...investmentBuy.ledgerRows,
      ...shopPurchase.ledger,
    ]);

    expect(balances).toEqual({
      Spend: 5,
      Saving: 30,
      Investment: 20,
      InvestmentReturn: 0,
      TithePaid: 10,
      Given: 30,
      FeeSink: 0,
    });
  });

  it('compiles term reports from ledger snapshots without adding ledger movement', () => {
    const ledgerRows = [
      ...rowsForMerit({
        studentId,
        amount: 50,
        reason: 'Merit: service',
        behaviourEntryId: 'behaviour_merit_2',
      }),
      ...rowsForTransfer({
        studentId,
        from: 'Spend',
        to: 'Saving',
        amount: 15,
        reason: 'report snapshot saving',
      }),
    ];

    const reportLedgerRows = ledgerRows.map((row, index) => ({
      ...row,
      createdAt: new Date(`2026-05-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
    }));

    const report = compileTermReport({
      studentId,
      studentDisplayName: 'Phase Four Student',
      term: '2026-Summer',
      attendance: { total: 4, present: 3, absent: 1, late: 0 },
      paces: [],
      behaviour: {
        meritsEarned: 50,
        demeritsCount: 0,
        demeritsMerits: 0,
        generalEntries: [],
      },
      notes: [],
      ledgerRows: reportLedgerRows,
      headSummary: 'Ready to send.',
    });

    expect(report.balances).toEqual(applyRows(reportLedgerRows));
    expect(report.meritActivity).toHaveLength(reportLedgerRows.length);
    expect(report.headSummary).toBe('Ready to send.');
  });
});
