'use client';

import type { CSSProperties } from 'react';
import { Minus, Package, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SHOP_CATEGORY_OPTIONS = [
  'Treats',
  'Privileges',
  'Stationery',
  'Accessories',
  'Toys',
  'Vouchers',
  'Merch',
  'Recognition',
] as const;

export type ShopCategoryOption = (typeof SHOP_CATEGORY_OPTIONS)[number];

export const SHOP_CATEGORY_VISUALS = {
  Treats: { label: 'Treats', tint: '#FDF1E6', ink: '#9C5A2F' },
  Privileges: { label: 'Privileges', tint: '#EAF1FB', ink: '#3B5F95' },
  Stationery: { label: 'Stationery', tint: '#EFEEFA', ink: '#5E5BA8' },
  Accessories: { label: 'Accessories', tint: '#E6F5F2', ink: '#276B63' },
  Toys: { label: 'Toys', tint: '#FEF1D6', ink: '#8A4F16' },
  Vouchers: { label: 'Vouchers', tint: '#E8F2EC', ink: '#356B4D' },
  Merch: { label: 'Merch', tint: '#F6ECEE', ink: '#8E3F4C' },
  Recognition: { label: 'Recognition', tint: '#FBF3D9', ink: '#7E6315' },
} as const satisfies Record<ShopCategoryOption, { label: string; tint: string; ink: string }>;

export interface ShopVisualItem {
  name: string;
  photoUrl: string | null;
  category: ShopCategoryOption;
  categoryLabel: string;
  categoryTint: string;
  categoryInk: string;
}

export function formatMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function visualStyle(item: ShopVisualItem): CSSProperties & {
  '--shop-tint': string;
  '--shop-ink': string;
} {
  return {
    '--shop-tint': item.categoryTint,
    '--shop-ink': item.categoryInk,
  };
}

export function ShopTile({
  className,
  item,
  size = 'md',
}: {
  className?: string;
  item: ShopVisualItem;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div
      aria-label={item.photoUrl ? item.name : undefined}
      className={cn('shop-tile', `shop-tile--${size}`, className)}
      role={item.photoUrl ? 'img' : undefined}
      style={{
        ...visualStyle(item),
        ...(item.photoUrl ? { backgroundImage: `url(${item.photoUrl})` } : undefined),
      }}
    >
      {item.photoUrl ? null : (
        <>
          <span className="shop-tile__stripe" aria-hidden="true" />
          <span className="shop-tile__label">{item.name}</span>
          <span className="shop-tile__dot" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

export function CategoryDot({ item, size = 8 }: { item: ShopVisualItem; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="shop-category-dot"
      style={{ background: item.categoryInk, height: size, width: size }}
    />
  );
}

export function CategoryPill({ item }: { item: ShopVisualItem }) {
  return (
    <span
      className="shop-category-pill"
      style={{ background: item.categoryTint, color: item.categoryInk }}
    >
      <CategoryDot item={item} size={6} />
      {item.categoryLabel}
    </span>
  );
}

export function stockBadgeTone(
  stockStatus: 'Available' | 'Inactive' | 'LowStock' | 'OutOfStock',
): 'amber' | 'green' | 'grey' | 'red' {
  if (stockStatus === 'Inactive') return 'grey';
  if (stockStatus === 'OutOfStock') return 'red';
  if (stockStatus === 'LowStock') return 'amber';
  return 'green';
}

export function StockBadge({
  stockCount,
  stockStatus,
}: {
  stockCount: number;
  stockStatus: 'Available' | 'Inactive' | 'LowStock' | 'OutOfStock';
}) {
  const label =
    stockStatus === 'Inactive'
      ? 'Paused'
      : stockStatus === 'OutOfStock'
        ? 'Out of stock'
        : stockStatus === 'LowStock'
          ? `Low · ${formatMerits(stockCount)} left`
          : `${formatMerits(stockCount)} left`;
  return <Badge tone={stockBadgeTone(stockStatus)}>{label}</Badge>;
}

export function QuantityStepper({
  disabled = false,
  max,
  min = 1,
  onChange,
  value,
}: {
  disabled?: boolean;
  max: number;
  min?: number;
  onChange: (next: number) => void;
  value: number;
}) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div className="shop-qty-stepper">
      <Button
        aria-label="Decrease quantity"
        disabled={disabled || !canDecrease}
        onClick={() => {
          onChange(Math.max(min, value - 1));
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Minus aria-hidden="true" size={14} />
      </Button>
      <span aria-live="polite">{String(value)}</span>
      <Button
        aria-label="Increase quantity"
        disabled={disabled || !canIncrease}
        onClick={() => {
          onChange(Math.min(max, value + 1));
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Plus aria-hidden="true" size={14} />
      </Button>
    </div>
  );
}

export function RemoveLineButton({
  disabled = false,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Trash2 aria-hidden="true" size={14} />
    </Button>
  );
}

export function EmptyShopTile() {
  return (
    <div className="shop-empty-tile" aria-hidden="true">
      <Package size={18} />
    </div>
  );
}
