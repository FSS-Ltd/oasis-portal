import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type RouterOutputs } from '../../lib/trpc';
import { Badge, MutedText } from '../core/mobile-ui';
import { C } from '../core/mobile-theme';
import { formatDate, formatTime } from './staff-rota-utils';

export type RotaShift = RouterOutputs['rota']['myRota'][number];
export type SwapCandidate = RouterOutputs['rota']['swapCandidates'][number];
export type SwapRequest = RouterOutputs['rota']['mySwapRequests'][number];

export function shiftTitle(shift: Pick<RotaShift, 'bandName' | 'kind'>): string {
  return shift.kind === 'Meeting' ? 'Meeting' : (shift.bandName ?? 'Cover');
}

export function shiftDetail(shift: Pick<RotaShift, 'date' | 'endsAt' | 'startsAt'>): string {
  return `${formatDate(shift.date)} · ${formatTime(shift.startsAt)}-${formatTime(shift.endsAt)}`;
}

export function selectedShiftLabel(shift: RotaShift | SwapCandidate | null): string {
  if (!shift) return 'Choose shift';
  const staffPrefix = 'staff' in shift && shift.staff ? `${shift.staff.fullName} · ` : '';
  return `${staffPrefix}${shiftDetail(shift)} · ${shiftTitle(shift)}`;
}

export function TabButton({
  active,
  badge = 0,
  label,
  onPress,
}: {
  active: boolean;
  badge?: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active ? styles.tabButtonActive : null]}
    >
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>
        {label}
      </Text>
      {badge > 0 ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{String(badge)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ShiftRow({ shift }: { shift: RotaShift }) {
  return (
    <View style={styles.shiftRow}>
      <View
        style={[
          styles.shiftDot,
          { backgroundColor: shift.kind === 'Meeting' ? C.success : (shift.bandColour ?? C.blue) },
        ]}
      />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{shiftTitle(shift)}</Text>
        <MutedText>{shiftDetail(shift)}</MutedText>
        {shift.notes ? <Text style={styles.note}>{shift.notes}</Text> : null}
      </View>
      <Badge variant={shift.kind === 'Meeting' ? 'success' : 'blue'}>{shift.kind}</Badge>
    </View>
  );
}

export function SelectableList<T extends { id: string }>({
  emptyLabel,
  items,
  onSelect,
  renderLabel,
  selectedId,
}: {
  emptyLabel: string;
  items: readonly T[];
  onSelect: (id: string) => void;
  renderLabel: (item: T) => string;
  selectedId: string;
}) {
  if (items.length === 0) return <MutedText>{emptyLabel}</MutedText>;
  return (
    <View style={styles.selectableList}>
      {items.slice(0, 8).map((item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedId === item.id }}
          key={item.id}
          onPress={() => {
            onSelect(item.id);
          }}
          style={[styles.selectableRow, selectedId === item.id ? styles.selectableRowActive : null]}
        >
          <Text style={styles.selectableText}>{renderLabel(item)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    color: C.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    color: C.navy,
    fontSize: 14,
    fontWeight: '900',
  },
  selectableList: {
    gap: 8,
  },
  selectableRow: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectableRowActive: {
    backgroundColor: C.blueLight,
    borderColor: C.blue,
  },
  selectableText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  shiftDot: {
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  shiftRow: {
    alignItems: 'flex-start',
    borderTopColor: C.borderLight,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
  },
  tabBadge: {
    alignItems: 'center',
    backgroundColor: C.crimson,
    borderRadius: 9,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: C.surface,
    fontSize: 10,
    fontWeight: '900',
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
  },
  tabButtonActive: {
    backgroundColor: C.navy,
    borderColor: C.navy,
  },
  tabButtonText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: C.surface,
  },
});
