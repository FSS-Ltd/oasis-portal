import { Image, StyleSheet, Text, View } from 'react-native';
import { C } from '../smoke/mobile-theme';
import { type ParentShopItem } from './parent-shop-reservations-utils';

export function ParentShopTile({ item, size = 72 }: { item: ParentShopItem; size?: number }) {
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
      style={[styles.tile, { backgroundColor: item.categoryTint, height: size, width: size }]}
    >
      <Text numberOfLines={3} style={[styles.tileText, { color: item.categoryInk }]}>
        {item.name.toUpperCase()}
      </Text>
      <View style={[styles.tileDot, { backgroundColor: item.categoryInk }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileDot: {
    borderRadius: 5,
    bottom: 8,
    height: 10,
    position: 'absolute',
    right: 8,
    width: 10,
  },
  tileText: {
    color: C.navy,
    fontSize: 10,
    fontWeight: '900',
    padding: 8,
    textAlign: 'center',
  },
});
