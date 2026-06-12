import { Prisma } from '@oasis/db';
import { describe, expect, it, vi } from 'vitest';
import {
  readCachedInvestmentMarketData,
  refreshInvestmentMarketData,
  type InvestmentMarketRefreshDb,
} from '../services/market-data/investment-market-refresh.js';
import type { TwelveDataQuoteProvider } from '../services/market-data/twelve-data-provider.js';
import type { YahooFinanceProvider } from '../services/market-data/yahoo-finance-provider.js';
import type { FinnhubProvider } from '../services/market-data/finnhub-provider.js';

interface StoredInstrument {
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

interface StoredSnapshot {
  id: string;
  instrumentId: string;
  provider: string;
  providerTimestamp: Date;
  serverFetchedAt: Date;
  sourceCurrency: string;
  sourcePrice: Prisma.Decimal;
  gbpConversionRate: Prisma.Decimal;
  gbpPrice: Prisma.Decimal;
  previousCloseGbp: Prisma.Decimal;
  dayChangePct: Prisma.Decimal;
  rawPayloadHash: string;
  providerCreditsUsed: number | null;
  providerCreditsLeft: number | null;
  createdAt: Date;
  instrument: StoredInstrument;
}

interface StoredNewsItem {
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

interface NewsUpsertInput {
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
  where: { provider_providerNewsId: { provider: string; providerNewsId: string } };
}

interface DividendUpsertInput {
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
  where: { provider_providerEventId: { provider: string; providerEventId: string } };
}

interface AuditCreateInput {
  data: {
    action: string;
    entity: string;
    entityId?: string;
    meta?: unknown;
    userId?: string | null;
  };
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function makeInstrument(input: Partial<StoredInstrument> & Pick<StoredInstrument, 'id' | 'symbol'>) {
  return {
    category: input.kind === 'crypto' ? 'Crypto' : 'Stock',
    displayName: input.symbol,
    dividendSymbol: null,
    enabled: true,
    exchangeMic: 'XNAS',
    kind: 'stock',
    newsSymbol: null,
    provider: 'yahoo-finance',
    providerSymbol: input.symbol,
    riskBand: 'high',
    sortOrder: 1,
    sourceCurrency: 'USD',
    summary: null,
    themeColor: '#2e5e8c',
    ...input,
  } satisfies StoredInstrument;
}

function makeDb(input: { instruments: StoredInstrument[]; transactions?: Array<{
  studentId: string;
  type: 'Buy' | 'Sell';
  instrumentId: string;
  units: number;
  createdAt: Date;
}> }) {
  const snapshots: StoredSnapshot[] = [];
  const newsItems: StoredNewsItem[] = [];
  const dividendEvents: Array<{
    id: string;
    instrumentId: string;
    provider: string;
    providerEventId: string;
    exDate: Date;
    payDate: Date | null;
    sourceCurrency: string;
    amountSource: Prisma.Decimal;
    gbpConversionRate: Prisma.Decimal;
    amountGbp: Prisma.Decimal;
    amountMerits: Prisma.Decimal;
    createdAt: Date;
  }> = [];
  const dividendPayments: unknown[] = [];
  const ledger: unknown[] = [];
  const transactions = input.transactions ?? [];
  let nextSnapshot = 1;
  let nextTransaction = 1;

  return {
    auditLog: {
      create: vi.fn((args: AuditCreateInput) => Promise.resolve(args)),
    },
    investmentInstrument: {
      findMany: vi.fn(() =>
        Promise.resolve(
          input.instruments
            .filter((instrument) => instrument.enabled)
            .sort((left, right) => left.sortOrder - right.sortOrder),
        ),
      ),
      findFirst: vi.fn((args: { where: { provider: string; providerSymbol: string; enabled: true } }) =>
        Promise.resolve(
          input.instruments.find(
            (instrument) =>
              instrument.provider === args.where.provider &&
              instrument.providerSymbol === args.where.providerSymbol &&
              instrument.enabled,
          ) ?? null,
        ),
      ),
      update: vi.fn((args: { data: { enabled: false }; where: { id: string } }) => {
        const instrument = input.instruments.find((item) => item.id === args.where.id);
        if (!instrument) throw new Error('missing instrument');
        instrument.enabled = args.data.enabled;
        return Promise.resolve({ id: instrument.id });
      }),
    },
    marketDataSnapshot: {
      count: vi.fn(() => Promise.resolve(0)),
      create: vi.fn((args: {
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
      }) => {
        const instrument = input.instruments.find((item) => item.id === args.data.instrumentId);
        if (!instrument) throw new Error('missing instrument');
        const row: StoredSnapshot = {
          createdAt: args.data.serverFetchedAt,
          dayChangePct: decimal(args.data.dayChangePct),
          gbpConversionRate: decimal(args.data.gbpConversionRate),
          gbpPrice: decimal(args.data.gbpPrice),
          id: `snapshot-${String(nextSnapshot++)}`,
          instrument,
          instrumentId: args.data.instrumentId,
          previousCloseGbp: decimal(args.data.previousCloseGbp),
          provider: args.data.provider,
          providerCreditsLeft: args.data.providerCreditsLeft ?? null,
          providerCreditsUsed: args.data.providerCreditsUsed ?? null,
          providerTimestamp: args.data.providerTimestamp,
          rawPayloadHash: args.data.rawPayloadHash,
          serverFetchedAt: args.data.serverFetchedAt,
          sourceCurrency: args.data.sourceCurrency,
          sourcePrice: decimal(args.data.sourcePrice),
        };
        snapshots.push(row);
        return Promise.resolve(row);
      }),
      findMany: vi.fn((args: { where?: { instrumentId?: { in: string[] } } }) =>
        Promise.resolve(
          snapshots.filter((snapshot) =>
            args.where?.instrumentId
              ? args.where.instrumentId.in.includes(snapshot.instrumentId)
              : true,
          ),
        ),
      ),
    },
    investmentNewsItem: {
      findMany: vi.fn((args: { where: { instrumentId: string }; take: number }) =>
        Promise.resolve(
          newsItems
            .filter((item) => item.instrumentId === args.where.instrumentId)
            .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
            .slice(0, args.take),
        ),
      ),
      upsert: vi.fn((args: NewsUpsertInput) => {
        const existing = newsItems.find(
          (item) =>
            item.provider === args.where.provider_providerNewsId.provider &&
            item.providerNewsId === args.where.provider_providerNewsId.providerNewsId,
        );
        if (existing) {
          existing.headline = args.update.headline;
          existing.summary = args.update.summary;
          existing.source = args.update.source;
          existing.url = args.update.url;
          existing.imageUrl = args.update.imageUrl ?? null;
          existing.publishedAt = args.update.publishedAt;
          return Promise.resolve(existing);
        }
        const row: StoredNewsItem = {
          ...args.create,
          createdAt: new Date('2026-06-16T12:00:00.000Z'),
          id: `news-${String(newsItems.length + 1)}`,
          imageUrl: args.create.imageUrl ?? null,
        };
        newsItems.push(row);
        return Promise.resolve(row);
      }),
    },
    investmentDividendEvent: {
      findMany: vi.fn((args: { where: { instrumentId?: string; exDate?: { lte: Date } } }) => {
        const exDateFilter = args.where.exDate;
        if (exDateFilter) {
          return Promise.resolve(
            dividendEvents.filter((event) => event.exDate <= exDateFilter.lte),
          );
        }
        return Promise.resolve(
          dividendEvents.filter((event) => event.instrumentId === args.where.instrumentId),
        );
      }),
      upsert: vi.fn((args: DividendUpsertInput) => {
        const existing = dividendEvents.find(
          (event) =>
            event.provider === args.where.provider_providerEventId.provider &&
            event.providerEventId === args.where.provider_providerEventId.providerEventId,
        );
        if (existing) {
          return Promise.resolve(existing);
        }
        const row = {
          ...args.create,
          amountGbp: decimal(args.create.amountGbp),
          amountMerits: decimal(args.create.amountMerits),
          amountSource: decimal(args.create.amountSource),
          createdAt: new Date('2026-06-16T12:00:00.000Z'),
          gbpConversionRate: decimal(args.create.gbpConversionRate),
          id: `dividend-event-${String(dividendEvents.length + 1)}`,
          payDate: args.create.payDate ?? null,
        };
        dividendEvents.push(row);
        return Promise.resolve(row);
      }),
    },
    investmentTransaction: {
      findMany: vi.fn((args: { where: { instrumentId: string; createdAt: { lte: Date } } }) =>
        Promise.resolve(
          transactions
            .filter((transaction) => transaction.instrumentId === args.where.instrumentId)
            .filter((transaction) => transaction.createdAt <= args.where.createdAt.lte)
            .map((transaction) => ({
              studentId: transaction.studentId,
              type: transaction.type,
              units: decimal(transaction.units),
            })),
        ),
      ),
      create: vi.fn(() => Promise.resolve({ id: `dividend-tx-${String(nextTransaction++)}` })),
    },
    investmentDividendPayment: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: unknown) => {
        dividendPayments.push(args);
        return Promise.resolve(args);
      }),
    },
    meritLedger: {
      createMany: vi.fn((args: { data: unknown[] }) => {
        ledger.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    snapshots,
    newsItems,
    dividendEvents,
    dividendPayments,
    ledger,
  } satisfies InvestmentMarketRefreshDb & {
    snapshots: StoredSnapshot[];
    newsItems: StoredNewsItem[];
    dividendEvents: unknown[];
    dividendPayments: unknown[];
    ledger: unknown[];
  };
}

function yahooPayload(symbol: string) {
  return {
    chart: {
      result: [
        {
          meta: {
            chartPreviousClose: 198,
            currency: 'USD',
            regularMarketPrice: 200,
            regularMarketTime: 1780672500,
            shortName: symbol,
            symbol,
          },
        },
      ],
    },
  };
}

describe('refreshInvestmentMarketData', () => {
  it('routes quotes and stores Finnhub news plus Yahoo-backed dividend simulation events', async () => {
    const stock = makeInstrument({
      dividendSymbol: 'AAPL',
      id: 'instrument-aapl',
      newsSymbol: 'AAPL',
      symbol: 'AAPL',
    });
    const crypto = makeInstrument({
      category: 'Crypto',
      displayName: 'Bitcoin',
      exchangeMic: 'CRYPTO',
      id: 'instrument-btc',
      kind: 'crypto',
      newsSymbol: 'BTC',
      provider: 'twelve-data',
      providerSymbol: 'BTC/USD',
      sortOrder: 2,
      symbol: 'BTC/USD',
    });
    const db = makeDb({
      instruments: [stock, crypto],
      transactions: [
        {
          createdAt: new Date('2026-06-10T12:00:00.000Z'),
          instrumentId: stock.id,
          studentId: 'student-1',
          type: 'Buy',
          units: 12.5,
        },
      ],
    });
    const yahooGetQuote = vi.fn((symbol: string) =>
      Promise.resolve({
        payload: yahooPayload(symbol),
        rawPayloadHash: `sha256:${symbol}`,
      }),
    );
    const yahooGetDividends = vi.fn(() =>
      Promise.resolve({
        payload: {
          chart: {
            result: [
              {
                events: {
                  dividends: {
                    1773667800: {
                      amount: 0.72,
                      date: 1773667800,
                    },
                    1781530200: {
                      amount: 0.75,
                      date: 1781530200,
                    },
                  },
                },
                meta: {
                  currency: 'USD',
                  symbol: 'AAPL',
                },
              },
            ],
          },
        },
        rawPayloadHash: 'sha256:yahoo-dividends',
      }),
    );
    const twelveDataGetQuote = vi.fn(() =>
      Promise.resolve({
        payload: {
          close: '63000.00',
          currency: 'USD',
          name: 'Bitcoin',
          percent_change: '2.5',
          previous_close: '62000.00',
          symbol: 'BTC/USD',
          timestamp: '1780672500',
        },
        rawPayloadHash: 'sha256:btc',
      }),
    );
    const yahooProvider: YahooFinanceProvider = {
      getDividends: yahooGetDividends,
      getGbpRate: vi.fn(() => Promise.resolve(0.8)),
      getQuote: yahooGetQuote,
    };
    const twelveDataProvider: TwelveDataQuoteProvider = {
      getQuote: twelveDataGetQuote,
    };
    const finnhubGetDividends = vi.fn();
    const finnhubProvider: FinnhubProvider = {
      getCompanyNews: vi.fn(() =>
        Promise.resolve({
          payload: [
            {
              datetime: 1780672500,
              headline: 'Apple education news',
              id: 123,
              source: 'Finnhub Test',
              summary: 'A short summary',
              url: 'https://example.test/news',
            },
          ],
          rawPayloadHash: 'sha256:news',
        }),
      ),
      getDividends: finnhubGetDividends,
    };

    const result = await refreshInvestmentMarketData({
      auditUserId: 'head-1',
      db,
      finnhubProvider,
      mode: 'manual',
      now: new Date('2026-06-16T12:00:00.000Z'),
      twelveDataProvider,
      yahooProvider,
    });

    expect(result).toMatchObject({
      attemptedSymbols: ['AAPL', 'BTC/USD'],
      dividendEventsRefreshedCount: 3,
      dividendPaymentsCreated: 1,
      newsRefreshedCount: 2,
      refreshedCount: 2,
      status: 'updated',
    });
    expect(yahooGetQuote).toHaveBeenCalledWith('AAPL');
    expect(yahooGetDividends).toHaveBeenCalledWith('AAPL');
    expect(twelveDataGetQuote).toHaveBeenCalledWith('BTC/USD');
    expect(finnhubGetDividends).not.toHaveBeenCalled();
    expect(db.snapshots).toHaveLength(2);
    expect(db.snapshots.map((snapshot) => snapshot.provider)).toEqual([
      'yahoo-finance',
      'twelve-data',
    ]);
    expect(db.ledger).toEqual([
      { account: 'Investment', delta: 1, reason: 'investment:dividend', studentId: 'student-1' },
      {
        account: 'InvestmentReturn',
        delta: -1,
        reason: 'investment:dividend',
        studentId: 'student-1',
      },
    ]);
    expect(db.dividendEvents.map((event) => event.provider)).toEqual([
      'yahoo-finance',
      'yahoo-finance',
      'merit-markets-simulation',
    ]);
  });

  it('does not expose unsupported forex instruments through cached market data', async () => {
    const db = makeDb({
      instruments: [
        makeInstrument({
          displayName: 'US Dollar to Pound',
          id: 'instrument-usd-gbp',
          kind: 'forex',
          providerSymbol: 'USDGBP=X',
          symbol: 'USD/GBP',
        }),
      ],
    });

    await expect(readCachedInvestmentMarketData({ db })).resolves.toMatchObject({
      freshness: 'empty',
      instruments: [],
      snapshots: [],
    });
  });

  it('disables and audits unsupported Twelve Data crypto pairs', async () => {
    const crypto = makeInstrument({
      category: 'Crypto',
      displayName: 'Canton',
      exchangeMic: 'CRYPTO',
      id: 'instrument-cc',
      kind: 'crypto',
      provider: 'twelve-data',
      providerSymbol: 'CC/USD',
      symbol: 'CC/USD',
    });
    const db = makeDb({ instruments: [crypto] });
    const yahooProvider: YahooFinanceProvider = {
      getDividends: vi.fn(),
      getGbpRate: vi.fn(() => Promise.resolve(0.8)),
      getQuote: vi.fn(),
    };
    const twelveDataProvider: TwelveDataQuoteProvider = {
      getQuote: vi.fn(() =>
        Promise.resolve({
          payload: {
            code: 400,
            message: 'invalid symbol',
            status: 'error',
          },
          rawPayloadHash: 'sha256:cc',
        }),
      ),
    };

    const result = await refreshInvestmentMarketData({
      auditUserId: 'head-1',
      db,
      mode: 'manual',
      now: new Date('2026-06-16T12:00:00.000Z'),
      twelveDataProvider,
      yahooProvider,
    });

    expect(result).toMatchObject({
      attemptedSymbols: ['CC/USD'],
      refreshedCount: 0,
      status: 'empty',
    });
    expect(crypto.enabled).toBe(false);
    expect(db.investmentInstrument.update).toHaveBeenCalledWith({
      data: { enabled: false },
      select: { id: true },
      where: { id: crypto.id },
    });
    const instrumentAudit = db.auditLog.create.mock.calls
      .map(([args]) => args)
      .find((args) => args.data.entity === 'InvestmentInstrument');
    expect(instrumentAudit?.data).toMatchObject({
      action: 'Update',
      entity: 'InvestmentInstrument',
      entityId: crypto.id,
    });
  });

  it('limits crypto quote refreshes to the Twelve Data minute credit batch size', async () => {
    const cryptoInstruments = Array.from({ length: 10 }, (_, index) => {
      const number = index + 1;
      const label = String(number);
      return makeInstrument({
        category: 'Crypto',
        displayName: `Crypto ${label}`,
        exchangeMic: 'CRYPTO',
        id: `instrument-crypto-${label}`,
        kind: 'crypto',
        provider: 'twelve-data',
        providerSymbol: `CRYPTO${label}/USD`,
        sortOrder: number,
        symbol: `CRYPTO${label}/USD`,
      });
    });
    const db = makeDb({ instruments: cryptoInstruments });
    const yahooProvider: YahooFinanceProvider = {
      getDividends: vi.fn(),
      getGbpRate: vi.fn(() => Promise.resolve(0.8)),
      getQuote: vi.fn(),
    };
    const twelveDataGetQuote = vi.fn((symbol: string) =>
      Promise.resolve({
        payload: {
          close: '100.00',
          currency: 'USD',
          name: symbol,
          percent_change: '1.5',
          previous_close: '98.50',
          symbol,
          timestamp: '1780672500',
        },
        rawPayloadHash: `sha256:${symbol}`,
      }),
    );
    const twelveDataProvider: TwelveDataQuoteProvider = {
      getQuote: twelveDataGetQuote,
    };

    const result = await refreshInvestmentMarketData({
      auditUserId: 'head-1',
      db,
      mode: 'manual',
      now: new Date('2026-06-16T12:00:00.000Z'),
      twelveDataProvider,
      yahooProvider,
    });

    expect(result.attemptedSymbols).toEqual(
      cryptoInstruments.slice(0, 8).map((instrument) => instrument.symbol),
    );
    expect(result.skippedSymbols).toEqual(
      cryptoInstruments.slice(8).map((instrument) => instrument.symbol),
    );
    expect(twelveDataGetQuote).toHaveBeenCalledTimes(8);
    expect(db.snapshots).toHaveLength(8);
  });
});
