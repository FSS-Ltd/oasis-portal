import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { api } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';

type ShopItem = RouterOutputs['shop']['listItems'][number];
type ShopCategory = ShopItem['category'];
type CartLine = { itemId: string; quantity: number };
type CategoryFilter = ShopCategory | 'All';

const CATEGORY_ORDER: readonly ShopCategory[] = [
  'Treats',
  'Privileges',
  'Stationery',
  'Accessories',
  'Toys',
  'Vouchers',
  'Merch',
  'Recognition',
];

function formatMerits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function stockVariant(item: ShopItem): 'success' | 'warning' | 'danger' | 'neutral' {
  if (item.stockStatus === 'Inactive') return 'neutral';
  if (item.stockStatus === 'OutOfStock') return 'danger';
  if (item.stockStatus === 'LowStock') return 'warning';
  return 'success';
}

function stockLabel(item: ShopItem): string {
  if (item.stockStatus === 'Inactive') return 'Paused';
  if (item.stockStatus === 'OutOfStock') return 'Out';
  if (item.stockStatus === 'LowStock') return `Low · ${String(item.stockCount)}`;
  return `${String(item.stockCount)} left`;
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

function MobileShopTile({ item, size = 72 }: { item: ShopItem; size?: number }) {
  if (item.photoUrl) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={item.name}
        source={{ uri: item.photoUrl }}
        style={[styles.tile, { height: size, width: size }]}
      />
    );
  }

  return (
    <View
      accessibilityLabel={item.name}
      style={[
        styles.tile,
        {
          backgroundColor: item.categoryTint,
          height: size,
          width: size,
        },
      ]}
    >
      <Text numberOfLines={3} style={[styles.tileText, { color: item.categoryInk }]}>
        {item.name.toUpperCase()}
      </Text>
      <View style={[styles.tileDot, { backgroundColor: item.categoryInk }]} />
    </View>
  );
}

function CategoryFilters({
  active,
  items,
  onSelect,
}: {
  active: CategoryFilter;
  items: readonly ShopItem[];
  onSelect: (category: CategoryFilter) => void;
}) {
  return (
    <View style={styles.categoryWrap}>
      {(['All', ...CATEGORY_ORDER] as const).map((category) => {
        const sample = items.find((item) => item.category === category);
        const selected = active === category;
        const count =
          category === 'All'
            ? items.length
            : items.filter((item) => item.category === category).length;
        return (
          <Pressable
            accessibilityRole="button"
            key={category}
            onPress={() => {
              onSelect(category);
            }}
            style={[styles.categoryChip, selected ? styles.categoryChipActive : null]}
          >
            <View
              style={[
                styles.categoryDot,
                {
                  backgroundColor:
                    category === 'All' ? C.navy : sample?.categoryInk ?? C.border,
                },
              ]}
            />
            <Text style={[styles.categoryText, selected ? styles.categoryTextActive : null]}>
              {category === 'All' ? 'All' : category}
            </Text>
            <Text style={styles.categoryCount}>{String(count)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ShopItemCard({
  item,
  onAdd,
  onOpen,
}: {
  item: ShopItem;
  onAdd: (item: ShopItem) => void;
  onOpen: (item: ShopItem) => void;
}) {
  const disabled = item.stockStatus === 'OutOfStock';

  return (
    <Card style={[styles.itemCard, disabled ? styles.disabledCard : null]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          onOpen(item);
        }}
        style={styles.itemPressable}
      >
        <MobileShopTile item={item} size={92} />
        <View style={styles.itemBody}>
          <View style={styles.itemMeta}>
            <Badge variant="blue" style={{ backgroundColor: item.categoryTint, color: item.categoryInk }}>
              {item.categoryLabel}
            </Badge>
            <Badge variant={stockVariant(item)}>{stockLabel(item)}</Badge>
          </View>
          <Text numberOfLines={2} style={styles.itemName}>
            {item.name}
          </Text>
          <Text numberOfLines={2} style={styles.itemBlurb}>
            {item.blurb ?? item.description ?? 'Reserve for pickup at the counter.'}
          </Text>
          <View style={styles.itemFooter}>
            <Text style={styles.itemPrice}>{formatMerits(item.priceIncVat)} merits</Text>
            <MobileButton
              compact
              disabled={disabled}
              label="Add"
              onPress={() => {
                onAdd(item);
              }}
              variant="secondary"
            />
          </View>
        </View>
      </Pressable>
    </Card>
  );
}

function ItemDetailCard({
  item,
  onAdd,
  onClose,
}: {
  item: ShopItem;
  onAdd: (item: ShopItem) => void;
  onClose: () => void;
}) {
  const disabled = item.stockStatus === 'OutOfStock';

  return (
    <Card style={styles.detailCard}>
      <View style={styles.detailHero}>
        <MobileShopTile item={item} size={136} />
        <View style={styles.detailBody}>
          <Badge variant="blue" style={{ backgroundColor: item.categoryTint, color: item.categoryInk }}>
            {item.categoryLabel}
          </Badge>
          <SectionTitle>{item.name}</SectionTitle>
          <MutedText>{item.description ?? item.blurb ?? 'Reserve for counter pickup.'}</MutedText>
          <Text style={styles.detailPrice}>{formatMerits(item.priceIncVat)} merits</Text>
          <MutedText>
            {item.stockStatus === 'OutOfStock'
              ? 'Currently out of stock.'
              : `${formatMerits(item.stockCount)} available · ${formatMerits(item.soldCount)} collected this term`}
          </MutedText>
        </View>
      </View>
      <View style={styles.detailActions}>
        <MobileButton compact label="Close" onPress={onClose} variant="secondary" />
        <MobileButton
          compact
          disabled={disabled}
          label={disabled ? 'Out of stock' : 'Add to cart'}
          onPress={() => {
            onAdd(item);
          }}
          variant="navy"
        />
      </View>
    </Card>
  );
}

function QuantityRow({
  line,
  onQuantity,
}: {
  line: CartLine & { item: ShopItem; lineTotal: number };
  onQuantity: (itemId: string, next: number) => void;
}) {
  return (
    <View style={styles.cartLine}>
      <MobileShopTile item={line.item} size={52} />
      <View style={styles.cartLineBody}>
        <Text numberOfLines={1} style={styles.cartItemName}>
          {line.item.name}
        </Text>
        <MutedText>
          {formatMerits(line.item.priceIncVat)} each · {formatMerits(line.lineTotal)} total
        </MutedText>
      </View>
      <View style={styles.qtyGroup}>
        <Pressable
          accessibilityRole="button"
          disabled={line.quantity <= 1}
          onPress={() => {
            onQuantity(line.item.id, Math.max(1, line.quantity - 1));
          }}
          style={[styles.qtyButton, line.quantity <= 1 ? styles.qtyButtonDisabled : null]}
        >
          <Text style={styles.qtyButtonText}>-</Text>
        </Pressable>
        <Text style={styles.qtyText}>{String(line.quantity)}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={line.quantity >= line.item.stockCount}
          onPress={() => {
            onQuantity(line.item.id, Math.min(line.item.stockCount, line.quantity + 1));
          }}
          style={[
            styles.qtyButton,
            line.quantity >= line.item.stockCount ? styles.qtyButtonDisabled : null,
          ]}
        >
          <Text style={styles.qtyButtonText}>+</Text>
        </Pressable>
      </View>
      <MobileButton
        compact
        label="Remove"
        onPress={() => {
          onQuantity(line.item.id, 0);
        }}
        variant="secondary"
      />
    </View>
  );
}

export function MobileShopReservationPanel({
  heldMerits,
  items,
  loading,
  ownerName,
  spendBalance,
  studentId,
}: {
  heldMerits: number;
  items: ShopItem[];
  loading: boolean;
  ownerName: string;
  spendBalance: number;
  studentId: string;
}) {
  const utils = api.useUtils();
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const reserve = api.shop.reserve.useMutation({
    onSuccess: async (reservation) => {
      setCart([]);
      setSelectedItemId(null);
      setStatus(`${formatMerits(reservation.totalPriceMerits)} merits held for pickup.`);
      await Promise.all([
        utils.shop.listItems.invalidate(),
        utils.shop.listReservations.invalidate(),
        utils.meritLedger.balances.invalidate(),
        utils.childLog.parentDashboard.invalidate(),
      ]);
    },
  });

  const activeItems = items.filter((item) => item.active);
  const visibleItems = activeItems.filter((item) => category === 'All' || item.category === category);
  const selectedItem = activeItems.find((item) => item.id === selectedItemId) ?? null;
  const cartLines = cartLinesFor(activeItems, cart);
  const cartTotal = cartLines.reduce((total, line) => total + line.lineTotal, 0);
  const balanceAfter = spendBalance - cartTotal;
  const canReserve = Boolean(studentId) && cartLines.length > 0 && balanceAfter >= 0;

  function addToCart(item: ShopItem): void {
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
    if (!canReserve) {
      setLocalError(balanceAfter < 0 ? 'Not enough Spend merits.' : 'Add an item first.');
      return;
    }
    try {
      await reserve.mutateAsync({
        studentId,
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
          <View>
            <SectionTitle>Merit Shop</SectionTitle>
            <MutedText>{ownerName} · reserve for pickup at the counter.</MutedText>
          </View>
          <Badge variant="crimson">{formatMerits(spendBalance)} spend</Badge>
        </View>
        {heldMerits > 0 ? <Badge variant="warning">{formatMerits(heldMerits)} held</Badge> : null}
      </Card>

      <CategoryFilters active={category} items={activeItems} onSelect={setCategory} />
      {loading ? <InlineSpinner label="Loading shop" /> : null}
      {selectedItem ? (
        <ItemDetailCard
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
          <ShopItemCard
            item={item}
            key={item.id}
            onAdd={addToCart}
            onOpen={(next) => {
              setSelectedItemId(next.id);
            }}
          />
        ))}
      </View>

      <Card style={styles.compactCard}>
        <View style={styles.header}>
          <SectionTitle>Cart</SectionTitle>
          <Badge variant="blue">{formatMerits(cartLines.length)} lines</Badge>
        </View>
        {cartLines.length === 0 ? <MutedText>Add an item to reserve it.</MutedText> : null}
        {cartLines.map((line) => (
          <QuantityRow key={line.item.id} line={line} onQuantity={setQuantity} />
        ))}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Spend</Text>
            <Text style={styles.summaryValue}>{formatMerits(spendBalance)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Cart</Text>
            <Text style={styles.summaryValue}>{formatMerits(cartTotal)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>After</Text>
            <Text style={[styles.summaryValue, balanceAfter < 0 ? styles.dangerText : null]}>
              {formatMerits(balanceAfter)}
            </Text>
          </View>
        </View>
        <MobileButton
          disabled={!canReserve || reserve.isPending}
          label={balanceAfter < 0 ? `Need ${formatMerits(Math.abs(balanceAfter))} more` : 'Reserve'}
          onPress={() => {
            void reserveCart();
          }}
          variant="navy"
        />
        {status ? <Badge variant="success">{status}</Badge> : null}
        {localError ? <ErrorText>{localError}</ErrorText> : null}
        {reserve.error ? <ErrorText>{reserve.error.message}</ErrorText> : null}
      </Card>
    </View>
  );
}

export function StudentShopPanel({
  heldMerits,
  items,
  loading,
  ownerName,
  spendBalance,
  studentId,
}: {
  heldMerits: number;
  items: ShopItem[];
  loading: boolean;
  ownerName: string;
  spendBalance: number;
  studentId: string;
}) {
  return (
    <MobileShopReservationPanel
      heldMerits={heldMerits}
      items={items}
      loading={loading}
      ownerName={ownerName}
      spendBalance={spendBalance}
      studentId={studentId}
    />
  );
}

const styles = StyleSheet.create({
  cartItemName: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
  },
  cartLine: {
    alignItems: 'center',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
  },
  cartLineBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryChipActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  categoryCount: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  categoryDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  categoryText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  categoryTextActive: {
    color: C.surface,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactCard: {
    gap: 10,
    padding: 16,
  },
  dangerText: {
    color: C.danger,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  detailBody: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  detailCard: {
    gap: 14,
    padding: 16,
  },
  detailHero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  detailPrice: {
    color: C.crimson,
    fontSize: 24,
    fontWeight: '900',
  },
  disabledCard: {
    opacity: 0.55,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  heroCard: {
    gap: 12,
    padding: 16,
  },
  itemBlurb: {
    color: C.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  itemBody: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  itemCard: {
    gap: 0,
    padding: 12,
  },
  itemFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemGrid: {
    gap: 12,
  },
  itemMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemName: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  itemPressable: {
    flexDirection: 'row',
    gap: 12,
  },
  itemPrice: {
    color: C.crimson,
    fontSize: 15,
    fontWeight: '900',
  },
  qtyButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  qtyButtonDisabled: {
    opacity: 0.4,
  },
  qtyButtonText: {
    color: C.navy,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  qtyGroup: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    padding: 2,
  },
  qtyText: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 20,
    textAlign: 'center',
  },
  stack: {
    gap: 14,
  },
  summaryCell: {
    backgroundColor: C.bg,
    borderRadius: 10,
    flex: 1,
    gap: 3,
    padding: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  tile: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  tileDot: {
    borderRadius: 999,
    height: 6,
    opacity: 0.5,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 6,
  },
  tileText: {
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 13,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
});
