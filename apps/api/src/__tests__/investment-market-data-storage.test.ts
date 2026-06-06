import type { ProviderQuoteSnapshot } from '@oasis/domain/investmentMarketData';
import { describe, expect, it, vi } from 'vitest';
import {
  countMarketDataSnapshots,
  listEnabledInvestmentInstruments,
  loadLatestMarketDataSnapshots,
  persistProviderQuoteSnapshot,
} from '../services/market-data/investment-market-data-storage.js';

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
  orderBy?: [{ sortOrder: 'asc' }, { symbol: 'asc' }];
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
    serverFetchedAt: {
      gte: Date;
      lt: Date;
    };
  };
}

function sortInstruments(
  left: StoredInvestmentInstrument,
  right: StoredInvestmentInstrument,
): number {
  return left.sortOrder - right.sortOrder || left.symbol.localeCompare(right.symbol);
}

function makeDb(input: {
  instruments: StoredInvestmentInstrument[];
  snapshots?: StoredMarketDataSnapshot[];
}) {
  const snapshots = input.snapshots ?? [];

  return {
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
      findMany: vi.fn((args: SnapshotFindManyArgs) =>
        Promise.resolve(
          snapshots.filter((snapshot) =>
            args.where?.instrumentId
              ? args.where.instrumentId.in.includes(snapshot.instrumentId)
              : true,
          ),
        ),
      ),
      create: vi.fn((args: SnapshotCreateArgs) => {
        const instrument = input.instruments.find(
          (candidate) => candidate.id === args.data.instrumentId,
        );
        if (!instrument) {
          throw new Error(`missing fake instrument ${args.data.instrumentId}`);
        }

        return Promise.resolve({
          ...args.data,
          createdAt: new Date('2026-06-06T12:05:00.000Z'),
          id: 'snapshot-created',
          instrument,
          providerCreditsLeft: args.data.providerCreditsLeft ?? null,
          providerCreditsUsed: args.data.providerCreditsUsed ?? null,
        });
      }),
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
    },
  };
}

const vooInstrument: StoredInvestmentInstrument = {
  displayName: 'Vanguard S&P 500 ETF',
  enabled: true,
  exchangeMic: 'ARCX',
  id: 'instrument-voo',
  kind: 'etf',
  provider: 'twelve-data',
  providerSymbol: 'VOO',
  riskBand: 'medium',
  sortOrder: 2,
  sourceCurrency: 'USD',
  symbol: 'VOO',
};

const aaplInstrument: StoredInvestmentInstrument = {
  displayName: 'Apple',
  enabled: true,
  exchangeMic: 'XNAS',
  id: 'instrument-aapl',
  kind: 'stock',
  provider: 'twelve-data',
  providerSymbol: 'AAPL',
  riskBand: 'high',
  sortOrder: 1,
  sourceCurrency: 'USD',
  symbol: 'AAPL',
};

const disabledInstrument: StoredInvestmentInstrument = {
  displayName: 'Disney',
  enabled: false,
  exchangeMic: 'XNYS',
  id: 'instrument-dis',
  kind: 'stock',
  provider: 'twelve-data',
  providerSymbol: 'DIS',
  riskBand: 'high',
  sortOrder: 3,
  sourceCurrency: 'USD',
  symbol: 'DIS',
};

function quoteSnapshot(symbol = 'AAPL'): ProviderQuoteSnapshot {
  return {
    dayChangePct: 1.2345,
    exchangeMic: 'XNAS',
    gbpConversionRate: 0.79,
    gbpPrice: 153.26,
    instrumentKind: 'stock',
    name: 'Apple',
    previousCloseGbp: 151.11,
    provider: 'twelve-data',
    providerCreditsLeft: 792,
    providerCreditsUsed: 8,
    providerTimestamp: new Date('2026-06-06T12:00:00.000Z'),
    serverFetchedAt: new Date('2026-06-06T12:04:00.000Z'),
    sourceCurrency: 'USD',
    sourcePrice: 194,
    symbol,
  };
}

describe('investment market data storage', () => {
  it('lists enabled instruments in stable display order', async () => {
    const db = makeDb({
      instruments: [vooInstrument, disabledInstrument, aaplInstrument],
    });

    await expect(listEnabledInvestmentInstruments(db)).resolves.toEqual([
      {
        displayName: 'Apple',
        exchangeMic: 'XNAS',
        id: 'instrument-aapl',
        kind: 'stock',
        provider: 'twelve-data',
        providerSymbol: 'AAPL',
        riskBand: 'high',
        sortOrder: 1,
        sourceCurrency: 'USD',
        symbol: 'AAPL',
      },
      {
        displayName: 'Vanguard S&P 500 ETF',
        exchangeMic: 'ARCX',
        id: 'instrument-voo',
        kind: 'etf',
        provider: 'twelve-data',
        providerSymbol: 'VOO',
        riskBand: 'medium',
        sortOrder: 2,
        sourceCurrency: 'USD',
        symbol: 'VOO',
      },
    ]);
    expect(db.investmentInstrument.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { symbol: 'asc' }],
      where: { enabled: true },
    });
  });

  it('loads the newest market-data snapshot for each enabled instrument', async () => {
    const olderSnapshotTime = new Date('2026-06-06T11:55:00.000Z');
    const newestSnapshotTime = new Date('2026-06-06T12:00:00.000Z');
    const db = makeDb({
      instruments: [aaplInstrument, vooInstrument],
      snapshots: [
        {
          ...quoteSnapshot(),
          createdAt: olderSnapshotTime,
          id: 'snapshot-aapl-older',
          instrument: aaplInstrument,
          instrumentId: 'instrument-aapl',
          providerCreditsLeft: 792,
          providerCreditsUsed: 8,
          rawPayloadHash: 'sha256:older',
          serverFetchedAt: olderSnapshotTime,
        },
        {
          ...quoteSnapshot(),
          createdAt: newestSnapshotTime,
          id: 'snapshot-aapl-newest',
          instrument: aaplInstrument,
          instrumentId: 'instrument-aapl',
          providerCreditsLeft: 792,
          providerCreditsUsed: 8,
          rawPayloadHash: 'sha256:newest',
          serverFetchedAt: newestSnapshotTime,
        },
      ],
    });

    await expect(loadLatestMarketDataSnapshots(db)).resolves.toEqual([
      expect.objectContaining({
        id: 'snapshot-aapl-newest',
        instrumentId: 'instrument-aapl',
        rawPayloadHash: 'sha256:newest',
        serverFetchedAt: newestSnapshotTime,
        symbol: 'AAPL',
      }),
    ]);
    expect(db.marketDataSnapshot.findMany).toHaveBeenCalledWith({
      include: { instrument: true },
      orderBy: [{ instrumentId: 'asc' }, { serverFetchedAt: 'desc' }],
      where: { instrumentId: { in: ['instrument-aapl', 'instrument-voo'] } },
    });
  });

  it('persists normalized quote snapshots without raw provider payloads', async () => {
    const db = makeDb({ instruments: [aaplInstrument] });

    await expect(
      persistProviderQuoteSnapshot({
        db,
        quote: quoteSnapshot(),
        rawPayloadHash: 'sha256:normalized-provider-payload',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        gbpPrice: 153.26,
        instrumentId: 'instrument-aapl',
        provider: 'twelve-data',
        rawPayloadHash: 'sha256:normalized-provider-payload',
        sourcePrice: 194,
        symbol: 'AAPL',
      }),
    );
    expect(db.marketDataSnapshot.create).toHaveBeenCalledWith({
      data: {
        dayChangePct: 1.2345,
        gbpConversionRate: 0.79,
        gbpPrice: 153.26,
        instrumentId: 'instrument-aapl',
        previousCloseGbp: 151.11,
        provider: 'twelve-data',
        providerCreditsLeft: 792,
        providerCreditsUsed: 8,
        providerTimestamp: new Date('2026-06-06T12:00:00.000Z'),
        rawPayloadHash: 'sha256:normalized-provider-payload',
        serverFetchedAt: new Date('2026-06-06T12:04:00.000Z'),
        sourceCurrency: 'USD',
        sourcePrice: 194,
      },
      include: { instrument: true },
    });
    expect(db.marketDataSnapshot.create.mock.calls[0]?.[0].data).not.toHaveProperty('rawPayload');
  });

  it('counts persisted snapshots in a quota window', async () => {
    const db = makeDb({
      instruments: [aaplInstrument],
      snapshots: [
        {
          ...quoteSnapshot(),
          createdAt: new Date('2026-06-06T12:00:00.000Z'),
          id: 'snapshot-aapl-current',
          instrument: aaplInstrument,
          instrumentId: 'instrument-aapl',
          providerCreditsLeft: null,
          providerCreditsUsed: null,
          rawPayloadHash: 'sha256:current',
          serverFetchedAt: new Date('2026-06-06T12:00:30.000Z'),
        },
        {
          ...quoteSnapshot(),
          createdAt: new Date('2026-06-06T11:59:00.000Z'),
          id: 'snapshot-aapl-previous',
          instrument: aaplInstrument,
          instrumentId: 'instrument-aapl',
          providerCreditsLeft: null,
          providerCreditsUsed: null,
          rawPayloadHash: 'sha256:previous',
          serverFetchedAt: new Date('2026-06-06T11:59:59.000Z'),
        },
      ],
    });

    await expect(
      countMarketDataSnapshots({
        db,
        from: new Date('2026-06-06T12:00:00.000Z'),
        provider: 'twelve-data',
        to: new Date('2026-06-06T12:01:00.000Z'),
      }),
    ).resolves.toBe(1);
    expect(db.marketDataSnapshot.count).toHaveBeenCalledWith({
      where: {
        provider: 'twelve-data',
        serverFetchedAt: {
          gte: new Date('2026-06-06T12:00:00.000Z'),
          lt: new Date('2026-06-06T12:01:00.000Z'),
        },
      },
    });
  });

  it('rejects snapshots for disabled or unknown instruments', async () => {
    const db = makeDb({ instruments: [disabledInstrument] });

    await expect(
      persistProviderQuoteSnapshot({
        db,
        quote: quoteSnapshot('DIS'),
        rawPayloadHash: 'sha256:disabled',
      }),
    ).rejects.toThrow('enabled investment instrument not found for twelve-data:DIS');
    expect(db.marketDataSnapshot.create).not.toHaveBeenCalled();
  });
});
