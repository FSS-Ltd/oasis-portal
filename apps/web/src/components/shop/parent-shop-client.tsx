'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Search, ShoppingCart } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectInput, TextInput } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import {
  CategoryDot,
  CategoryPill,
  QuantityStepper,
  RemoveLineButton,
  SHOP_CATEGORY_OPTIONS,
  type ShopCategoryOption,
  ShopTile,
  StockBadge,
  formatMerits,
} from './shop-shared';

type DashboardChild = RouterOutputs['childLog']['parentDashboard']['children'][number];
type ShopItem = RouterOutputs['shop']['listItems'][number];
type ShopReservation = RouterOutputs['shop']['listReservations'][number];
type CartLine = { itemId: string; quantity: number };
type CategoryFilter = ShopCategoryOption | 'All';

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

function cartLinesFor(items: readonly ShopItem[], cart: readonly CartLine[]) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return cart
    .map((line) => {
      const item = itemById.get(line.itemId);
      if (!item) return null;
      return { ...line, item, lineTotal: item.priceIncVat * line.quantity };
    })
    .filter((line): line is CartLine & { item: ShopItem; lineTotal: number } => line !== null);
}

function ParentShopItemCard({
  item,
  onAdd,
}: {
  item: ShopItem;
  onAdd: (item: ShopItem) => void;
}) {
  const disabled = !item.active || item.stockStatus === 'OutOfStock';

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
      </div>
    </article>
  );
}

function PickupList({ reservations }: { reservations: readonly ShopReservation[] }) {
  if (reservations.length === 0) {
    return (
      <div className="parent-shop-pickups__empty">
        <p>No items are waiting for pickup.</p>
      </div>
    );
  }

  return (
    <div className="parent-shop-pickups">
      {reservations.slice(0, 3).map((reservation) => (
        <article className="parent-shop-pickup" key={reservation.id}>
          <div>
            <strong>{formatMerits(reservation.totalPriceMerits)} merits held</strong>
            <span>
              {reservation.lines
                .map((line) => `${String(line.unitsReserved)} × ${line.itemName}`)
                .join(', ')}
            </span>
          </div>
          <Badge tone="amber">Ready</Badge>
        </article>
      ))}
    </div>
  );
}

export function ParentShopClient() {
  const utils = api.useUtils();
  const dashboard = api.childLog.parentDashboard.useQuery(undefined, { retry: false });
  const itemsQuery = api.shop.listItems.useQuery(undefined, { retry: false });
  const reservationsQuery = api.shop.listReservations.useQuery({ status: 'Ready' }, { retry: false });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const children = dashboard.data?.children ?? [];
  const selectedChild: DashboardChild | null =
    children.find((child) => child.student.id === selectedStudentId) ?? children[0] ?? null;
  const selectedChildId = selectedChild?.student.id ?? '';
  const balancesQuery = api.meritLedger.balances.useQuery(
    { studentId: selectedChildId },
    { enabled: Boolean(selectedChildId), retry: false },
  );
  const reserve = api.shop.reserve.useMutation({
    onSuccess: async (reservation) => {
      setCart([]);
      setLocalError(null);
      setStatusMessage(
        `${firstName(reservation.studentName)} has ${formatMerits(
          reservation.totalPriceMerits,
        )} merits on hold for pickup.`,
      );
      await Promise.all([
        utils.shop.listItems.invalidate(),
        utils.shop.listReservations.invalidate(),
        utils.meritLedger.balances.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
      ]);
    },
  });

  const items = itemsQuery.data ?? [];
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
  const spendBalance =
    balancesQuery.data?.balances.Spend ?? selectedChild?.metrics.meritBalances.Spend ?? 0;
  const heldMerits = balancesQuery.data?.balances.ShopReserved ?? 0;
  const balanceAfter = spendBalance - cartTotal;
  const canReserve = Boolean(selectedChildId) && cartLines.length > 0 && balanceAfter >= 0;
  const readyReservations = (reservationsQuery.data ?? []).filter(
    (reservation) => reservation.studentId === selectedChildId,
  );

  function addToCart(item: ShopItem): void {
    setStatusMessage(null);
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
    setStatusMessage(null);
    setLocalError(null);
    if (!selectedChildId) {
      setLocalError('Select a child before reserving.');
      return;
    }
    if (!canReserve) {
      setLocalError(balanceAfter < 0 ? 'There are not enough Spend merits available.' : 'Add an item.');
      return;
    }
    try {
      await reserve.mutateAsync({
        studentId: selectedChildId,
        lines: cartLines.map((line) => ({
          itemId: line.item.id,
          unitsReserved: line.quantity,
        })),
      });
    } catch {
      // Mutation errors are rendered below the cart.
    }
  }

  return (
    <div className="shop-page parent-shop-page">
      <div className="dashboard-hero">
        <p>Merit Shop</p>
        <h1>Reserve rewards for pickup</h1>
        <span>Spend merits are held now. A shopkeeper completes the purchase at collection.</span>
      </div>

      <div className="parent-shop-layout">
        <aside className="panel panel__body parent-shop-sidebar" aria-label="Shop categories">
          <div className="parent-shop-child">
            {selectedChild ? <Avatar name={selectedChild.student.fullName} /> : null}
            <div>
              <span>Spend balance</span>
              <strong>{formatMerits(spendBalance)} merits</strong>
              {heldMerits > 0 ? <small>{formatMerits(heldMerits)} held for pickup</small> : null}
            </div>
          </div>
          {children.length > 1 ? (
            <label className="parent-shop-select">
              <span>Linked child</span>
              <SelectInput
                onChange={(event) => {
                  setSelectedStudentId(event.target.value);
                  setCart([]);
                  setStatusMessage(null);
                  setLocalError(null);
                }}
                value={selectedChildId}
              >
                {children.map((child) => (
                  <option key={child.student.id} value={child.student.id}>
                    {child.student.fullName}
                  </option>
                ))}
              </SelectInput>
            </label>
          ) : null}
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
                    setActiveCategory(category);
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
          <div className="parent-shop-pickup-panel">
            <h2>Pickups</h2>
            <PickupList reservations={readyReservations} />
          </div>
        </aside>

        <section className="parent-shop-catalogue" aria-labelledby="parent-shop-catalogue-title">
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
          <h2 id="parent-shop-catalogue-title" className="sr-only">
            Merit shop catalogue
          </h2>
          {itemsQuery.isLoading ? <div className="empty-state">Loading shop items...</div> : null}
          {itemsQuery.error ? <p className="status--error">{itemsQuery.error.message}</p> : null}
          {dashboard.error ? <p className="status--error">{dashboard.error.message}</p> : null}
          {!itemsQuery.isLoading && visibleItems.length === 0 ? (
            <div className="empty-state">No shop items match this view.</div>
          ) : null}
          <div className="parent-shop-grid">
            {visibleItems.map((item) => (
              <ParentShopItemCard item={item} key={item.id} onAdd={addToCart} />
            ))}
          </div>
        </section>

        <aside className="panel panel__body parent-shop-cart" aria-labelledby="parent-shop-cart-title">
          <div className="section-title">
            <div>
              <h2 id="parent-shop-cart-title">My Cart</h2>
              <p className="muted">Pickup at the shopkeeper counter.</p>
            </div>
            <Badge tone="blue">
              <ShoppingCart aria-hidden="true" size={13} />
              {formatMerits(cartCount)}
            </Badge>
          </div>
          {cartLines.length === 0 ? (
            <div className="parent-shop-cart__empty">
              <p>Your cart is empty.</p>
              <span>Add a reward to reserve it for the next pickup window.</span>
            </div>
          ) : (
            <div className="parent-shop-cart__lines">
              {cartLines.map((line) => (
                <article className="parent-shop-cart-line" key={line.item.id}>
                  <ShopTile item={line.item} size="sm" />
                  <div>
                    <strong>{line.item.name}</strong>
                    <span>{formatMerits(line.item.priceIncVat)} merits each</span>
                  </div>
                  <QuantityStepper
                    disabled={reserve.isPending}
                    max={line.item.stockCount}
                    onChange={(next) => {
                      setLineQuantity(line.item.id, next);
                    }}
                    value={line.quantity}
                  />
                  <RemoveLineButton
                    disabled={reserve.isPending}
                    label={`Remove ${line.item.name}`}
                    onClick={() => {
                      setLineQuantity(line.item.id, 0);
                    }}
                  />
                </article>
              ))}
            </div>
          )}

          <div className="parent-shop-summary" aria-live="polite">
            <span>
              <small>Spend balance</small>
              <strong>{formatMerits(spendBalance)}</strong>
            </span>
            <span>
              <small>Cart total</small>
              <strong>{formatMerits(cartTotal)}</strong>
            </span>
            <span>
              <small>After reserve</small>
              <strong className={balanceAfter < 0 ? 'is-danger' : undefined}>
                {formatMerits(balanceAfter)}
              </strong>
            </span>
          </div>
          <Button
            className="parent-shop-cart__reserve"
            disabled={!canReserve}
            onClick={() => {
              void reserveCart();
            }}
            pending={reserve.isPending}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" size={16} />
            {balanceAfter < 0 ? `Need ${formatMerits(Math.abs(balanceAfter))} more` : 'Reserve'}
          </Button>
          <p className="parent-shop-cart__hint">
            Merits are held immediately, then moved to Given when the shopkeeper marks pickup
            collected.
          </p>
          {statusMessage ? <p className="status--success">{statusMessage}</p> : null}
          {localError ? <p className="status--error">{localError}</p> : null}
          {reserve.error ? <p className="status--error">{reserve.error.message}</p> : null}
          {balancesQuery.error ? <p className="status--error">{balancesQuery.error.message}</p> : null}
        </aside>
      </div>
    </div>
  );
}
