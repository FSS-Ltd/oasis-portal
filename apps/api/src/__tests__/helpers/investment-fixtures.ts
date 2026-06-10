import { Prisma } from '@oasis/db';
import type { MeritAccount, SessionUser } from '@oasis/domain';
import { afterEach, vi } from 'vitest';
import type { AppContext, RlsTx } from '../../context.js';
import { investmentRouter } from '../../routers/investment.js';
import { router } from '../../trpc.js';

export const headUser: SessionUser = {
  id: 'ckinvesthead000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};

export const parentUser: SessionUser = {
  id: 'ckinvestparent00000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

export const studentUser: SessionUser = {
  id: 'ckinveststudentuser0001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

export const otherStudentUser: SessionUser = {
  id: 'ckinveststudentuser0002',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

export const supervisorUser: SessionUser = {
  id: 'ckinvestsupervisor0001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

export const linkedStudentId = 'ckinveststudent00000001';
export const otherStudentId = 'ckinveststudent00000002';

export type AuditAction =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'DecryptSensitive'
  | 'DecryptPii'
  | 'ReadSensitive'
  | 'Login'
  | 'Login2FA'
  | 'PermissionDenied';

export interface StoredStudent {
  id: string;
  active: boolean;
  userId: string | null;
}

export interface StoredGuardian {
  userId: string;
  studentId: string;
}

export interface StoredLedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
  reason: string;
}

export interface StoredInvestmentAccount {
  studentId: string;
  units: number;
}

export interface StoredInvestmentNav {
  date: Date;
  nav: number;
  dailyReturn: number;
}

export interface StoredInvestmentTransaction {
  id: string;
  studentId: string;
  type: 'Buy' | 'Sell';
  units: number;
  nav: number;
  feeMerits: number;
  createdAt: Date;
}

export interface StoredInvestmentInstrument {
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

export interface StoredMarketDataSnapshot {
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

interface FakeInvestmentTransactionCreateArgs {
  data: {
    studentId: string;
    type: 'Buy' | 'Sell';
    units: Prisma.Decimal;
    nav: Prisma.Decimal;
    feeMerits: number;
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

export interface FakeAuditCreateArgs {
  data: {
    userId: string | null;
    action: AuditAction;
    entity: string;
    entityId?: string;
    meta?: unknown;
  };
}

export function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

export function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

export function decimalNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

export function makeStudent(input: Partial<StoredStudent> & Pick<StoredStudent, 'id'>): StoredStudent {
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

export function makeInstrument(
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

export function makeMarketSnapshot(input: {
  id: string;
  instrument: StoredInvestmentInstrument;
  serverFetchedAt: Date;
}): StoredMarketDataSnapshot {
  return {
    createdAt: input.serverFetchedAt,
    dayChangePct: 1.25,
    gbpConversionRate: 1,
    gbpPrice: 75,
    id: input.id,
    instrument: input.instrument,
    instrumentId: input.instrument.id,
    previousCloseGbp: 74,
    provider: 'twelve-data',
    providerCreditsLeft: null,
    providerCreditsUsed: null,
    providerTimestamp: input.serverFetchedAt,
    rawPayloadHash: `sha256:${input.id}`,
    serverFetchedAt: input.serverFetchedAt,
    sourceCurrency: input.instrument.sourceCurrency,
    sourcePrice: 75,
  };
}

function sortInstruments(
  left: StoredInvestmentInstrument,
  right: StoredInvestmentInstrument,
): number {
  return left.sortOrder - right.sortOrder || left.symbol.localeCompare(right.symbol);
}

export function makeFakeDb(
  input: {
    students?: StoredStudent[];
    guardians?: StoredGuardian[];
    ledger?: StoredLedgerRow[];
    navs?: StoredInvestmentNav[];
    accounts?: StoredInvestmentAccount[];
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
    investmentTransaction: {
      create: vi.fn((args: FakeInvestmentTransactionCreateArgs) => {
        const row: StoredInvestmentTransaction = {
          id: `ckinvesttxn${String(nextTransaction++).padStart(12, '0')}`,
          studentId: args.data.studentId,
          type: args.data.type,
          units: decimalNumber(args.data.units),
          nav: decimalNumber(args.data.nav),
          feeMerits: args.data.feeMerits,
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
    students,
    guardians,
    ledger,
    navs,
    accounts,
    transactions,
    instruments,
    snapshots,
  };

  db.$transaction.mockImplementation(async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db));

  return db;
}

export function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
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

export function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ investment: investmentRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

export function auditCreates(db: ReturnType<typeof makeFakeDb>): FakeAuditCreateArgs[] {
  return db.auditLog.create.mock.calls.map(([args]) => args);
}

export function installInvestmentTestHooks() {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env['INVESTMENT_NAV_SEED'];
    delete process.env['TWELVE_DATA_API_KEY'];
    delete process.env['TWELVE_DATA_BASE_URL'];
  });
}
