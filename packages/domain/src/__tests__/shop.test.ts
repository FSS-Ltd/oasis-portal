import { describe, expect, it } from 'vitest';
import {
  assertCanManageShop,
  assertCanSellInShop,
  computePriceIncVat,
  prepareShopPurchase,
  validateDraft,
} from '../shop.js';
import { AccessDeniedError, type SessionUser } from '../rbac.js';

const shopadmin: SessionUser = {
  id: 'u1',
  role: 'Head',
  tags: ['shopadmin'],
  requires2fa: false,
};
const shopkeeper: SessionUser = {
  id: 'u2',
  role: 'Supervisor',
  tags: ['shopkeeper'],
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
});

describe('assertCanManageShop / assertCanSellInShop', () => {
  it('shopadmin can manage', () => {
    expect(() => { assertCanManageShop(shopadmin); }).not.toThrow();
  });
  it('shopkeeper can sell', () => {
    expect(() => { assertCanSellInShop(shopkeeper); }).not.toThrow();
  });
  it('untagged users blocked', () => {
    expect(() => { assertCanManageShop(nobody); }).toThrow(AccessDeniedError);
    expect(() => { assertCanSellInShop(nobody); }).toThrow(AccessDeniedError);
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
    expect(r.ledger).toHaveLength(1);
    expect(r.ledger[0]?.delta).toBe(-40);
    expect(r.ledger[0]?.account).toBe('Spend');
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
