import { type RouterOutputs } from '../../lib/trpc';
import { type ParentDashboardChild } from './parent-home-utils';

export type ParentShopItem = RouterOutputs['shop']['listItems'][number];
export type ParentShopCategory = ParentShopItem['category'];
export type ParentShopReservation = RouterOutputs['shop']['listReservations'][number];
export type ParentShopCartLine = { itemId: string; quantity: number };
export type ParentShopCategoryFilter = ParentShopCategory | 'All';

export interface ParentShopReservationsScreenProps {
  children: readonly ParentDashboardChild[];
  heldMerits: number;
  items: readonly ParentShopItem[];
  loading: boolean;
  onSelectChild: (studentId: string) => void;
  reservations: readonly ParentShopReservation[];
  reservationsError: string | null;
  reservationsLoading: boolean;
  selectedChild: ParentDashboardChild;
  shopError: string | null;
  spendBalance: number;
}

export const parentShopCategoryOrder: readonly ParentShopCategory[] = [
  'Treats',
  'Privileges',
  'Stationery',
  'Accessories',
  'Toys',
  'Vouchers',
  'Merch',
  'Recognition',
];

export const parentShopStatusLabels: readonly ParentShopReservation['status'][] = [
  'Ready',
  'Collected',
  'Cancelled',
];

export function formatParentShopMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

export function formatParentShopDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function parentShopStockVariant(
  item: ParentShopItem,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (item.stockStatus === 'Inactive') return 'neutral';
  if (item.stockStatus === 'OutOfStock') return 'danger';
  if (item.stockStatus === 'LowStock') return 'warning';
  return 'success';
}

export function parentShopStockLabel(item: ParentShopItem): string {
  if (item.stockStatus === 'Inactive') return 'Paused';
  if (item.stockStatus === 'OutOfStock') return 'Out of Stock';
  if (item.stockStatus === 'LowStock') return `Low · ${String(item.stockCount)}`;
  return `${String(item.stockCount)} left`;
}

export function parentShopReservationStatusVariant(
  status: ParentShopReservation['status'],
): 'success' | 'warning' | 'neutral' {
  if (status === 'Ready') return 'warning';
  if (status === 'Collected') return 'success';
  return 'neutral';
}

export function parentShopCartLinesFor(
  items: readonly ParentShopItem[],
  cart: readonly ParentShopCartLine[],
) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return cart
    .map((line) => {
      const item = itemById.get(line.itemId);
      if (!item) return null;
      return { ...line, item, lineTotal: item.priceIncVat * line.quantity };
    })
    .filter(
      (line): line is ParentShopCartLine & { item: ParentShopItem; lineTotal: number } =>
        line !== null,
    );
}

export function parentShopFriendlyErrorMessage(message: string | null): string | null {
  if (!message) return null;
  if (message.includes('blocked by a parent')) {
    return 'Merit Shop access is blocked by a parent or carer.';
  }
  if (message.includes('Tithe due')) return 'Tithe due before Merit Shop opens.';
  if (message.includes('insufficient stock')) return 'insufficient stock';
  if (message.includes('insufficient spend balance')) return 'insufficient spend balance';
  return message;
}
