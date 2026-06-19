import { StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { Badge, Card, ErrorText, InlineSpinner, MutedText } from '../smoke/smoke-ui';
import { formatMerits, type ShopCounterItem } from './staff-shop-counter-utils';

export function StaffShopCounterStock({
  error,
  items,
  loading,
}: {
  error: string | null;
  items: readonly ShopCounterItem[];
  loading: boolean;
}) {
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Counter stock</Text>
          <MutedText>Read-only catalogue availability for shopkeepers.</MutedText>
        </View>
        <Badge variant="neutral">{String(items.length)} active</Badge>
      </View>

      {loading ? <InlineSpinner label="Loading counter stock" /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={styles.grid}>
        {items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.itemTile,
              {
                backgroundColor: item.categoryTint || C.blueLight,
                borderColor: item.categoryInk || C.blueMid,
              },
            ]}
          >
            <View
              style={[
                styles.tileDot,
                { backgroundColor: item.categoryInk || C.crimson },
              ]}
            />
            <Text style={[styles.itemName, { color: item.categoryInk || C.navy }]}>
              {item.name}
            </Text>
            <Text style={[styles.itemMeta, { color: item.categoryInk || C.textSecondary }]}>
              {item.categoryLabel} · {formatMerits(item.priceIncVat)}
            </Text>
            <View style={styles.itemFooter}>
              <Badge variant={item.stockStatus === 'OutOfStock' ? 'danger' : 'neutral'}>
                {String(item.availableStockCount)} stock
              </Badge>
              {item.stockStatus === 'LowStock' ? <Badge variant="warning">Low</Badge> : null}
            </View>
          </View>
        ))}
      </View>

      {!loading && !error && items.length === 0 ? (
        <Text style={styles.emptyText}>No active shop stock is available.</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: C.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  grid: {
    gap: 10,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  itemFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemMeta: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
    textTransform: 'uppercase',
  },
  itemTile: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 7,
    overflow: 'hidden',
    padding: 14,
  },
  tileDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});
