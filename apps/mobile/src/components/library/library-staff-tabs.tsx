import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LIBRARY_STAFF_VIEWS, type LibraryStaffView } from '@oasis/domain';
import { C } from '../core/mobile-theme';

export function LibraryStaffTabs({
  value,
  onChange,
}: {
  value: LibraryStaffView;
  onChange: (value: LibraryStaffView) => void;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Library workspace" style={styles.tabs}>
      {LIBRARY_STAFF_VIEWS.map((view) => (
        <Pressable
          key={view.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === view.id }}
          onPress={() => {
            onChange(view.id);
          }}
          style={[styles.tab, value === view.id && styles.selected]}
        >
          <Text style={[styles.label, value === view.id && styles.selectedLabel]}>
            {view.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
  selected: { backgroundColor: C.navy },
  label: { color: C.navy, fontWeight: '700', fontSize: 13 },
  selectedLabel: { color: C.surface },
});
