import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, ErrorText, MutedText, SectionTitle, SmokeButton } from '../smoke/smoke-ui';
import { ParentShopTile } from './parent-shop-tile';
import {
  formatParentShopMerits,
  parentShopFriendlyErrorMessage,
  type ParentShopCartLine,
  type ParentShopItem,
} from './parent-shop-reservations-utils';

type ParentShopCartLineWithItem = ParentShopCartLine & {
  item: ParentShopItem;
  lineTotal: number;
};

function QuantityRow({
  line,
  onQuantity,
}: {
  line: ParentShopCartLineWithItem;
  onQuantity: (itemId: string, next: number) => void;
}) {
  return (
    <View style={styles.cartLine}>
      <ParentShopTile item={line.item} size={52} />
      <View style={styles.cartLineBody}>
        <Text numberOfLines={1} style={styles.cartItemName}>
          {line.item.name}
        </Text>
        <MutedText>
          {formatParentShopMerits(line.item.priceIncVat)} each ·{' '}
          {formatParentShopMerits(line.lineTotal)} total
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
      <SmokeButton
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

export function ParentShopCart({
  balanceAfter,
  cartLines,
  cartTotal,
  localError,
  mutationError,
  onQuantity,
  onReserve,
  pending,
  spendBalance,
}: {
  balanceAfter: number;
  cartLines: readonly ParentShopCartLineWithItem[];
  cartTotal: number;
  localError: string | null;
  mutationError: string | null;
  onQuantity: (itemId: string, next: number) => void;
  onReserve: () => void;
  pending: boolean;
  spendBalance: number;
}) {
  const canReserve = cartLines.length > 0 && balanceAfter >= 0;

  return (
    <Card style={styles.compactCard}>
      <View style={styles.header}>
        <View>
          <SectionTitle>My Cart</SectionTitle>
          <MutedText>Pickup at Shopkeeper Counter</MutedText>
        </View>
        <Badge variant="blue">{formatParentShopMerits(cartLines.length)} lines</Badge>
      </View>
      {cartLines.length === 0 ? <MutedText>Add an item to reserve it.</MutedText> : null}
      {cartLines.map((line) => (
        <QuantityRow key={line.item.id} line={line} onQuantity={onQuantity} />
      ))}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Spend</Text>
          <Text style={styles.summaryValue}>{formatParentShopMerits(spendBalance)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Cart</Text>
          <Text style={styles.summaryValue}>{formatParentShopMerits(cartTotal)}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>After</Text>
          <Text style={[styles.summaryValue, balanceAfter < 0 ? styles.dangerText : null]}>
            {formatParentShopMerits(balanceAfter)}
          </Text>
        </View>
      </View>
      <SmokeButton
        disabled={!canReserve || pending}
        label={
          balanceAfter < 0
            ? `Need ${formatParentShopMerits(Math.abs(balanceAfter))} more`
            : 'Reserve at Counter'
        }
        onPress={onReserve}
        variant="navy"
      />
      {localError ? <ErrorText>{localError}</ErrorText> : null}
      {mutationError ? <ErrorText>{parentShopFriendlyErrorMessage(mutationError)}</ErrorText> : null}
    </Card>
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
  compactCard: {
    gap: 10,
    padding: 16,
  },
  dangerText: {
    color: C.danger,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  qtyButton: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  qtyButtonDisabled: {
    opacity: 0.45,
  },
  qtyButtonText: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  qtyGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  qtyText: {
    color: C.navy,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 18,
    textAlign: 'center',
  },
  summaryCell: {
    backgroundColor: C.bg,
    borderRadius: 10,
    flex: 1,
    gap: 3,
    minWidth: 80,
    padding: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  summaryValue: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
});
