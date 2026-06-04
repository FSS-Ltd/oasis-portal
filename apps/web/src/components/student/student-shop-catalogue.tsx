import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CategoryDot,
  CategoryPill,
  SHOP_CATEGORY_OPTIONS,
  ShopTile,
  StockBadge,
  formatMerits,
} from '@/components/shop/shop-shared';
import type { CategoryFilter, ShopItem } from './student-shop-types';

export function StudentShopItemCard({
  item,
  spendBalance,
  onAdd,
}: {
  item: ShopItem;
  spendBalance: number;
  onAdd: (item: ShopItem) => void;
}) {
  const outOfStock = item.stockStatus === 'OutOfStock';
  const disabled = !item.active || outOfStock;
  const canAfford = spendBalance >= item.priceIncVat;

  return (
    <article className={disabled ? 'parent-shop-item is-disabled' : 'parent-shop-item'}>
      <button
        className="parent-shop-item__visual"
        disabled={disabled}
        onClick={() => {
          onAdd(item);
        }}
        type="button"
      >
        <ShopTile item={item} />
      </button>
      <div className="parent-shop-item__body">
        <div className="parent-shop-item__meta">
          <CategoryPill item={item} />
          <StockBadge stockCount={item.stockCount} stockStatus={item.stockStatus} />
        </div>
        <h2>{item.name}</h2>
        <p>{item.blurb ?? item.description ?? 'Reserve for pickup at the shopkeeper counter.'}</p>
        <div className="parent-shop-item__footer">
          <strong>
            {formatMerits(item.priceIncVat)} <span>merits</span>
          </strong>
          <Badge tone={canAfford ? 'green' : 'grey'}>
            {canAfford ? 'Can reserve' : 'Save more'}
          </Badge>
        </div>
        <Button
          disabled={disabled}
          onClick={() => {
            onAdd(item);
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          Add
        </Button>
      </div>
    </article>
  );
}

export function StudentShopCategoryList({
  activeCategory,
  activeItems,
  categoryCounts,
  onSelect,
}: {
  activeCategory: CategoryFilter;
  activeItems: readonly ShopItem[];
  categoryCounts: ReadonlyMap<CategoryFilter, number>;
  onSelect: (category: CategoryFilter) => void;
}) {
  return (
    <div className="parent-shop-category-list">
      {(['All', ...SHOP_CATEGORY_OPTIONS] as const).map((category) => {
        const selected = activeCategory === category;
        const categoryItem = activeItems.find((item) => item.category === category);
        return (
          <button
            aria-pressed={selected}
            className={selected ? 'is-active' : undefined}
            key={category}
            onClick={() => {
              onSelect(category);
            }}
            type="button"
          >
            {category === 'All' ? (
              <span className="parent-shop-category-all" aria-hidden="true" />
            ) : categoryItem ? (
              <CategoryDot item={categoryItem} />
            ) : (
              <span className="parent-shop-category-empty" aria-hidden="true" />
            )}
            <span>{category === 'All' ? 'All Items' : category}</span>
            <small>{formatMerits(categoryCounts.get(category) ?? 0)}</small>
          </button>
        );
      })}
    </div>
  );
}
