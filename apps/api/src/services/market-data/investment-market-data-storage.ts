import type { ProviderQuoteSnapshot } from '@oasis/domain/investmentMarketData';

type DecimalLike = { toString(): string } | number | string;

export interface InvestmentInstrumentDto {
  id: string;
  symbol: string;
  provider: string;
  providerSymbol: string;
  displayName: string;
  kind: string;
  exchangeMic: string;
  sourceCurrency: string;
  riskBand: string;
  sortOrder: number;
}

export interface MarketDataSnapshotDto {
  id: string;
  instrumentId: string;
  symbol: string;
  provider: string;
  providerTimestamp: Date;
  serverFetchedAt: Date;
  sourceCurrency: string;
  sourcePrice: number;
  gbpConversionRate: number;
  gbpPrice: number;
  previousCloseGbp: number;
  dayChangePct: number;
  rawPayloadHash: string;
  providerCreditsUsed: number | null;
  providerCreditsLeft: number | null;
  createdAt: Date;
}

interface InvestmentInstrumentRow {
  id: string;
  symbol: string;
  provider: string;
  providerSymbol: string;
  displayName: string;
  kind: string;
  exchangeMic: string;
  sourceCurrency: string;
  riskBand: string;
  enabled: boolean;
  sortOrder: number;
}

interface MarketDataSnapshotRow {
  id: string;
  instrumentId: string;
  provider: string;
  providerTimestamp: Date;
  serverFetchedAt: Date;
  sourceCurrency: string;
  sourcePrice: DecimalLike;
  gbpConversionRate: DecimalLike;
  gbpPrice: DecimalLike;
  previousCloseGbp: DecimalLike;
  dayChangePct: DecimalLike;
  rawPayloadHash: string;
  providerCreditsUsed: number | null;
  providerCreditsLeft: number | null;
  createdAt: Date;
  instrument: InvestmentInstrumentRow;
}

interface InvestmentInstrumentFindManyArgs {
  where: { enabled: true };
  orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }];
}

interface InvestmentInstrumentFindFirstArgs {
  where: {
    provider: string;
    providerSymbol: string;
    enabled: true;
  };
}

interface MarketDataSnapshotFindManyArgs {
  where: { instrumentId: { in: string[] } };
  include: { instrument: true };
  orderBy: [{ instrumentId: 'asc' }, { serverFetchedAt: 'desc' }];
}

interface MarketDataSnapshotCountArgs {
  where: {
    provider: string;
    serverFetchedAt: {
      gte: Date;
      lt: Date;
    };
  };
}

interface MarketDataSnapshotCreateArgs {
  data: {
    instrumentId: string;
    provider: string;
    providerTimestamp: Date;
    serverFetchedAt: Date;
    sourceCurrency: string;
    sourcePrice: number;
    gbpConversionRate: number;
    gbpPrice: number;
    previousCloseGbp: number;
    dayChangePct: number;
    rawPayloadHash: string;
    providerCreditsUsed?: number;
    providerCreditsLeft?: number;
  };
  include: { instrument: true };
}

export interface InvestmentMarketDataStorageDb {
  investmentInstrument: {
    findMany(args: InvestmentInstrumentFindManyArgs): Promise<InvestmentInstrumentRow[]>;
    findFirst(args: InvestmentInstrumentFindFirstArgs): Promise<InvestmentInstrumentRow | null>;
  };
  marketDataSnapshot: {
    findMany(args: MarketDataSnapshotFindManyArgs): Promise<MarketDataSnapshotRow[]>;
    create(args: MarketDataSnapshotCreateArgs): Promise<MarketDataSnapshotRow>;
    count(args: MarketDataSnapshotCountArgs): Promise<number>;
  };
}

function toNumber(value: DecimalLike): number {
  return Number(value.toString());
}

function mapInstrument(row: InvestmentInstrumentRow): InvestmentInstrumentDto {
  return {
    displayName: row.displayName,
    exchangeMic: row.exchangeMic,
    id: row.id,
    kind: row.kind,
    provider: row.provider,
    providerSymbol: row.providerSymbol,
    riskBand: row.riskBand,
    sortOrder: row.sortOrder,
    sourceCurrency: row.sourceCurrency,
    symbol: row.symbol,
  };
}

function mapSnapshot(row: MarketDataSnapshotRow): MarketDataSnapshotDto {
  return {
    createdAt: row.createdAt,
    dayChangePct: toNumber(row.dayChangePct),
    gbpConversionRate: toNumber(row.gbpConversionRate),
    gbpPrice: toNumber(row.gbpPrice),
    id: row.id,
    instrumentId: row.instrumentId,
    previousCloseGbp: toNumber(row.previousCloseGbp),
    provider: row.provider,
    providerCreditsLeft: row.providerCreditsLeft,
    providerCreditsUsed: row.providerCreditsUsed,
    providerTimestamp: row.providerTimestamp,
    rawPayloadHash: row.rawPayloadHash,
    serverFetchedAt: row.serverFetchedAt,
    sourceCurrency: row.sourceCurrency,
    sourcePrice: toNumber(row.sourcePrice),
    symbol: row.instrument.symbol,
  };
}

export async function listEnabledInvestmentInstruments(
  db: InvestmentMarketDataStorageDb,
): Promise<InvestmentInstrumentDto[]> {
  const rows = await db.investmentInstrument.findMany({
    orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }],
    where: { enabled: true },
  });
  return rows.map(mapInstrument);
}

export async function loadLatestMarketDataSnapshots(
  db: InvestmentMarketDataStorageDb,
): Promise<MarketDataSnapshotDto[]> {
  const instruments = await db.investmentInstrument.findMany({
    orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }],
    where: { enabled: true },
  });
  if (instruments.length === 0) return [];

  const rows = await db.marketDataSnapshot.findMany({
    include: { instrument: true },
    orderBy: [{ instrumentId: 'asc' }, { serverFetchedAt: 'desc' }],
    where: { instrumentId: { in: instruments.map((instrument) => instrument.id) } },
  });

  const latestByInstrument = new Map<string, MarketDataSnapshotRow>();
  for (const row of rows) {
    const current = latestByInstrument.get(row.instrumentId);
    if (!current || row.serverFetchedAt.getTime() > current.serverFetchedAt.getTime()) {
      latestByInstrument.set(row.instrumentId, row);
    }
  }

  return instruments
    .map((instrument) => latestByInstrument.get(instrument.id))
    .filter((row): row is MarketDataSnapshotRow => Boolean(row))
    .map(mapSnapshot);
}

export async function countMarketDataSnapshots(input: {
  db: InvestmentMarketDataStorageDb;
  provider: string;
  from: Date;
  to: Date;
}): Promise<number> {
  return input.db.marketDataSnapshot.count({
    where: {
      provider: input.provider,
      serverFetchedAt: {
        gte: input.from,
        lt: input.to,
      },
    },
  });
}

export async function persistProviderQuoteSnapshot(input: {
  db: InvestmentMarketDataStorageDb;
  quote: ProviderQuoteSnapshot;
  rawPayloadHash: string;
}): Promise<MarketDataSnapshotDto> {
  const rawPayloadHash = input.rawPayloadHash.trim();
  if (!rawPayloadHash) {
    throw new Error('rawPayloadHash is required for market data snapshots');
  }

  const instrument = await input.db.investmentInstrument.findFirst({
    where: {
      enabled: true,
      provider: input.quote.provider,
      providerSymbol: input.quote.symbol,
    },
  });
  if (!instrument) {
    throw new Error(
      `enabled investment instrument not found for ${input.quote.provider}:${input.quote.symbol}`,
    );
  }

  const data: MarketDataSnapshotCreateArgs['data'] = {
    dayChangePct: input.quote.dayChangePct,
    gbpConversionRate: input.quote.gbpConversionRate,
    gbpPrice: input.quote.gbpPrice,
    instrumentId: instrument.id,
    previousCloseGbp: input.quote.previousCloseGbp,
    provider: input.quote.provider,
    providerTimestamp: input.quote.providerTimestamp,
    rawPayloadHash,
    serverFetchedAt: input.quote.serverFetchedAt,
    sourceCurrency: input.quote.sourceCurrency,
    sourcePrice: input.quote.sourcePrice,
  };
  if (input.quote.providerCreditsLeft !== undefined) {
    data.providerCreditsLeft = input.quote.providerCreditsLeft;
  }
  if (input.quote.providerCreditsUsed !== undefined) {
    data.providerCreditsUsed = input.quote.providerCreditsUsed;
  }

  const row = await input.db.marketDataSnapshot.create({
    data,
    include: { instrument: true },
  });

  return mapSnapshot(row);
}
