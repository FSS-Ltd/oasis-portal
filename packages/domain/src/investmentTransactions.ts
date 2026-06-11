import { computeWithdrawalFee } from './investmentSim.js';
import type { LedgerRow } from './meritLedger.js';

const UNIT_SCALE = 1_000_000;
export const DEFAULT_INVESTMENT_WITHDRAWAL_FEE_PCT = 5;
export const DEFAULT_INVESTMENT_CAPITAL_GAINS_TAX_PCT = 15;

export interface InvestmentBuyPlan {
  units: number;
  ledgerRows: LedgerRow[];
}

export interface InvestmentSellPlan {
  proceedsMerits: number;
  feeMerits: number;
  netMerits: number;
  costBasisMerits: number;
  investmentReturnDelta: number;
  ledgerRows: LedgerRow[];
}

export interface InvestmentHoldingBuyPlan {
  costBasisMerits: number;
  units: number;
  ledgerRows: LedgerRow[];
}

export interface InvestmentPortfolioWithdrawalHolding {
  instrumentId: string;
  units: number;
  costBasisMerits: number;
  currentPriceMerits: number;
}

export interface InvestmentPortfolioWithdrawalSale {
  instrumentId: string;
  unitsSold: number;
  remainingUnits: number;
  grossMerits: number;
  costBasisMerits: number;
}

export interface InvestmentPortfolioWithdrawalPlan {
  grossMerits: number;
  feeMerits: number;
  taxMerits: number;
  netMerits: number;
  costBasisMerits: number;
  investmentReturnDelta: number;
  sales: InvestmentPortfolioWithdrawalSale[];
  ledgerRows: LedgerRow[];
}

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive`);
  }
}

function unitsToSixDecimals(value: number): number {
  return Math.floor(value * UNIT_SCALE) / UNIT_SCALE;
}

export function planInvestmentBuy(params: {
  studentId: string;
  merits: number;
  nav: number;
}): InvestmentBuyPlan {
  if (!Number.isInteger(params.merits) || params.merits <= 0) {
    throw new Error('merits must be a positive integer');
  }
  requirePositiveFinite(params.nav, 'nav');

  const units = unitsToSixDecimals(params.merits / params.nav);
  if (units <= 0) {
    throw new Error('merits are too small to buy investment units at current NAV');
  }

  return {
    units,
    ledgerRows: [
      {
        studentId: params.studentId,
        account: 'Spend',
        delta: -params.merits,
        reason: 'investment:buy',
      },
      {
        studentId: params.studentId,
        account: 'Investment',
        delta: params.merits,
        reason: 'investment:buy',
      },
    ],
  };
}

export function planInvestmentHoldingBuy(params: {
  studentId: string;
  merits: number;
  priceMerits: number;
}): InvestmentHoldingBuyPlan {
  if (!Number.isInteger(params.merits) || params.merits <= 0) {
    throw new Error('merits must be a positive integer');
  }
  requirePositiveFinite(params.priceMerits, 'priceMerits');

  const units = unitsToSixDecimals(params.merits / params.priceMerits);
  if (units <= 0) {
    throw new Error('merits are too small to buy investment units at current price');
  }

  return {
    costBasisMerits: params.merits,
    units,
    ledgerRows: [
      {
        studentId: params.studentId,
        account: 'Spend',
        delta: -params.merits,
        reason: 'investment:holding:buy',
      },
      {
        studentId: params.studentId,
        account: 'Investment',
        delta: params.merits,
        reason: 'investment:holding:buy',
      },
    ],
  };
}

export function planInvestmentSell(params: {
  studentId: string;
  units: number;
  currentUnits: number;
  totalCostBasisMerits: number;
  nav: number;
  feeRatePct?: number;
}): InvestmentSellPlan {
  requirePositiveFinite(params.units, 'units');
  requirePositiveFinite(params.currentUnits, 'currentUnits');
  requirePositiveFinite(params.nav, 'nav');
  if (!Number.isInteger(params.totalCostBasisMerits) || params.totalCostBasisMerits < 0) {
    throw new Error('totalCostBasisMerits must be a non-negative integer');
  }
  if (params.units > params.currentUnits) {
    throw new Error('cannot sell more units than currently held');
  }

  const isFullExit = Math.abs(params.currentUnits - params.units) < 1 / UNIT_SCALE;
  const costBasisMerits = isFullExit
    ? params.totalCostBasisMerits
    : Math.floor(params.totalCostBasisMerits * (params.units / params.currentUnits));
  const proceedsMerits = Math.floor(params.units * params.nav);
  const feeMerits = computeWithdrawalFee({
    proceedsMerits,
    feeRatePct: params.feeRatePct ?? DEFAULT_INVESTMENT_WITHDRAWAL_FEE_PCT,
  });
  const netMerits = proceedsMerits - feeMerits;
  const investmentReturnDelta = costBasisMerits - proceedsMerits;
  const reason = 'investment:sell';
  const ledgerRows: LedgerRow[] = [
    {
      studentId: params.studentId,
      account: 'Investment',
      delta: -costBasisMerits,
      reason,
    },
    {
      studentId: params.studentId,
      account: 'Spend',
      delta: netMerits,
      reason,
    },
    {
      studentId: params.studentId,
      account: 'FeeSink',
      delta: feeMerits,
      reason,
    },
    {
      studentId: params.studentId,
      account: 'InvestmentReturn',
      delta: investmentReturnDelta,
      reason,
    },
  ];

  return {
    proceedsMerits,
    feeMerits,
    netMerits,
    costBasisMerits,
    investmentReturnDelta,
    ledgerRows: ledgerRows.filter((row) => row.delta !== 0),
  };
}

export function planInvestmentPortfolioWithdrawal(params: {
  studentId: string;
  grossMerits: number;
  holdings: readonly InvestmentPortfolioWithdrawalHolding[];
  feeRatePct?: number;
  taxRatePct?: number;
}): InvestmentPortfolioWithdrawalPlan {
  if (!Number.isInteger(params.grossMerits) || params.grossMerits <= 0) {
    throw new Error('grossMerits must be a positive integer');
  }
  if (params.holdings.length === 0) {
    throw new Error('at least one holding is required');
  }

  const holdingValues = params.holdings.map((holding) => {
    requirePositiveFinite(holding.units, 'holding units');
    requirePositiveFinite(holding.currentPriceMerits, 'currentPriceMerits');
    if (!Number.isInteger(holding.costBasisMerits) || holding.costBasisMerits < 0) {
      throw new Error('costBasisMerits must be a non-negative integer');
    }
    return Math.floor(holding.units * holding.currentPriceMerits);
  });
  const portfolioValue = holdingValues.reduce((sum, value) => sum + value, 0);
  if (params.grossMerits > portfolioValue) {
    throw new Error('cannot withdraw more than current portfolio value');
  }

  let allocatedGross = 0;
  const sales = params.holdings.map((holding, index) => {
    const holdingValue = holdingValues[index] ?? 0;
    const isLast = index === params.holdings.length - 1;
    const grossMerits = isLast
      ? params.grossMerits - allocatedGross
      : Math.floor((params.grossMerits * holdingValue) / portfolioValue);
    allocatedGross += grossMerits;

    const isFullExit = grossMerits >= holdingValue;
    const unitsSold = isFullExit
      ? unitsToSixDecimals(holding.units)
      : unitsToSixDecimals((holding.units * grossMerits) / holdingValue);
    const remainingUnits = Math.max(0, unitsToSixDecimals(holding.units - unitsSold));
    const costBasisMerits = isFullExit
      ? holding.costBasisMerits
      : Math.floor(holding.costBasisMerits * (unitsSold / holding.units));

    return {
      costBasisMerits,
      grossMerits,
      instrumentId: holding.instrumentId,
      remainingUnits,
      unitsSold,
    };
  });

  const costBasisMerits = sales.reduce((sum, sale) => sum + sale.costBasisMerits, 0);
  const feeMerits = computeWithdrawalFee({
    proceedsMerits: params.grossMerits,
    feeRatePct: params.feeRatePct ?? DEFAULT_INVESTMENT_WITHDRAWAL_FEE_PCT,
  });
  const gainMerits = Math.max(0, params.grossMerits - costBasisMerits);
  const taxRatePct = params.taxRatePct ?? DEFAULT_INVESTMENT_CAPITAL_GAINS_TAX_PCT;
  if (taxRatePct < 0 || taxRatePct > 100) throw new Error('taxRatePct out of range');
  const taxMerits = Math.floor((gainMerits * taxRatePct) / 100);
  const netMerits = params.grossMerits - feeMerits - taxMerits;
  const investmentReturnDelta = costBasisMerits - params.grossMerits;
  const reason = 'investment:portfolio:withdraw';
  const ledgerRows: LedgerRow[] = [
    {
      studentId: params.studentId,
      account: 'Investment',
      delta: -costBasisMerits,
      reason,
    },
    {
      studentId: params.studentId,
      account: 'Spend',
      delta: netMerits,
      reason,
    },
    {
      studentId: params.studentId,
      account: 'FeeSink',
      delta: feeMerits,
      reason,
    },
    {
      studentId: params.studentId,
      account: 'TaxSink',
      delta: taxMerits,
      reason,
    },
    {
      studentId: params.studentId,
      account: 'InvestmentReturn',
      delta: investmentReturnDelta,
      reason,
    },
  ];

  return {
    costBasisMerits,
    feeMerits,
    grossMerits: params.grossMerits,
    investmentReturnDelta,
    ledgerRows: ledgerRows.filter((row) => row.delta !== 0),
    netMerits,
    sales: sales.filter((sale) => sale.grossMerits > 0 && sale.unitsSold > 0),
    taxMerits,
  };
}
