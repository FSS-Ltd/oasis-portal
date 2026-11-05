import { StyleSheet, Text, View } from 'react-native';
import { MobileButton } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';

export function LibraryRecordPager({
  page,
  nextPage,
  pending,
  onPage,
}: {
  page: number;
  nextPage: number | null | undefined;
  pending: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <View style={styles.row}>
      <MobileButton
        compact
        label="Previous"
        disabled={page === 1 || pending}
        onPress={() => {
          onPage(page - 1);
        }}
        variant="secondary"
      />
      <Text accessibilityLiveRegion="polite" style={styles.label}>
        Page {page}
      </Text>
      <MobileButton
        compact
        label="Next"
        disabled={!nextPage || pending}
        onPress={() => {
          if (nextPage) onPage(nextPage);
        }}
        variant="secondary"
      />
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  label: { color: C.textSecondary, fontSize: 13 },
});
