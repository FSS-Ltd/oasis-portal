import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, MobileButton, MutedText } from '../core/mobile-ui';
import { nextOrderStatus } from './staff-academic-inventory-utils';

type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryOrder = InventorySummary['orders'][number];
type InventoryStudent = InventorySummary['students'][number];
const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function SelectionCheckbox({
  checked,
  disabled,
  label,
  mixed = false,
  onPress,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  mixed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: mixed ? 'mixed' : checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.checkboxRow}
    >
      <View style={[styles.checkbox, checked || mixed ? styles.checkboxChecked : null]}>
        <Text style={styles.checkboxMark}>{mixed ? '−' : checked ? '✓' : ''}</Text>
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export function InventoryOrderList({
  bulkPending,
  onAdvance,
  onMarkSelected,
  onSelectionChange,
  orders,
  pending,
  selectedOrderIds,
  students,
  updatingOrderId,
}: {
  bulkPending: boolean;
  onAdvance: (order: InventoryOrder) => void;
  onMarkSelected: () => void;
  onSelectionChange: (orderIds: string[]) => void;
  orders: InventoryOrder[];
  pending: boolean;
  selectedOrderIds: readonly string[];
  students: InventoryStudent[];
  updatingOrderId: string | null;
}) {
  const eligibleIds = orders.filter((order) => order.status === 'Ordered').map((order) => order.id);
  const selectedIds = new Set(selectedOrderIds);
  const selectedCount = eligibleIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = eligibleIds.length > 0 && selectedCount === eligibleIds.length;

  return (
    <Card style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>Existing orders</Text>
        <Badge>{String(orders.length)} recent</Badge>
      </View>
      <View style={styles.selectionToolbar}>
        <SelectionCheckbox
          checked={allSelected}
          disabled={pending || eligibleIds.length === 0}
          label="Select all"
          mixed={selectedCount > 0 && !allSelected}
          onPress={() => {
            onSelectionChange(allSelected ? [] : eligibleIds);
          }}
        />
        <Text accessibilityLiveRegion="polite" style={styles.selectionCount}>
          {String(selectedCount)} {selectedCount === 1 ? 'order' : 'orders'} selected
        </Text>
        <View style={styles.selectionActions}>
          <MobileButton
            disabled={pending || selectedCount === 0}
            label="Clear selection"
            onPress={() => {
              onSelectionChange([]);
            }}
            variant="secondary"
          />
          <MobileButton
            disabled={pending || selectedCount === 0}
            label={bulkPending ? 'Marking in transit…' : 'Mark selected in transit'}
            onPress={onMarkSelected}
            variant="blue"
          />
        </View>
      </View>
      {orders.length === 0 ? <MutedText>No PACE orders have been created yet.</MutedText> : null}
      {orders.map((order) => {
        const student = students.find((row) => row.id === order.studentId);
        const assignment = student?.subjects.find((row) => row.subjectId === order.subjectId);
        const nextStatus = nextOrderStatus(order.status);
        return (
          <View key={order.id} style={styles.orderRow}>
            <View style={styles.rowBetween}>
              {order.status === 'Ordered' ? (
                <SelectionCheckbox
                  checked={selectedIds.has(order.id)}
                  disabled={pending}
                  label={`Select PACE #${String(order.paceNumber)} order for ${student?.fullName ?? 'student'}, ${assignment?.subject.name ?? 'subject'}`}
                  onPress={() => {
                    onSelectionChange(
                      selectedIds.has(order.id)
                        ? selectedOrderIds.filter((id) => id !== order.id)
                        : [...selectedOrderIds, order.id],
                    );
                  }}
                />
              ) : null}
              <Badge variant={order.status === 'Delivered' ? 'success' : 'blue'}>
                {order.status}
              </Badge>
            </View>
            <Text style={styles.rowTitle}>
              PACE #{String(order.paceNumber)} · {student?.fullName ?? 'Student'}
            </Text>
            <MutedText>
              {assignment
                ? `${assignment.subject.code} · ${assignment.subject.name}`
                : 'Assigned subject'}{' '}
              · {dateFormatter.format(new Date(order.createdAt))}
            </MutedText>
            {nextStatus ? (
              <MobileButton
                compact
                disabled={pending}
                label={updatingOrderId === order.id ? 'Updating...' : `Mark ${nextStatus}`}
                onPress={() => {
                  onAdvance(order);
                }}
                variant="blue"
              />
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  cardTitle: { color: C.navy, fontSize: 14, fontWeight: '900' },
  checkbox: {
    alignItems: 'center',
    borderColor: C.navy,
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxChecked: { backgroundColor: C.navy },
  checkboxLabel: { color: C.navy, flexShrink: 1, fontSize: 13 },
  checkboxMark: { color: C.surface, fontSize: 16, fontWeight: '800' },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: 8,
    minHeight: 44,
    minWidth: 0,
  },
  orderRow: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  rowTitle: { color: C.navy, fontSize: 12, fontWeight: '900' },
  selectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectionCount: { color: C.textSecondary, fontSize: 12 },
  selectionToolbar: { gap: 8 },
});
