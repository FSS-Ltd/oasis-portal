export type ShopStockItem = {
  stockCount: number;
  stockStatus: string;
};

export type ShopStockVariant = 'success' | 'warning' | 'danger' | 'neutral';

export function formatMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

export function stockVariant(item: ShopStockItem): ShopStockVariant {
  if (item.stockStatus === 'Inactive') return 'neutral';
  if (item.stockStatus === 'OutOfStock') return 'danger';
  if (item.stockStatus === 'LowStock') return 'warning';
  return 'success';
}

export function stockLabel(item: ShopStockItem): string {
  if (item.stockStatus === 'Inactive') return 'Paused';
  if (item.stockStatus === 'OutOfStock') return 'Out';
  if (item.stockStatus === 'LowStock') return `Low · ${String(item.stockCount)}`;
  return `${String(item.stockCount)} left`;
}
