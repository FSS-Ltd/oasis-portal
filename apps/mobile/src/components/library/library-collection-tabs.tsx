import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  LIBRARY_BOOK_COLLECTIONS,
  LIBRARY_BOOK_COLLECTION_LABELS,
  type LibraryBookCollection,
} from '@oasis/domain';
import { C } from '../core/mobile-theme';

export function LibraryCollectionTabs({
  value,
  onChange,
}: {
  value: LibraryBookCollection;
  onChange: (value: LibraryBookCollection) => void;
}) {
  return (
    <View style={styles.tabs}>
      {LIBRARY_BOOK_COLLECTIONS.map((collection) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: value === collection }}
          key={collection}
          onPress={() => {
            onChange(collection);
          }}
          style={[styles.tab, value === collection && styles.selected]}
        >
          <Text style={[styles.label, value === collection && styles.selectedLabel]}>
            {LIBRARY_BOOK_COLLECTION_LABELS[collection]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  selected: { backgroundColor: C.crimson, borderColor: C.crimson },
  label: { fontWeight: '800', color: C.navy, fontSize: 14 },
  selectedLabel: { color: C.surface },
});
