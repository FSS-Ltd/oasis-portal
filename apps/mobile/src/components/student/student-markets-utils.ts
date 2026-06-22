import type { RouterOutputs } from '../../lib/trpc';

export type InvestmentAccount = RouterOutputs['investment']['account'];
export type InvestmentMarketData = RouterOutputs['investment']['marketData'];
export type InvestmentInstrument = InvestmentMarketData['instruments'][number];
export type InvestmentSnapshot = InvestmentMarketData['snapshots'][number];
export type InvestmentTransaction = InvestmentAccount['transactions'][number];
export type InvestmentHolding = InvestmentAccount['holdings'][number];
export type MarketFilter = 'All' | 'Stocks' | 'ETFs' | 'Crypto';
export type MarketTrendRange = '1D' | '1W' | '1M' | '3M';
export type MarketTradeSide = 'buy' | 'sell';

export const marketTrendOptions: readonly { id: MarketTrendRange; label: string }[] = [
  { id: '1D', label: 'Daily' },
  { id: '1W', label: 'Weekly' },
  { id: '1M', label: 'Month' },
  { id: '3M', label: '3 months' },
];

export interface MarketBuyInput {
  instrumentId: string;
  merits: number;
}

export interface MarketSellInput {
  instrumentId: string;
  units: number;
}

export interface MarketInstrumentRow {
  instrument: InvestmentInstrument;
  snapshot: InvestmentSnapshot | undefined;
}

export function formatInvestmentMerits(value: number): string {
  return `${Math.floor(value).toLocaleString('en-GB')} merits`;
}

export function formatSignedInvestmentMerits(value: number): string {
  const absolute = Math.abs(Math.floor(value)).toLocaleString('en-GB');
  if (value > 0) return `+${absolute}`;
  if (value < 0) return `-${absolute}`;
  return '0';
}

export function formatInvestmentPercent(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function parseMarketMeritAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function parseMarketUnits(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) return null;
  const units = Number(trimmed);
  return units > 0 ? units : null;
}

export function estimateUnitsBought(merits: number, priceMerits: number): number {
  if (merits <= 0 || priceMerits <= 0) return 0;
  return merits / priceMerits;
}

export function estimateGrossSaleMerits(units: number, priceMerits: number): number {
  if (units <= 0 || priceMerits <= 0) return 0;
  return Math.floor(units * priceMerits);
}

export function totalMarketNetWorth(account: InvestmentAccount | undefined): number {
  if (!account) return 0;
  return account.investmentCashMerits + account.portfolioValueMerits;
}

export function totalHoldingDayChange(account: InvestmentAccount | undefined): number {
  return account?.holdings.reduce((sum, holding) => sum + holding.dayChangeMerits, 0) ?? 0;
}

export function totalHoldingDayChangePct(account: InvestmentAccount | undefined): number {
  const dayChange = totalHoldingDayChange(account);
  const previousValue = (account?.portfolioValueMerits ?? 0) - dayChange;
  return previousValue > 0 ? (dayChange / previousValue) * 100 : 0;
}

export function portfolioTrendForRange(
  account: InvestmentAccount | undefined,
  range: MarketTrendRange,
): {
  changeMerits: number;
  changePct: number;
  currentValue: number;
  points: number[];
  startValue: number;
} {
  const currentValue = totalMarketNetWorth(account);
  const holdings = account?.holdings ?? [];
  const days = marketTrendDays(range);
  const pointCount = Math.max(2, Math.min(days, 30));

  if (holdings.length === 0) {
    return {
      changeMerits: 0,
      changePct: 0,
      currentValue,
      points: currentValue > 0 ? [currentValue, currentValue] : [],
      startValue: currentValue,
    };
  }

  const cashMerits = account?.investmentCashMerits ?? 0;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const remainingDays = days * (1 - index / (pointCount - 1 || 1));
    return holdings.reduce((sum, holding) => {
      const dailyRate = Math.max(-0.2, Math.min(0.2, holding.dayChangePct / 100));
      const divisor = Math.pow(Math.max(0.01, 1 + dailyRate), remainingDays);
      return sum + Math.floor(holding.currentValueMerits / divisor);
    }, cashMerits);
  });
  const startValue = points[0] ?? currentValue;
  const changeMerits = currentValue - startValue;
  const changePct = startValue > 0 ? (changeMerits / startValue) * 100 : 0;

  return {
    changeMerits,
    changePct,
    currentValue,
    points,
    startValue,
  };
}

function marketTrendDays(range: MarketTrendRange): number {
  if (range === '1D') return 1;
  if (range === '1W') return 7;
  if (range === '1M') return 30;
  return 90;
}

export function marketInstrumentRows(
  marketData: InvestmentMarketData | undefined,
  filter: MarketFilter,
): MarketInstrumentRow[] {
  if (!marketData) return [];

  const snapshotsByInstrument = new Map(
    marketData.snapshots.map((snapshot) => [snapshot.instrumentId, snapshot]),
  );
  return marketData.instruments
    .filter((instrument) => {
      if (filter === 'Crypto') return instrument.kind === 'crypto';
      if (filter === 'ETFs') return instrument.kind === 'etf';
      if (filter === 'Stocks') return instrument.kind === 'stock';
      return true;
    })
    .slice()
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.symbol.localeCompare(right.symbol),
    )
    .map((instrument) => ({
      instrument,
      snapshot: snapshotsByInstrument.get(instrument.id),
    }));
}

export function transactionLabel(transaction: InvestmentTransaction): string {
  switch (transaction.type) {
    case 'Buy':
      return 'Buy';
    case 'Sell':
      return 'Sell';
    case 'Dividend':
      return 'Dividend';
  }
}
