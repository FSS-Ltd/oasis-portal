import type { ProviderDividendEvent, ProviderQuoteSnapshot } from '@oasis/domain/investmentMarketData';
import type { FinnhubDividendEvent, FinnhubNewsItem } from '@oasis/domain/investmentMarketData';

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
  category: string | null;
  summary: string | null;
  themeColor: string | null;
  newsSymbol: string | null;
  dividendSymbol: string | null;
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

export interface InvestmentNewsItemDto {
  id: string;
  instrumentId: string;
  provider: string;
  providerNewsId: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  createdAt: Date;
}

export interface InvestmentDividendEventDto {
  id: string;
  instrumentId: string;
  provider: string;
  providerEventId: string;
  exDate: Date;
  payDate: Date | null;
  sourceCurrency: string;
  amountSource: number;
  gbpConversionRate: number;
  amountGbp: number;
  amountMerits: number;
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
  category?: string | null;
  summary?: string | null;
  themeColor?: string | null;
  newsSymbol?: string | null;
  dividendSymbol?: string | null;
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

interface InvestmentNewsItemRow {
  id: string;
  instrumentId: string;
  provider: string;
  providerNewsId: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  createdAt: Date;
}

interface InvestmentDividendEventRow {
  id: string;
  instrumentId: string;
  provider: string;
  providerEventId: string;
  exDate: Date;
  payDate: Date | null;
  sourceCurrency: string;
  amountSource: DecimalLike;
  gbpConversionRate: DecimalLike;
  amountGbp: DecimalLike;
  amountMerits: DecimalLike;
  createdAt: Date;
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

interface NewsFindManyArgs {
  where: { instrumentId: string };
  orderBy: { publishedAt: 'desc' };
  take: number;
}

interface NewsUpsertArgs {
  where: { provider_providerNewsId: { provider: string; providerNewsId: string } };
  create: {
    instrumentId: string;
    provider: string;
    providerNewsId: string;
    headline: string;
    summary: string;
    source: string;
    url: string;
    imageUrl?: string;
    publishedAt: Date;
  };
  update: {
    headline: string;
    summary: string;
    source: string;
    url: string;
    imageUrl?: string | null;
    publishedAt: Date;
  };
}

interface DividendFindManyArgs {
  where: { instrumentId: string };
  orderBy: { exDate: 'desc' };
  take: number;
}

interface DividendUpsertArgs {
  where: { provider_providerEventId: { provider: string; providerEventId: string } };
  create: {
    instrumentId: string;
    provider: string;
    providerEventId: string;
    exDate: Date;
    payDate?: Date;
    sourceCurrency: string;
    amountSource: number;
    gbpConversionRate: number;
    amountGbp: number;
    amountMerits: number;
  };
  update: {
    payDate?: Date | null;
    sourceCurrency: string;
    amountSource: number;
    gbpConversionRate: number;
    amountGbp: number;
    amountMerits: number;
  };
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

export interface InvestmentMarketEnrichmentStorageDb extends InvestmentMarketDataStorageDb {
  investmentNewsItem: {
    findMany(args: NewsFindManyArgs): Promise<InvestmentNewsItemRow[]>;
    upsert(args: NewsUpsertArgs): Promise<InvestmentNewsItemRow>;
  };
  investmentDividendEvent: {
    findMany(args: DividendFindManyArgs): Promise<InvestmentDividendEventRow[]>;
    upsert(args: DividendUpsertArgs): Promise<InvestmentDividendEventRow>;
  };
}

function toNumber(value: DecimalLike): number {
  return Number(value.toString());
}

function mapInstrument(row: InvestmentInstrumentRow): InvestmentInstrumentDto {
  return {
    category: row.category ?? null,
    displayName: row.displayName,
    dividendSymbol: row.dividendSymbol ?? null,
    exchangeMic: row.exchangeMic,
    id: row.id,
    kind: row.kind,
    newsSymbol: row.newsSymbol ?? null,
    provider: row.provider,
    providerSymbol: row.providerSymbol,
    riskBand: row.riskBand,
    sortOrder: row.sortOrder,
    sourceCurrency: row.sourceCurrency,
    summary: row.summary ?? null,
    symbol: row.symbol,
    themeColor: row.themeColor ?? null,
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

function mapNewsItem(row: InvestmentNewsItemRow): InvestmentNewsItemDto {
  return {
    createdAt: row.createdAt,
    headline: row.headline,
    id: row.id,
    imageUrl: row.imageUrl,
    instrumentId: row.instrumentId,
    provider: row.provider,
    providerNewsId: row.providerNewsId,
    publishedAt: row.publishedAt,
    source: row.source,
    summary: row.summary,
    url: row.url,
  };
}

function mapDividendEvent(row: InvestmentDividendEventRow): InvestmentDividendEventDto {
  return {
    amountGbp: toNumber(row.amountGbp),
    amountMerits: toNumber(row.amountMerits),
    amountSource: toNumber(row.amountSource),
    createdAt: row.createdAt,
    exDate: row.exDate,
    gbpConversionRate: toNumber(row.gbpConversionRate),
    id: row.id,
    instrumentId: row.instrumentId,
    payDate: row.payDate,
    provider: row.provider,
    providerEventId: row.providerEventId,
    sourceCurrency: row.sourceCurrency,
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

export async function loadInvestmentInstrumentNews(input: {
  db: InvestmentMarketEnrichmentStorageDb;
  instrumentId: string;
  take?: number;
}): Promise<InvestmentNewsItemDto[]> {
  const rows = await input.db.investmentNewsItem.findMany({
    orderBy: { publishedAt: 'desc' },
    take: input.take ?? 5,
    where: { instrumentId: input.instrumentId },
  });
  return rows.map(mapNewsItem);
}

export async function loadInvestmentDividendEvents(input: {
  db: InvestmentMarketEnrichmentStorageDb;
  instrumentId: string;
  take?: number;
}): Promise<InvestmentDividendEventDto[]> {
  const rows = await input.db.investmentDividendEvent.findMany({
    orderBy: { exDate: 'desc' },
    take: input.take ?? 6,
    where: { instrumentId: input.instrumentId },
  });
  return rows.map(mapDividendEvent);
}

export async function persistFinnhubNewsItems(input: {
  db: InvestmentMarketEnrichmentStorageDb;
  instrumentId: string;
  items: readonly FinnhubNewsItem[];
}): Promise<number> {
  let persisted = 0;
  for (const item of input.items) {
    const create: NewsUpsertArgs['create'] = {
      headline: item.headline,
      instrumentId: input.instrumentId,
      provider: 'finnhub',
      providerNewsId: item.providerNewsId,
      publishedAt: item.publishedAt,
      source: item.source,
      summary: item.summary,
      url: item.url,
    };
    const update: NewsUpsertArgs['update'] = {
      headline: item.headline,
      imageUrl: item.imageUrl ?? null,
      publishedAt: item.publishedAt,
      source: item.source,
      summary: item.summary,
      url: item.url,
    };
    if (item.imageUrl) create.imageUrl = item.imageUrl;
    await input.db.investmentNewsItem.upsert({
      create,
      update,
      where: {
        provider_providerNewsId: {
          provider: 'finnhub',
          providerNewsId: item.providerNewsId,
        },
      },
    });
    persisted += 1;
  }
  return persisted;
}

export async function persistFinnhubDividendEvents(input: {
  db: InvestmentMarketEnrichmentStorageDb;
  instrumentId: string;
  events: readonly FinnhubDividendEvent[];
  gbpConversionRateByCurrency: Readonly<Record<string, number>>;
}): Promise<number> {
  return persistInvestmentDividendEvents({
    ...input,
    provider: 'finnhub',
  });
}

export async function persistInvestmentDividendEvents(input: {
  db: InvestmentMarketEnrichmentStorageDb;
  instrumentId: string;
  provider: string;
  events: readonly ProviderDividendEvent[];
  gbpConversionRateByCurrency: Readonly<Record<string, number>>;
}): Promise<number> {
  let persisted = 0;
  for (const event of input.events) {
    const gbpConversionRate = input.gbpConversionRateByCurrency[event.sourceCurrency] ?? 1;
    const create: DividendUpsertArgs['create'] = {
      amountGbp: event.amountGbp,
      amountMerits: event.amountMerits,
      amountSource: event.amountSource,
      exDate: event.exDate,
      gbpConversionRate,
      instrumentId: input.instrumentId,
      provider: input.provider,
      providerEventId: event.providerEventId,
      sourceCurrency: event.sourceCurrency,
    };
    const update: DividendUpsertArgs['update'] = {
      amountGbp: event.amountGbp,
      amountMerits: event.amountMerits,
      amountSource: event.amountSource,
      gbpConversionRate,
      payDate: event.payDate ?? null,
      sourceCurrency: event.sourceCurrency,
    };
    if (event.payDate) create.payDate = event.payDate;
    await input.db.investmentDividendEvent.upsert({
      create,
      update,
      where: {
        provider_providerEventId: {
          provider: input.provider,
          providerEventId: event.providerEventId,
        },
      },
    });
    persisted += 1;
  }
  return persisted;
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
