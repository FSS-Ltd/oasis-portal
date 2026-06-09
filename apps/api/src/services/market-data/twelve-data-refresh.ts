import {
  buildMarketDataMeritValuation,
  normaliseTwelveDataQuoteResponse,
  type InvestmentMarketInstrumentKind,
  type MarketDataNormalisationError,
} from '@oasis/domain/investmentMarketData';
import { isLondonStockMarketOpen } from './london-market-hours.js';
import {
  countMarketDataSnapshots,
  listEnabledInvestmentInstruments,
  loadLatestMarketDataSnapshots,
  persistProviderQuoteSnapshot,
  type InvestmentInstrumentDto,
  type InvestmentMarketDataStorageDb,
  type MarketDataSnapshotDto,
} from './investment-market-data-storage.js';
import {
  createTwelveDataMarketDataProvider,
  quoteNormalisationMeta,
  type TwelveDataQuoteProvider,
} from './twelve-data-provider.js';
import type { TwelveDataConfig } from './twelve-data-config.js';

export { isLondonStockMarketOpen } from './london-market-hours.js';
export {
  createTwelveDataMarketDataProvider,
  type TwelveDataQuoteProvider,
} from './twelve-data-provider.js';

const PROVIDER = 'twelve-data';
const FREE_TIER_DAILY_CREDITS = 800;
const FREE_TIER_MINUTE_CREDITS = 8;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DEFAULT_MIN_REFRESH_INTERVAL_MS = 5 * MINUTE_MS;
const DEFAULT_MAX_SNAPSHOT_AGE_MS = 15 * MINUTE_MS;

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

export interface TwelveDataRefreshDb extends InvestmentMarketDataStorageDb {
  auditLog: {
    create(args: AuditCreateArgs): Promise<unknown>;
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
  | 'market_closed'
  | 'quota_exhausted';

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
  rawPayloadHash: string;
  providerCreditsUsed: number | null;
  providerCreditsLeft: number | null;
  createdAt: Date;
}

export interface CachedMarketDataResult {
  freshness: MarketDataFreshness;
  snapshots: MarketDataSnapshotValuationDto[];
}

export interface MarketDataRefreshResult extends CachedMarketDataResult {
  attemptedSymbols: string[];
  failed: Array<{ symbol: string; error: MarketDataNormalisationError | { message: string } }>;
  mode: MarketDataRefreshMode;
  refreshedCount: number;
  skippedSymbols: string[];
  status: MarketDataRefreshStatus;
}

export interface RefreshTwelveDataQuotesOptions {
  auditUserId: string | null;
  db: TwelveDataRefreshDb;
  mode: MarketDataRefreshMode;
  now?: Date;
  provider?: TwelveDataQuoteProvider;
  config?: TwelveDataConfig;
  minRefreshIntervalMs?: number;
  maxSnapshotAgeMs?: number;
  closedDates?: Set<string>;
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

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

function sourceCurrencyNeedsProviderFx(sourceCurrency: string): boolean {
  const normalised = sourceCurrency.trim().toUpperCase();
  return normalised !== 'GBP' && normalised !== 'GBX' && sourceCurrency.trim() !== 'GBp';
}

function creditCostFor(instruments: InvestmentInstrumentDto[]): number {
  return instruments.length + providerFxCurrencyCodes(instruments).size;
}

function providerFxCurrencyCodes(instruments: InvestmentInstrumentDto[]): Set<string> {
  return new Set(
    instruments
      .map((instrument) => instrument.sourceCurrency)
      .filter(sourceCurrencyNeedsProviderFx)
      .map((currency) => currency.trim().toUpperCase()),
  );
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

interface CachedMarketDataSnapshots {
  freshness: MarketDataFreshness;
  snapshots: MarketDataSnapshotDto[];
}

function mapSnapshotValuation(snapshot: MarketDataSnapshotDto): MarketDataSnapshotValuationDto {
  const valuation = buildMarketDataMeritValuation({
    gbpPrice: snapshot.gbpPrice,
    previousCloseGbp: snapshot.previousCloseGbp,
  });

  return {
    createdAt: snapshot.createdAt,
    dailyMovementMerits: valuation.dailyMovementMerits,
    dayChangePct: snapshot.dayChangePct,
    id: snapshot.id,
    instrumentId: snapshot.instrumentId,
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

function mapCachedMarketDataResult(cached: CachedMarketDataSnapshots): CachedMarketDataResult {
  return {
    freshness: cached.freshness,
    snapshots: cached.snapshots.map(mapSnapshotValuation),
  };
}

async function readCachedMarketDataSnapshots(input: {
  db: InvestmentMarketDataStorageDb;
  now?: Date;
  maxSnapshotAgeMs?: number;
}): Promise<CachedMarketDataSnapshots> {
  const now = input.now ?? new Date();
  const snapshots = await loadLatestMarketDataSnapshots(input.db);
  return {
    freshness: marketDataFreshness(
      snapshots,
      now,
      input.maxSnapshotAgeMs ?? DEFAULT_MAX_SNAPSHOT_AGE_MS,
    ),
    snapshots,
  };
}

export async function readCachedInvestmentMarketData(input: {
  db: InvestmentMarketDataStorageDb;
  now?: Date;
  maxSnapshotAgeMs?: number;
}): Promise<CachedMarketDataResult> {
  return mapCachedMarketDataResult(await readCachedMarketDataSnapshots(input));
}

async function quotaAvailable(input: {
  db: InvestmentMarketDataStorageDb;
  creditsNeeded: number;
  now: Date;
}): Promise<boolean> {
  const dayStart = startOfUtcDay(input.now);
  const minuteStart = startOfUtcMinute(input.now);
  const [dailyCredits, minuteCredits] = await Promise.all([
    countMarketDataSnapshots({
      db: input.db,
      from: dayStart,
      provider: PROVIDER,
      to: addDays(dayStart, 1),
    }),
    countMarketDataSnapshots({
      db: input.db,
      from: minuteStart,
      provider: PROVIDER,
      to: addMinutes(minuteStart, 1),
    }),
  ]);

  return (
    dailyCredits + input.creditsNeeded <= FREE_TIER_DAILY_CREDITS &&
    minuteCredits + input.creditsNeeded <= FREE_TIER_MINUTE_CREDITS
  );
}

function selectRefreshBatch(input: {
  instruments: InvestmentInstrumentDto[];
  latestByInstrument: Map<string, MarketDataSnapshotDto>;
  minRefreshIntervalMs: number;
  mode: MarketDataRefreshMode;
  now: Date;
}): InvestmentInstrumentDto[] {
  const due = input.instruments
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
    });

  const selected: InvestmentInstrumentDto[] = [];
  for (const instrument of due) {
    const next = [...selected, instrument];
    if (creditCostFor(next) > FREE_TIER_MINUTE_CREDITS) continue;
    selected.push(instrument);
  }

  return selected;
}

async function loadGbpConversionRates(input: {
  instruments: InvestmentInstrumentDto[];
  provider: TwelveDataQuoteProvider;
}): Promise<Record<string, number>> {
  const rates: Record<string, number> = {};
  const currencies = [
    ...new Set(
      input.instruments
        .map((instrument) => instrument.sourceCurrency.trim().toUpperCase())
        .filter((currency) => sourceCurrencyNeedsProviderFx(currency)),
    ),
  ];

  for (const currency of currencies) {
    const quote = await input.provider.getQuote(`${currency}/GBP`);
    const parsed = zodLikeQuoteClose(quote.payload);
    if (!parsed || parsed <= 0) {
      throw new Error(`GBP conversion quote was invalid for ${currency}`);
    }
    rates[currency] = parsed;
  }

  return rates;
}

function zodLikeQuoteClose(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || !('close' in payload)) return null;
  const value = (payload as { close?: unknown }).close;
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function auditRefresh(input: {
  db: TwelveDataRefreshDb;
  result: MarketDataRefreshResult;
  auditUserId: string | null;
}): Promise<void> {
  if (
    input.result.failed.length === 0 &&
    input.result.status !== 'partial_failure' &&
    input.result.status !== 'quota_exhausted' &&
    input.result.status !== 'stale' &&
    input.result.status !== 'updated'
  ) {
    return;
  }

  await input.db.auditLog.create({
    data: {
      action: input.result.status === 'updated' ? 'Create' : 'Update',
      entity: 'MarketDataSnapshot',
      meta: {
        attemptedSymbols: input.result.attemptedSymbols,
        failed: input.result.failed.map((failure) => ({
          error: failure.error.message,
          symbol: failure.symbol,
        })),
        mode: input.result.mode,
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

export async function refreshTwelveDataQuotes(
  options: RefreshTwelveDataQuotesOptions,
): Promise<MarketDataRefreshResult> {
  const now = options.now ?? new Date();
  const maxSnapshotAgeMs = options.maxSnapshotAgeMs ?? DEFAULT_MAX_SNAPSHOT_AGE_MS;
  const cached = await readCachedMarketDataSnapshots({
    db: options.db,
    maxSnapshotAgeMs,
    now,
  });
  const cachedResult = mapCachedMarketDataResult(cached);

  if (
    options.mode === 'scheduled' &&
    !isLondonStockMarketOpen(now, options.closedDates ? { closedDates: options.closedDates } : {})
  ) {
    return {
      ...cachedResult,
      attemptedSymbols: [],
      failed: [],
      mode: options.mode,
      refreshedCount: 0,
      skippedSymbols: [],
      status: 'market_closed',
    };
  }

  const instruments = await listEnabledInvestmentInstruments(options.db);
  if (instruments.length === 0) {
    return {
      ...cachedResult,
      attemptedSymbols: [],
      failed: [],
      mode: options.mode,
      refreshedCount: 0,
      skippedSymbols: [],
      status: 'empty',
    };
  }

  const latestByInstrument = latestSnapshotMap(cached.snapshots);
  const selected = selectRefreshBatch({
    instruments,
    latestByInstrument,
    minRefreshIntervalMs: options.minRefreshIntervalMs ?? DEFAULT_MIN_REFRESH_INTERVAL_MS,
    mode: options.mode,
    now,
  });

  if (selected.length === 0) {
    return {
      ...cachedResult,
      attemptedSymbols: [],
      failed: [],
      mode: options.mode,
      refreshedCount: 0,
      skippedSymbols: [],
      status: fallbackStatus(cached.freshness),
    };
  }

  const creditsNeeded = creditCostFor(selected);
  if (!(await quotaAvailable({ creditsNeeded, db: options.db, now }))) {
    const result: MarketDataRefreshResult = {
      ...cachedResult,
      attemptedSymbols: [],
      failed: [],
      mode: options.mode,
      refreshedCount: 0,
      skippedSymbols: selected.map((instrument) => instrument.symbol),
      status: 'quota_exhausted',
    };
    await auditRefresh({ auditUserId: options.auditUserId, db: options.db, result });
    return result;
  }

  const provider =
    options.provider ??
    createTwelveDataMarketDataProvider(options.config ? { config: options.config } : {});
  let conversionRates: Record<string, number>;
  try {
    conversionRates = await loadGbpConversionRates({ instruments: selected, provider });
  } catch (err) {
    const result: MarketDataRefreshResult = {
      ...cachedResult,
      attemptedSymbols: selected.map((instrument) => instrument.symbol),
      failed: [
        {
          error: {
            message: err instanceof Error ? err.message : 'GBP conversion quote request failed',
          },
          symbol: 'FX',
        },
      ],
      mode: options.mode,
      refreshedCount: 0,
      skippedSymbols: instruments
        .filter(
          (instrument) =>
            !selected.some((selectedInstrument) => selectedInstrument.id === instrument.id),
        )
        .map((instrument) => instrument.symbol),
      status: fallbackStatus(cached.freshness),
    };
    await auditRefresh({ auditUserId: options.auditUserId, db: options.db, result });
    return result;
  }
  const failed: MarketDataRefreshResult['failed'] = [];
  const refreshed: MarketDataSnapshotDto[] = [];

  for (const instrument of selected) {
    try {
      const quote = await provider.getQuote(instrument.providerSymbol);
      const quoteContext = {
        exchangeMic: instrument.exchangeMic,
        gbpConversionRates: conversionRates,
        instrumentKind: instrument.kind as InvestmentMarketInstrumentKind,
        serverFetchedAt: now,
        symbol: instrument.providerSymbol,
        ...quoteNormalisationMeta(quote),
      };
      const normalised = normaliseTwelveDataQuoteResponse(quote.payload, quoteContext);

      if (!normalised.ok) {
        failed.push({ error: normalised.error, symbol: instrument.symbol });
        continue;
      }

      refreshed.push(
        await persistProviderQuoteSnapshot({
          db: options.db,
          quote: normalised.value,
          rawPayloadHash: quote.rawPayloadHash,
        }),
      );
    } catch (err) {
      failed.push({
        error: { message: err instanceof Error ? err.message : 'Twelve Data request failed' },
        symbol: instrument.symbol,
      });
    }
  }

  const latest = await readCachedMarketDataSnapshots({
    db: options.db,
    maxSnapshotAgeMs,
    now,
  });
  const latestResult = mapCachedMarketDataResult(latest);
  const skippedSymbols = instruments
    .filter(
      (instrument) =>
        !selected.some((selectedInstrument) => selectedInstrument.id === instrument.id),
    )
    .map((instrument) => instrument.symbol);
  const status =
    refreshed.length > 0 && failed.length === 0
      ? 'updated'
      : refreshed.length > 0
        ? 'partial_failure'
        : fallbackStatus(latest.freshness);
  const result: MarketDataRefreshResult = {
    ...latestResult,
    attemptedSymbols: selected.map((instrument) => instrument.symbol),
    failed,
    mode: options.mode,
    refreshedCount: refreshed.length,
    skippedSymbols,
    status,
  };
  await auditRefresh({ auditUserId: options.auditUserId, db: options.db, result });
  return result;
}
