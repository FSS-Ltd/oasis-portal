import { Image, StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from './mobile-theme';
import { Badge, Card, InlineSpinner, MutedText, SectionTitle } from './smoke-ui';

type ShopItem = RouterOutputs['shop']['listItems'][number];

function stockVariant(item: ShopItem): 'success' | 'warning' | 'danger' {
  if (item.stockCount <= 0) return 'danger';
  if (item.stockCount <= 3) return 'warning';
  return 'success';
}

function ShopItemCard({ item }: { item: ShopItem }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        {item.photoUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={item.name}
            source={{ uri: item.photoUrl }}
            style={styles.itemImage}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>{item.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.itemBody}>
          <Text numberOfLines={2} style={styles.itemName}>
            {item.name}
          </Text>
          <MutedText>{String(item.priceIncVat)} merits</MutedText>
        </View>
        <View style={styles.itemMeta}>
          <Badge variant={stockVariant(item)}>{String(item.stockCount)} left</Badge>
          <Badge variant="neutral">Shopkeeper checkout</Badge>
        </View>
      </View>
    </Card>
  );
}

export function StudentShopPanel({
  items,
  loading,
}: {
  items: ShopItem[];
  loading: boolean;
}) {
  return (
    <View style={styles.stack}>
      <Card style={styles.compactCard}>
        <View style={styles.header}>
          <SectionTitle>Shop</SectionTitle>
          <Badge variant="blue">{String(items.length)} active</Badge>
        </View>
        <MutedText>Browse available items. Purchases are completed by a shopkeeper.</MutedText>
      </Card>
      {loading ? <InlineSpinner label="Loading shop" /> : null}
      {items.length === 0 ? (
        <Card style={styles.compactCard}>
          <SectionTitle>No shop items</SectionTitle>
          <MutedText>No active items are available right now.</MutedText>
        </Card>
      ) : null}
      {items.map((item) => (
        <ShopItemCard key={item.id} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    gap: 10,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  itemCard: {
    gap: 0,
    padding: 14,
  },
  itemImage: {
    backgroundColor: C.bg,
    borderRadius: 8,
    height: 56,
    width: 56,
  },
  itemMeta: {
    alignItems: 'flex-end',
    gap: 5,
    maxWidth: 118,
  },
  itemName: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  itemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  placeholderImage: {
    alignItems: 'center',
    backgroundColor: C.blueLight,
    borderRadius: 8,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  placeholderText: {
    color: C.navy,
    fontSize: 22,
    fontWeight: '900',
  },
  stack: {
    gap: 14,
  },
});
