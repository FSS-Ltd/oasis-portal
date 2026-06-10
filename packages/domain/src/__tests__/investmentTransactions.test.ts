import { describe, expect, it } from 'vitest';
import { planInvestmentBuy, planInvestmentSell } from '../investmentTransactions.js';

describe('planInvestmentBuy', () => {
  it('converts Spend merits into six-decimal investment units and balanced ledger rows', () => {
    const plan = planInvestmentBuy({ studentId: 'student_1', merits: 250, nav: 125 });

    expect(plan.units).toBe(2);
    expect(plan.ledgerRows).toEqual([
      {
        studentId: 'student_1',
        account: 'Spend',
        delta: -250,
        reason: 'investment:buy',
      },
      {
        studentId: 'student_1',
        account: 'Investment',
        delta: 250,
        reason: 'investment:buy',
      },
    ]);
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });
});

describe('planInvestmentSell', () => {
  it('credits Spend net of fee and balances realized gains through InvestmentReturn', () => {
    const plan = planInvestmentSell({
      studentId: 'student_1',
      units: 1,
      currentUnits: 2,
      totalCostBasisMerits: 200,
      nav: 120,
    });

    expect(plan).toMatchObject({
      proceedsMerits: 120,
      feeMerits: 6,
      netMerits: 114,
      costBasisMerits: 100,
      investmentReturnDelta: -20,
    });
    expect(plan.ledgerRows).toEqual([
      {
        studentId: 'student_1',
        account: 'Investment',
        delta: -100,
        reason: 'investment:sell',
      },
      {
        studentId: 'student_1',
        account: 'Spend',
        delta: 114,
        reason: 'investment:sell',
      },
      {
        studentId: 'student_1',
        account: 'FeeSink',
        delta: 6,
        reason: 'investment:sell',
      },
      {
        studentId: 'student_1',
        account: 'InvestmentReturn',
        delta: -20,
        reason: 'investment:sell',
      },
    ]);
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });

  it('debits losses through InvestmentReturn and uses all remaining cost basis on full exit', () => {
    const plan = planInvestmentSell({
      studentId: 'student_1',
      units: 1.5,
      currentUnits: 1.5,
      totalCostBasisMerits: 200,
      nav: 80,
    });

    expect(plan).toMatchObject({
      proceedsMerits: 120,
      feeMerits: 6,
      netMerits: 114,
      costBasisMerits: 200,
      investmentReturnDelta: 80,
    });
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });

  it('balances a partial sell after multiple buys and consumes cost basis in proportion', () => {
    const firstBuy = planInvestmentBuy({ studentId: 'student_1', merits: 250, nav: 125 });
    const secondBuy = planInvestmentBuy({ studentId: 'student_1', merits: 250, nav: 125 });
    const sell = planInvestmentSell({
      studentId: 'student_1',
      units: 1,
      currentUnits: firstBuy.units + secondBuy.units,
      totalCostBasisMerits: 500,
      nav: 125,
    });

    expect(firstBuy.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
    expect(secondBuy.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
    expect(sell).toMatchObject({
      proceedsMerits: 125,
      feeMerits: 6,
      netMerits: 119,
      costBasisMerits: 125,
      investmentReturnDelta: 0,
    });
    expect(sell.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });
});
