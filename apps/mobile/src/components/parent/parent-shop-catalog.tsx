import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { Badge, Card, MutedText, SectionTitle, MobileButton } from '../core/mobile-ui';
import { ParentShopTile } from './parent-shop-tile';
import {
  formatParentShopMerits,
  parentShopCategoryOrder,
  parentShopStockLabel,
  parentShopStockVariant,
  type ParentShopCategoryFilter,
  type ParentShopItem,
} from './parent-shop-reservations-utils';

export function ParentShopCategoryFilters({
  active,
  items,
  onSelect,
}: {
  active: ParentShopCategoryFilter;
  items: readonly ParentShopItem[];
  onSelect: (category: ParentShopCategoryFilter) => void;
}) {
  return (
    <View style={styles.categoryWrap}>
      {(['All', ...parentShopCategoryOrder] as const).map((category) => {
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
                  backgroundColor: category === 'All' ? C.navy : (sample?.categoryInk ?? C.border),
                },
              ]}
            />
            <Text style={[styles.categoryText, selected ? styles.categoryTextActive : null]}>
              {category}
            </Text>
            <Text style={styles.categoryCount}>{String(count)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ParentShopItemCard({
  item,
  onAdd,
  onOpen,
}: {
  item: ParentShopItem;
  onAdd: (item: ParentShopItem) => void;
  onOpen: (item: ParentShopItem) => void;
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
        <ParentShopTile item={item} size={92} />
        <View style={styles.itemBody}>
          <View style={styles.itemMeta}>
            <Badge
              variant="blue"
              style={{ backgroundColor: item.categoryTint, color: item.categoryInk }}
            >
              {item.categoryLabel}
            </Badge>
            <Badge variant={parentShopStockVariant(item)}>{parentShopStockLabel(item)}</Badge>
          </View>
          <Text numberOfLines={2} style={styles.itemName}>
            {item.name}
          </Text>
          <Text numberOfLines={2} style={styles.itemBlurb}>
            {item.blurb ?? item.description ?? 'Reserve for pickup at the counter.'}
          </Text>
          <View style={styles.itemFooter}>
            <Text style={styles.itemPrice}>{formatParentShopMerits(item.priceIncVat)} merits</Text>
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

export function ParentShopItemDetailCard({
  item,
  onAdd,
  onClose,
}: {
  item: ParentShopItem;
  onAdd: (item: ParentShopItem) => void;
  onClose: () => void;
}) {
  const disabled = item.stockStatus === 'OutOfStock';

  return (
    <Card style={styles.detailCard}>
      <View style={styles.detailHero}>
        <ParentShopTile item={item} size={132} />
        <View style={styles.detailBody}>
          <Badge
            variant="blue"
            style={{ backgroundColor: item.categoryTint, color: item.categoryInk }}
          >
            {item.categoryLabel}
          </Badge>
          <SectionTitle>{item.name}</SectionTitle>
          <MutedText>{item.description ?? item.blurb ?? 'Reserve for counter pickup.'}</MutedText>
          <Text style={styles.detailPrice}>{formatParentShopMerits(item.priceIncVat)} merits</Text>
          <MutedText>
            {item.stockStatus === 'OutOfStock'
              ? 'Currently out of stock.'
              : `${formatParentShopMerits(item.stockCount)} available · ${formatParentShopMerits(item.soldCount)} collected this term`}
          </MutedText>
        </View>
      </View>
      <View style={styles.detailActions}>
        <MobileButton compact label="Close" onPress={onClose} variant="secondary" />
        <MobileButton
          compact
          disabled={disabled}
          label={disabled ? 'Out of Stock' : 'Add to cart'}
          onPress={() => {
            onAdd(item);
          }}
          variant="navy"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  detailPrice: {
    color: C.crimson,
    fontSize: 22,
    fontWeight: '900',
  },
  disabledCard: {
    opacity: 0.62,
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
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  itemMeta: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemName: {
    color: C.navy,
    fontSize: 15,
    fontWeight: '900',
  },
  itemPressable: {
    flexDirection: 'row',
    gap: 12,
  },
  itemPrice: {
    color: C.crimson,
    fontSize: 14,
    fontWeight: '900',
  },
});
