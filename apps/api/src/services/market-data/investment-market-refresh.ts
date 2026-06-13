import { Prisma } from '@oasis/db';
import {
  applyLearningReturnMultiplier,
  buildMarketDataMeritValuation,
  forecastSimulatedDividendEvents,
  normaliseFinnhubNewsResponse,
  normaliseTwelveDataQuoteResponse,
  normaliseYahooFinanceDividendResponse,
  normaliseYahooFinanceQuoteResponse,
  planInvestmentDividendPayment,
  type InvestmentMarketInstrumentKind,
  type LedgerRow,
  type MarketDataNormalisationError,
  type YahooFinanceQuoteContext,
} from '@oasis/domain';
import {
  countMarketDataSnapshots,
  listEnabledInvestmentInstruments,
  loadInvestmentDividendEvents,
  loadInvestmentInstrumentNews,
  loadLatestMarketDataSnapshots,
  persistInvestmentDividendEvents,
  persistFinnhubNewsItems,
  persistProviderQuoteSnapshot,
  type InvestmentDividendEventDto,
  type InvestmentInstrumentDto,
  type InvestmentMarketDataStorageDb,
  type InvestmentMarketEnrichmentStorageDb,
  type InvestmentNewsItemDto,
  type MarketDataSnapshotDto,
} from './investment-market-data-storage.js';
import {
  createTwelveDataMarketDataProvider,
  quoteNormalisationMeta,
  type TwelveDataQuoteProvider,
} from './twelve-data-provider.js';
import { type TwelveDataConfig } from './twelve-data-config.js';
import {
  createYahooFinanceProvider,
  type YahooFinanceConfig,
  type YahooFinanceProvider,
} from './yahoo-finance-provider.js';
import {
  createFinnhubProvider,
  type FinnhubConfig,
  type FinnhubProvider,
} from './finnhub-provider.js';

const TWELVE_DATA_PROVIDER = 'twelve-data';
const YAHOO_PROVIDER = 'yahoo-finance';
const SIMULATED_DIVIDEND_PROVIDER = 'merit-markets-simulation';
const FREE_TIER_DAILY_CREDITS = 800;
const FREE_TIER_MINUTE_CREDITS = 8;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DEFAULT_MIN_REFRESH_INTERVAL_MS = 15 * MINUTE_MS;
const DEFAULT_MAX_SNAPSHOT_AGE_MS = 20 * MINUTE_MS;
const NEWS_LOOKBACK_DAYS = 7;
const DIVIDEND_LOOKAHEAD_DAYS = 90;
const UNIT_SCALE = 1_000_000;

type AuditAction = 'Create' | 'Update' | 'PermissionDenied';

interface AuditCreateArgs {
  data: {
    userId: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string;
    meta?: unknown;
  };
}

interface DividendTransactionRow {
  studentId: string;
  type: 'Buy' | 'Sell' | 'Dividend';
  units: Prisma.Decimal;
}

interface DividendEventRow {
  id: string;
  instrumentId: string;
  exDate: Date;
  amountMerits: Prisma.Decimal;
}

interface DividendTransactionFindManyArgs {
  where: {
    instrumentId: string;
    createdAt: { lte: Date };
    type: { in: ['Buy', 'Sell'] };
  };
  orderBy: { createdAt: 'asc' };
  select: {
    studentId: true;
    type: true;
    units: true;
  };
}

interface DividendEventFindManyArgs {
  where: { exDate: { lte: Date } };
  select: { id: true; instrumentId: true; exDate: true; amountMerits: true };
}

interface DividendPaymentFindUniqueArgs {
  where: { studentId_dividendEventId: { studentId: string; dividendEventId: string } };
  select: { id: true };
}

interface DividendTransactionCreateArgs {
  data: {
    studentId: string;
    type: 'Dividend';
    instrumentId: string;
    units: Prisma.Decimal;
    nav: Prisma.Decimal;
    feeMerits: number;
    grossMerits: number;
    taxMerits: number;
    costBasisMerits: null;
  };
  select: { id: true };
}

interface DividendPaymentCreateArgs {
  data: {
    studentId: string;
    dividendEventId: string;
    transactionId: string;
    units: Prisma.Decimal;
    payoutMerits: number;
  };
}

interface InvestmentInstrumentDisableArgs {
  data: { enabled: false };
  select: { id: true };
  where: { id: string };
}

interface LedgerCreateManyArgs {
  data: LedgerRow[];
}

export interface InvestmentMarketRefreshDb extends InvestmentMarketEnrichmentStorageDb {
  auditLog: {
    create(args: AuditCreateArgs): Promise<unknown>;
  };
  investmentInstrument: InvestmentMarketEnrichmentStorageDb['investmentInstrument'] & {
    update(args: InvestmentInstrumentDisableArgs): Promise<{ id: string }>;
  };
  investmentTransaction: {
    findMany(args: DividendTransactionFindManyArgs): Promise<DividendTransactionRow[]>;
    create(args: DividendTransactionCreateArgs): Promise<{ id: string }>;
  };
  investmentDividendEvent: InvestmentMarketEnrichmentStorageDb['investmentDividendEvent'] & {
    findMany(args: DividendEventFindManyArgs): Promise<DividendEventRow[]>;
  };
  investmentDividendPayment: {
    findUnique(args: DividendPaymentFindUniqueArgs): Promise<{ id: string } | null>;
    create(args: DividendPaymentCreateArgs): Promise<unknown>;
  };
  meritLedger: {
    createMany(args: LedgerCreateManyArgs): Promise<unknown>;
  };
}

export type MarketDataRefreshMode = 'manual' | 'scheduled';
export type MarketDataFreshness = 'fresh' | 'stale' | 'empty';
export type MarketDataRefreshStatus =
  | 'updated'
  | 'partial_failure'
  | 'stale'
  | 'fresh'
  | 'empty'
  | 'quota_exhausted';

export interface MarketDataInstrumentDto {
  id: string;
  symbol: string;
  displayName: string;
  kind: InvestmentMarketInstrumentKind;
  provider: string;
  providerSymbol: string;
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

export interface MarketDataSnapshotValuationDto {
  id: string;
  instrumentId: string;
  symbol: string;
  provider: string;
  providerTimestamp: Date;
  serverFetchedAt: Date;
  sourceCurrency: string;
  dayChangePct: number;
  priceMerits: number;
  previousCloseMerits: number;
  dailyMovementMerits: number;
  learningDayChangePct: number;
  learningDailyMovementMerits: number;
  rawPayloadHash: string;
  providerCreditsUsed: number | null;
  providerCreditsLeft: number | null;
  createdAt: Date;
}

export interface CachedMarketDataResult {
  freshness: MarketDataFreshness;
  instruments: MarketDataInstrumentDto[];
  snapshots: MarketDataSnapshotValuationDto[];
}

export interface InstrumentDetailResult {
  instrument: MarketDataInstrumentDto;
  latestSnapshot: MarketDataSnapshotValuationDto | null;
  news: InvestmentNewsItemDto[];
  dividends: InvestmentDividendEventDto[];
}

export interface MarketDataRefreshResult extends CachedMarketDataResult {
  attemptedSymbols: string[];
  failed: Array<{ symbol: string; error: MarketDataNormalisationError | { message: string } }>;
  mode: MarketDataRefreshMode;
  refreshedCount: number;
  skippedSymbols: string[];
  status: MarketDataRefreshStatus;
  newsRefreshedCount: number;
  dividendEventsRefreshedCount: number;
  dividendPaymentsCreated: number;
}

export interface RefreshInvestmentMarketDataOptions {
  auditUserId: string | null;
  db: InvestmentMarketRefreshDb;
  mode: MarketDataRefreshMode;
  now?: Date;
  yahooProvider?: YahooFinanceProvider;
  twelveDataProvider?: TwelveDataQuoteProvider;
  finnhubProvider?: FinnhubProvider;
  yahooConfig?: YahooFinanceConfig;
  twelveDataConfig?: TwelveDataConfig;
  finnhubConfig?: FinnhubConfig;
  minRefreshIntervalMs?: number;
  maxSnapshotAgeMs?: number;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMinute(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
    ),
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value.toString());
}

function toSixDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function isTradableKind(kind: string): kind is InvestmentMarketInstrumentKind {
  return kind === 'stock' || kind === 'etf' || kind === 'crypto';
}

function mapInstrument(row: InvestmentInstrumentDto): MarketDataInstrumentDto | null {
  if (!isTradableKind(row.kind)) return null;
  return {
    category: row.category,
    displayName: row.displayName,
    dividendSymbol: row.dividendSymbol,
    exchangeMic: row.exchangeMic,
    id: row.id,
    kind: row.kind,
    newsSymbol: row.newsSymbol,
    provider: row.provider,
    providerSymbol: row.providerSymbol,
    riskBand: row.riskBand,
    sortOrder: row.sortOrder,
    sourceCurrency: row.sourceCurrency,
    summary: row.summary,
    symbol: row.symbol,
    themeColor: row.themeColor,
  };
}

function latestSnapshotMap(snapshots: MarketDataSnapshotDto[]): Map<string, MarketDataSnapshotDto> {
  return new Map(snapshots.map((snapshot) => [snapshot.instrumentId, snapshot]));
}

function marketDataFreshness(
  snapshots: MarketDataSnapshotDto[],
  now: Date,
  maxSnapshotAgeMs: number,
): MarketDataFreshness {
  if (snapshots.length === 0) return 'empty';
  const newest = snapshots.reduce((latest, snapshot) =>
    snapshot.serverFetchedAt > latest.serverFetchedAt ? snapshot : latest,
  );
  return now.getTime() - newest.serverFetchedAt.getTime() > maxSnapshotAgeMs ? 'stale' : 'fresh';
}

function mapSnapshotValuation(snapshot: MarketDataSnapshotDto): MarketDataSnapshotValuationDto {
  const valuation = buildMarketDataMeritValuation({
    gbpPrice: snapshot.gbpPrice,
    previousCloseGbp: snapshot.previousCloseGbp,
  });
  const learningDayReturnRate = applyLearningReturnMultiplier(snapshot.dayChangePct / 100, 'daily');

  return {
    createdAt: snapshot.createdAt,
    dailyMovementMerits: valuation.dailyMovementMerits,
    dayChangePct: snapshot.dayChangePct,
    id: snapshot.id,
    instrumentId: snapshot.instrumentId,
    learningDailyMovementMerits: Number(
      (valuation.previousCloseMerits * learningDayReturnRate).toFixed(6),
    ),
    learningDayChangePct: Number((learningDayReturnRate * 100).toFixed(6)),
    previousCloseMerits: valuation.previousCloseMerits,
    priceMerits: valuation.priceMerits,
    provider: snapshot.provider,
    providerCreditsLeft: snapshot.providerCreditsLeft,
    providerCreditsUsed: snapshot.providerCreditsUsed,
    providerTimestamp: snapshot.providerTimestamp,
    rawPayloadHash: snapshot.rawPayloadHash,
    serverFetchedAt: snapshot.serverFetchedAt,
    sourceCurrency: snapshot.sourceCurrency,
    symbol: snapshot.symbol,
  };
}

async function readCachedMarketDataSnapshots(input: {
  db: InvestmentMarketDataStorageDb;
  now?: Date;
  maxSnapshotAgeMs?: number;
}): Promise<{
  freshness: MarketDataFreshness;
  instruments: MarketDataInstrumentDto[];
  snapshots: MarketDataSnapshotDto[];
}> {
  const now = input.now ?? new Date();
  const [instruments, snapshots] = await Promise.all([
    listEnabledInvestmentInstruments(input.db),
    loadLatestMarketDataSnapshots(input.db),
  ]);
  const tradableInstruments = instruments
    .map(mapInstrument)
    .filter((item): item is MarketDataInstrumentDto => Boolean(item));
  const instrumentIds = new Set(tradableInstruments.map((instrument) => instrument.id));
  const tradableSnapshots = snapshots.filter((snapshot) =>
    instrumentIds.has(snapshot.instrumentId),
  );
  return {
    freshness: marketDataFreshness(
      tradableSnapshots,
      now,
      input.maxSnapshotAgeMs ?? DEFAULT_MAX_SNAPSHOT_AGE_MS,
    ),
    instruments: tradableInstruments,
    snapshots: tradableSnapshots,
  };
}

function mapCachedMarketDataResult(cached: {
  freshness: MarketDataFreshness;
  instruments: MarketDataInstrumentDto[];
  snapshots: MarketDataSnapshotDto[];
}): CachedMarketDataResult {
  return {
    freshness: cached.freshness,
    instruments: cached.instruments,
    snapshots: cached.snapshots.map(mapSnapshotValuation),
  };
}

export async function readCachedInvestmentMarketData(input: {
  db: InvestmentMarketDataStorageDb;
  now?: Date;
  maxSnapshotAgeMs?: number;
}): Promise<CachedMarketDataResult> {
  return mapCachedMarketDataResult(await readCachedMarketDataSnapshots(input));
}

export async function readInvestmentInstrumentDetail(input: {
  db: InvestmentMarketEnrichmentStorageDb;
  instrumentId: string;
  now?: Date;
  maxSnapshotAgeMs?: number;
}): Promise<InstrumentDetailResult | null> {
  const cacheInput: {
    db: InvestmentMarketDataStorageDb;
    maxSnapshotAgeMs?: number;
    now?: Date;
  } = {
    db: input.db,
  };
  if (input.maxSnapshotAgeMs !== undefined) {
    cacheInput.maxSnapshotAgeMs = input.maxSnapshotAgeMs;
  }
  if (input.now !== undefined) {
    cacheInput.now = input.now;
  }
  const cached = await readCachedInvestmentMarketData(cacheInput);
  const instrument = cached.instruments.find((candidate) => candidate.id === input.instrumentId);
  if (!instrument) return null;
  const [news, dividends] = await Promise.all([
    loadInvestmentInstrumentNews({ db: input.db, instrumentId: input.instrumentId }),
    loadInvestmentDividendEvents({ db: input.db, instrumentId: input.instrumentId }),
  ]);
  return {
    dividends,
    instrument,
    latestSnapshot:
      cached.snapshots.find((snapshot) => snapshot.instrumentId === input.instrumentId) ?? null,
    news,
  };
}

async function quotaAvailable(input: {
  db: InvestmentMarketDataStorageDb;
  creditsNeeded: number;
  now: Date;
}): Promise<boolean> {
  if (input.creditsNeeded <= 0) return true;
  const dayStart = startOfUtcDay(input.now);
  const minuteStart = startOfUtcMinute(input.now);
  const [dailyCredits, minuteCredits] = await Promise.all([
    countMarketDataSnapshots({
      db: input.db,
      from: dayStart,
      provider: TWELVE_DATA_PROVIDER,
      to: addDays(dayStart, 1),
    }),
    countMarketDataSnapshots({
      db: input.db,
      from: minuteStart,
      provider: TWELVE_DATA_PROVIDER,
      to: new Date(minuteStart.getTime() + MINUTE_MS),
    }),
  ]);

  return (
    dailyCredits + input.creditsNeeded <= FREE_TIER_DAILY_CREDITS &&
    minuteCredits + input.creditsNeeded <= FREE_TIER_MINUTE_CREDITS
  );
}

function selectRefreshBatch(input: {
  instruments: MarketDataInstrumentDto[];
  latestByInstrument: Map<string, MarketDataSnapshotDto>;
  maxBatchSize: number;
  minRefreshIntervalMs: number;
  mode: MarketDataRefreshMode;
  now: Date;
}): MarketDataInstrumentDto[] {
  return input.instruments
    .filter((instrument) => {
      const snapshot = input.latestByInstrument.get(instrument.id);
      if (!snapshot) return true;
      if (input.mode === 'manual') return true;
      return input.now.getTime() - snapshot.serverFetchedAt.getTime() >= input.minRefreshIntervalMs;
    })
    .sort((left, right) => {
      const leftSnapshot = input.latestByInstrument.get(left.id);
      const rightSnapshot = input.latestByInstrument.get(right.id);
      const leftTime = leftSnapshot?.serverFetchedAt.getTime() ?? 0;
      const rightTime = rightSnapshot?.serverFetchedAt.getTime() ?? 0;
      return (
        leftTime - rightTime ||
        left.sortOrder - right.sortOrder ||
        left.symbol.localeCompare(right.symbol)
      );
    })
    .slice(0, input.maxBatchSize);
}

async function loadGbpConversionRates(input: {
  currencies: readonly string[];
  yahooProvider: YahooFinanceProvider;
}): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};
  for (const currency of [...new Set(input.currencies.map((item) => item.trim().toUpperCase()))]) {
    rates[currency] = await input.yahooProvider.getGbpRate(currency);
  }
  return rates;
}

async function refreshQuotes(input: {
  auditUserId: string | null;
  db: InvestmentMarketRefreshDb;
  instruments: MarketDataInstrumentDto[];
  latestByInstrument: Map<string, MarketDataSnapshotDto>;
  mode: MarketDataRefreshMode;
  now: Date;
  yahooProvider: YahooFinanceProvider;
  twelveDataProvider: TwelveDataQuoteProvider;
  minRefreshIntervalMs: number;
}): Promise<{
  attemptedSymbols: string[];
  failed: MarketDataRefreshResult['failed'];
  refreshedCount: number;
  skippedSymbols: string[];
  quotaExhausted: boolean;
}> {
  const yahooInstruments = selectRefreshBatch({
    instruments: input.instruments.filter(
      (instrument) => instrument.provider === YAHOO_PROVIDER && instrument.kind !== 'crypto',
    ),
    latestByInstrument: input.latestByInstrument,
    maxBatchSize: 50,
    minRefreshIntervalMs: input.minRefreshIntervalMs,
    mode: input.mode,
    now: input.now,
  });
  const cryptoInstruments = selectRefreshBatch({
    instruments: input.instruments.filter(
      (instrument) => instrument.provider === TWELVE_DATA_PROVIDER && instrument.kind === 'crypto',
    ),
    latestByInstrument: input.latestByInstrument,
    maxBatchSize: FREE_TIER_MINUTE_CREDITS,
    minRefreshIntervalMs: input.minRefreshIntervalMs,
    mode: input.mode,
    now: input.now,
  });
  const selected = [...yahooInstruments, ...cryptoInstruments];
  const attemptedSymbols: string[] = [];
  const failed: MarketDataRefreshResult['failed'] = [];
  let refreshedCount = 0;

  if (
    cryptoInstruments.length > 0 &&
    !(await quotaAvailable({
      creditsNeeded: cryptoInstruments.length,
      db: input.db,
      now: input.now,
    }))
  ) {
    return {
      attemptedSymbols,
      failed,
      quotaExhausted: true,
      refreshedCount,
      skippedSymbols: selected.map((instrument) => instrument.symbol),
    };
  }

  let conversionRates: Record<string, number>;
  try {
    conversionRates = await loadGbpConversionRates({
      currencies: selected.map((instrument) => instrument.sourceCurrency),
      yahooProvider: input.yahooProvider,
    });
  } catch (err) {
    return {
      attemptedSymbols: selected.map((instrument) => instrument.symbol),
      failed: [
        {
          error: {
            message: err instanceof Error ? err.message : 'GBP conversion quote request failed',
          },
          symbol: 'GBP',
        },
      ],
      quotaExhausted: false,
      refreshedCount,
      skippedSymbols: input.instruments
        .filter((instrument) => !selected.some((candidate) => candidate.id === instrument.id))
        .map((instrument) => instrument.symbol),
    };
  }

  for (const instrument of selected) {
    attemptedSymbols.push(instrument.symbol);
    try {
      const quote =
        instrument.provider === YAHOO_PROVIDER
          ? await input.yahooProvider.getQuote(instrument.providerSymbol)
          : await input.twelveDataProvider.getQuote(instrument.providerSymbol);
      const normalised =
        instrument.provider === YAHOO_PROVIDER
          ? normaliseYahooQuote({
              conversionRates,
              instrument,
              now: input.now,
              quote,
            })
          : normaliseTwelveDataQuoteResponse(quote.payload, {
              exchangeMic: instrument.exchangeMic,
              gbpConversionRates: conversionRates,
              instrumentKind: instrument.kind,
              serverFetchedAt: input.now,
              sourceCurrency: instrument.sourceCurrency,
              symbol: instrument.providerSymbol,
              ...quoteNormalisationMeta(quote),
            });

      if (!normalised.ok) {
        failed.push({ error: normalised.error, symbol: instrument.symbol });
        if (
          instrument.provider === TWELVE_DATA_PROVIDER &&
          instrument.kind === 'crypto' &&
          isUnsupportedTwelveDataSymbol(normalised.error)
        ) {
          await disableUnsupportedCryptoInstrument({
            auditUserId: input.auditUserId,
            db: input.db,
            error: normalised.error,
            instrument,
          });
        }
        continue;
      }

      await persistProviderQuoteSnapshot({
        db: input.db,
        quote: normalised.value,
        rawPayloadHash: quote.rawPayloadHash,
      });
      refreshedCount += 1;
    } catch (err) {
      failed.push({
        error: { message: err instanceof Error ? err.message : 'market data request failed' },
        symbol: instrument.symbol,
      });
    }
  }

  return {
    attemptedSymbols,
    failed,
    quotaExhausted: false,
    refreshedCount,
    skippedSymbols: input.instruments
      .filter((instrument) => !selected.some((candidate) => candidate.id === instrument.id))
      .map((instrument) => instrument.symbol),
  };
}

function normaliseYahooQuote(input: {
  conversionRates: Record<string, number>;
  instrument: MarketDataInstrumentDto;
  now: Date;
  quote: Awaited<ReturnType<YahooFinanceProvider['getQuote']>>;
}): ReturnType<typeof normaliseYahooFinanceQuoteResponse> {
  const context: YahooFinanceQuoteContext = {
    exchangeMic: input.instrument.exchangeMic,
    gbpConversionRates: input.conversionRates,
    instrumentKind: input.instrument.kind,
    serverFetchedAt: input.now,
    symbol: input.instrument.providerSymbol,
  };
  if (input.quote.httpStatus !== undefined) {
    context.httpStatus = input.quote.httpStatus;
  }
  return normaliseYahooFinanceQuoteResponse(input.quote.payload, context);
}

function isUnsupportedTwelveDataSymbol(error: MarketDataNormalisationError): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === 'unsupported_instrument_type' ||
    error.providerStatus === 400 ||
    error.providerStatus === 404 ||
    message.includes('invalid symbol') ||
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('unsupported')
  );
}

async function disableUnsupportedCryptoInstrument(input: {
  auditUserId: string | null;
  db: InvestmentMarketRefreshDb;
  error: MarketDataNormalisationError;
  instrument: MarketDataInstrumentDto;
}): Promise<void> {
  const meta: Record<string, unknown> = {
    error: input.error.message,
    provider: TWELVE_DATA_PROVIDER,
    providerSymbol: input.instrument.providerSymbol,
    reason: 'unsupported-crypto-symbol',
    source: 'investment.refreshMarketData',
    symbol: input.instrument.symbol,
  };
  if (input.error.providerStatus !== undefined) {
    meta.providerStatus = input.error.providerStatus;
  }

  await input.db.investmentInstrument.update({
    data: { enabled: false },
    select: { id: true },
    where: { id: input.instrument.id },
  });
  await input.db.auditLog.create({
    data: {
      action: 'Update',
      entity: 'InvestmentInstrument',
      entityId: input.instrument.id,
      meta,
      userId: input.auditUserId,
    },
  });
}

async function refreshMarketEnrichment(input: {
  db: InvestmentMarketRefreshDb;
  finnhubProvider: FinnhubProvider;
  instruments: MarketDataInstrumentDto[];
  now: Date;
  yahooProvider: YahooFinanceProvider;
}): Promise<{
  failed: MarketDataRefreshResult['failed'];
  newsRefreshedCount: number;
  dividendEventsRefreshedCount: number;
}> {
  const failed: MarketDataRefreshResult['failed'] = [];
  let newsRefreshedCount = 0;
  let dividendEventsRefreshedCount = 0;
  const newsFrom = dateKey(addDays(input.now, -NEWS_LOOKBACK_DAYS));

  for (const instrument of input.instruments.filter(
    (item) => item.newsSymbol || item.dividendSymbol,
  )) {
    if (instrument.newsSymbol) {
      try {
        const response = await input.finnhubProvider.getCompanyNews(
          instrument.newsSymbol,
          newsFrom,
          dateKey(input.now),
        );
        const normalised = normaliseFinnhubNewsResponse(response.payload);
        if (!normalised.ok) {
          failed.push({ error: normalised.error, symbol: instrument.symbol });
        } else {
          newsRefreshedCount += await persistFinnhubNewsItems({
            db: input.db,
            instrumentId: instrument.id,
            items: normalised.value,
          });
        }
      } catch (err) {
        failed.push({
          error: { message: err instanceof Error ? err.message : 'Finnhub news request failed' },
          symbol: instrument.symbol,
        });
      }
    }

    if (instrument.dividendSymbol && instrument.kind !== 'crypto') {
      try {
        const rates = await loadGbpConversionRates({
          currencies: [instrument.sourceCurrency],
          yahooProvider: input.yahooProvider,
        });
        const response = await input.yahooProvider.getDividends(instrument.providerSymbol);
        const normalised = normaliseYahooFinanceDividendResponse(response.payload, {
          gbpConversionRates: rates,
          sourceCurrency: instrument.sourceCurrency,
          symbol: instrument.symbol,
        });
        if (!normalised.ok) {
          failed.push({ error: normalised.error, symbol: instrument.symbol });
        } else {
          dividendEventsRefreshedCount += await persistInvestmentDividendEvents({
            db: input.db,
            events: normalised.value,
            gbpConversionRateByCurrency: rates,
            instrumentId: instrument.id,
            provider: YAHOO_PROVIDER,
          });
          dividendEventsRefreshedCount += await persistInvestmentDividendEvents({
            db: input.db,
            events: forecastSimulatedDividendEvents(normalised.value, {
              gbpConversionRates: rates,
              horizonDays: DIVIDEND_LOOKAHEAD_DAYS,
              now: input.now,
              symbol: instrument.symbol,
            }),
            gbpConversionRateByCurrency: rates,
            instrumentId: instrument.id,
            provider: SIMULATED_DIVIDEND_PROVIDER,
          });
        }
      } catch (err) {
        failed.push({
          error: {
            message: err instanceof Error ? err.message : 'Yahoo Finance dividend request failed',
          },
          symbol: instrument.symbol,
        });
      }
    }
  }

  return { dividendEventsRefreshedCount, failed, newsRefreshedCount };
}

function unitsHeldAt(transactions: readonly DividendTransactionRow[]): Map<string, number> {
  const unitsByStudent = new Map<string, number>();
  for (const transaction of transactions) {
    const current = unitsByStudent.get(transaction.studentId) ?? 0;
    const units = toNumber(transaction.units);
    const next = transaction.type === 'Buy' ? current + units : current - units;
    unitsByStudent.set(
      transaction.studentId,
      Math.max(0, Math.floor(next * UNIT_SCALE) / UNIT_SCALE),
    );
  }
  return unitsByStudent;
}

async function processDividendPayments(input: {
  db: InvestmentMarketRefreshDb;
  now: Date;
}): Promise<number> {
  const events = await input.db.investmentDividendEvent.findMany({
    select: { amountMerits: true, exDate: true, id: true, instrumentId: true },
    where: { exDate: { lte: startOfUtcDay(input.now) } },
  });
  let paymentsCreated = 0;

  for (const event of events) {
    const transactions = await input.db.investmentTransaction.findMany({
      orderBy: { createdAt: 'asc' },
      select: { studentId: true, type: true, units: true },
      where: {
        createdAt: { lte: addDays(event.exDate, 1) },
        instrumentId: event.instrumentId,
        type: { in: ['Buy', 'Sell'] },
      },
    });

    for (const [studentId, units] of unitsHeldAt(transactions).entries()) {
      const existing = await input.db.investmentDividendPayment.findUnique({
        select: { id: true },
        where: { studentId_dividendEventId: { dividendEventId: event.id, studentId } },
      });
      if (existing || units <= 0) continue;

      const plan = planInvestmentDividendPayment({
        amountMeritsPerUnit: toNumber(event.amountMerits),
        studentId,
        units,
      });
      if (plan.payoutMerits <= 0) continue;

      const transaction = await input.db.investmentTransaction.create({
        data: {
          costBasisMerits: null,
          feeMerits: 0,
          grossMerits: plan.payoutMerits,
          instrumentId: event.instrumentId,
          nav: toSixDecimal(toNumber(event.amountMerits)),
          studentId,
          taxMerits: 0,
          type: 'Dividend',
          units: toSixDecimal(units),
        },
        select: { id: true },
      });
      await input.db.meritLedger.createMany({ data: plan.ledgerRows });
      await input.db.investmentDividendPayment.create({
        data: {
          dividendEventId: event.id,
          payoutMerits: plan.payoutMerits,
          studentId,
          transactionId: transaction.id,
          units: toSixDecimal(units),
        },
      });
      paymentsCreated += 1;
    }
  }

  return paymentsCreated;
}

async function auditRefresh(input: {
  auditUserId: string | null;
  db: InvestmentMarketRefreshDb;
  result: MarketDataRefreshResult;
}): Promise<void> {
  if (
    input.result.failed.length === 0 &&
    input.result.refreshedCount === 0 &&
    input.result.newsRefreshedCount === 0 &&
    input.result.dividendEventsRefreshedCount === 0 &&
    input.result.dividendPaymentsCreated === 0 &&
    (input.result.status === 'fresh' || input.result.status === 'empty')
  ) {
    return;
  }

  await input.db.auditLog.create({
    data: {
      action: input.result.status === 'updated' ? 'Create' : 'Update',
      entity: 'MarketDataSnapshot',
      meta: {
        attemptedSymbols: input.result.attemptedSymbols,
        dividendEventsRefreshedCount: input.result.dividendEventsRefreshedCount,
        dividendPaymentsCreated: input.result.dividendPaymentsCreated,
        failed: input.result.failed.map((failure) => ({
          error: failure.error.message,
          symbol: failure.symbol,
        })),
        mode: input.result.mode,
        newsRefreshedCount: input.result.newsRefreshedCount,
        refreshedCount: input.result.refreshedCount,
        skippedSymbols: input.result.skippedSymbols,
        source: 'investment.refreshMarketData',
        status: input.result.status,
      },
      userId: input.auditUserId,
    },
  });
}

function fallbackStatus(freshness: MarketDataFreshness): MarketDataRefreshStatus {
  if (freshness === 'empty') return 'empty';
  if (freshness === 'stale') return 'stale';
  return 'fresh';
}

export async function refreshInvestmentMarketData(
  options: RefreshInvestmentMarketDataOptions,
): Promise<MarketDataRefreshResult> {
  const now = options.now ?? new Date();
  const maxSnapshotAgeMs = options.maxSnapshotAgeMs ?? DEFAULT_MAX_SNAPSHOT_AGE_MS;
  const cached = await readCachedMarketDataSnapshots({
    db: options.db,
    maxSnapshotAgeMs,
    now,
  });
  const cachedResult = mapCachedMarketDataResult(cached);
  const latestByInstrument = latestSnapshotMap(cached.snapshots);

  if (cached.instruments.length === 0) {
    return {
      ...cachedResult,
      attemptedSymbols: [],
      dividendEventsRefreshedCount: 0,
      dividendPaymentsCreated: 0,
      failed: [],
      mode: options.mode,
      newsRefreshedCount: 0,
      refreshedCount: 0,
      skippedSymbols: [],
      status: 'empty',
    };
  }

  const yahooProvider =
    options.yahooProvider ??
    createYahooFinanceProvider(options.yahooConfig ? { config: options.yahooConfig } : {});
  const twelveDataProvider =
    options.twelveDataProvider ??
    createTwelveDataMarketDataProvider(
      options.twelveDataConfig ? { config: options.twelveDataConfig } : {},
    );

  const quoteResult = await refreshQuotes({
    auditUserId: options.auditUserId,
    db: options.db,
    instruments: cached.instruments,
    latestByInstrument,
    minRefreshIntervalMs: options.minRefreshIntervalMs ?? DEFAULT_MIN_REFRESH_INTERVAL_MS,
    mode: options.mode,
    now,
    twelveDataProvider,
    yahooProvider,
  });

  let enrichmentResult: Awaited<ReturnType<typeof refreshMarketEnrichment>> = {
    dividendEventsRefreshedCount: 0,
    failed: [],
    newsRefreshedCount: 0,
  };
  if (cached.instruments.some((instrument) => instrument.newsSymbol || instrument.dividendSymbol)) {
    try {
      const finnhubProvider =
        options.finnhubProvider ??
        createFinnhubProvider(options.finnhubConfig ? { config: options.finnhubConfig } : {});
      enrichmentResult = await refreshMarketEnrichment({
        db: options.db,
        finnhubProvider,
        instruments: cached.instruments,
        now,
        yahooProvider,
      });
    } catch (err) {
      enrichmentResult = {
        dividendEventsRefreshedCount: 0,
        failed: [
          {
            error: {
              message: err instanceof Error ? err.message : 'Finnhub enrichment failed',
            },
            symbol: 'FINNHUB',
          },
        ],
        newsRefreshedCount: 0,
      };
    }
  }

  const dividendPaymentsCreated = await processDividendPayments({ db: options.db, now });
  const latest = await readCachedMarketDataSnapshots({
    db: options.db,
    maxSnapshotAgeMs,
    now,
  });
  const latestResult = mapCachedMarketDataResult(latest);
  const allFailed = [...quoteResult.failed, ...enrichmentResult.failed];
  const changed =
    quoteResult.refreshedCount +
    enrichmentResult.newsRefreshedCount +
    enrichmentResult.dividendEventsRefreshedCount +
    dividendPaymentsCreated;
  const status: MarketDataRefreshStatus = quoteResult.quotaExhausted
    ? 'quota_exhausted'
    : changed > 0 && allFailed.length === 0
      ? 'updated'
      : changed > 0
        ? 'partial_failure'
        : fallbackStatus(latest.freshness);
  const result: MarketDataRefreshResult = {
    ...latestResult,
    attemptedSymbols: quoteResult.attemptedSymbols,
    dividendEventsRefreshedCount: enrichmentResult.dividendEventsRefreshedCount,
    dividendPaymentsCreated,
    failed: allFailed,
    mode: options.mode,
    newsRefreshedCount: enrichmentResult.newsRefreshedCount,
    refreshedCount: quoteResult.refreshedCount,
    skippedSymbols: quoteResult.skippedSymbols,
    status,
  };
  await auditRefresh({ auditUserId: options.auditUserId, db: options.db, result });
  return result;
}
