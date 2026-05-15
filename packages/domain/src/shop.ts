/**
 * In-app shop rules.
 *
 * - `shopadmin` tag: create/edit/remove items, set prices + VAT + stock.
 * - `shopkeeper` tag: record a purchase.
 * - Purchase: atomic — decrement stock, debit Spend account.
 * - Price stored as merits. VAT rounded half-up to nearest integer merit.
 */
import { AccessDeniedError, hasTag, isFullAdmin, type SessionUser } from './rbac.js';
import type { LedgerRow } from './meritLedger.js';

export interface ShopItemDraft {
  name: string;
  photoUrl?: string;
  priceExVat: number;
  vatRatePct: number;
  stockCount: number;
}

export interface ShopItemPricing {
  priceExVat: number;
  vatRatePct: number;
  priceIncVat: number;
}

export function computePriceIncVat(priceExVat: number, vatRatePct: number): number {
  if (!Number.isInteger(priceExVat) || priceExVat < 0) {
    throw new Error('priceExVat must be a non-negative integer (merits)');
  }
  if (vatRatePct < 0 || vatRatePct > 100) {
    throw new Error('vatRatePct out of range');
  }
  return Math.round(priceExVat * (1 + vatRatePct / 100));
}

export function validateDraft(draft: ShopItemDraft): ShopItemPricing & {
  name: string;
  photoUrl?: string;
  stockCount: number;
} {
  if (!draft.name.trim()) throw new Error('name is required');
  if (!Number.isInteger(draft.stockCount) || draft.stockCount < 0) {
    throw new Error('stockCount must be a non-negative integer');
  }
  const priceIncVat = computePriceIncVat(draft.priceExVat, draft.vatRatePct);
  const out: ShopItemPricing & { name: string; photoUrl?: string; stockCount: number } = {
    name: draft.name.trim(),
    priceExVat: draft.priceExVat,
    vatRatePct: draft.vatRatePct,
    priceIncVat,
    stockCount: draft.stockCount,
  };
  if (draft.photoUrl !== undefined) out.photoUrl = draft.photoUrl;
  return out;
}

export function assertCanManageShop(user: SessionUser): void {
  if (!isFullAdmin(user) && !hasTag(user, 'shopadmin')) {
    throw new AccessDeniedError('shop management requires full-admin or shopadmin');
  }
}

export function assertCanSellInShop(user: SessionUser): void {
  if (!isFullAdmin(user) && !hasTag(user, 'shopkeeper')) {
    throw new AccessDeniedError('shop selling requires full-admin or shopkeeper');
  }
}

export interface PurchaseInput {
  shopkeeper: SessionUser;
  studentId: string;
  item: { id: string; priceIncVat: number; stockCount: number; active: boolean };
  unitsBought: number;
  spendBalance: number; // caller fetched this
}

export interface PurchaseResult {
  totalPriceMerits: number;
  newStockCount: number;
  ledger: LedgerRow[];
}

export function prepareShopPurchase(input: PurchaseInput): PurchaseResult {
  assertCanSellInShop(input.shopkeeper);
  if (!input.item.active) throw new Error('item is inactive');
  if (!Number.isInteger(input.unitsBought) || input.unitsBought <= 0) {
    throw new Error('unitsBought must be a positive integer');
  }
  if (input.unitsBought > input.item.stockCount) {
    throw new Error('insufficient stock');
  }
  const totalPriceMerits = input.item.priceIncVat * input.unitsBought;
  if (totalPriceMerits > input.spendBalance) {
    throw new Error('insufficient spend balance');
  }
  return {
    totalPriceMerits,
    newStockCount: input.item.stockCount - input.unitsBought,
    ledger: [
      {
        studentId: input.studentId,
        account: 'Spend',
        delta: -totalPriceMerits,
        reason: `shop:${input.item.id}:x${String(input.unitsBought)}`,
      },
    ],
  };
}
