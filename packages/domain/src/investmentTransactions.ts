import { computeWithdrawalFee } from './investmentSim.js';
import type { LedgerRow } from './meritLedger.js';

const UNIT_SCALE = 1_000_000;
export const DEFAULT_INVESTMENT_WITHDRAWAL_FEE_PCT = 5;

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
