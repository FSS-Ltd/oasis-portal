import { StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { MobileButton } from '../core/mobile-ui';

export function InventoryMobilePagination({
  label,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  total,
}: {
  label: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <View style={styles.wrapper}>
      <Text accessibilityLiveRegion="polite" style={styles.label}>
        {label}: {String(total === 0 ? 0 : (page - 1) * pageSize + 1)}–
        {String(Math.min(page * pageSize, total))} of {String(total)}
      </Text>
      <View style={styles.controls}>
        <MobileButton
          disabled={page <= 1}
          label="Previous"
          onPress={() => {
            onPageChange(page - 1);
          }}
          variant="secondary"
        />
        <MobileButton
          disabled={page >= totalPages}
          label="Next"
          onPress={() => {
            onPageChange(page + 1);
          }}
          variant="secondary"
        />
      </View>
      {onPageSizeChange ? (
        <View style={styles.controls}>
          <Text style={styles.label}>Per page</Text>
          {[5, 10, 20].map((size) => (
            <MobileButton
              key={size}
              label={String(size)}
              onPress={() => {
                onPageSizeChange(size);
              }}
              variant={size === pageSize ? 'navy' : 'secondary'}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { color: C.textSecondary, fontSize: 12 },
  wrapper: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
});
