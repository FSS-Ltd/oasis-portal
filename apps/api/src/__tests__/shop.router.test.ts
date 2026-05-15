import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeritAccount, SessionUser } from '@oasis/domain';
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

const linkedStudentId = 'ckshopstudent000000001';
const shopItemId = 'ckshopitem000000000001';

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
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
  stockCount: number;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredStudent {
  id: string;
  active: boolean;
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

interface FakeShopItemFindManyArgs {
  where: { active?: true } | Record<string, never>;
  orderBy: [{ active: 'desc' }, { name: 'asc' }];
}

interface FakeShopItemCreateArgs {
  data: {
    name: string;
    photoUrl: string | null;
    priceExVat: number;
    vatRatePct: number;
    priceIncVat: number;
    stockCount: number;
    createdById: string;
  };
}

interface FakeShopItemFindUniqueArgs {
  where: { id: string };
}

interface FakeShopItemUpdateArgs {
  where: { id: string };
  data: {
    name: string;
    photoUrl: string | null;
    priceExVat: number;
    vatRatePct: number;
    priceIncVat: number;
    stockCount: number;
    active: boolean;
  };
}

interface FakeShopItemUpdateManyArgs {
  where: { id: string; active: true; stockCount: { gte: number } };
  data: { stockCount: { decrement: number } };
}

interface FakeStudentFindUniqueArgs {
  where: { id: string };
  select: { id: true; active: true };
}

interface FakeLedgerAggregateArgs {
  where: { studentId: string; account: MeritAccount };
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
    priceExVat: 100,
    vatRatePct: 20,
    priceIncVat: 120,
    stockCount: 5,
    active: true,
    createdById: headUser.id,
    createdAt: new Date('2026-05-15T09:00:00.000Z'),
    updatedAt: new Date('2026-05-15T09:00:00.000Z'),
    ...input,
  };
}

function selectItem(item: StoredShopItem) {
  return {
    id: item.id,
    name: item.name,
    photoUrl: item.photoUrl,
    priceExVat: item.priceExVat,
    vatRatePct: item.vatRatePct,
    priceIncVat: item.priceIncVat,
    stockCount: item.stockCount,
    active: item.active,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function makeFakeDb(
  input: {
    items?: StoredShopItem[];
    students?: StoredStudent[];
    ledger?: StoredLedgerRow[];
    purchases?: StoredShopPurchase[];
    forceStockConflict?: boolean;
  } = {},
) {
  const items = input.items ?? [];
  const students = input.students ?? [{ id: linkedStudentId, active: true }];
  const ledger = input.ledger ?? [];
  const purchases = input.purchases ?? [];
  const forceStockConflict = input.forceStockConflict ?? false;
  let nextItem = items.length + 1;
  let nextPurchase = purchases.length + 1;

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
    shopItem: {
      findMany: vi.fn((args: FakeShopItemFindManyArgs) => {
        const filtered =
          'active' in args.where
            ? items.filter((item) => item.active === args.where.active)
            : [...items];
        return Promise.resolve(
          filtered
            .sort((a, b) => {
              if (a.active !== b.active) return a.active ? -1 : 1;
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
          priceExVat: args.data.priceExVat,
          vatRatePct: args.data.vatRatePct,
          priceIncVat: args.data.priceIncVat,
          stockCount: args.data.stockCount,
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
        item.name = args.data.name;
        item.photoUrl = args.data.photoUrl ?? null;
        item.priceExVat = args.data.priceExVat;
        item.vatRatePct = args.data.vatRatePct;
        item.priceIncVat = args.data.priceIncVat;
        item.stockCount = args.data.stockCount;
        item.active = args.data.active;
        item.updatedAt = new Date();
        return Promise.resolve(selectItem(item));
      }),
      updateMany: vi.fn((args: FakeShopItemUpdateManyArgs) => {
        if (forceStockConflict) return Promise.resolve({ count: 0 });
        const item = items.find((row) => row.id === args.where.id);
        if (!item || item.active !== args.where.active || item.stockCount < args.where.stockCount.gte) {
          return Promise.resolve({ count: 0 });
        }
        item.stockCount -= args.data.stockCount.decrement;
        item.updatedAt = new Date();
        return Promise.resolve({ count: 1 });
      }),
    },
    shopPurchase: {
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
    },
    items,
    students,
    ledger,
    purchases,
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
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
});

describe('shop.createItem', () => {
  it('allows full-admin and shopadmin users to create priced items and writes an audit row', async () => {
    const { caller, db } = makeCaller(headUser);

    await expect(
      caller.shop.createItem({
        name: '  Pencil  ',
        priceExVat: 25,
        vatRatePct: 20,
        stockCount: 12,
      }),
    ).resolves.toMatchObject({
      name: 'Pencil',
      priceExVat: 25,
      vatRatePct: 20,
      priceIncVat: 30,
      stockCount: 12,
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
