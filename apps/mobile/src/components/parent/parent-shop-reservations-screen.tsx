import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../lib/trpc';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle } from '../smoke/smoke-ui';
import { ParentChildSwitcher } from './parent-child-switcher';
import {
  ParentShopCategoryFilters,
  ParentShopItemCard,
  ParentShopItemDetailCard,
} from './parent-shop-catalog';
import { ParentShopCart } from './parent-shop-cart';
import { ParentShopReservationsList } from './parent-shop-reservations-list';
import {
  formatParentShopMerits,
  parentShopCartLinesFor,
  parentShopFriendlyErrorMessage,
  type ParentShopCartLine,
  type ParentShopCategoryFilter,
  type ParentShopItem,
  type ParentShopReservationsScreenProps,
} from './parent-shop-reservations-utils';

export function ParentShopReservationsScreen({
  children,
  heldMerits,
  items,
  loading,
  onSelectChild,
  reservations,
  reservationsError,
  reservationsLoading,
  selectedChild,
  shopError,
  spendBalance,
}: ParentShopReservationsScreenProps) {
  const utils = api.useUtils();
  const reserve = api.shop.reserve.useMutation({
    onSuccess: async (reservation) => {
      setCart([]);
      setSelectedItemId(null);
      setStatus(`Reservation placed. ${formatParentShopMerits(reservation.totalPriceMerits)} merits held.`);
      await Promise.all([
        utils.shop.listItems.invalidate(),
        utils.shop.listReservations.invalidate(),
        utils.meritLedger.balances.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
      ]);
    },
  });
  const [category, setCategory] = useState<ParentShopCategoryFilter>('All');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [cart, setCart] = useState<ParentShopCartLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeItems = useMemo(() => items.filter((item) => item.active), [items]);
  const visibleItems = activeItems.filter((item) => category === 'All' || item.category === category);
  const selectedItem = activeItems.find((item) => item.id === selectedItemId) ?? null;
  const cartLines = parentShopCartLinesFor(activeItems, cart);
  const cartTotal = cartLines.reduce((total, line) => total + line.lineTotal, 0);
  const balanceAfter = spendBalance - cartTotal;
  const selectedReservations = reservations.filter(
    (reservation) => reservation.studentId === selectedChild.student.id,
  );
  const friendlyShopError = parentShopFriendlyErrorMessage(shopError);
  const friendlyReservationError = parentShopFriendlyErrorMessage(reservationsError);

  function addToCart(item: ParentShopItem): void {
    setStatus(null);
    setLocalError(null);
    if (item.stockStatus === 'OutOfStock') {
      setLocalError(`${item.name} is out of stock.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (!existing) return [...current, { itemId: item.id, quantity: 1 }];
      return current.map((line) =>
        line.itemId === item.id
          ? { ...line, quantity: Math.min(item.stockCount, line.quantity + 1) }
          : line,
      );
    });
  }

  function setQuantity(itemId: string, next: number): void {
    setCart((current) =>
      current
        .map((line) => (line.itemId === itemId ? { ...line, quantity: next } : line))
        .filter((line) => line.quantity > 0),
    );
  }

  async function reserveCart(): Promise<void> {
    setStatus(null);
    setLocalError(null);
    if (cartLines.length === 0 || balanceAfter < 0) {
      setLocalError(balanceAfter < 0 ? 'Not enough Spend merits.' : 'Add an item first.');
      return;
    }
    try {
      await reserve.mutateAsync({
        studentId: selectedChild.student.id,
        lines: cartLines.map((line) => ({
          itemId: line.item.id,
          unitsReserved: line.quantity,
        })),
      });
    } catch {
      // Mutation error is rendered below.
    }
  }

  return (
    <View style={styles.stack}>
      <Card style={styles.heroCard}>
        <View style={styles.header}>
          <View style={styles.heroText}>
            <Text style={styles.title}>Merit Shop</Text>
            <MutedText>
              {selectedChild.student.fullName} · reserve for pickup at the counter.
            </MutedText>
          </View>
          <Badge variant="crimson">{formatParentShopMerits(spendBalance)} spend</Badge>
        </View>
        <View style={styles.balanceGrid}>
          <View style={styles.balanceCell}>
            <Text style={styles.balanceLabel}>Spend balance</Text>
            <Text style={styles.balanceValue}>{formatParentShopMerits(spendBalance)}</Text>
          </View>
          <View style={styles.balanceCell}>
            <Text style={styles.balanceLabel}>Shop Holds</Text>
            <Text style={styles.balanceValue}>{formatParentShopMerits(heldMerits)}</Text>
          </View>
        </View>
      </Card>

      <ParentChildSwitcher
        children={children}
        selectedChildId={selectedChild.student.id}
        onSelect={onSelectChild}
      />

      {friendlyShopError ? <ErrorText>{friendlyShopError}</ErrorText> : null}
      {friendlyReservationError ? <ErrorText>{friendlyReservationError}</ErrorText> : null}

      <ParentShopReservationsList
        loading={reservationsLoading}
        reservations={selectedReservations}
      />

      <ParentShopCategoryFilters active={category} items={activeItems} onSelect={setCategory} />
      {loading ? <InlineSpinner label="Loading shop" /> : null}
      {selectedItem ? (
        <ParentShopItemDetailCard
          item={selectedItem}
          onAdd={addToCart}
          onClose={() => {
            setSelectedItemId(null);
          }}
        />
      ) : null}

      {visibleItems.length === 0 && !loading ? (
        <Card style={styles.compactCard}>
          <SectionTitle>No shop items</SectionTitle>
          <MutedText>No active items are available in this category.</MutedText>
        </Card>
      ) : null}

      <View style={styles.itemGrid}>
        {visibleItems.map((item) => (
          <ParentShopItemCard
            item={item}
            key={item.id}
            onAdd={addToCart}
            onOpen={(next) => {
              setSelectedItemId(next.id);
            }}
          />
        ))}
      </View>

      <ParentShopCart
        balanceAfter={balanceAfter}
        cartLines={cartLines}
        cartTotal={cartTotal}
        localError={localError}
        mutationError={reserve.error?.message ?? null}
        pending={reserve.isPending}
        spendBalance={spendBalance}
        onQuantity={setQuantity}
        onReserve={() => {
          void reserveCart();
        }}
      />
      {status ? <Badge variant="success">{status}</Badge> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCell: {
    backgroundColor: C.bg,
    borderColor: C.borderLight,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 118,
    padding: 12,
  },
  balanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  balanceLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  balanceValue: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  heroCard: {
    gap: 14,
    padding: 16,
  },
  heroText: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  itemGrid: {
    gap: 10,
  },
  stack: {
    gap: 14,
  },
  title: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '900',
  },
});
