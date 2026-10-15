import { useEffect, useState } from 'react';
import { PACE_CATALOGUE } from '@oasis/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type RouterOutputs } from '../../lib/trpc';
import { C } from '../core/mobile-theme';
import { Badge, Card, Field, MobileButton, MutedText } from '../core/mobile-ui';
import { InventoryMobilePagination } from './staff-academic-inventory-pagination';

type Summary = RouterOutputs['academicInventory']['summary'];
type Student = Pick<Summary['students'][number], 'id' | 'fullName' | 'subjects'>;
type Order = RouterOutputs['academicInventory']['ordersForStudent']['rows'][number];
type Filter = 'Outstanding' | 'Ordered' | 'InTransit' | 'Delivered';
const filters: readonly Filter[] = ['Outstanding', 'Ordered', 'InTransit', 'Delivered'];
const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function countForStatus(
  counts: Summary['orderCountsByStudent'],
  studentId: string,
  status: Filter,
): number {
  return counts
    .filter(
      (row) =>
        row.studentId === studentId &&
        (status === 'Outstanding' ? row.status !== 'Delivered' : row.status === status),
    )
    .reduce((total, row) => total + row._count._all, 0);
}

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

function StudentOrders({
  allChildIds,
  filter,
  onAdvance,
  onSelectionChange,
  pageSize,
  pending,
  selectedOrderIds,
  student,
}: {
  allChildIds: string[];
  filter: Filter;
  onAdvance: (order: Order) => void;
  onSelectionChange: (ids: string[]) => void;
  pageSize: number;
  pending: boolean;
  selectedOrderIds: readonly string[];
  student: Student;
}) {
  const [page, setPage] = useState(1);
  const query = api.academicInventory.ordersForStudent.useQuery(
    { studentId: student.id, status: filter, page, pageSize },
    { retry: false },
  );
  useEffect(() => {
    if (!query.data) return;
    const lastPage = Math.max(1, Math.ceil(query.data.totalRows / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [page, pageSize, query.data]);
  const selected = new Set(selectedOrderIds);
  const visibleIds = (query.data?.rows ?? [])
    .filter((row) => row.status !== 'Delivered' && PACE_CATALOGUE.includes(row.paceNumber))
    .map((row) => row.id);
  const childSelected = allChildIds.length > 0 && allChildIds.every((id) => selected.has(id));
  const visibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  return (
    <View style={styles.childBody}>
      {allChildIds.length > 0 ? (
        <SelectionCheckbox
          checked={childSelected}
          disabled={pending}
          label={`Select all ${String(allChildIds.length)} eligible orders for ${student.fullName}`}
          mixed={!childSelected && allChildIds.some((id) => selected.has(id))}
          onPress={() => {
            onSelectionChange(
              childSelected
                ? selectedOrderIds.filter((id) => !allChildIds.includes(id))
                : [...new Set([...selectedOrderIds, ...allChildIds])],
            );
          }}
        />
      ) : null}
      {visibleIds.length > 0 ? (
        <SelectionCheckbox
          checked={visibleSelected}
          disabled={pending}
          label="Select visible orders"
          mixed={!visibleSelected && visibleIds.some((id) => selected.has(id))}
          onPress={() => {
            onSelectionChange(
              visibleSelected
                ? selectedOrderIds.filter((id) => !visibleIds.includes(id))
                : [...new Set([...selectedOrderIds, ...visibleIds])],
            );
          }}
        />
      ) : null}
      {query.isLoading ? <MutedText>Loading orders…</MutedText> : null}
      {query.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {query.error.message}
        </Text>
      ) : null}
      {query.data?.rows.map((order) => {
        const assignment = student.subjects.find((row) => row.subjectId === order.subjectId);
        return (
          <View key={order.id} style={styles.orderRow}>
            <View style={styles.rowBetween}>
              {order.status !== 'Delivered' && PACE_CATALOGUE.includes(order.paceNumber) ? (
                <SelectionCheckbox
                  checked={selected.has(order.id)}
                  disabled={pending}
                  label={`Select PACE #${String(order.paceNumber)} order for ${student.fullName}`}
                  onPress={() => {
                    onSelectionChange(
                      selected.has(order.id)
                        ? selectedOrderIds.filter((id) => id !== order.id)
                        : [...selectedOrderIds, order.id],
                    );
                  }}
                />
              ) : null}
              <Badge variant={order.status === 'Delivered' ? 'success' : 'blue'}>
                {order.status === 'InTransit' ? 'In transit' : order.status}
              </Badge>
            </View>
            <Text style={styles.title}>PACE #{String(order.paceNumber)}</Text>
            <MutedText>
              {assignment
                ? `${assignment.subject.code} · ${assignment.subject.name}`
                : 'Assigned subject'}{' '}
              · {dateFormatter.format(new Date(order.orderedAt))}
            </MutedText>
            {order.status !== 'Delivered' && PACE_CATALOGUE.includes(order.paceNumber) ? (
              <MobileButton
                compact
                disabled={pending}
                label={order.status === 'Ordered' ? 'Mark in transit' : 'Mark delivered'}
                onPress={() => {
                  onAdvance(order);
                }}
                variant="blue"
              />
            ) : order.status !== 'Delivered' ? (
              <MutedText>
                PACE order is outside the supported range and cannot be delivered.
              </MutedText>
            ) : null}
          </View>
        );
      })}
      {query.data?.rows.length === 0 ? <MutedText>No orders in this status.</MutedText> : null}
      {query.data ? (
        <InventoryMobilePagination
          label="Orders"
          onPageChange={setPage}
          page={page}
          pageSize={pageSize}
          total={query.data.totalRows}
        />
      ) : null}
    </View>
  );
}

export function InventoryOrderList({
  onAdvance,
  onSelectionChange,
  orders,
  pending,
  selectedOrderIds,
  students,
  summary,
}: {
  onAdvance: (order: Order) => void;
  onSelectionChange: (ids: string[]) => void;
  orders: Summary['orders'];
  pending: boolean;
  selectedOrderIds: readonly string[];
  students: Student[];
  summary: Pick<Summary, 'orderCountsByStudent'>;
}) {
  const [filter, setFilter] = useState<Filter>('Outstanding');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const counts = summary.orderCountsByStudent;
  const countForStudent = (studentId: string) => countForStatus(counts, studentId, filter);
  const matching = students
    .filter(
      (student) =>
        student.fullName.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
        countForStudent(student.id) > 0,
    )
    .sort(
      (left, right) =>
        left.fullName.localeCompare(right.fullName) || left.id.localeCompare(right.id),
    );
  const matchingStudentIds = new Set(matching.map((student) => student.id));
  const matchingIds = orders
    .filter(
      (order) =>
        matchingStudentIds.has(order.studentId) &&
        order.status !== 'Delivered' &&
        PACE_CATALOGUE.includes(order.paceNumber) &&
        (filter === 'Outstanding' || order.status === filter),
    )
    .map((order) => order.id);
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Tracked orders</Text>
      <Field
        label="Find child"
        onChangeText={(value) => {
          setSearch(value);
          setPage(1);
          setOpenStudentId(null);
          onSelectionChange([]);
        }}
        value={search}
      />
      <View accessibilityLabel="Order status" accessibilityRole="tablist" style={styles.filters}>
        {filters.map((status) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === status, disabled: pending }}
            disabled={pending}
            key={status}
            onPress={() => {
              setFilter(status);
              setPage(1);
              setOpenStudentId(null);
              onSelectionChange([]);
            }}
            style={[styles.filter, filter === status ? styles.filterSelected : null]}
          >
            <Text style={styles.filterText}>{status === 'InTransit' ? 'In transit' : status}</Text>
          </Pressable>
        ))}
      </View>
      {matchingIds.length > 0 ? (
        <MobileButton
          disabled={pending}
          label={`Select all ${String(matchingIds.length)} matching orders`}
          onPress={() => {
            onSelectionChange(matchingIds);
          }}
          variant="secondary"
        />
      ) : null}
      {matching.length === 0 ? <MutedText>No orders match this view.</MutedText> : null}
      {matching.slice((page - 1) * pageSize, page * pageSize).map((student) => {
        const open = openStudentId === student.id;
        const childIds = orders
          .filter(
            (order) =>
              order.studentId === student.id &&
              order.status !== 'Delivered' &&
              PACE_CATALOGUE.includes(order.paceNumber) &&
              (filter === 'Outstanding' || order.status === filter),
          )
          .map((order) => order.id);
        return (
          <View key={student.id} style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => {
                setOpenStudentId(open ? null : student.id);
              }}
              style={styles.groupTrigger}
            >
              <Text style={styles.title}>{student.fullName}</Text>
              <Text style={styles.subtle}>
                {String(countForStudent(student.id))} shown ·{' '}
                {String(countForStatus(counts, student.id, 'Ordered'))} ordered ·{' '}
                {String(countForStatus(counts, student.id, 'InTransit'))} in transit ·{' '}
                {String(countForStatus(counts, student.id, 'Delivered'))} delivered ·{' '}
                {open ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
            {open ? (
              <StudentOrders
                allChildIds={childIds}
                filter={filter}
                onAdvance={onAdvance}
                onSelectionChange={onSelectionChange}
                pageSize={pageSize}
                pending={pending}
                selectedOrderIds={selectedOrderIds}
                student={student}
              />
            ) : null}
          </View>
        );
      })}
      <InventoryMobilePagination
        label="Children"
        onPageChange={(next) => {
          setPage(next);
          setOpenStudentId(null);
        }}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
          setOpenStudentId(null);
        }}
        page={page}
        pageSize={pageSize}
        total={matching.length}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
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
  checkboxRow: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 8, minHeight: 44 },
  childBody: { gap: 10, padding: 12 },
  error: { color: C.danger },
  filter: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    padding: 8,
    width: '48%',
  },
  filterSelected: { backgroundColor: C.blueLight, borderColor: C.blue },
  filterText: { color: C.navy, fontSize: 13, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { borderColor: C.border, borderRadius: 8, borderWidth: 1 },
  groupTrigger: { gap: 4, minHeight: 54, padding: 12 },
  orderRow: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  subtle: { color: C.textSecondary, fontSize: 12 },
  title: { color: C.navy, fontSize: 14, fontWeight: '800' },
});
