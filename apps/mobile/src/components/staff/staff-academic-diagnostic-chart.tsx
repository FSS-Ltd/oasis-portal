import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';

/** The printed diagnostic chart: attempted PACEs, circled in red when below the minimum. */
export function StaffDiagnosticChart({
  attempted,
  circled,
  disabled = false,
  onToggle,
}: {
  attempted: readonly number[];
  circled: readonly number[];
  disabled?: boolean;
  onToggle?: (paceNumber: number) => void;
}) {
  const circledSet = new Set(circled);
  return (
    <View accessibilityLabel="PACE diagnostic chart" style={styles.grid}>
      {attempted.map((paceNumber) => {
        const isCircled = circledSet.has(paceNumber);
        const label = `PACE ${String(paceNumber)}${isCircled ? ', circled' : ''}`;
        const cell = (
          <Text style={[styles.text, isCircled ? styles.textCircled : null]}>{paceNumber}</Text>
        );
        return onToggle ? (
          <Pressable
            accessibilityLabel={label}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: isCircled }}
            disabled={disabled}
            key={paceNumber}
            onPress={() => {
              onToggle(paceNumber);
            }}
            style={[styles.cell, isCircled ? styles.cellCircled : null]}
          >
            {cell}
          </Pressable>
        ) : (
          <View
            accessibilityLabel={label}
            key={paceNumber}
            style={[styles.cell, isCircled ? styles.cellCircled : null]}
          >
            {cell}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  cell: {
    flexBasis: '14%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    backgroundColor: C.surface,
  },
  // Circled like the red rings on the printed result sheet.
  cellCircled: {
    borderWidth: 2,
    borderColor: C.crimson,
    borderRadius: 999,
    backgroundColor: C.crimsonLight,
  },
  text: { color: C.textPrimary, fontSize: 14 },
  textCircled: { color: C.crimson, fontWeight: '700' },
});
