import type { RouterOutputs } from '../../lib/trpc';

export type InvestmentAccount = RouterOutputs['investment']['account'];
export type InvestmentMarketData = RouterOutputs['investment']['marketData'];
export type InvestmentInstrument = InvestmentMarketData['instruments'][number];
export type InvestmentSnapshot = InvestmentMarketData['snapshots'][number];
export type InvestmentTransaction = InvestmentAccount['transactions'][number];
export type InvestmentHolding = InvestmentAccount['holdings'][number];
export type MarketFilter = 'All' | 'Stocks' | 'ETFs' | 'Crypto';

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

export function totalMarketNetWorth(account: InvestmentAccount | undefined): number {
  if (!account) return 0;
  return account.investmentCashMerits + account.portfolioValueMerits;
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
