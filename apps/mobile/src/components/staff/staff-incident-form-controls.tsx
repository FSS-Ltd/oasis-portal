import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../core/mobile-theme';
import { type IncidentSeverity } from './staff-incident-utils';

export function IncidentOptionButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.optionButton, active ? styles.optionButtonActive : null]}
    >
      <Text style={[styles.optionButtonText, active ? styles.optionButtonTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IncidentSeverityButton({
  active,
  label,
  onPress,
  severity,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  severity: IncidentSeverity;
}) {
  const danger = severity === 'High' || severity === 'Critical';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.segmentButton,
        active ? (danger ? styles.segmentButtonDanger : styles.segmentButtonActive) : null,
      ]}
    >
      <Text
        style={[
          styles.segmentButtonText,
          active
            ? danger
              ? styles.segmentButtonTextDanger
              : styles.segmentButtonTextActive
            : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IncidentToggleRow({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={styles.toggleRow}
    >
      <View style={[styles.toggleBox, active ? styles.toggleBoxActive : null]}>
        <Text style={[styles.toggleMark, active ? styles.toggleMarkActive : null]}>
          {active ? 'Yes' : 'No'}
        </Text>
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionButton: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  optionButtonText: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  optionButtonTextActive: {
    color: C.navy,
  },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  segmentButtonActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  segmentButtonDanger: {
    backgroundColor: C.dangerBg,
    borderColor: C.dangerMid,
  },
  segmentButtonText: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  segmentButtonTextActive: {
    color: C.navy,
  },
  segmentButtonTextDanger: {
    color: C.danger,
  },
  toggleBox: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  toggleBoxActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  toggleLabel: {
    color: C.navy,
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  toggleMark: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  toggleMarkActive: {
    color: C.navy,
  },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
