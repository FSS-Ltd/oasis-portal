'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { TextInput } from '@/components/ui/field';
import { friendlyErrorMessage, showErrorToast, showSuccessToast } from '@/lib/notifications';
import { api } from '@/lib/trpc';
import { SHOP_CATEGORY_OPTIONS, formatMerits } from '@/components/shop/shop-shared';
import { StudentShopCategoryList, StudentShopItemCard } from './student-shop-catalogue';
import { StudentShopCart } from './student-shop-cart';
import { StudentShopHistoryPanel } from './student-shop-history';
import type { CartLine, CartLineWithItem, CategoryFilter, ShopItem } from './student-shop-types';

function cartLinesFor(items: readonly ShopItem[], cart: readonly CartLine[]): CartLineWithItem[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return cart
    .map((line) => {
      const item = itemById.get(line.itemId);
      if (!item) return null;
      return { ...line, item, lineTotal: item.priceIncVat * line.quantity };
    })
    .filter((line): line is CartLineWithItem => line !== null);
}

export function StudentShopClient() {
  const utils = api.useUtils();
  const wallet = api.student.wallet.useQuery(undefined, { retry: false });
  const itemsQuery = api.shop.listItems.useQuery(undefined, { retry: false });
  const historyQuery = api.shop.studentHistory.useQuery(undefined, { retry: false });
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const reserve = api.shop.reserve.useMutation({
    onSuccess: async (reservation) => {
      setCart([]);
      setLocalError(null);
      showSuccessToast(`${formatMerits(reservation.totalPriceMerits)} merits held for pickup.`);
      await Promise.all([
        utils.shop.listItems.invalidate(),
        utils.shop.studentHistory.invalidate(),
        utils.student.wallet.invalidate(),
      ]);
    },
    onError(error) {
      showErrorToast(error, 'Reservation could not be created.');
    },
  });

  const items = itemsQuery.data ?? [];
  const spendBalance = wallet.data?.balances.Spend ?? 0;
  const heldMerits = wallet.data?.balances.ShopReserved ?? 0;
  const activeItems = items.filter((item) => item.active);
  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryFilter, number>([['All', activeItems.length]]);
    for (const category of SHOP_CATEGORY_OPTIONS) {
      counts.set(category, activeItems.filter((item) => item.category === category).length);
    }
    return counts;
  }, [activeItems]);
  const visibleItems = activeItems.filter((item) => {
    if (activeCategory !== 'All' && item.category !== activeCategory) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      (item.blurb ?? '').toLowerCase().includes(query) ||
      (item.description ?? '').toLowerCase().includes(query)
    );
  });
  const cartLines = cartLinesFor(items, cart);
  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const cartTotal = cartLines.reduce((total, line) => total + line.lineTotal, 0);
  const balanceAfter = spendBalance - cartTotal;
  const canReserve =
    Boolean(wallet.data?.studentId) &&
    cartLines.length > 0 &&
    balanceAfter >= 0 &&
    !reserve.isPending;

  function addToCart(item: ShopItem): void {
    setLocalError(null);
    if (item.stockStatus === 'OutOfStock') {
      setLocalError(`${item.name} is out of stock.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing) {
        return current.map((line) =>
          line.itemId === item.id
            ? { ...line, quantity: Math.min(item.stockCount, line.quantity + 1) }
            : line,
        );
      }
      return [...current, { itemId: item.id, quantity: 1 }];
    });
  }

  function setLineQuantity(itemId: string, quantity: number): void {
    setCart((current) =>
      current
        .map((line) => (line.itemId === itemId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  async function reserveCart(): Promise<void> {
    setLocalError(null);
    if (!wallet.data?.studentId) {
      setLocalError('Wallet data is still loading.');
      return;
    }
    if (!canReserve) {
      setLocalError(
        balanceAfter < 0 ? 'There are not enough Spend merits available.' : 'Add an item.',
      );
      return;
    }
    try {
      await reserve.mutateAsync({
        studentId: wallet.data.studentId,
        lines: cartLines.map((line) => ({
          itemId: line.item.id,
          unitsReserved: line.quantity,
        })),
      });
    } catch {
      // Toast and inline mutation state show the error.
    }
  }

  if (itemsQuery.error || historyQuery.error) {
    return (
      <EmptyState
        detail={friendlyErrorMessage(itemsQuery.error ?? historyQuery.error)}
        title="Merit Shop unavailable"
      />
    );
  }

  return (
    <div className="shop-page student-shop-page">
      <div className="student-shop-shell">
        <section className="student-wallet-hero student-shop-hero">
          <div>
            <p>Merit Shop</p>
            <h1>Reserve rewards</h1>
            <span>Spend merits are held now. A shopkeeper completes pickup in-centre.</span>
          </div>
          <div className="student-shop-balance">
            <small>Spend</small>
            <strong>{formatMerits(spendBalance)}</strong>
            {heldMerits > 0 ? <span>{formatMerits(heldMerits)} held</span> : null}
          </div>
        </section>

        <StudentShopCart
          balanceAfter={balanceAfter}
          canReserve={canReserve}
          cartCount={cartCount}
          cartLines={cartLines}
          cartTotal={cartTotal}
          error={reserve.error}
          localError={localError}
          onReserve={() => {
            void reserveCart();
          }}
          onSetLineQuantity={setLineQuantity}
          pending={reserve.isPending}
          spendBalance={spendBalance}
        />

        <div className="parent-shop-layout student-shop-layout">
          <aside className="panel panel__body parent-shop-sidebar" aria-label="Shop categories">
            <StudentShopCategoryList
              activeCategory={activeCategory}
              activeItems={activeItems}
              categoryCounts={categoryCounts}
              onSelect={setActiveCategory}
            />
            <StudentShopHistoryPanel history={historyQuery.data} />
          </aside>

          <section className="parent-shop-catalogue" aria-labelledby="student-shop-catalogue-title">
            <div className="parent-shop-toolbar">
              <div className="parent-shop-search">
                <Search aria-hidden="true" size={16} />
                <TextInput
                  aria-label="Search shop items"
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  placeholder="Search the shop..."
                  value={search}
                />
              </div>
              <Badge tone="blue">{formatMerits(visibleItems.length)} shown</Badge>
            </div>
            <h2 id="student-shop-catalogue-title" className="sr-only">
              Merit shop catalogue
            </h2>
            {itemsQuery.isLoading || wallet.isLoading ? (
              <div className="empty-state">Loading shop items...</div>
            ) : null}
            {wallet.error ? (
              <p className="status--error">{friendlyErrorMessage(wallet.error)}</p>
            ) : null}
            {!itemsQuery.isLoading && visibleItems.length === 0 ? (
              <div className="empty-state">No shop items match this view.</div>
            ) : null}
            <div className="parent-shop-grid">
              {visibleItems.map((item) => (
                <StudentShopItemCard
                  item={item}
                  key={item.id}
                  onAdd={addToCart}
                  spendBalance={spendBalance}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
