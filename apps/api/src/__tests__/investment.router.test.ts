import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { MeritAccount, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { investmentRouter } from '../routers/investment.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'ckinvesthead000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'ckinvestparent00000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'ckinveststudentuser0001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const otherStudentUser: SessionUser = {
  id: 'ckinveststudentuser0002',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckinvestsupervisor0001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'ckinveststudent00000001';
const otherStudentId = 'ckinveststudent00000002';

type AuditAction =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'DecryptSensitive'
  | 'DecryptPii'
  | 'ReadSensitive'
  | 'Login'
  | 'Login2FA'
  | 'PermissionDenied';

interface StoredStudent {
  id: string;
  active: boolean;
  userId: string | null;
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface StoredLedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
  reason: string;
}

interface StoredInvestmentAccount {
  studentId: string;
  units: number;
}

interface StoredInvestmentHolding {
  id: string;
  studentId: string;
  instrumentId: string;
  units: number;
  costBasisMerits: number;
  instrument: StoredInvestmentInstrument;
}

interface StoredInvestmentNav {
  date: Date;
  nav: number;
  dailyReturn: number;
}

interface StoredInvestmentTransaction {
  id: string;
  studentId: string;
  type: 'Buy' | 'Sell';
  instrumentId?: string | null;
  units: number;
  nav: number;
  feeMerits: number;
  grossMerits?: number | null;
  taxMerits?: number;
  costBasisMerits?: number | null;
  createdAt: Date;
}

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

interface FakeStudentFindUniqueArgs {
  where: { id: string };
  select?: { id?: true; active?: true; userId?: true };
}

interface FakeGuardianFindUniqueArgs {
  where: { userId_studentId: { userId: string; studentId: string } };
  select?: { studentId?: true };
}

interface FakeLedgerAggregateArgs {
  where: { studentId: string; account: MeritAccount };
  _sum: { delta: true };
}

interface FakeLedgerCreateManyArgs {
  data: StoredLedgerRow[];
}

interface FakeNavFindManyArgs {
  orderBy: { date: 'desc' };
  take: number;
  select: { date: true; nav: true; dailyReturn: true };
}

interface FakeNavFindUniqueArgs {
  where: { date: Date };
  select: { date: true; nav: true; dailyReturn: true };
}

interface FakeNavCreateArgs {
  data: { date: Date; nav: Prisma.Decimal; dailyReturn: Prisma.Decimal };
  select: { date: true; nav: true; dailyReturn: true };
}

interface FakeInvestmentAccountFindUniqueArgs {
  where: { studentId: string };
  select: { units: true };
}

interface FakeInvestmentAccountUpsertArgs {
  where: { studentId: string };
  create: { studentId: string; units: Prisma.Decimal };
  update: { units: { increment: Prisma.Decimal } };
  select: { units: true };
}

interface FakeInvestmentAccountUpdateArgs {
  where: { studentId: string };
  data: { units: Prisma.Decimal };
  select: { units: true };
}

interface FakeInvestmentHoldingFindManyArgs {
  where: { studentId: string };
  include?: { instrument: true };
}

interface FakeInvestmentHoldingUpsertArgs {
  where: { studentId_instrumentId: { studentId: string; instrumentId: string } };
  create: {
    studentId: string;
    instrumentId: string;
    units: Prisma.Decimal;
    costBasisMerits: number;
  };
  update: {
    units: { increment: Prisma.Decimal };
    costBasisMerits: { increment: number };
  };
  include?: { instrument: true };
}

interface FakeInvestmentHoldingUpdateArgs {
  where: { id: string };
  data: { units: Prisma.Decimal; costBasisMerits: number };
  include?: { instrument: true };
}

interface FakeInvestmentTransactionCreateArgs {
  data: {
    studentId: string;
    type: 'Buy' | 'Sell';
    instrumentId?: string | null;
    units: Prisma.Decimal;
    nav: Prisma.Decimal;
    feeMerits: number;
    grossMerits?: number | null;
    taxMerits?: number;
    costBasisMerits?: number | null;
  };
  select: { id: true };
}

interface FakeInvestmentTransactionFindManyArgs {
  where: { studentId: string };
  orderBy: { createdAt: 'desc' };
  take: number;
  select: {
    id: true;
    type: true;
    units: true;
    nav: true;
    feeMerits: true;
    grossMerits?: true;
    taxMerits?: true;
    costBasisMerits?: true;
    instrumentId?: true;
    createdAt: true;
  };
}

interface FakeInstrumentFindManyArgs {
  where?: { enabled?: boolean };
}

interface FakeInstrumentFindFirstArgs {
  where: {
    provider: string;
    providerSymbol: string;
    enabled: boolean;
  };
}

interface FakeMarketDataSnapshotFindManyArgs {
  where?: { instrumentId?: { in: string[] } };
}

interface FakeMarketDataSnapshotCreateArgs {
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

interface FakeMarketDataSnapshotCountArgs {
  where: {
    provider: string;
    serverFetchedAt: {
      gte: Date;
      lt: Date;
    };
  };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string;
    meta?: unknown;
  };
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function decimalNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function makeStudent(input: Partial<StoredStudent> & Pick<StoredStudent, 'id'>): StoredStudent {
  return {
    active: true,
    userId: null,
    ...input,
  };
}

function mapNav(row: StoredInvestmentNav) {
  return { date: row.date, nav: decimal(row.nav), dailyReturn: decimal(row.dailyReturn) };
}

function mapAccount(row: StoredInvestmentAccount) {
  return { units: decimal(row.units) };
}

function mapHolding(row: StoredInvestmentHolding) {
  return {
    id: row.id,
    studentId: row.studentId,
    instrumentId: row.instrumentId,
    units: decimal(row.units),
    costBasisMerits: row.costBasisMerits,
    instrument: row.instrument,
  };
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

function mapSnapshot(row: StoredMarketDataSnapshot) {
  return {
    ...row,
    dayChangePct: decimal(row.dayChangePct),
    gbpConversionRate: decimal(row.gbpConversionRate),
    gbpPrice: decimal(row.gbpPrice),
    previousCloseGbp: decimal(row.previousCloseGbp),
    sourcePrice: decimal(row.sourcePrice),
  };
}

function makeMarketSnapshot(input: {
  id: string;
  instrument: StoredInvestmentInstrument;
  serverFetchedAt: Date;
  gbpPrice?: number;
  previousCloseGbp?: number;
}): StoredMarketDataSnapshot {
  const gbpPrice = input.gbpPrice ?? 75;
  const previousCloseGbp = input.previousCloseGbp ?? 74;
  return {
    createdAt: input.serverFetchedAt,
    dayChangePct: 1.25,
    gbpConversionRate: 1,
    gbpPrice,
    id: input.id,
    instrument: input.instrument,
    instrumentId: input.instrument.id,
    previousCloseGbp,
    provider: 'twelve-data',
    providerCreditsLeft: null,
    providerCreditsUsed: null,
    providerTimestamp: input.serverFetchedAt,
    rawPayloadHash: `sha256:${input.id}`,
    serverFetchedAt: input.serverFetchedAt,
    sourceCurrency: input.instrument.sourceCurrency,
    sourcePrice: gbpPrice,
  };
}

function sortInstruments(
  left: StoredInvestmentInstrument,
  right: StoredInvestmentInstrument,
): number {
  return left.sortOrder - right.sortOrder || left.symbol.localeCompare(right.symbol);
}

function makeFakeDb(
  input: {
    students?: StoredStudent[];
    guardians?: StoredGuardian[];
    ledger?: StoredLedgerRow[];
    navs?: StoredInvestmentNav[];
    accounts?: StoredInvestmentAccount[];
    holdings?: StoredInvestmentHolding[];
    transactions?: StoredInvestmentTransaction[];
    instruments?: StoredInvestmentInstrument[];
    snapshots?: StoredMarketDataSnapshot[];
  } = {},
) {
  const students = input.students ?? [
    makeStudent({ id: linkedStudentId, userId: studentUser.id }),
    makeStudent({ id: otherStudentId, userId: otherStudentUser.id }),
  ];
  const guardians = input.guardians ?? [{ userId: parentUser.id, studentId: linkedStudentId }];
  const ledger = input.ledger ?? [];
  const navs = input.navs ?? [];
  const accounts = input.accounts ?? [];
  const holdings = input.holdings ?? [];
  const transactions = input.transactions ?? [];
  const instruments = input.instruments ?? [];
  const snapshots = input.snapshots ?? [];
  let nextTransaction = transactions.length + 1;

  const db = {
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
    },
    student: {
      findUnique: vi.fn((args: FakeStudentFindUniqueArgs) =>
        Promise.resolve(students.find((student) => student.id === args.where.id) ?? null),
      ),
    },
    studentPortalSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    guardian: {
      findUnique: vi.fn((args: FakeGuardianFindUniqueArgs) =>
        Promise.resolve(
          guardians.find(
            (guardian) =>
              guardian.userId === args.where.userId_studentId.userId &&
              guardian.studentId === args.where.userId_studentId.studentId,
          ) ?? null,
        ),
      ),
    },
    meritLedger: {
      aggregate: vi.fn((args: FakeLedgerAggregateArgs) => {
        const delta = ledger
          .filter((row) => row.studentId === args.where.studentId)
          .filter((row) => row.account === args.where.account)
          .reduce((total, row) => total + row.delta, 0);
        return Promise.resolve({ _sum: { delta: delta === 0 ? null : delta } });
      }),
      createMany: vi.fn((args: FakeLedgerCreateManyArgs) => {
        ledger.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    investmentNav: {
      findFirst: vi.fn(() => {
        const row = [...navs].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        return Promise.resolve(row ? mapNav(row) : null);
      }),
      findUnique: vi.fn((args: FakeNavFindUniqueArgs) => {
        const row = navs.find((nav) => sameDate(nav.date, args.where.date));
        return Promise.resolve(row ? mapNav(row) : null);
      }),
      create: vi.fn((args: FakeNavCreateArgs) => {
        const row = {
          date: args.data.date,
          nav: decimalNumber(args.data.nav),
          dailyReturn: decimalNumber(args.data.dailyReturn),
        };
        navs.push(row);
        return Promise.resolve(mapNav(row));
      }),
      findMany: vi.fn((args: FakeNavFindManyArgs) =>
        Promise.resolve(
          [...navs]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, args.take)
            .map(mapNav),
        ),
      ),
    },
    investmentAccount: {
      findUnique: vi.fn((args: FakeInvestmentAccountFindUniqueArgs) => {
        const account = accounts.find((row) => row.studentId === args.where.studentId);
        return Promise.resolve(account ? mapAccount(account) : null);
      }),
      upsert: vi.fn((args: FakeInvestmentAccountUpsertArgs) => {
        const existing = accounts.find((row) => row.studentId === args.where.studentId);
        if (existing) {
          existing.units += decimalNumber(args.update.units.increment);
          return Promise.resolve(mapAccount(existing));
        }

        const created = {
          studentId: args.create.studentId,
          units: decimalNumber(args.create.units),
        };
        accounts.push(created);
        return Promise.resolve(mapAccount(created));
      }),
      update: vi.fn((args: FakeInvestmentAccountUpdateArgs) => {
        const existing = accounts.find((row) => row.studentId === args.where.studentId);
        if (!existing) throw new Error('missing investment account');
        existing.units = decimalNumber(args.data.units);
        return Promise.resolve(mapAccount(existing));
      }),
    },
    investmentHolding: {
      findMany: vi.fn((args: FakeInvestmentHoldingFindManyArgs) =>
        Promise.resolve(
          holdings.filter((holding) => holding.studentId === args.where.studentId).map(mapHolding),
        ),
      ),
      upsert: vi.fn((args: FakeInvestmentHoldingUpsertArgs) => {
        const key = args.where.studentId_instrumentId;
        const existing = holdings.find(
          (holding) =>
            holding.studentId === key.studentId && holding.instrumentId === key.instrumentId,
        );
        if (existing) {
          existing.units += decimalNumber(args.update.units.increment);
          existing.costBasisMerits += args.update.costBasisMerits.increment;
          return Promise.resolve(mapHolding(existing));
        }

        const instrument = instruments.find(
          (candidate) => candidate.id === args.create.instrumentId,
        );
        if (!instrument) throw new Error('missing fake instrument');
        const created: StoredInvestmentHolding = {
          costBasisMerits: args.create.costBasisMerits,
          id: `ckholding${String(holdings.length + 1).padStart(12, '0')}`,
          instrument,
          instrumentId: args.create.instrumentId,
          studentId: args.create.studentId,
          units: decimalNumber(args.create.units),
        };
        holdings.push(created);
        return Promise.resolve(mapHolding(created));
      }),
      update: vi.fn((args: FakeInvestmentHoldingUpdateArgs) => {
        const existing = holdings.find((holding) => holding.id === args.where.id);
        if (!existing) throw new Error('missing investment holding');
        existing.units = decimalNumber(args.data.units);
        existing.costBasisMerits = args.data.costBasisMerits;
        return Promise.resolve(mapHolding(existing));
      }),
    },
    investmentTransaction: {
      create: vi.fn((args: FakeInvestmentTransactionCreateArgs) => {
        const row: StoredInvestmentTransaction = {
          id: `ckinvesttxn${String(nextTransaction++).padStart(12, '0')}`,
          costBasisMerits: args.data.costBasisMerits ?? null,
          grossMerits: args.data.grossMerits ?? null,
          instrumentId: args.data.instrumentId ?? null,
          studentId: args.data.studentId,
          type: args.data.type,
          units: decimalNumber(args.data.units),
          nav: decimalNumber(args.data.nav),
          feeMerits: args.data.feeMerits,
          taxMerits: args.data.taxMerits ?? 0,
          createdAt: new Date(),
        };
        transactions.push(row);
        return Promise.resolve({ id: row.id });
      }),
      findMany: vi.fn((args: FakeInvestmentTransactionFindManyArgs) =>
        Promise.resolve(
          transactions
            .filter((row) => row.studentId === args.where.studentId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, args.take)
            .map((row) => ({
              id: row.id,
              type: row.type,
              units: decimal(row.units),
              nav: decimal(row.nav),
              feeMerits: row.feeMerits,
              grossMerits: row.grossMerits ?? null,
              taxMerits: row.taxMerits ?? 0,
              costBasisMerits: row.costBasisMerits ?? null,
              instrumentId: row.instrumentId ?? null,
              createdAt: row.createdAt,
            })),
        ),
      ),
    },
    investmentInstrument: {
      findMany: vi.fn((args: FakeInstrumentFindManyArgs) =>
        Promise.resolve(
          instruments
            .filter((instrument) =>
              args.where?.enabled === undefined ? true : instrument.enabled === args.where.enabled,
            )
            .sort(sortInstruments),
        ),
      ),
      findFirst: vi.fn((args: FakeInstrumentFindFirstArgs) =>
        Promise.resolve(
          instruments.find(
            (instrument) =>
              instrument.provider === args.where.provider &&
              instrument.providerSymbol === args.where.providerSymbol &&
              instrument.enabled === args.where.enabled,
          ) ?? null,
        ),
      ),
      update: vi.fn((args: { data: { enabled: false }; where: { id: string } }) => {
        const instrument = instruments.find((candidate) => candidate.id === args.where.id);
        if (!instrument) throw new Error('missing fake instrument');
        instrument.enabled = args.data.enabled;
        return Promise.resolve({ id: instrument.id });
      }),
    },
    marketDataSnapshot: {
      count: vi.fn((args: FakeMarketDataSnapshotCountArgs) =>
        Promise.resolve(
          snapshots.filter(
            (snapshot) =>
              snapshot.provider === args.where.provider &&
              snapshot.serverFetchedAt >= args.where.serverFetchedAt.gte &&
              snapshot.serverFetchedAt < args.where.serverFetchedAt.lt,
          ).length,
        ),
      ),
      create: vi.fn((args: FakeMarketDataSnapshotCreateArgs) => {
        const instrument = instruments.find((candidate) => candidate.id === args.data.instrumentId);
        if (!instrument) throw new Error('missing fake instrument');

        const row: StoredMarketDataSnapshot = {
          ...args.data,
          createdAt: args.data.serverFetchedAt,
          id: `ckmarketsnapshot${String(snapshots.length + 1).padStart(8, '0')}`,
          instrument,
          providerCreditsLeft: args.data.providerCreditsLeft ?? null,
          providerCreditsUsed: args.data.providerCreditsUsed ?? null,
        };
        snapshots.push(row);
        return Promise.resolve(mapSnapshot(row));
      }),
      findMany: vi.fn((args: FakeMarketDataSnapshotFindManyArgs) =>
        Promise.resolve(
          snapshots
            .filter((snapshot) =>
              args.where?.instrumentId
                ? args.where.instrumentId.in.includes(snapshot.instrumentId)
                : true,
            )
            .map(mapSnapshot),
        ),
      ),
    },
    investmentNewsItem: {
      findMany: vi.fn(() => Promise.resolve([])),
      upsert: vi.fn((args: { create: unknown }) => Promise.resolve(args.create)),
    },
    investmentDividendEvent: {
      findMany: vi.fn(() => Promise.resolve([])),
      upsert: vi.fn((args: { create: unknown }) => Promise.resolve(args.create)),
    },
    investmentDividendPayment: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: unknown) => Promise.resolve(args)),
    },
    students,
    guardians,
    ledger,
    navs,
    accounts,
    holdings,
    transactions,
    instruments,
    snapshots,
  };

  db.$transaction.mockImplementation(async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db));

  return db;
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: <T>(fn: (tx: RlsTx) => Promise<T>): Promise<T> => {
      void fn;
      return Promise.reject(new Error('withRls is not used by investment router tests'));
    },
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ investment: investmentRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

function auditCreates(db: ReturnType<typeof makeFakeDb>): FakeAuditCreateArgs[] {
  return db.auditLog.create.mock.calls.map(([args]) => args);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
  process.env['INVESTMENT_NAV_SEED'] = 'oasis-v1';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env['INVESTMENT_NAV_SEED'];
  delete process.env['TWELVE_DATA_API_KEY'];
  delete process.env['TWELVE_DATA_BASE_URL'];
  delete process.env['FINNHUB_API_KEY'];
  delete process.env['FINNHUB_BASE_URL'];
  delete process.env['YAHOO_FINANCE_BASE_URL'];
});

describe('investment.marketData', () => {
  it('returns cached market snapshots without calling the provider', async () => {
    const instrument = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchImpl);

    const result = await makeCaller(
      studentUser,
      makeFakeDb({
        instruments: [instrument],
        snapshots: [
          makeMarketSnapshot({
            id: 'snapshot-vusa',
            instrument,
            serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
          }),
        ],
      }),
    ).caller.investment.marketData();

    expect(result).toMatchObject({
      freshness: 'fresh',
      snapshots: [
        {
          dailyMovementMerits: 0.1,
          previousCloseMerits: 7.4,
          priceMerits: 7.5,
          symbol: 'VUSA',
        },
      ],
    });
    expect(result.snapshots[0]).not.toHaveProperty('gbpPrice');
    expect(result.snapshots[0]).not.toHaveProperty('sourcePrice');
    expect(result.snapshots[0]).not.toHaveProperty('previousCloseGbp');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('investment.refreshMarketData', () => {
  it('requires full-admin access and audits denials', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.investment.refreshMarketData()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'MarketDataSnapshot',
        meta: expect.objectContaining({
          source: 'investment.refreshMarketData',
        }) as unknown,
      }),
    );
  });

  it('lets full admins refresh cached market snapshots server-side', async () => {
    process.env['TWELVE_DATA_API_KEY'] = 'test-key';
    process.env['TWELVE_DATA_BASE_URL'] = 'https://example.test';
    const instrument = makeInstrument({
      id: 'instrument-vusa',
      provider: 'yahoo-finance',
      providerSymbol: 'VUSA.L',
      sourceCurrency: 'GBP',
      symbol: 'VUSA',
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  chartPreviousClose: 74,
                  currency: 'GBP',
                  regularMarketPrice: 75,
                  regularMarketTime: 1778846100,
                  shortName: 'Vanguard S&P 500 UCITS ETF',
                  symbol: 'VUSA.L',
                },
              },
            ],
          },
        }),
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchImpl);
    const { caller, db } = makeCaller(
      headUser,
      makeFakeDb({
        instruments: [instrument],
      }),
    );

    await expect(caller.investment.refreshMarketData()).resolves.toMatchObject({
      attemptedSymbols: ['VUSA'],
      refreshedCount: 1,
      status: 'updated',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(db.snapshots).toEqual([
      expect.objectContaining({
        gbpPrice: 75,
        instrumentId: 'instrument-vusa',
        provider: 'yahoo-finance',
      }),
    ]);
  });
});

describe('investment.tickNav', () => {
  it('creates a deterministic daily NAV tick and is idempotent for the same UTC day', async () => {
    const { caller, db } = makeCaller(headUser);

    const first = await caller.investment.tickNav();
    const second = await caller.investment.tickNav();

    expect(first.status).toBe('Created');
    expect(second).toEqual({ status: 'AlreadyExists', nav: first.nav });
    expect(db.navs).toHaveLength(1);
    expect(db.investmentNav.create).toHaveBeenCalledTimes(1);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'InvestmentNav',
        entityId: '2026-05-15',
        meta: expect.objectContaining({
          source: 'investment.tickNav',
          seed: 'oasis-v1',
          status: 'Created',
        }) as unknown,
      }),
    );
  });

  it('requires full-admin access and audits denials', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(caller.investment.tickNav()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.investmentNav.create).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'InvestmentNav',
      }),
    );
  });
});

describe('investment.navHistory', () => {
  it('returns the requested number of stored NAV rows in ascending date order', async () => {
    const { caller } = makeCaller(
      headUser,
      makeFakeDb({
        navs: [
          { date: day('2026-05-13'), nav: 100, dailyReturn: 0 },
          { date: day('2026-05-14'), nav: 101, dailyReturn: 0.01 },
          { date: day('2026-05-15'), nav: 102, dailyReturn: 0.009901 },
        ],
      }),
    );

    await expect(caller.investment.navHistory({ days: 2 })).resolves.toEqual([
      { date: day('2026-05-14'), nav: 101, dailyReturn: 0.01 },
      { date: day('2026-05-15'), nav: 102, dailyReturn: 0.009901 },
    ]);
  });

  it('validates the day limit at the API boundary', async () => {
    await expect(
      makeCaller(headUser).caller.investment.navHistory({ days: 366 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('investment.account', () => {
  it('allows linked parents and students to view units, current value, and transactions', async () => {
    const db = makeFakeDb({
      ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 200, reason: 'buy' }],
      navs: [{ date: day('2026-05-15'), nav: 125, dailyReturn: 0.01 }],
      accounts: [{ studentId: linkedStudentId, units: 1.5 }],
      transactions: [
        {
          id: 'ckinvesttxn000000000001',
          studentId: linkedStudentId,
          type: 'Buy',
          units: 1.5,
          nav: 125,
          feeMerits: 0,
          createdAt: day('2026-05-15'),
        },
      ],
    });

    await expect(
      makeCaller(parentUser, db).caller.investment.account({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      units: 1.5,
      latestNav: { date: day('2026-05-15'), nav: 125, dailyReturn: 0.01 },
      currentValueMerits: 187,
      costBasisMerits: 200,
      holdings: [],
      investmentCashMerits: 200,
      portfolioCostBasisMerits: 0,
      portfolioReturnMerits: 0,
      portfolioValueMerits: 0,
      transactions: [
        {
          id: 'ckinvesttxn000000000001',
          type: 'Buy',
          units: 1.5,
          nav: 125,
          feeMerits: 0,
          createdAt: day('2026-05-15'),
        },
      ],
    });

    await expect(
      makeCaller(studentUser, db).caller.investment.account({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({ studentId: linkedStudentId, units: 1.5 });
  });

  it('returns current per-instrument holdings when students own stocks', async () => {
    const vusa = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const eqqq = makeInstrument({ id: 'instrument-eqqq', sortOrder: 2, symbol: 'EQQQ' });
    const db = makeFakeDb({
      holdings: [
        {
          costBasisMerits: 100,
          id: 'holding-vusa',
          instrument: vusa,
          instrumentId: vusa.id,
          studentId: linkedStudentId,
          units: 4,
        },
        {
          costBasisMerits: 200,
          id: 'holding-eqqq',
          instrument: eqqq,
          instrumentId: eqqq.id,
          studentId: linkedStudentId,
          units: 6,
        },
      ],
      instruments: [vusa, eqqq],
      snapshots: [
        makeMarketSnapshot({
          gbpPrice: 250,
          id: 'snapshot-vusa',
          instrument: vusa,
          serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
        }),
        makeMarketSnapshot({
          gbpPrice: 500,
          id: 'snapshot-eqqq',
          instrument: eqqq,
          serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
        }),
      ],
    });

    await expect(
      makeCaller(studentUser, db).caller.investment.account({ studentId: linkedStudentId }),
    ).resolves.toMatchObject({
      holdings: [
        {
          costBasisMerits: 100,
          currentPriceMerits: 25,
          currentValueMerits: 100,
          instrumentId: 'instrument-vusa',
          symbol: 'VUSA',
          units: 4,
        },
        {
          costBasisMerits: 200,
          currentPriceMerits: 50,
          currentValueMerits: 300,
          instrumentId: 'instrument-eqqq',
          symbol: 'EQQQ',
          units: 6,
        },
      ],
      portfolioCostBasisMerits: 300,
      portfolioReturnMerits: 100,
      portfolioValueMerits: 400,
    });
  });

  it('blocks supervisors and unlinked parents from account reads', async () => {
    const supervisor = makeCaller(supervisorUser);
    await expect(
      supervisor.caller.investment.account({ studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const parent = makeCaller(parentUser);
    await expect(
      parent.caller.investment.account({ studentId: otherStudentId }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(auditCreates(parent.db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'investment.account',
        entityId: otherStudentId,
      }),
    );
  });
});

describe('investment.buy', () => {
  it('creates units, balanced ledger rows, a transaction row, and an audit row', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 300, reason: 'merit' }],
        navs: [{ date: day('2026-05-15'), nav: 120, dailyReturn: 0.01 }],
      }),
    );

    await expect(
      caller.investment.buy({ studentId: linkedStudentId, merits: 240 }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      units: 2,
      unitsBought: 2,
      nav: { date: day('2026-05-15'), nav: 120, dailyReturn: 0.01 },
    });

    expect(db.accounts).toEqual([{ studentId: linkedStudentId, units: 2 }]);
    expect(db.transactions).toMatchObject([
      {
        studentId: linkedStudentId,
        type: 'Buy',
        units: 2,
        nav: 120,
        feeMerits: 0,
      },
    ]);
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Spend',
      delta: -240,
      reason: 'investment:buy',
    });
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Investment',
      delta: 240,
      reason: 'investment:buy',
    });
    expect(
      db.ledger
        .filter((row) => row.reason === 'investment:buy')
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'InvestmentTransaction',
        meta: expect.objectContaining({
          source: 'investment.buy',
          studentId: linkedStudentId,
          merits: 240,
          units: 2,
          nav: 120,
        }) as unknown,
      }),
    );
  });

  it('rejects insufficient Spend and parent write attempts', async () => {
    const insufficient = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 10, reason: 'merit' }],
        navs: [{ date: day('2026-05-15'), nav: 100, dailyReturn: 0 }],
      }),
    );

    await expect(
      insufficient.caller.investment.buy({ studentId: linkedStudentId, merits: 11 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(insufficient.db.meritLedger.createMany).not.toHaveBeenCalled();
    expect(auditCreates(insufficient.db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'InvestmentTransaction',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          source: 'investment.buy',
          outcome: 'Rejected',
          reason: 'InsufficientSpend',
        }) as unknown,
      }),
    );

    const parent = makeCaller(parentUser);
    await expect(
      parent.caller.investment.buy({ studentId: linkedStudentId, merits: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(parent.db.investmentTransaction.create).not.toHaveBeenCalled();
  });
});

describe('investment.fundCash', () => {
  it('moves Spend merits into Merit Markets cash and audits the funding event', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      }),
    );

    await expect(
      caller.investment.fundCash({ studentId: linkedStudentId, merits: 75 }),
    ).resolves.toMatchObject({
      cashFundedMerits: 75,
      studentId: linkedStudentId,
    });
    expect(db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' },
      {
        studentId: linkedStudentId,
        account: 'Spend',
        delta: -75,
        reason: 'investment:cash:fund',
      },
      {
        studentId: linkedStudentId,
        account: 'Investment',
        delta: 75,
        reason: 'investment:cash:fund',
      },
    ]);
    expect(
      db.ledger
        .filter((row) => row.reason === 'investment:cash:fund')
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'InvestmentCashFunding',
        meta: expect.objectContaining({
          source: 'investment.fundCash',
          merits: 75,
        }) as unknown,
      }),
    );
  });

  it('rejects insufficient Spend and parent write attempts before writing rows', async () => {
    const insufficient = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 10, reason: 'merit' }],
      }),
    );

    await expect(
      insufficient.caller.investment.fundCash({ studentId: linkedStudentId, merits: 11 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(insufficient.db.meritLedger.createMany).not.toHaveBeenCalled();

    const parent = makeCaller(parentUser);
    await expect(
      parent.caller.investment.fundCash({ studentId: linkedStudentId, merits: 1 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(parent.db.meritLedger.createMany).not.toHaveBeenCalled();
  });
});

describe('investment.buyHolding', () => {
  it('buys instrument units from Merit Markets cash and records a holding transaction', async () => {
    const vusa = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        instruments: [vusa],
        ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 100, reason: 'fund' }],
        snapshots: [
          makeMarketSnapshot({
            gbpPrice: 75,
            id: 'snapshot-vusa',
            instrument: vusa,
            serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
          }),
        ],
      }),
    );

    await expect(
      caller.investment.buyHolding({
        instrumentId: 'instrument-vusa',
        merits: 75,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      costBasisMerits: 75,
      holding: {
        costBasisMerits: 75,
        instrumentId: 'instrument-vusa',
        units: 10,
      },
      priceMerits: 7.5,
      unitsBought: 10,
    });
    expect(db.holdings).toMatchObject([
      {
        costBasisMerits: 75,
        instrumentId: 'instrument-vusa',
        studentId: linkedStudentId,
        units: 10,
      },
    ]);
    expect(db.transactions).toMatchObject([
      {
        costBasisMerits: 75,
        feeMerits: 0,
        grossMerits: 75,
        instrumentId: 'instrument-vusa',
        nav: 7.5,
        taxMerits: 0,
        type: 'Buy',
        units: 10,
      },
    ]);
    expect(
      db.ledger
        .filter((row) => row.reason === 'investment:holding:buy' || row.account === 'Spend')
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
    expect(db.meritLedger.createMany).not.toHaveBeenCalled();
  });

  it('rejects buys that exceed Merit Markets cash even when Spend has enough merits', async () => {
    const vusa = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        instruments: [vusa],
        ledger: [
          { studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' },
          { studentId: linkedStudentId, account: 'Investment', delta: 10, reason: 'fund' },
        ],
        snapshots: [
          makeMarketSnapshot({
            gbpPrice: 75,
            id: 'snapshot-vusa',
            instrument: vusa,
            serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
          }),
        ],
      }),
    );

    await expect(
      caller.investment.buyHolding({
        instrumentId: 'instrument-vusa',
        merits: 75,
        studentId: linkedStudentId,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.investmentTransaction.create).not.toHaveBeenCalled();
    expect(db.meritLedger.createMany).not.toHaveBeenCalled();
  });

  it('blocks parents from buying holdings for linked children', async () => {
    const parent = makeCaller(parentUser);

    await expect(
      parent.caller.investment.buyHolding({
        instrumentId: 'instrument-vusa',
        merits: 10,
        studentId: linkedStudentId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(parent.db.investmentTransaction.create).not.toHaveBeenCalled();
  });
});

describe('investment.sellHolding', () => {
  it('sells one holding back into Merit Markets cash without fee or tax', async () => {
    const vusa = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        holdings: [
          {
            costBasisMerits: 100,
            id: 'holding-vusa',
            instrument: vusa,
            instrumentId: vusa.id,
            studentId: linkedStudentId,
            units: 4,
          },
        ],
        instruments: [vusa],
        ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 100, reason: 'fund' }],
        snapshots: [
          makeMarketSnapshot({
            gbpPrice: 300,
            id: 'snapshot-vusa',
            instrument: vusa,
            serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
          }),
        ],
      }),
    );

    await expect(
      caller.investment.sellHolding({
        instrumentId: 'instrument-vusa',
        studentId: linkedStudentId,
        units: 2,
      }),
    ).resolves.toMatchObject({
      costBasisMerits: 50,
      grossMerits: 60,
      investmentReturnDelta: -10,
      priceMerits: 30,
      unitsSold: 2,
    });
    expect(db.holdings).toMatchObject([
      {
        costBasisMerits: 50,
        id: 'holding-vusa',
        units: 2,
      },
    ]);
    expect(db.transactions).toMatchObject([
      {
        costBasisMerits: 50,
        feeMerits: 0,
        grossMerits: 60,
        instrumentId: 'instrument-vusa',
        nav: 30,
        taxMerits: 0,
        type: 'Sell',
        units: 2,
      },
    ]);
    expect(db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Investment', delta: 100, reason: 'fund' },
      {
        account: 'Investment',
        delta: 10,
        reason: 'investment:holding:sell',
        studentId: linkedStudentId,
      },
      {
        account: 'InvestmentReturn',
        delta: -10,
        reason: 'investment:holding:sell',
        studentId: linkedStudentId,
      },
    ]);
    expect(
      db.ledger
        .filter((row) => row.reason === 'investment:holding:sell')
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
  });

  it('rejects parent sell attempts and insufficient holding units before writing rows', async () => {
    const vusa = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const insufficient = makeCaller(
      studentUser,
      makeFakeDb({
        holdings: [
          {
            costBasisMerits: 100,
            id: 'holding-vusa',
            instrument: vusa,
            instrumentId: vusa.id,
            studentId: linkedStudentId,
            units: 1,
          },
        ],
        instruments: [vusa],
        snapshots: [
          makeMarketSnapshot({
            gbpPrice: 300,
            id: 'snapshot-vusa',
            instrument: vusa,
            serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
          }),
        ],
      }),
    );

    await expect(
      insufficient.caller.investment.sellHolding({
        instrumentId: 'instrument-vusa',
        studentId: linkedStudentId,
        units: 2,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(insufficient.db.investmentTransaction.create).not.toHaveBeenCalled();
    expect(insufficient.db.meritLedger.createMany).not.toHaveBeenCalled();

    const parent = makeCaller(parentUser);
    await expect(
      parent.caller.investment.sellHolding({
        instrumentId: 'instrument-vusa',
        studentId: linkedStudentId,
        units: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(parent.db.investmentTransaction.create).not.toHaveBeenCalled();
  });
});

describe('investment.withdrawPortfolio', () => {
  it('sells holdings pro-rata, deducts fee and tax, and updates holdings', async () => {
    const vusa = makeInstrument({ id: 'instrument-vusa', symbol: 'VUSA' });
    const eqqq = makeInstrument({ id: 'instrument-eqqq', sortOrder: 2, symbol: 'EQQQ' });
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        holdings: [
          {
            costBasisMerits: 100,
            id: 'holding-vusa',
            instrument: vusa,
            instrumentId: vusa.id,
            studentId: linkedStudentId,
            units: 4,
          },
          {
            costBasisMerits: 200,
            id: 'holding-eqqq',
            instrument: eqqq,
            instrumentId: eqqq.id,
            studentId: linkedStudentId,
            units: 6,
          },
        ],
        instruments: [vusa, eqqq],
        snapshots: [
          makeMarketSnapshot({
            gbpPrice: 250,
            id: 'snapshot-vusa',
            instrument: vusa,
            serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
          }),
          makeMarketSnapshot({
            gbpPrice: 500,
            id: 'snapshot-eqqq',
            instrument: eqqq,
            serverFetchedAt: new Date('2026-05-15T11:59:00.000Z'),
          }),
        ],
      }),
    );

    await expect(
      caller.investment.withdrawPortfolio({
        grossMerits: 200,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      costBasisMerits: 150,
      feeMerits: 10,
      grossMerits: 200,
      netMerits: 183,
      taxMerits: 7,
    });
    expect(db.holdings).toMatchObject([
      {
        costBasisMerits: 50,
        id: 'holding-vusa',
        units: 2,
      },
      {
        costBasisMerits: 100,
        id: 'holding-eqqq',
        units: 3,
      },
    ]);
    expect(db.transactions).toMatchObject([
      {
        costBasisMerits: 50,
        feeMerits: 10,
        grossMerits: 50,
        instrumentId: 'instrument-vusa',
        nav: 25,
        taxMerits: 7,
        type: 'Sell',
        units: 2,
      },
      {
        costBasisMerits: 100,
        feeMerits: 0,
        grossMerits: 150,
        instrumentId: 'instrument-eqqq',
        nav: 50,
        taxMerits: 0,
        type: 'Sell',
        units: 3,
      },
    ]);
    expect(db.ledger).toEqual([
      {
        account: 'Investment',
        delta: -150,
        reason: 'investment:portfolio:withdraw',
        studentId: linkedStudentId,
      },
      {
        account: 'Spend',
        delta: 183,
        reason: 'investment:portfolio:withdraw',
        studentId: linkedStudentId,
      },
      {
        account: 'FeeSink',
        delta: 10,
        reason: 'investment:portfolio:withdraw',
        studentId: linkedStudentId,
      },
      {
        account: 'TaxSink',
        delta: 7,
        reason: 'investment:portfolio:withdraw',
        studentId: linkedStudentId,
      },
      {
        account: 'InvestmentReturn',
        delta: -50,
        reason: 'investment:portfolio:withdraw',
        studentId: linkedStudentId,
      },
    ]);
    expect(db.ledger.reduce((total, row) => total + row.delta, 0)).toBe(0);
  });

  it('rejects withdrawals when there are no holdings', async () => {
    const { caller, db } = makeCaller(studentUser);

    await expect(
      caller.investment.withdrawPortfolio({
        grossMerits: 1,
        studentId: linkedStudentId,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.investmentTransaction.create).not.toHaveBeenCalled();
  });
});

describe('investment.sell', () => {
  it('sells units, applies fee, realizes gain through InvestmentReturn, and balances ledger rows', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 200, reason: 'buy' }],
        navs: [{ date: day('2026-05-15'), nav: 120, dailyReturn: 0.01 }],
        accounts: [{ studentId: linkedStudentId, units: 2 }],
      }),
    );

    await expect(
      caller.investment.sell({ studentId: linkedStudentId, units: 1 }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      units: 1,
      unitsSold: 1,
      proceedsMerits: 120,
      feeMerits: 6,
      netMerits: 114,
      costBasisMerits: 100,
      investmentReturnDelta: -20,
    });

    expect(db.accounts).toEqual([{ studentId: linkedStudentId, units: 1 }]);
    expect(db.transactions).toMatchObject([
      {
        studentId: linkedStudentId,
        type: 'Sell',
        units: 1,
        nav: 120,
        feeMerits: 6,
      },
    ]);
    expect(db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Investment', delta: 200, reason: 'buy' },
      {
        studentId: linkedStudentId,
        account: 'Investment',
        delta: -100,
        reason: 'investment:sell',
      },
      {
        studentId: linkedStudentId,
        account: 'Spend',
        delta: 114,
        reason: 'investment:sell',
      },
      {
        studentId: linkedStudentId,
        account: 'FeeSink',
        delta: 6,
        reason: 'investment:sell',
      },
      {
        studentId: linkedStudentId,
        account: 'InvestmentReturn',
        delta: -20,
        reason: 'investment:sell',
      },
    ]);
    expect(
      db.ledger
        .filter((row) => row.reason === 'investment:sell')
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'InvestmentTransaction',
        meta: expect.objectContaining({
          source: 'investment.sell',
          proceedsMerits: 120,
          feeMerits: 6,
          netMerits: 114,
          costBasisMerits: 100,
          investmentReturnDelta: -20,
        }) as unknown,
      }),
    );
  });

  it('rejects insufficient units before writing transaction rows', async () => {
    const { caller, db } = makeCaller(
      studentUser,
      makeFakeDb({
        ledger: [{ studentId: linkedStudentId, account: 'Investment', delta: 100, reason: 'buy' }],
        navs: [{ date: day('2026-05-15'), nav: 100, dailyReturn: 0 }],
        accounts: [{ studentId: linkedStudentId, units: 0.5 }],
      }),
    );

    await expect(
      caller.investment.sell({ studentId: linkedStudentId, units: 1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.investmentTransaction.create).not.toHaveBeenCalled();
    expect(db.meritLedger.createMany).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'InvestmentTransaction',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          source: 'investment.sell',
          outcome: 'Rejected',
          reason: 'InsufficientUnits',
        }) as unknown,
      }),
    );
  });
});
