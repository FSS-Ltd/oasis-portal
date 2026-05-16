import { describe, expect, it } from 'vitest';
import {
  assertCanManageShop,
  assertCanSellInShop,
  canManageShop,
  canSellInShop,
  computePriceIncVat,
  prepareShopPurchase,
  prepareShopReservation,
  rowsForReservationCancellation,
  rowsForReservationCollection,
  validateDraft,
} from '../shop.js';
import { AccessDeniedError, type SessionUser } from '../rbac.js';

const shopadmin: SessionUser = {
  id: 'u1',
  role: 'Supervisor',
  tags: ['shopadmin'],
  requires2fa: false,
};
const shopkeeper: SessionUser = {
  id: 'u2',
  role: 'Supervisor',
  tags: ['shopkeeper'],
  requires2fa: false,
};
const head: SessionUser = {
  id: 'u4',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const nobody: SessionUser = { id: 'u3', role: 'Supervisor', tags: [], requires2fa: false };

describe('computePriceIncVat', () => {
  it('adds VAT and rounds half-up', () => {
    expect(computePriceIncVat(100, 20)).toBe(120);
    expect(computePriceIncVat(99, 20)).toBe(119); // 118.8 rounds to 119
    expect(computePriceIncVat(0, 20)).toBe(0);
  });
  it('rejects out-of-range inputs', () => {
    expect(() => computePriceIncVat(-1, 20)).toThrow();
    expect(() => computePriceIncVat(100, 120)).toThrow();
  });
});

describe('validateDraft', () => {
  it('trims name and computes priceIncVat', () => {
    const out = validateDraft({
      name: '  Sticker  ',
      priceExVat: 50,
      vatRatePct: 20,
      stockCount: 10,
    });
    expect(out.name).toBe('Sticker');
    expect(out.priceIncVat).toBe(60);
    expect(out.category).toBe('Treats');
    expect(out.lowStockThreshold).toBe(5);
  });
  it('normalizes catalogue metadata', () => {
    const out = validateDraft({
      name: '  Hot Chocolate  ',
      category: 'Treats',
      blurb: '  Mug of cocoa  ',
      description: '  Served at break  ',
      priceExVat: 25,
      vatRatePct: 0,
      stockCount: 10,
      lowStockThreshold: 3,
    });
    expect(out).toMatchObject({
      name: 'Hot Chocolate',
      category: 'Treats',
      blurb: 'Mug of cocoa',
      description: 'Served at break',
      lowStockThreshold: 3,
    });
  });
  it('rejects empty name', () => {
    expect(() =>
      validateDraft({ name: '   ', priceExVat: 1, vatRatePct: 0, stockCount: 1 }),
    ).toThrow();
  });
  it('rejects negative stock', () => {
    expect(() =>
      validateDraft({ name: 'x', priceExVat: 1, vatRatePct: 0, stockCount: -1 }),
    ).toThrow();
  });
  it('rejects invalid low stock thresholds', () => {
    expect(() =>
      validateDraft({
        name: 'x',
        priceExVat: 1,
        vatRatePct: 0,
        stockCount: 1,
        lowStockThreshold: -1,
      }),
    ).toThrow(/lowStockThreshold/);
  });
});

describe('assertCanManageShop / assertCanSellInShop', () => {
  it('shopadmin can manage', () => {
    expect(() => { assertCanManageShop(shopadmin); }).not.toThrow();
    expect(canManageShop(shopadmin)).toBe(true);
    expect(canSellInShop(shopadmin)).toBe(false);
  });
  it('full-admin can manage and sell without shop tags', () => {
    expect(() => { assertCanManageShop(head); }).not.toThrow();
    expect(() => { assertCanSellInShop(head); }).not.toThrow();
    expect(canManageShop(head)).toBe(true);
    expect(canSellInShop(head)).toBe(true);
  });
  it('shopkeeper can sell', () => {
    expect(() => { assertCanSellInShop(shopkeeper); }).not.toThrow();
    expect(canSellInShop(shopkeeper)).toBe(true);
    expect(canManageShop(shopkeeper)).toBe(false);
  });
  it('untagged users blocked', () => {
    expect(() => { assertCanManageShop(nobody); }).toThrow(AccessDeniedError);
    expect(() => { assertCanSellInShop(nobody); }).toThrow(AccessDeniedError);
    expect(canManageShop(nobody)).toBe(false);
    expect(canSellInShop(nobody)).toBe(false);
  });
});

describe('prepareShopReservation', () => {
  const activeItem = { id: 'i1', priceIncVat: 20, stockCount: 3, active: true };
  const secondItem = { id: 'i2', priceIncVat: 15, stockCount: 4, active: true };

  it('holds Spend in ShopReserved and decrements planned stock', () => {
    const r = prepareShopReservation({
      studentId: 's1',
      spendBalance: 100,
      lines: [
        { item: activeItem, unitsReserved: 2 },
        { item: secondItem, unitsReserved: 1 },
      ],
    });
    expect(r.totalPriceMerits).toBe(55);
    expect(r.lines).toEqual([
      {
        itemId: 'i1',
        unitsReserved: 2,
        unitPriceMerits: 20,
        totalPriceMerits: 40,
        newStockCount: 1,
      },
      {
        itemId: 'i2',
        unitsReserved: 1,
        unitPriceMerits: 15,
        totalPriceMerits: 15,
        newStockCount: 3,
      },
    ]);
    expect(r.ledger).toEqual([
      { studentId: 's1', account: 'Spend', delta: -55, reason: 'shop-reservation:hold' },
      { studentId: 's1', account: 'ShopReserved', delta: 55, reason: 'shop-reservation:hold' },
    ]);
    expect(r.ledger.reduce((total, row) => total + row.delta, 0)).toBe(0);
  });

  it('rejects invalid reservation lines', () => {
    expect(() =>
      prepareShopReservation({ studentId: 's1', spendBalance: 100, lines: [] }),
    ).toThrow(/at least one/);
    expect(() =>
      prepareShopReservation({
        studentId: 's1',
        spendBalance: 100,
        lines: [{ item: activeItem, unitsReserved: 0 }],
      }),
    ).toThrow(/positive/);
    expect(() =>
      prepareShopReservation({
        studentId: 's1',
        spendBalance: 100,
        lines: [{ item: { ...activeItem, active: false }, unitsReserved: 1 }],
      }),
    ).toThrow(/inactive/);
    expect(() =>
      prepareShopReservation({
        studentId: 's1',
        spendBalance: 100,
        lines: [{ item: activeItem, unitsReserved: 4 }],
      }),
    ).toThrow(/stock/);
    expect(() =>
      prepareShopReservation({
        studentId: 's1',
        spendBalance: 10,
        lines: [{ item: activeItem, unitsReserved: 1 }],
      }),
    ).toThrow(/balance/);
  });

  it('rejects duplicate item lines before reservation writes', () => {
    expect(() =>
      prepareShopReservation({
        studentId: 's1',
        spendBalance: 100,
        lines: [
          { item: activeItem, unitsReserved: 1 },
          { item: activeItem, unitsReserved: 1 },
        ],
      }),
    ).toThrow(/unique/);
  });
});

describe('reservation settlement rows', () => {
  it('moves held merits to Given on collection', () => {
    expect(
      rowsForReservationCollection({
        studentId: 's1',
        reservationId: 'r1',
        totalPriceMerits: 35,
      }),
    ).toEqual([
      {
        studentId: 's1',
        account: 'ShopReserved',
        delta: -35,
        reason: 'shop-reservation:r1:collected',
      },
      { studentId: 's1', account: 'Given', delta: 35, reason: 'shop-reservation:r1:collected' },
    ]);
  });

  it('returns held merits to Spend on cancellation', () => {
    expect(
      rowsForReservationCancellation({
        studentId: 's1',
        reservationId: 'r1',
        totalPriceMerits: 35,
      }),
    ).toEqual([
      {
        studentId: 's1',
        account: 'ShopReserved',
        delta: -35,
        reason: 'shop-reservation:r1:cancelled',
      },
      { studentId: 's1', account: 'Spend', delta: 35, reason: 'shop-reservation:r1:cancelled' },
    ]);
  });
});

describe('prepareShopPurchase', () => {
  const activeItem = { id: 'i1', priceIncVat: 20, stockCount: 3, active: true };

  it('debits Spend and decrements stock atomically', () => {
    const r = prepareShopPurchase({
      shopkeeper,
      studentId: 's1',
      item: activeItem,
      unitsBought: 2,
      spendBalance: 100,
    });
    expect(r.totalPriceMerits).toBe(40);
    expect(r.newStockCount).toBe(1);
    expect(r.ledger).toEqual([
      {
        studentId: 's1',
        account: 'Spend',
        delta: -40,
        reason: 'shop:i1:x2',
      },
      {
        studentId: 's1',
        account: 'Given',
        delta: 40,
        reason: 'shop:i1:x2',
      },
    ]);
    expect(r.ledger.reduce((total, row) => total + row.delta, 0)).toBe(0);
  });

  it('rejects when stock is insufficient', () => {
    expect(() =>
      prepareShopPurchase({
        shopkeeper,
        studentId: 's1',
        item: activeItem,
        unitsBought: 5,
        spendBalance: 100,
      }),
    ).toThrow(/stock/);
  });

  it('rejects when balance is insufficient', () => {
    expect(() =>
      prepareShopPurchase({
        shopkeeper,
        studentId: 's1',
        item: activeItem,
        unitsBought: 3,
        spendBalance: 10,
      }),
    ).toThrow(/balance/);
  });

  it('rejects inactive items', () => {
    expect(() =>
      prepareShopPurchase({
        shopkeeper,
        studentId: 's1',
        item: { ...activeItem, active: false },
        unitsBought: 1,
        spendBalance: 100,
      }),
    ).toThrow(/inactive/);
  });

  it('rejects non-shopkeepers', () => {
    expect(() =>
      prepareShopPurchase({
        shopkeeper: nobody,
        studentId: 's1',
        item: activeItem,
        unitsBought: 1,
        spendBalance: 100,
      }),
    ).toThrow(AccessDeniedError);
  });
});
