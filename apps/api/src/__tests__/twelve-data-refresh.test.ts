import { describe, expect, it, vi } from 'vitest';
import {
  createTwelveDataMarketDataProvider,
  isLondonStockMarketOpen,
  refreshTwelveDataQuotes,
  type TwelveDataQuoteProvider,
} from '../services/market-data/twelve-data-refresh.js';

interface StoredInvestmentInstrument {
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

interface StoredMarketDataSnapshot {
  id: string;
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
  providerCreditsUsed: number | null;
  providerCreditsLeft: number | null;
  createdAt: Date;
  instrument: StoredInvestmentInstrument;
}

interface InstrumentFindManyArgs {
  where?: { enabled?: boolean };
}

interface InstrumentFindFirstArgs {
  where: {
    provider: string;
    providerSymbol: string;
    enabled: boolean;
  };
}

interface SnapshotFindManyArgs {
  where?: { instrumentId?: { in: string[] } };
}

interface SnapshotCreateArgs {
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

interface SnapshotCountArgs {
  where: {
    provider: string;
    serverFetchedAt: { gte: Date; lt: Date };
  };
}

function sortInstruments(
  left: StoredInvestmentInstrument,
  right: StoredInvestmentInstrument,
): number {
  return left.sortOrder - right.sortOrder || left.symbol.localeCompare(right.symbol);
}

function makeInstrument(
  input: Partial<StoredInvestmentInstrument> & Pick<StoredInvestmentInstrument, 'id' | 'symbol'>,
): StoredInvestmentInstrument {
  return {
    displayName: input.symbol,
    enabled: true,
    exchangeMic: 'XLON',
    kind: 'etf',
    provider: 'twelve-data',
    providerSymbol: input.symbol,
    riskBand: 'medium',
    sortOrder: 1,
    sourceCurrency: 'GBP',
    ...input,
  };
}

function makeSnapshot(input: {
  id: string;
  instrument: StoredInvestmentInstrument;
  serverFetchedAt: Date;
}): StoredMarketDataSnapshot {
  return {
    createdAt: input.serverFetchedAt,
    dayChangePct: 0.5,
    gbpConversionRate: 1,
    gbpPrice: 100,
    id: input.id,
    instrument: input.instrument,
    instrumentId: input.instrument.id,
    previousCloseGbp: 99,
    provider: 'twelve-data',
    providerCreditsLeft: null,
    providerCreditsUsed: null,
    providerTimestamp: input.serverFetchedAt,
    rawPayloadHash: `sha256:${input.id}`,
    serverFetchedAt: input.serverFetchedAt,
    sourceCurrency: input.instrument.sourceCurrency,
    sourcePrice: 100,
  };
}

function makeDb(input: {
  instruments: StoredInvestmentInstrument[];
  snapshots?: StoredMarketDataSnapshot[];
}) {
  const snapshots = input.snapshots ?? [];

  return {
    auditLog: {
      create: vi.fn((args: unknown) => Promise.resolve(args)),
    },
    investmentInstrument: {
      findMany: vi.fn((args: InstrumentFindManyArgs) =>
        Promise.resolve(
          input.instruments
            .filter((instrument) =>
              args.where?.enabled === undefined ? true : instrument.enabled === args.where.enabled,
            )
            .sort(sortInstruments),
        ),
      ),
      findFirst: vi.fn((args: InstrumentFindFirstArgs) =>
        Promise.resolve(
          input.instruments.find(
            (instrument) =>
              instrument.provider === args.where.provider &&
              instrument.providerSymbol === args.where.providerSymbol &&
              instrument.enabled === args.where.enabled,
          ) ?? null,
        ),
      ),
    },
    marketDataSnapshot: {
      count: vi.fn((args: SnapshotCountArgs) =>
        Promise.resolve(
          snapshots.filter(
            (snapshot) =>
              snapshot.provider === args.where.provider &&
              snapshot.serverFetchedAt >= args.where.serverFetchedAt.gte &&
              snapshot.serverFetchedAt < args.where.serverFetchedAt.lt,
          ).length,
        ),
      ),
      create: vi.fn((args: SnapshotCreateArgs) => {
        const instrument = input.instruments.find(
          (candidate) => candidate.id === args.data.instrumentId,
        );
        if (!instrument) throw new Error('missing fake instrument');

        const row: StoredMarketDataSnapshot = {
          ...args.data,
          createdAt: args.data.serverFetchedAt,
          id: `snapshot-${String(snapshots.length + 1)}`,
          instrument,
          providerCreditsLeft: args.data.providerCreditsLeft ?? null,
          providerCreditsUsed: args.data.providerCreditsUsed ?? null,
        };
        snapshots.push(row);
        return Promise.resolve(row);
      }),
      findMany: vi.fn((args: SnapshotFindManyArgs) =>
        Promise.resolve(
          snapshots.filter((snapshot) =>
            args.where?.instrumentId
              ? args.where.instrumentId.in.includes(snapshot.instrumentId)
              : true,
          ),
        ),
      ),
    },
    snapshots,
  };
}

function quotePayload(input: {
  currency?: string;
  close?: string;
  previousClose?: string;
  symbol: string;
}) {
  return {
    close: input.close ?? '100.00',
    currency: input.currency ?? 'GBP',
    mic_code: 'XLON',
    name: input.symbol,
    percent_change: '1.25',
    previous_close: input.previousClose ?? '98.00',
    symbol: input.symbol,
    timestamp: '1780672500',
  };
}

function makeProvider(payloads: Record<string, unknown>): {
  getQuote: ReturnType<typeof vi.fn>;
  provider: TwelveDataQuoteProvider;
} {
  const getQuote = vi.fn((symbol: string): ReturnType<TwelveDataQuoteProvider['getQuote']> => {
    const payload = payloads[symbol];
    if (payload === undefined) {
      return Promise.reject(new Error(`missing provider payload for ${symbol}`));
    }
    return Promise.resolve({
      payload,
      rawPayloadHash: `sha256:${symbol}`,
    });
  });

  return {
    getQuote,
    provider: { getQuote },
  };
}

describe('isLondonStockMarketOpen', () => {
  it('uses the London regular session and weekends', () => {
    expect(isLondonStockMarketOpen(new Date('2026-06-05T08:30:00.000Z'))).toBe(true);
    expect(isLondonStockMarketOpen(new Date('2026-06-05T17:00:00.000Z'))).toBe(false);
    expect(isLondonStockMarketOpen(new Date('2026-06-06T10:00:00.000Z'))).toBe(false);
  });
});

describe('refreshTwelveDataQuotes', () => {
  it('skips scheduled refreshes while the London market is closed', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const db = makeDb({ instruments: [instrument] });
    const { getQuote, provider } = makeProvider({ VUSA: quotePayload({ symbol: 'VUSA' }) });

    await expect(
      refreshTwelveDataQuotes({
        auditUserId: null,
        db,
        mode: 'scheduled',
        now: new Date('2026-06-06T10:00:00.000Z'),
        provider,
      }),
    ).resolves.toMatchObject({
      attemptedSymbols: [],
      refreshedCount: 0,
      status: 'market_closed',
    });
    expect(getQuote).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('persists normalized quotes and uses provider FX only for non-GBP instruments', async () => {
    const gbpInstrument = makeInstrument({ id: 'instrument-vusa', sortOrder: 1, symbol: 'VUSA' });
    const usdInstrument = makeInstrument({
      exchangeMic: 'XNAS',
      id: 'instrument-aapl',
      kind: 'stock',
      sortOrder: 2,
      sourceCurrency: 'USD',
      symbol: 'AAPL',
    });
    const db = makeDb({ instruments: [gbpInstrument, usdInstrument] });
    const { getQuote, provider } = makeProvider({
      AAPL: quotePayload({
        close: '200.00',
        currency: 'USD',
        previousClose: '198.00',
        symbol: 'AAPL',
      }),
      'USD/GBP': quotePayload({ close: '0.80', currency: 'GBP', symbol: 'USD/GBP' }),
      VUSA: quotePayload({
        close: '75.00',
        currency: 'GBP',
        previousClose: '74.00',
        symbol: 'VUSA',
      }),
    });

    const result = await refreshTwelveDataQuotes({
      auditUserId: 'head-user',
      db,
      mode: 'manual',
      now: new Date('2026-06-05T12:00:00.000Z'),
      provider,
    });

    expect(result).toMatchObject({
      attemptedSymbols: ['VUSA', 'AAPL'],
      refreshedCount: 2,
      status: 'updated',
    });
    expect(getQuote).toHaveBeenCalledWith('USD/GBP');
    expect(db.snapshots).toEqual([
      expect.objectContaining({ gbpPrice: 75, instrumentId: 'instrument-vusa' }),
      expect.objectContaining({
        gbpConversionRate: 0.8,
        gbpPrice: 160,
        instrumentId: 'instrument-aapl',
      }),
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'Create',
        entity: 'MarketDataSnapshot',
        userId: 'head-user',
      }) as unknown,
    });
  });

  it('blocks provider calls when the persisted quota window is exhausted', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const now = new Date('2026-06-05T12:00:30.000Z');
    const db = makeDb({
      instruments: [instrument],
      snapshots: Array.from({ length: 8 }, (_, index) =>
        makeSnapshot({
          id: `existing-${String(index)}`,
          instrument,
          serverFetchedAt: new Date('2026-06-05T12:00:10.000Z'),
        }),
      ),
    });
    const { getQuote, provider } = makeProvider({ VUSA: quotePayload({ symbol: 'VUSA' }) });

    await expect(
      refreshTwelveDataQuotes({
        auditUserId: 'head-user',
        db,
        mode: 'manual',
        now,
        provider,
      }),
    ).resolves.toMatchObject({
      refreshedCount: 0,
      skippedSymbols: ['VUSA'],
      status: 'quota_exhausted',
    });
    expect(getQuote).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'Update',
        entity: 'MarketDataSnapshot',
        meta: expect.objectContaining({ status: 'quota_exhausted' }) as unknown,
      }) as unknown,
    });
  });

  it('returns cached stale data and audits when provider fetches fail', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const db = makeDb({
      instruments: [instrument],
      snapshots: [
        makeSnapshot({
          id: 'old-snapshot',
          instrument,
          serverFetchedAt: new Date('2026-06-05T08:00:00.000Z'),
        }),
      ],
    });
    const { provider } = makeProvider({});

    await expect(
      refreshTwelveDataQuotes({
        auditUserId: 'head-user',
        db,
        maxSnapshotAgeMs: 60_000,
        mode: 'manual',
        now: new Date('2026-06-05T12:00:00.000Z'),
        provider,
      }),
    ).resolves.toMatchObject({
      freshness: 'stale',
      refreshedCount: 0,
      status: 'stale',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'Update',
        entity: 'MarketDataSnapshot',
        meta: expect.objectContaining({ status: 'stale' }) as unknown,
      }) as unknown,
    });
  });
});

describe('createTwelveDataMarketDataProvider', () => {
  it('retries transient server failures and returns hashed payload metadata', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('{"status":"error","message":"temporary"}', { status: 500 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(quotePayload({ symbol: 'VUSA' })), {
          headers: {
            'api-credits-left': '792',
            'api-credits-used': '8',
          },
          status: 200,
        }),
      );
    const provider = createTwelveDataMarketDataProvider({
      backoffMs: 0,
      config: { apiKey: 'test-key', baseUrl: 'https://example.test' },
      fetchImpl,
      maxRetries: 1,
    });

    await expect(provider.getQuote('VUSA')).resolves.toMatchObject({
      httpStatus: 200,
      providerCreditsLeft: 792,
      providerCreditsUsed: 8,
      rawPayloadHash: expect.stringMatching(/^sha256:/) as unknown,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstRequest = fetchImpl.mock.calls[0]?.[0];
    expect(typeof firstRequest).toBe('string');
    expect(firstRequest as string).toContain('/quote?symbol=VUSA&apikey=test-key');
  });
});
