import { type RouterOutputs } from '../../lib/trpc';

export type ShopCounterTab = 'pickups' | 'sale' | 'stock';
export type ShopCounterReservation = RouterOutputs['shop']['listReservations'][number];
export type ShopCounterItem = RouterOutputs['shop']['listItems'][number];
export type ShopCounterPurchaser = RouterOutputs['shop']['listPurchasers'][number];

export interface CounterSaleForm {
  itemId: string;
  quantity: string;
  studentId: string;
}

export interface CounterSaleValidation {
  message: string | null;
  tone: 'danger' | 'warning';
}

export const shopCounterTabs: { id: ShopCounterTab; label: string }[] = [
  { id: 'pickups', label: 'Pickups' },
  { id: 'sale', label: 'Sale' },
  { id: 'stock', label: 'Stock' },
];

export function formatMerits(value: number): string {
  return `${String(value)} merits`;
}

export function formatShopDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function quantityValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function activeShopItems(items: readonly ShopCounterItem[]): ShopCounterItem[] {
  return items.filter((item) => item.active);
}

export function saleTotalMerits(item: ShopCounterItem | null, quantity: number | null): number {
  if (!item || quantity === null) return 0;
  return item.priceIncVat * quantity;
}

export function validateCounterSale({
  item,
  purchaser,
  quantity,
}: {
  item: ShopCounterItem | null;
  purchaser: ShopCounterPurchaser | null;
  quantity: number | null;
}): CounterSaleValidation | null {
  if (!purchaser) {
    return { message: 'Choose a student before recording a counter sale.', tone: 'warning' };
  }
  if (!item) {
    return { message: 'Choose an item before recording a counter sale.', tone: 'warning' };
  }
  if (quantity === null) {
    return { message: 'Enter a quantity of at least 1.', tone: 'warning' };
  }
  if (item.availableStockCount < quantity) {
    return { message: 'Insufficient stock for this counter sale.', tone: 'danger' };
  }
  if (purchaser.spendBalance < saleTotalMerits(item, quantity)) {
    return { message: 'Insufficient balance for this counter sale.', tone: 'danger' };
  }
  return null;
}
