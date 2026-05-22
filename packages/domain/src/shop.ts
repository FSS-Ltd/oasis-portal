/**
 * In-app shop rules.
 *
 * - `shopadmin` tag: create/edit/remove items, set prices + VAT + stock.
 * - `shopkeeper` tag: record a purchase.
 * - Purchase: atomic - decrement stock, debit Spend, credit Given.
 * - Reservation: hold stock and Spend until shopkeeper collection or cancellation.
 * - Price stored as merits. VAT rounded half-up to nearest integer merit.
 */
import {
  AccessDeniedError,
  canUseClubsLeadPortal,
  hasTag,
  isFullAdmin,
  type SessionUser,
} from './rbac.js';
import type { LedgerRow } from './meritLedger.js';

export const SHOP_CATEGORIES = [
  'Treats',
  'Privileges',
  'Stationery',
  'Accessories',
  'Toys',
  'Vouchers',
  'Merch',
  'Recognition',
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const SHOP_CATEGORY_DETAILS = {
  Treats: { label: 'Treats', tint: '#FDF1E6', ink: '#9C5A2F' },
  Privileges: { label: 'Privileges', tint: '#EAF1FB', ink: '#3B5F95' },
  Stationery: { label: 'Stationery', tint: '#EFEEFA', ink: '#5E5BA8' },
  Accessories: { label: 'Accessories', tint: '#E6F5F2', ink: '#276B63' },
  Toys: { label: 'Toys', tint: '#FEF1D6', ink: '#8A4F16' },
  Vouchers: { label: 'Vouchers', tint: '#E8F2EC', ink: '#356B4D' },
  Merch: { label: 'Merch', tint: '#F6ECEE', ink: '#8E3F4C' },
  Recognition: { label: 'Recognition', tint: '#FBF3D9', ink: '#7E6315' },
} as const satisfies Record<ShopCategory, { label: string; tint: string; ink: string }>;

export interface ShopItemDraft {
  name: string;
  photoUrl?: string;
  category?: ShopCategory;
  blurb?: string;
  description?: string;
  priceExVat: number;
  vatRatePct: number;
  stockCount: number;
  lowStockThreshold?: number;
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
  category: ShopCategory;
  blurb?: string;
  description?: string;
  stockCount: number;
  lowStockThreshold: number;
} {
  const name = draft.name.trim();
  if (!name) throw new Error('name is required');
  if (!Number.isInteger(draft.stockCount) || draft.stockCount < 0) {
    throw new Error('stockCount must be a non-negative integer');
  }
  const lowStockThreshold = draft.lowStockThreshold ?? 5;
  if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
    throw new Error('lowStockThreshold must be a non-negative integer');
  }
  if (draft.category !== undefined && !SHOP_CATEGORIES.includes(draft.category)) {
    throw new Error('category is invalid');
  }
  const priceIncVat = computePriceIncVat(draft.priceExVat, draft.vatRatePct);
  const out: ShopItemPricing & {
    name: string;
    photoUrl?: string;
    category: ShopCategory;
    blurb?: string;
    description?: string;
    stockCount: number;
    lowStockThreshold: number;
  } = {
    name,
    category: draft.category ?? 'Treats',
    priceExVat: draft.priceExVat,
    vatRatePct: draft.vatRatePct,
    priceIncVat,
    stockCount: draft.stockCount,
    lowStockThreshold,
  };
  if (draft.photoUrl !== undefined) out.photoUrl = draft.photoUrl;
  const blurb = draft.blurb?.trim();
  if (blurb) out.blurb = blurb;
  const description = draft.description?.trim();
  if (description) out.description = description;
  return out;
}

export function assertCanManageShop(user: SessionUser): void {
  if (!canManageShop(user)) {
    throw new AccessDeniedError('shop management requires full-admin or shopadmin');
  }
}

export function assertCanSellInShop(user: SessionUser): void {
  if (!canSellInShop(user)) {
    throw new AccessDeniedError('shop selling requires full-admin or shopkeeper');
  }
}

export function canManageShop(user: SessionUser): boolean {
  if (canUseClubsLeadPortal(user)) return false;
  return isFullAdmin(user) || hasTag(user, 'shopadmin');
}

export function canSellInShop(user: SessionUser): boolean {
  if (canUseClubsLeadPortal(user)) return false;
  return isFullAdmin(user) || hasTag(user, 'shopkeeper');
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

export interface ReservationLineInput {
  item: { id: string; priceIncVat: number; stockCount: number; active: boolean };
  unitsReserved: number;
}

export interface ReservationLineResult {
  itemId: string;
  unitsReserved: number;
  unitPriceMerits: number;
  totalPriceMerits: number;
  newStockCount: number;
}

export interface ReservationResult {
  totalPriceMerits: number;
  lines: ReservationLineResult[];
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
      {
        studentId: input.studentId,
        account: 'Given',
        delta: totalPriceMerits,
        reason: `shop:${input.item.id}:x${String(input.unitsBought)}`,
      },
    ],
  };
}

export function prepareShopReservation(input: {
  studentId: string;
  lines: readonly ReservationLineInput[];
  spendBalance: number;
}): ReservationResult {
  if (input.lines.length === 0) throw new Error('reservation requires at least one item');

  const seenItemIds = new Set<string>();
  const lines = input.lines.map((line) => {
    if (seenItemIds.has(line.item.id)) throw new Error('reservation items must be unique');
    seenItemIds.add(line.item.id);
    if (!line.item.active) throw new Error('item is inactive');
    if (!Number.isInteger(line.unitsReserved) || line.unitsReserved <= 0) {
      throw new Error('unitsReserved must be a positive integer');
    }
    if (line.unitsReserved > line.item.stockCount) {
      throw new Error('insufficient stock');
    }
    const totalPriceMerits = line.item.priceIncVat * line.unitsReserved;
    return {
      itemId: line.item.id,
      unitsReserved: line.unitsReserved,
      unitPriceMerits: line.item.priceIncVat,
      totalPriceMerits,
      newStockCount: line.item.stockCount - line.unitsReserved,
    } satisfies ReservationLineResult;
  });
  const totalPriceMerits = lines.reduce((total, line) => total + line.totalPriceMerits, 0);
  if (totalPriceMerits > input.spendBalance) {
    throw new Error('insufficient spend balance');
  }

  return {
    totalPriceMerits,
    lines,
    ledger: [
      {
        studentId: input.studentId,
        account: 'Spend',
        delta: -totalPriceMerits,
        reason: 'shop-reservation:hold',
      },
      {
        studentId: input.studentId,
        account: 'ShopReserved',
        delta: totalPriceMerits,
        reason: 'shop-reservation:hold',
      },
    ],
  };
}

export function rowsForReservationCollection(input: {
  studentId: string;
  reservationId: string;
  totalPriceMerits: number;
}): LedgerRow[] {
  if (!Number.isInteger(input.totalPriceMerits) || input.totalPriceMerits <= 0) {
    throw new Error('totalPriceMerits must be a positive integer');
  }
  return [
    {
      studentId: input.studentId,
      account: 'ShopReserved',
      delta: -input.totalPriceMerits,
      reason: `shop-reservation:${input.reservationId}:collected`,
    },
    {
      studentId: input.studentId,
      account: 'Given',
      delta: input.totalPriceMerits,
      reason: `shop-reservation:${input.reservationId}:collected`,
    },
  ];
}

export function rowsForReservationCancellation(input: {
  studentId: string;
  reservationId: string;
  totalPriceMerits: number;
}): LedgerRow[] {
  if (!Number.isInteger(input.totalPriceMerits) || input.totalPriceMerits <= 0) {
    throw new Error('totalPriceMerits must be a positive integer');
  }
  return [
    {
      studentId: input.studentId,
      account: 'ShopReserved',
      delta: -input.totalPriceMerits,
      reason: `shop-reservation:${input.reservationId}:cancelled`,
    },
    {
      studentId: input.studentId,
      account: 'Spend',
      delta: input.totalPriceMerits,
      reason: `shop-reservation:${input.reservationId}:cancelled`,
    },
  ];
}
