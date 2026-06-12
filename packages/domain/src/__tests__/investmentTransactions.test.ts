import { describe, expect, it } from 'vitest';
import {
  planInvestmentCashFunding,
  planInvestmentBuy,
  planInvestmentHoldingCashBuy,
  planInvestmentHoldingCashSell,
  planInvestmentHoldingBuy,
  planInvestmentDividendPayment,
  planInvestmentPortfolioWithdrawal,
  planInvestmentSell,
} from '../investmentTransactions.js';

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

describe('planInvestmentCashFunding', () => {
  it('moves whole Spend merits into Merit Markets cash with balanced ledger rows', () => {
    const plan = planInvestmentCashFunding({ studentId: 'student_1', merits: 75 });

    expect(plan.ledgerRows).toEqual([
      {
        studentId: 'student_1',
        account: 'Spend',
        delta: -75,
        reason: 'investment:cash:fund',
      },
      {
        studentId: 'student_1',
        account: 'Investment',
        delta: 75,
        reason: 'investment:cash:fund',
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

describe('planInvestmentHoldingBuy', () => {
  it('converts Spend merits into stock units and balanced ledger rows', () => {
    const plan = planInvestmentHoldingBuy({
      merits: 125,
      priceMerits: 25,
      studentId: 'student_1',
    });

    expect(plan).toMatchObject({
      costBasisMerits: 125,
      units: 5,
    });
    expect(plan.ledgerRows).toEqual([
      {
        studentId: 'student_1',
        account: 'Spend',
        delta: -125,
        reason: 'investment:holding:buy',
      },
      {
        studentId: 'student_1',
        account: 'Investment',
        delta: 125,
        reason: 'investment:holding:buy',
      },
    ]);
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });
});

describe('planInvestmentHoldingCashBuy', () => {
  it('converts investment cash into stock units without creating ledger rows', () => {
    const plan = planInvestmentHoldingCashBuy({
      merits: 125,
      priceMerits: 25,
    });

    expect(plan).toEqual({
      costBasisMerits: 125,
      units: 5,
      ledgerRows: [],
    });
  });
});

describe('planInvestmentHoldingCashSell', () => {
  it('returns a profitable stock sale to investment cash with no fee or tax', () => {
    const plan = planInvestmentHoldingCashSell({
      currentPriceMerits: 30,
      currentUnits: 5,
      studentId: 'student_1',
      totalCostBasisMerits: 100,
      units: 4,
    });

    expect(plan).toMatchObject({
      costBasisMerits: 80,
      grossMerits: 120,
      investmentReturnDelta: -40,
      remainingUnits: 1,
      unitsSold: 4,
    });
    expect(plan.ledgerRows).toEqual([
      {
        studentId: 'student_1',
        account: 'Investment',
        delta: 40,
        reason: 'investment:holding:sell',
      },
      {
        studentId: 'student_1',
        account: 'InvestmentReturn',
        delta: -40,
        reason: 'investment:holding:sell',
      },
    ]);
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });

  it('returns a loss-making stock sale to investment cash with no fee or tax', () => {
    const plan = planInvestmentHoldingCashSell({
      currentPriceMerits: 15,
      currentUnits: 5,
      studentId: 'student_1',
      totalCostBasisMerits: 100,
      units: 4,
    });

    expect(plan).toMatchObject({
      costBasisMerits: 80,
      grossMerits: 60,
      investmentReturnDelta: 20,
      remainingUnits: 1,
      unitsSold: 4,
    });
    expect(plan.ledgerRows).toEqual([
      {
        studentId: 'student_1',
        account: 'Investment',
        delta: -20,
        reason: 'investment:holding:sell',
      },
      {
        studentId: 'student_1',
        account: 'InvestmentReturn',
        delta: 20,
        reason: 'investment:holding:sell',
      },
    ]);
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });
});

describe('planInvestmentDividendPayment', () => {
  it('credits rounded dividend merits into Investment and balances InvestmentReturn', () => {
    const plan = planInvestmentDividendPayment({
      amountMeritsPerUnit: 0.06,
      studentId: 'student_1',
      units: 12.5,
    });

    expect(plan).toEqual({
      payoutMerits: 1,
      ledgerRows: [
        {
          studentId: 'student_1',
          account: 'Investment',
          delta: 1,
          reason: 'investment:dividend',
        },
        {
          studentId: 'student_1',
          account: 'InvestmentReturn',
          delta: -1,
          reason: 'investment:dividend',
        },
      ],
    });
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });

  it('returns no ledger rows when the rounded dividend is zero', () => {
    const plan = planInvestmentDividendPayment({
      amountMeritsPerUnit: 0.004,
      studentId: 'student_1',
      units: 0.5,
    });

    expect(plan).toEqual({
      payoutMerits: 0,
      ledgerRows: [],
    });
  });
});

describe('planInvestmentPortfolioWithdrawal', () => {
  it('sells holdings pro-rata and deducts fee and tax from positive gains', () => {
    const plan = planInvestmentPortfolioWithdrawal({
      grossMerits: 200,
      holdings: [
        {
          costBasisMerits: 100,
          currentPriceMerits: 25,
          instrumentId: 'instrument_a',
          units: 4,
        },
        {
          costBasisMerits: 200,
          currentPriceMerits: 50,
          instrumentId: 'instrument_b',
          units: 6,
        },
      ],
      studentId: 'student_1',
    });

    expect(plan).toMatchObject({
      costBasisMerits: 150,
      feeMerits: 10,
      grossMerits: 200,
      netMerits: 183,
      taxMerits: 7,
    });
    expect(plan.sales).toEqual([
      {
        costBasisMerits: 50,
        grossMerits: 50,
        instrumentId: 'instrument_a',
        remainingUnits: 2,
        unitsSold: 2,
      },
      {
        costBasisMerits: 100,
        grossMerits: 150,
        instrumentId: 'instrument_b',
        remainingUnits: 3,
        unitsSold: 3,
      },
    ]);
    expect(plan.ledgerRows).toEqual([
      {
        studentId: 'student_1',
        account: 'Investment',
        delta: -150,
        reason: 'investment:portfolio:withdraw',
      },
      {
        studentId: 'student_1',
        account: 'Spend',
        delta: 183,
        reason: 'investment:portfolio:withdraw',
      },
      {
        studentId: 'student_1',
        account: 'FeeSink',
        delta: 10,
        reason: 'investment:portfolio:withdraw',
      },
      {
        studentId: 'student_1',
        account: 'TaxSink',
        delta: 7,
        reason: 'investment:portfolio:withdraw',
      },
      {
        studentId: 'student_1',
        account: 'InvestmentReturn',
        delta: -50,
        reason: 'investment:portfolio:withdraw',
      },
    ]);
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });

  it('does not charge capital-gains tax when the sale realizes a loss', () => {
    const plan = planInvestmentPortfolioWithdrawal({
      grossMerits: 80,
      holdings: [
        {
          costBasisMerits: 200,
          currentPriceMerits: 40,
          instrumentId: 'instrument_a',
          units: 2,
        },
      ],
      studentId: 'student_1',
    });

    expect(plan).toMatchObject({
      costBasisMerits: 200,
      feeMerits: 4,
      grossMerits: 80,
      netMerits: 76,
      taxMerits: 0,
    });
    expect(plan.ledgerRows).not.toContainEqual(
      expect.objectContaining({
        account: 'TaxSink',
      }),
    );
    expect(plan.ledgerRows.reduce((sum, row) => sum + row.delta, 0)).toBe(0);
  });
});
