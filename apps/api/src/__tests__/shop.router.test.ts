import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
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
const supervisorUser: SessionUser = {
  id: 'ckshopsupervisor000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

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

function makeFakeDb(input: { items?: StoredShopItem[] } = {}) {
  const items = input.items ?? [];
  let nextItem = items.length + 1;

  const db = {
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
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
    },
    items,
  };

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
