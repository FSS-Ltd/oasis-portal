import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeritAccount, SessionUser, ShopCategory } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { shopRouter } from '../routers/shop.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'ckshophead000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const shopadminUser: SessionUser = {
  id: 'ckshopadmin00000000001',
  role: 'Supervisor',
  tags: ['shopadmin'],
  requires2fa: false,
};
const shopkeeperUser: SessionUser = {
  id: 'ckshopkeeper000000001',
  role: 'Supervisor',
  tags: ['shopkeeper'],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckshopsupervisor000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'ckshopparent000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'ckshopstudentuser001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const linkedStudentId = 'ckshopstudent000000001';
const shopItemId = 'ckshopitem000000000001';
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type ShopReservationStatus = 'Ready' | 'Collected' | 'Cancelled';

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

interface StoredShopItem {
  id: string;
  name: string;
  photoUrl: string | null;
  category: ShopCategory;
  blurb: string | null;
  description: string | null;
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
  stockCount: number;
  lowStockThreshold: number;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredStudent {
  id: string;
  active: boolean;
  userId: string | null;
  fullNameEnc: string;
  yearGroup: string;
  createdAt: Date;
}

interface StoredStudentPortalSettings {
  studentId: string;
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
}

interface StoredLedgerRow {
  studentId: string;
  account: MeritAccount;
  delta: number;
  reason: string;
}

interface StoredShopPurchase {
  id: string;
  studentId: string;
  itemId: string;
  unitsBought: number;
  totalPriceMerits: number;
  shopkeeperId: string;
  createdAt: Date;
}

interface StoredShopReservation {
  id: string;
  studentId: string;
  reservedById: string;
  status: ShopReservationStatus;
  totalPriceMerits: number;
  collectedAt: Date | null;
  collectedById: string | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredShopReservationLine {
  id: string;
  reservationId: string;
  itemId: string;
  unitsReserved: number;
  unitPriceMerits: number;
  totalPriceMerits: number;
  createdAt: Date;
}

interface FakeShopItemFindManyArgs {
  where: { active?: boolean; id?: { in: string[] } };
  orderBy?: [{ active: 'desc' }, { category?: 'asc' }, { name: 'asc' }];
}

interface FakeShopItemCreateArgs {
  data: {
    name: string;
    photoUrl: string | null;
    category: ShopCategory;
    blurb: string | null;
    description: string | null;
    priceExVat: number;
    vatRatePct: number;
    priceIncVat: number;
    stockCount: number;
    lowStockThreshold: number;
    createdById: string;
  };
}

interface FakeShopItemFindUniqueArgs {
  where: { id: string };
}

interface FakeShopItemScalarUpdate {
  name: string;
  photoUrl: string | null;
  category: ShopCategory;
  blurb: string | null;
  description: string | null;
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
  stockCount: number;
  lowStockThreshold: number;
  active: boolean;
}

interface FakeShopItemStockIncrementUpdate {
  stockCount: { increment: number };
}

interface FakeShopItemPhotoUpdate {
  photoUrl: string;
}

interface FakeShopItemUpdateArgs {
  where: { id: string };
  data: FakeShopItemScalarUpdate | FakeShopItemStockIncrementUpdate | FakeShopItemPhotoUpdate;
}

interface FakeShopItemUpdateManyArgs {
  where: { id: string; active: true; stockCount: { gte: number } };
  data: { stockCount: { decrement: number } };
}

interface FakeStudentFindUniqueArgs {
  where: { id?: string; userId?: string };
  select: { id: true; active: true; userId?: true };
}

interface FakeStudentFindManyArgs {
  where: { active: true };
  orderBy: { createdAt: 'desc' };
  select: { id: true; fullNameEnc: true; yearGroup: true };
}

interface FakeLedgerAggregateArgs {
  where: { studentId: string; account: MeritAccount };
  _sum: { delta: true };
}

interface FakeLedgerGroupByArgs {
  by: ['studentId'];
  where: { studentId: { in: string[] }; account: MeritAccount };
  _sum: { delta: true };
}

interface FakeLedgerCreateManyArgs {
  data: StoredLedgerRow[];
}

interface FakeShopPurchaseCreateArgs {
  data: {
    studentId: string;
    itemId: string;
    unitsBought: number;
    totalPriceMerits: number;
    shopkeeperId: string;
  };
}

interface FakeShopPurchaseCreateManyArgs {
  data: Array<{
    studentId: string;
    itemId: string;
    unitsBought: number;
    totalPriceMerits: number;
    shopkeeperId: string;
  }>;
}

interface FakeShopPurchaseFindManyArgs {
  where: { itemId: { in: string[] } };
  select: { itemId: true; unitsBought: true };
}

interface FakeGuardianFindUniqueArgs {
  where: { userId_studentId: { userId: string; studentId: string } };
  select: { studentId: true };
}

interface FakeShopReservationFindManyArgs {
  where: { status?: ShopReservationStatus; reservedById?: string };
}

interface FakeShopReservationFindUniqueArgs {
  where: { id: string };
  select?: { studentId: true; status: true };
}

interface FakeStudentPortalSettingsFindUniqueArgs {
  where: { studentId: string };
}

interface FakeShopReservationCreateArgs {
  data: {
    studentId: string;
    reservedById: string;
    totalPriceMerits: number;
  };
  select: { id: true };
}

interface FakeShopReservationUpdateManyArgs {
  where: { id: string; status: ShopReservationStatus };
  data:
    | { status: 'Collected'; collectedAt: Date; collectedById: string }
    | { status: 'Cancelled'; cancelledAt: Date; cancelledById: string };
}

interface FakeShopReservationLineCreateManyArgs {
  data: Array<{
    reservationId: string;
    itemId: string;
    unitsReserved: number;
    unitPriceMerits: number;
    totalPriceMerits: number;
  }>;
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

function makeItem(input: Partial<StoredShopItem> & Pick<StoredShopItem, 'id'>): StoredShopItem {
  return {
    name: 'Notebook',
    photoUrl: null,
    category: 'Stationery',
    blurb: null,
    description: null,
    priceExVat: 100,
    vatRatePct: 20,
    priceIncVat: 120,
    stockCount: 5,
    lowStockThreshold: 2,
    active: true,
    createdById: headUser.id,
    createdAt: new Date('2026-05-15T09:00:00.000Z'),
    updatedAt: new Date('2026-05-15T09:00:00.000Z'),
    ...input,
  };
}

function makeStudent(input: Partial<StoredStudent> & Pick<StoredStudent, 'id'>): StoredStudent {
  return {
    active: true,
    userId: studentUser.id,
    fullNameEnc: 'Joshua Johnson',
    yearGroup: 'Y9',
    createdAt: new Date('2026-05-15T09:00:00.000Z'),
    ...input,
  };
}

function makePortalSettings(
  input: Partial<StoredStudentPortalSettings> & Pick<StoredStudentPortalSettings, 'studentId'>,
): StoredStudentPortalSettings {
  return {
    parentAccountLocked: false,
    parentLockReasonEnc: null,
    headAcademicLocked: false,
    headAcademicLockReasonEnc: null,
    parentMeritShopBlocked: false,
    ...input,
  };
}

function selectItem(item: StoredShopItem) {
  return {
    id: item.id,
    name: item.name,
    photoUrl: item.photoUrl,
    category: item.category,
    blurb: item.blurb,
    description: item.description,
    priceExVat: item.priceExVat,
    vatRatePct: item.vatRatePct,
    priceIncVat: item.priceIncVat,
    stockCount: item.stockCount,
    lowStockThreshold: item.lowStockThreshold,
    active: item.active,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function makeReservation(
  input: Partial<StoredShopReservation> & Pick<StoredShopReservation, 'id' | 'studentId'>,
): StoredShopReservation {
  return {
    reservedById: parentUser.id,
    status: 'Ready',
    totalPriceMerits: 20,
    collectedAt: null,
    collectedById: null,
    cancelledAt: null,
    cancelledById: null,
    createdAt: new Date('2026-05-15T11:00:00.000Z'),
    updatedAt: new Date('2026-05-15T11:00:00.000Z'),
    ...input,
  };
}

function makeReservationLine(
  input: Partial<StoredShopReservationLine> &
    Pick<StoredShopReservationLine, 'id' | 'reservationId' | 'itemId'>,
): StoredShopReservationLine {
  return {
    unitsReserved: 1,
    unitPriceMerits: 20,
    totalPriceMerits: 20,
    createdAt: new Date('2026-05-15T11:00:00.000Z'),
    ...input,
  };
}

function isStockIncrementUpdate(
  data: FakeShopItemUpdateArgs['data'],
): data is FakeShopItemStockIncrementUpdate {
  return 'stockCount' in data && typeof data.stockCount === 'object';
}

function isPhotoOnlyUpdate(data: FakeShopItemUpdateArgs['data']): data is FakeShopItemPhotoUpdate {
  return 'photoUrl' in data && !('name' in data);
}

function makeFakeDb(
  input: {
    items?: StoredShopItem[];
    students?: Array<Partial<StoredStudent> & Pick<StoredStudent, 'id'>>;
    ledger?: StoredLedgerRow[];
    purchases?: StoredShopPurchase[];
    reservations?: StoredShopReservation[];
    reservationLines?: StoredShopReservationLine[];
    guardians?: Array<{ userId: string; studentId: string }>;
    portalSettings?: Array<
      Partial<StoredStudentPortalSettings> & Pick<StoredStudentPortalSettings, 'studentId'>
    >;
    forceStockConflict?: boolean;
  } = {},
) {
  const items = input.items ?? [];
  const students = (input.students ?? [{ id: linkedStudentId }]).map(makeStudent);
  const ledger = input.ledger ?? [];
  const purchases = input.purchases ?? [];
  const reservations = input.reservations ?? [];
  const reservationLines = input.reservationLines ?? [];
  const guardians = input.guardians ?? [{ userId: parentUser.id, studentId: linkedStudentId }];
  const portalSettings = (input.portalSettings ?? []).map(makePortalSettings);
  const forceStockConflict = input.forceStockConflict ?? false;
  let nextItem = items.length + 1;
  let nextPurchase = purchases.length + 1;
  let nextReservation = reservations.length + 1;
  let nextReservationLine = reservationLines.length + 1;

  const selectReservation = (reservation: StoredShopReservation) => {
    const student = students.find((row) => row.id === reservation.studentId);
    if (!student) throw new Error('missing reservation student');
    return {
      ...reservation,
      student: {
        id: student.id,
        userId: student.userId,
        fullNameEnc: student.fullNameEnc,
        yearGroup: student.yearGroup,
      },
      lines: reservationLines
        .filter((line) => line.reservationId === reservation.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((line) => {
          const item = items.find((row) => row.id === line.itemId);
          if (!item) throw new Error('missing reservation item');
          return { ...line, item: selectItem(item) };
        }),
    };
  };

  const db = {
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
    },
    $enc: {
      decrypt: vi.fn((value: string | null | undefined) => value ?? null),
    },
    student: {
      findUnique: vi.fn((args: FakeStudentFindUniqueArgs) =>
        Promise.resolve(
          students.find(
            (student) =>
              (args.where.id !== undefined && student.id === args.where.id) ||
              (args.where.userId !== undefined && student.userId === args.where.userId),
          ) ?? null,
        ),
      ),
      findMany: vi.fn((args: FakeStudentFindManyArgs) => {
        const filtered = students.filter((student) => student.active === args.where.active);
        return Promise.resolve(
          filtered
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((student) => ({
              id: student.id,
              fullNameEnc: student.fullNameEnc,
              yearGroup: student.yearGroup,
            })),
        );
      }),
    },
    guardian: {
      findUnique: vi.fn((args: FakeGuardianFindUniqueArgs) => {
        const match = guardians.find(
          (guardian) =>
            guardian.userId === args.where.userId_studentId.userId &&
            guardian.studentId === args.where.userId_studentId.studentId,
        );
        return Promise.resolve(match ? { studentId: match.studentId } : null);
      }),
    },
    studentPortalSettings: {
      findUnique: vi.fn((args: FakeStudentPortalSettingsFindUniqueArgs) =>
        Promise.resolve(
          portalSettings.find((settings) => settings.studentId === args.where.studentId) ?? null,
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
      groupBy: vi.fn((args: FakeLedgerGroupByArgs) => {
        const studentIds = new Set(args.where.studentId.in);
        const totals = new Map<string, number>();
        for (const row of ledger) {
          if (!studentIds.has(row.studentId) || row.account !== args.where.account) continue;
          totals.set(row.studentId, (totals.get(row.studentId) ?? 0) + row.delta);
        }
        return Promise.resolve(
          [...totals.entries()].map(([studentId, delta]) => ({
            studentId,
            _sum: { delta },
          })),
        );
      }),
      createMany: vi.fn((args: FakeLedgerCreateManyArgs) => {
        ledger.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    shopItem: {
      findMany: vi.fn((args: FakeShopItemFindManyArgs) => {
        const filtered = (() => {
          if (args.where.active !== undefined) {
            return items.filter((item) => item.active === args.where.active);
          }
          if (args.where.id) {
            const ids = new Set(args.where.id.in);
            return items.filter((item) => ids.has(item.id));
          }
          return [...items];
        })();
        return Promise.resolve(
          filtered
            .sort((a, b) => {
              if (a.active !== b.active) return a.active ? -1 : 1;
              if (a.category !== b.category) return a.category.localeCompare(b.category);
              return a.name.localeCompare(b.name);
            })
            .map(selectItem),
        );
      }),
      create: vi.fn((args: FakeShopItemCreateArgs) => {
        const now = new Date();
        const item = makeItem({
          id: `ckshopitem${String(nextItem++).padStart(13, '0')}`,
          name: args.data.name,
          photoUrl: args.data.photoUrl,
          category: args.data.category,
          blurb: args.data.blurb,
          description: args.data.description,
          priceExVat: args.data.priceExVat,
          vatRatePct: args.data.vatRatePct,
          priceIncVat: args.data.priceIncVat,
          stockCount: args.data.stockCount,
          lowStockThreshold: args.data.lowStockThreshold,
          createdById: args.data.createdById,
          createdAt: now,
          updatedAt: now,
        });
        items.push(item);
        return Promise.resolve(selectItem(item));
      }),
      findUnique: vi.fn((args: FakeShopItemFindUniqueArgs) => {
        const item = items.find((row) => row.id === args.where.id);
        return Promise.resolve(item ? selectItem(item) : null);
      }),
      update: vi.fn((args: FakeShopItemUpdateArgs) => {
        const item = items.find((row) => row.id === args.where.id);
        if (!item) throw new Error('missing item');
        const data = args.data;
        if (isStockIncrementUpdate(data)) {
          item.stockCount += data.stockCount.increment;
          item.updatedAt = new Date();
          return Promise.resolve(selectItem(item));
        }
        if (isPhotoOnlyUpdate(data)) {
          item.photoUrl = data.photoUrl;
          item.updatedAt = new Date();
          return Promise.resolve(selectItem(item));
        }
        item.name = data.name;
        item.photoUrl = data.photoUrl ?? null;
        item.category = data.category;
        item.blurb = data.blurb;
        item.description = data.description;
        item.priceExVat = data.priceExVat;
        item.vatRatePct = data.vatRatePct;
        item.priceIncVat = data.priceIncVat;
        item.stockCount = data.stockCount;
        item.lowStockThreshold = data.lowStockThreshold;
        item.active = data.active;
        item.updatedAt = new Date();
        return Promise.resolve(selectItem(item));
      }),
      updateMany: vi.fn((args: FakeShopItemUpdateManyArgs) => {
        if (forceStockConflict) return Promise.resolve({ count: 0 });
        const item = items.find((row) => row.id === args.where.id);
        if (
          !item ||
          item.active !== args.where.active ||
          item.stockCount < args.where.stockCount.gte
        ) {
          return Promise.resolve({ count: 0 });
        }
        item.stockCount -= args.data.stockCount.decrement;
        item.updatedAt = new Date();
        return Promise.resolve({ count: 1 });
      }),
    },
    shopPurchase: {
      findMany: vi.fn((args: FakeShopPurchaseFindManyArgs) => {
        const itemIds = new Set(args.where.itemId.in);
        return Promise.resolve(
          purchases
            .filter((purchase) => itemIds.has(purchase.itemId))
            .map((purchase) => ({
              itemId: purchase.itemId,
              unitsBought: purchase.unitsBought,
            })),
        );
      }),
      create: vi.fn((args: FakeShopPurchaseCreateArgs) => {
        const purchase: StoredShopPurchase = {
          id: `ckshoppurchase${String(nextPurchase++).padStart(10, '0')}`,
          studentId: args.data.studentId,
          itemId: args.data.itemId,
          unitsBought: args.data.unitsBought,
          totalPriceMerits: args.data.totalPriceMerits,
          shopkeeperId: args.data.shopkeeperId,
          createdAt: new Date(),
        };
        purchases.push(purchase);
        return Promise.resolve({
          id: purchase.id,
          studentId: purchase.studentId,
          itemId: purchase.itemId,
          unitsBought: purchase.unitsBought,
          totalPriceMerits: purchase.totalPriceMerits,
          createdAt: purchase.createdAt,
        });
      }),
      createMany: vi.fn((args: FakeShopPurchaseCreateManyArgs) => {
        for (const row of args.data) {
          purchases.push({
            id: `ckshoppurchase${String(nextPurchase++).padStart(10, '0')}`,
            studentId: row.studentId,
            itemId: row.itemId,
            unitsBought: row.unitsBought,
            totalPriceMerits: row.totalPriceMerits,
            shopkeeperId: row.shopkeeperId,
            createdAt: new Date(),
          });
        }
        return Promise.resolve({ count: args.data.length });
      }),
    },
    shopReservation: {
      findMany: vi.fn((args: FakeShopReservationFindManyArgs) => {
        const filtered = reservations.filter((reservation) => {
          if (args.where.status && reservation.status !== args.where.status) return false;
          if (args.where.reservedById && reservation.reservedById !== args.where.reservedById) {
            return false;
          }
          return true;
        });
        return Promise.resolve(
          filtered
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map(selectReservation),
        );
      }),
      findUnique: vi.fn((args: FakeShopReservationFindUniqueArgs) => {
        const reservation = reservations.find((row) => row.id === args.where.id);
        return Promise.resolve(reservation ? selectReservation(reservation) : null);
      }),
      create: vi.fn((args: FakeShopReservationCreateArgs) => {
        const now = new Date();
        const reservation = makeReservation({
          id: `ckshopreservation${String(nextReservation++).padStart(7, '0')}`,
          studentId: args.data.studentId,
          reservedById: args.data.reservedById,
          totalPriceMerits: args.data.totalPriceMerits,
          createdAt: now,
          updatedAt: now,
        });
        reservations.push(reservation);
        return Promise.resolve({ id: reservation.id });
      }),
      updateMany: vi.fn((args: FakeShopReservationUpdateManyArgs) => {
        const reservation = reservations.find(
          (row) => row.id === args.where.id && row.status === args.where.status,
        );
        if (!reservation) return Promise.resolve({ count: 0 });
        reservation.status = args.data.status;
        reservation.updatedAt = new Date();
        if (args.data.status === 'Collected') {
          reservation.collectedAt = args.data.collectedAt;
          reservation.collectedById = args.data.collectedById;
        } else {
          reservation.cancelledAt = args.data.cancelledAt;
          reservation.cancelledById = args.data.cancelledById;
        }
        return Promise.resolve({ count: 1 });
      }),
    },
    shopReservationLine: {
      createMany: vi.fn((args: FakeShopReservationLineCreateManyArgs) => {
        for (const row of args.data) {
          reservationLines.push(
            makeReservationLine({
              id: `ckshopresline${String(nextReservationLine++).padStart(10, '0')}`,
              reservationId: row.reservationId,
              itemId: row.itemId,
              unitsReserved: row.unitsReserved,
              unitPriceMerits: row.unitPriceMerits,
              totalPriceMerits: row.totalPriceMerits,
              createdAt: new Date(),
            }),
          );
        }
        return Promise.resolve({ count: args.data.length });
      }),
    },
    items,
    students,
    ledger,
    purchases,
    reservations,
    reservationLines,
    guardians,
    portalSettings,
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
      return Promise.reject(new Error('withRls is not used by shop router tests'));
    },
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ shop: shopRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

function auditCreates(db: ReturnType<typeof makeFakeDb>): FakeAuditCreateArgs[] {
  return db.auditLog.create.mock.calls.map(([args]) => args);
}

function stubShopItemPhotoStorage(
  input: {
    bytes?: Uint8Array;
    contentType?: string;
    ok?: boolean;
  } = {},
) {
  const bytes = input.bytes ?? pngBytes;
  vi.stubEnv('SUPABASE_URL', 'https://supabase.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      const init: ResponseInit = { status: input.ok === false ? 404 : 200 };
      if (input.contentType) init.headers = { 'content-type': input.contentType };
      return Promise.resolve(new Response(input.ok === false ? null : bytes.slice().buffer, init));
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('shop.listItems', () => {
  it('lists active items by default and lets managers include inactive items', async () => {
    const db = makeFakeDb({
      items: [
        makeItem({ id: 'ckshopitem000000000001', name: 'Water Bottle', active: false }),
        makeItem({ id: 'ckshopitem000000000002', name: 'Bookmark', active: true }),
      ],
    });

    await expect(makeCaller(supervisorUser, db).caller.shop.listItems()).resolves.toMatchObject([
      { id: 'ckshopitem000000000002', name: 'Bookmark', active: true },
    ]);

    await expect(
      makeCaller(shopadminUser, db).caller.shop.listItems({ includeInactive: true }),
    ).resolves.toMatchObject([
      { id: 'ckshopitem000000000002', name: 'Bookmark', active: true },
      { id: 'ckshopitem000000000001', name: 'Water Bottle', active: false },
    ]);
  });

  it('blocks includeInactive for non-managers and audits the denial', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.shop.listItems({ includeInactive: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'shop.listItems',
      }),
    );
  });

  it('includes category metadata, stock status, and sold counts derived from purchases', async () => {
    const db = makeFakeDb({
      items: [
        makeItem({
          id: shopItemId,
          name: 'Oasis Pencil',
          category: 'Stationery',
          blurb: 'For neat notes',
          description: 'A useful pencil for learning center work.',
          priceIncVat: 15,
          stockCount: 2,
          lowStockThreshold: 3,
        }),
      ],
      purchases: [
        {
          id: 'ckshoppurchase000000001',
          studentId: linkedStudentId,
          itemId: shopItemId,
          unitsBought: 2,
          totalPriceMerits: 30,
          shopkeeperId: shopkeeperUser.id,
          createdAt: new Date('2026-05-15T10:00:00.000Z'),
        },
        {
          id: 'ckshoppurchase000000002',
          studentId: linkedStudentId,
          itemId: shopItemId,
          unitsBought: 1,
          totalPriceMerits: 15,
          shopkeeperId: shopkeeperUser.id,
          createdAt: new Date('2026-05-15T10:30:00.000Z'),
        },
      ],
    });

    await expect(makeCaller(supervisorUser, db).caller.shop.listItems()).resolves.toMatchObject([
      {
        id: shopItemId,
        category: 'Stationery',
        categoryLabel: 'Stationery',
        blurb: 'For neat notes',
        description: 'A useful pencil for learning center work.',
        lowStockThreshold: 3,
        stockStatus: 'LowStock',
        soldCount: 3,
      },
    ]);
  });

  it('blocks locked Student users from reading shop items', async () => {
    const db = makeFakeDb({
      items: [makeItem({ id: shopItemId, active: true })],
      portalSettings: [{ studentId: linkedStudentId, headAcademicLocked: true }],
      students: [{ id: linkedStudentId, userId: studentUser.id }],
    });

    await expect(makeCaller(studentUser, db).caller.shop.listItems()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Student portal is locked by Oasis Learning Centre for academic reasons.',
    });
    expect(db.shopItem.findMany).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'shop.listItems',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          reason: 'AccountLocked',
          lockSource: 'HeadAcademic',
        }) as unknown,
      }),
    );
  });
});

describe('shop.listPurchasers', () => {
  it('lists active students with Spend balances for shopkeepers and audits PII decrypt', async () => {
    const db = makeFakeDb({
      students: [
        makeStudent({
          id: linkedStudentId,
          fullNameEnc: 'Joshua Johnson',
          yearGroup: 'Y9',
          createdAt: new Date('2026-05-15T10:00:00.000Z'),
        }),
        makeStudent({
          id: 'ckshopstudent000000002',
          fullNameEnc: 'Grace Williams',
          yearGroup: 'Y8',
          createdAt: new Date('2026-05-15T11:00:00.000Z'),
        }),
        makeStudent({
          id: 'ckshopstudent000000003',
          active: false,
          fullNameEnc: 'Archived Student',
          yearGroup: 'Y7',
        }),
      ],
      ledger: [
        { studentId: linkedStudentId, account: 'Spend', delta: 40, reason: 'merit' },
        { studentId: linkedStudentId, account: 'Spend', delta: -10, reason: 'shop' },
        { studentId: 'ckshopstudent000000002', account: 'Saving', delta: 100, reason: 'saving' },
      ],
    });

    await expect(makeCaller(shopkeeperUser, db).caller.shop.listPurchasers()).resolves.toEqual([
      {
        id: 'ckshopstudent000000002',
        fullName: 'Grace Williams',
        yearGroup: 'Y8',
        spendBalance: 0,
      },
      {
        id: linkedStudentId,
        fullName: 'Joshua Johnson',
        yearGroup: 'Y9',
        spendBalance: 30,
      },
    ]);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 2, source: 'shop.listPurchasers' },
      }),
    );
  });

  it('denies untagged users before listing student PII', async () => {
    const db = makeFakeDb();

    await expect(makeCaller(supervisorUser, db).caller.shop.listPurchasers()).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
    expect(db.student.findMany).not.toHaveBeenCalled();
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'shop.listPurchasers',
      }),
    );
  });
});

describe('shop.createItem', () => {
  it('allows full-admin and shopadmin users to create priced items and writes an audit row', async () => {
    const { caller, db } = makeCaller(headUser);

    await expect(
      caller.shop.createItem({
        name: '  Pencil  ',
        category: 'Stationery',
        blurb: '  For careful work  ',
        description: '  HB pencil with an Oasis wrap.  ',
        priceExVat: 25,
        vatRatePct: 20,
        stockCount: 12,
        lowStockThreshold: 4,
      }),
    ).resolves.toMatchObject({
      name: 'Pencil',
      category: 'Stationery',
      blurb: 'For careful work',
      description: 'HB pencil with an Oasis wrap.',
      priceExVat: 25,
      vatRatePct: 20,
      priceIncVat: 30,
      stockCount: 12,
      lowStockThreshold: 4,
      active: true,
    });

    expect(db.items).toHaveLength(1);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'ShopItem',
        meta: expect.objectContaining({
          source: 'shop.createItem',
          priceIncVat: 30,
          stockCount: 12,
        }) as unknown,
      }),
    );

    await expect(
      makeCaller(shopadminUser, makeFakeDb()).caller.shop.createItem({
        name: 'Sticker',
        priceExVat: 10,
        vatRatePct: 0,
        stockCount: 5,
      }),
    ).resolves.toMatchObject({ name: 'Sticker', priceIncVat: 10 });
  });

  it('rejects unauthorized create attempts before writing items', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(
      caller.shop.createItem({
        name: 'Pencil',
        priceExVat: 25,
        vatRatePct: 20,
        stockCount: 12,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.items).toHaveLength(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'shop.createItem',
      }),
    );
  });
});

describe('shop.updateItem', () => {
  it('updates pricing, stock, and active state with recalculated VAT and audit rows', async () => {
    const itemId = 'ckshopitem000000000001';
    const { caller, db } = makeCaller(
      shopadminUser,
      makeFakeDb({ items: [makeItem({ id: itemId, name: 'Notebook' })] }),
    );

    await expect(
      caller.shop.updateItem({
        id: itemId,
        priceExVat: 50,
        vatRatePct: 20,
        stockCount: 2,
        active: false,
      }),
    ).resolves.toMatchObject({
      id: itemId,
      name: 'Notebook',
      priceExVat: 50,
      priceIncVat: 60,
      stockCount: 2,
      active: false,
    });

    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Delete',
        entity: 'ShopItem',
        entityId: itemId,
        meta: expect.objectContaining({
          source: 'shop.updateItem',
          previousActive: true,
          active: false,
        }) as unknown,
      }),
    );
  });

  it('returns not found for missing items', async () => {
    await expect(
      makeCaller(headUser).caller.shop.updateItem({
        id: 'ckshopitem000000000999',
        active: false,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not let shopkeepers change item management fields', async () => {
    const { caller, db } = makeCaller(
      shopkeeperUser,
      makeFakeDb({ items: [makeItem({ id: shopItemId, name: 'Notebook' })] }),
    );

    await expect(
      caller.shop.updateItem({
        id: shopItemId,
        priceExVat: 50,
        stockCount: 2,
        active: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.items[0]).toMatchObject({
      name: 'Notebook',
      priceExVat: 100,
      stockCount: 5,
      active: true,
    });
  });
});

describe('shop item photos', () => {
  const validPhoto = {
    fileName: 'photo.png',
    mimeType: 'image/png',
    sizeBytes: pngBytes.byteLength,
    storageBucket: 'shop-item-photos',
    storagePath: `shop-items/${shopkeeperUser.id}/photo.png`,
  };

  it('prepares signed upload metadata for shopkeepers', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test');

    const result = await makeCaller(shopkeeperUser).caller.shop.prepareItemPhotoUpload({
      photo: {
        fileName: 'Reward Photo.png',
        mimeType: 'image/png',
        sizeBytes: pngBytes.byteLength,
      },
    });

    expect(result).toMatchObject({
      fileName: 'Reward Photo.png',
      mimeType: 'image/png',
      sizeBytes: pngBytes.byteLength,
      storageBucket: 'shop-item-photos',
    });
    expect(result.publicUrl).toContain('/storage/v1/object/public/shop-item-photos/shop-items/');
  });

  it('lets shopkeepers update only the item photo after uploaded object verification', async () => {
    stubShopItemPhotoStorage();
    const { caller, db } = makeCaller(
      shopkeeperUser,
      makeFakeDb({ items: [makeItem({ id: shopItemId, name: 'Notebook' })] }),
    );

    await expect(
      caller.shop.updateItemPhoto({
        id: shopItemId,
        photo: validPhoto,
      }),
    ).resolves.toMatchObject({
      id: shopItemId,
      name: 'Notebook',
      photoUrl:
        'https://supabase.test/storage/v1/object/public/shop-item-photos/shop-items/ckshopkeeper000000001/photo.png',
      priceExVat: 100,
      stockCount: 5,
      active: true,
    });

    expect(db.items[0]?.photoUrl).toBe(
      'https://supabase.test/storage/v1/object/public/shop-item-photos/shop-items/ckshopkeeper000000001/photo.png',
    );
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'ShopItem',
        entityId: shopItemId,
        meta: expect.objectContaining({
          source: 'shop.updateItemPhoto',
          storageBucket: 'shop-item-photos',
          storagePath: validPhoto.storagePath,
        }) as unknown,
      }),
    );
  });

  it('rejects ordinary supervisors before preparing or saving item photos', async () => {
    const { caller, db } = makeCaller(
      supervisorUser,
      makeFakeDb({ items: [makeItem({ id: shopItemId, name: 'Notebook' })] }),
    );

    await expect(
      caller.shop.prepareItemPhotoUpload({
        photo: { fileName: 'photo.png', mimeType: 'image/png', sizeBytes: pngBytes.byteLength },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.shop.updateItemPhoto({
        id: shopItemId,
        photo: validPhoto,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.items[0]?.photoUrl).toBeNull();
  });

  it('rejects invalid photo metadata and unsafe storage targets', async () => {
    const caller = makeCaller(
      shopkeeperUser,
      makeFakeDb({ items: [makeItem({ id: shopItemId, name: 'Notebook' })] }),
    ).caller;

    await expect(
      caller.shop.prepareItemPhotoUpload({
        photo: { fileName: 'photo.gif', mimeType: 'image/gif', sizeBytes: 100 },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.shop.prepareItemPhotoUpload({
        photo: { fileName: 'photo.png', mimeType: 'image/png', sizeBytes: 5 * 1024 * 1024 + 1 },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.shop.updateItemPhoto({
        id: shopItemId,
        photo: { ...validPhoto, storageBucket: 'notice-attachments' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.shop.updateItemPhoto({
        id: shopItemId,
        photo: { ...validPhoto, storagePath: 'shop-items/other-user/photo.png' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects missing uploaded objects before saving the photo URL', async () => {
    stubShopItemPhotoStorage({ ok: false });
    const { caller, db } = makeCaller(
      shopkeeperUser,
      makeFakeDb({ items: [makeItem({ id: shopItemId, name: 'Notebook' })] }),
    );

    await expect(
      caller.shop.updateItemPhoto({
        id: shopItemId,
        photo: validPhoto,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.items[0]?.photoUrl).toBeNull();
  });
});

describe('shop reservations', () => {
  it('lets a parent reserve stock and Spend for a linked child', async () => {
    const { caller, db } = makeCaller(
      parentUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 4 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      }),
    );

    await expect(
      caller.shop.reserve({
        studentId: linkedStudentId,
        lines: [{ itemId: shopItemId, unitsReserved: 2 }],
      }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      reservedById: parentUser.id,
      status: 'Ready',
      totalPriceMerits: 40,
      lines: [
        {
          itemId: shopItemId,
          itemName: 'Notebook',
          unitsReserved: 2,
          unitPriceMerits: 20,
          totalPriceMerits: 40,
        },
      ],
    });

    const reservation = db.reservations[0];
    if (!reservation) {
      throw new Error('expected shop reservation to be created');
    }
    const reservationId = reservation.id;
    expect(db.items[0]?.stockCount).toBe(2);
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Spend',
      delta: -40,
      reason: `shop-reservation:${reservationId}:hold`,
    });
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'ShopReserved',
      delta: 40,
      reason: `shop-reservation:${reservationId}:hold`,
    });
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'ShopReservation',
        entityId: reservationId,
      }),
    );
  });

  it('limits parent and student reservation access to linked children or self', async () => {
    const parentDb = makeFakeDb({
      guardians: [],
      items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 4 })],
      ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
    });

    await expect(
      makeCaller(parentUser, parentDb).caller.shop.reserve({
        studentId: linkedStudentId,
        lines: [{ itemId: shopItemId, unitsReserved: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(parentDb.reservations).toHaveLength(0);

    const studentDb = makeFakeDb({
      students: [{ id: linkedStudentId, userId: studentUser.id }],
      items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 4 })],
      ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
    });

    await expect(
      makeCaller(studentUser, studentDb).caller.shop.reserve({
        studentId: linkedStudentId,
        lines: [{ itemId: shopItemId, unitsReserved: 1 }],
      }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      reservedById: studentUser.id,
      totalPriceMerits: 20,
    });

    const otherStudentId = 'ckshopstudent000000002';
    await expect(
      makeCaller(
        studentUser,
        makeFakeDb({
          students: [{ id: otherStudentId, userId: 'ckshopotheruser00001' }],
          items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 4 })],
          ledger: [{ studentId: otherStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
        }),
      ).caller.shop.reserve({
        studentId: otherStudentId,
        lines: [{ itemId: shopItemId, unitsReserved: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks parent and student reservations when portal policy blocks shop use', async () => {
    const parentDb = makeFakeDb({
      items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 4 })],
      ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      portalSettings: [{ studentId: linkedStudentId, parentMeritShopBlocked: true }],
    });

    await expect(
      makeCaller(parentUser, parentDb).caller.shop.reserve({
        studentId: linkedStudentId,
        lines: [{ itemId: shopItemId, unitsReserved: 1 }],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Merit Shop access is blocked by a parent or carer.',
    });
    expect(parentDb.reservations).toHaveLength(0);
    expect(parentDb.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' },
    ]);

    const studentDb = makeFakeDb({
      items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 4 })],
      ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      portalSettings: [{ studentId: linkedStudentId, parentAccountLocked: true }],
      students: [{ id: linkedStudentId, userId: studentUser.id }],
    });

    await expect(
      makeCaller(studentUser, studentDb).caller.shop.reserve({
        studentId: linkedStudentId,
        lines: [{ itemId: shopItemId, unitsReserved: 1 }],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Student portal is locked by a parent or carer.',
    });
    expect(studentDb.reservations).toHaveLength(0);
    expect(auditCreates(studentDb).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'shop.reserve',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          reason: 'AccountLocked',
          lockSource: 'Parent',
        }) as unknown,
      }),
    );
  });

  it('lets shop staff list, collect, and cancel reservations with balanced ledger rows', async () => {
    const reservationId = 'ckshopreserve000000001';
    const cancelReservationId = 'ckshopreserve000000002';
    const db = makeFakeDb({
      items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 1 })],
      ledger: [{ studentId: linkedStudentId, account: 'ShopReserved', delta: 40, reason: 'hold' }],
      reservations: [
        makeReservation({
          id: reservationId,
          studentId: linkedStudentId,
          totalPriceMerits: 20,
        }),
        makeReservation({
          id: cancelReservationId,
          studentId: linkedStudentId,
          totalPriceMerits: 20,
        }),
      ],
      reservationLines: [
        makeReservationLine({
          id: 'ckshopresline000000001',
          reservationId,
          itemId: shopItemId,
          unitsReserved: 1,
          unitPriceMerits: 20,
          totalPriceMerits: 20,
        }),
        makeReservationLine({
          id: 'ckshopresline000000002',
          reservationId: cancelReservationId,
          itemId: shopItemId,
          unitsReserved: 1,
          unitPriceMerits: 20,
          totalPriceMerits: 20,
        }),
      ],
    });
    const caller = makeCaller(shopkeeperUser, db).caller;

    await expect(caller.shop.listReservations({ status: 'Ready' })).resolves.toHaveLength(2);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 2, source: 'shop.listReservations' },
      }),
    );

    await expect(caller.shop.collectReservation({ reservationId })).resolves.toMatchObject({
      id: reservationId,
      status: 'Collected',
      collectedById: shopkeeperUser.id,
    });
    expect(db.purchases).toMatchObject([
      {
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
        totalPriceMerits: 20,
        shopkeeperId: shopkeeperUser.id,
      },
    ]);
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'ShopReserved',
      delta: -20,
      reason: `shop-reservation:${reservationId}:collected`,
    });
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Given',
      delta: 20,
      reason: `shop-reservation:${reservationId}:collected`,
    });

    await expect(
      caller.shop.cancelReservation({ reservationId: cancelReservationId }),
    ).resolves.toMatchObject({
      id: cancelReservationId,
      status: 'Cancelled',
      cancelledById: shopkeeperUser.id,
    });
    expect(db.items[0]?.stockCount).toBe(2);
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'ShopReserved',
      delta: -20,
      reason: `shop-reservation:${cancelReservationId}:cancelled`,
    });
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Spend',
      delta: 20,
      reason: `shop-reservation:${cancelReservationId}:cancelled`,
    });
  });

  it('blocks reservation collection when the student shop policy becomes blocked', async () => {
    const reservationId = 'ckshopreserve000000001';
    const db = makeFakeDb({
      items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 1 })],
      ledger: [{ studentId: linkedStudentId, account: 'ShopReserved', delta: 20, reason: 'hold' }],
      portalSettings: [{ studentId: linkedStudentId, parentMeritShopBlocked: true }],
      reservations: [
        makeReservation({
          id: reservationId,
          studentId: linkedStudentId,
          totalPriceMerits: 20,
        }),
      ],
      reservationLines: [
        makeReservationLine({
          id: 'ckshopresline000000001',
          reservationId,
          itemId: shopItemId,
          unitsReserved: 1,
          unitPriceMerits: 20,
          totalPriceMerits: 20,
        }),
      ],
    });

    await expect(
      makeCaller(shopkeeperUser, db).caller.shop.collectReservation({ reservationId }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Merit Shop access is blocked by a parent or carer.',
    });
    expect(db.reservations[0]).toMatchObject({ status: 'Ready' });
    expect(db.purchases).toHaveLength(0);
    expect(db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'ShopReserved', delta: 20, reason: 'hold' },
    ]);
  });

  it('lets parents see their own reservations without exposing other parent holds', async () => {
    const db = makeFakeDb({
      items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 1 })],
      reservations: [
        makeReservation({
          id: 'ckshopreserve000000001',
          studentId: linkedStudentId,
          reservedById: parentUser.id,
        }),
        makeReservation({
          id: 'ckshopreserve000000002',
          studentId: linkedStudentId,
          reservedById: 'ckshopparent000000002',
        }),
      ],
      reservationLines: [
        makeReservationLine({
          id: 'ckshopresline000000001',
          reservationId: 'ckshopreserve000000001',
          itemId: shopItemId,
        }),
        makeReservationLine({
          id: 'ckshopresline000000002',
          reservationId: 'ckshopreserve000000002',
          itemId: shopItemId,
        }),
      ],
    });

    await expect(makeCaller(parentUser, db).caller.shop.listReservations()).resolves.toMatchObject([
      {
        id: 'ckshopreserve000000001',
        reservedById: parentUser.id,
      },
    ]);
  });
});

describe('shop.purchase', () => {
  it('records a shopkeeper purchase, decrements stock, writes balanced ledger rows, and audits it', async () => {
    const { caller, db } = makeCaller(
      shopkeeperUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 3 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      }),
    );

    await expect(
      caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 2,
      }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      itemId: shopItemId,
      unitsBought: 2,
      totalPriceMerits: 40,
      remainingStockCount: 1,
    });

    expect(db.items[0]?.stockCount).toBe(1);
    expect(db.purchases).toMatchObject([
      {
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 2,
        totalPriceMerits: 40,
        shopkeeperId: shopkeeperUser.id,
      },
    ]);
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Spend',
      delta: -40,
      reason: `shop:${shopItemId}:x2`,
    });
    expect(db.ledger).toContainEqual({
      studentId: linkedStudentId,
      account: 'Given',
      delta: 40,
      reason: `shop:${shopItemId}:x2`,
    });
    expect(
      db.ledger
        .filter((row) => row.reason === `shop:${shopItemId}:x2`)
        .reduce((total, row) => total + row.delta, 0),
    ).toBe(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Create',
        entity: 'ShopPurchase',
        meta: expect.objectContaining({
          source: 'shop.purchase',
          studentId: linkedStudentId,
          itemId: shopItemId,
          totalPriceMerits: 40,
        }) as unknown,
      }),
    );
  });

  it('allows full-admin users to record purchases without shopkeeper tags', async () => {
    const { caller } = makeCaller(
      headUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 10, stockCount: 1 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 10, reason: 'merit' }],
      }),
    );

    await expect(
      caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).resolves.toMatchObject({ totalPriceMerits: 10 });
  });

  it('blocks direct shop purchases when account or shop policy blocks the student', async () => {
    const shopBlocked = makeCaller(
      shopkeeperUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 3 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
        portalSettings: [{ studentId: linkedStudentId, parentMeritShopBlocked: true }],
      }),
    );

    await expect(
      shopBlocked.caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Merit Shop access is blocked by a parent or carer.',
    });
    expect(shopBlocked.db.purchases).toHaveLength(0);
    expect(shopBlocked.db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' },
    ]);

    const academicallyLocked = makeCaller(
      shopkeeperUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 3 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
        portalSettings: [{ studentId: linkedStudentId, headAcademicLocked: true }],
      }),
    );

    await expect(
      academicallyLocked.caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Student portal is locked by Oasis Learning Centre for academic reasons.',
    });
    expect(academicallyLocked.db.purchases).toHaveLength(0);
    expect(auditCreates(academicallyLocked.db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'shop.purchase',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          reason: 'AccountLocked',
          lockSource: 'HeadAcademic',
        }) as unknown,
      }),
    );
  });

  it('rejects unauthorized purchase attempts before writing purchases', async () => {
    const { caller, db } = makeCaller(
      supervisorUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 3 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      }),
    );

    await expect(
      caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.purchases).toHaveLength(0);
    expect(auditCreates(db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'PermissionDenied',
        entity: 'shop.purchase',
        entityId: linkedStudentId,
      }),
    );
  });

  it('rejects inactive items, insufficient stock, and insufficient Spend without writes', async () => {
    const inactive = makeCaller(
      shopkeeperUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, active: false, priceIncVat: 20, stockCount: 3 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      }),
    );

    await expect(
      inactive.caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(inactive.db.purchases).toHaveLength(0);

    const stock = makeCaller(
      shopkeeperUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 1 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      }),
    );

    await expect(
      stock.caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 2,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(stock.db.purchases).toHaveLength(0);

    const spend = makeCaller(
      shopkeeperUser,
      makeFakeDb({
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 3 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 10, reason: 'merit' }],
      }),
    );

    await expect(
      spend.caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(spend.db.purchases).toHaveLength(0);
    expect(spend.db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Spend', delta: 10, reason: 'merit' },
    ]);
    expect(auditCreates(spend.db).map((audit) => audit.data)).toContainEqual(
      expect.objectContaining({
        action: 'Update',
        entity: 'ShopPurchase',
        entityId: linkedStudentId,
        meta: expect.objectContaining({
          source: 'shop.purchase',
          outcome: 'Rejected',
          reason: 'InsufficientSpend',
        }) as unknown,
      }),
    );
  });

  it('rejects stale stock updates without creating purchase or ledger rows', async () => {
    const { caller, db } = makeCaller(
      shopkeeperUser,
      makeFakeDb({
        forceStockConflict: true,
        items: [makeItem({ id: shopItemId, priceIncVat: 20, stockCount: 2 })],
        ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
      }),
    );

    await expect(
      caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 2,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.items[0]?.stockCount).toBe(2);
    expect(db.purchases).toHaveLength(0);
    expect(db.ledger).toEqual([
      { studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' },
    ]);
  });

  it('returns not found for inactive students and missing items', async () => {
    await expect(
      makeCaller(
        shopkeeperUser,
        makeFakeDb({ students: [{ id: linkedStudentId, active: false }] }),
      ).caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      makeCaller(
        shopkeeperUser,
        makeFakeDb({
          ledger: [{ studentId: linkedStudentId, account: 'Spend', delta: 100, reason: 'merit' }],
        }),
      ).caller.shop.purchase({
        studentId: linkedStudentId,
        itemId: shopItemId,
        unitsBought: 1,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
