'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PACE_CATALOGUE } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';
import { api } from '@/lib/trpc';
import { friendlyErrorMessage, showSuccessToast } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { InventoryPagination } from './pace-inventory-navigation';
import { PaceInventoryOrderList } from './pace-inventory-order-list';

type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryStudent = InventorySummary['students'][number];
type InventoryOrder = RouterOutputs['academicInventory']['ordersForStudent']['rows'][number];
type OrderFilter = 'Outstanding' | 'Ordered' | 'InTransit' | 'Delivered';
const orderFilters: readonly OrderFilter[] = ['Outstanding', 'Ordered', 'InTransit', 'Delivered'];

function countForStatus(
  counts: InventorySummary['orderCountsByStudent'],
  studentId: string,
  status: OrderFilter,
): number {
  return counts
    .filter(
      (row) =>
        row.studentId === studentId &&
        (status === 'Outstanding' ? row.status !== 'Delivered' : row.status === status),
    )
    .reduce((total, row) => total + row._count._all, 0);
}

function OrderGroup({
  count,
  counts,
  filter,
  onAdvance,
  onSelectionChange,
  open,
  pageSize,
  pending,
  selectedOrderIds,
  student,
  toggle,
  allChildIds,
}: {
  allChildIds: string[];
  count: number;
  counts: InventorySummary['orderCountsByStudent'];
  filter: OrderFilter;
  onAdvance: (order: InventoryOrder, status: 'InTransit' | 'Delivered') => void;
  onSelectionChange: (ids: string[]) => void;
  open: boolean;
  pageSize: number;
  pending: boolean;
  selectedOrderIds: readonly string[];
  student: InventoryStudent;
  toggle: () => void;
}) {
  const [page, setPage] = useState(1);
  const orders = api.academicInventory.ordersForStudent.useQuery(
    { studentId: student.id, status: filter, page, pageSize },
    { enabled: open, retry: false },
  );
  useEffect(() => {
    if (!orders.data) return;
    const lastPage = Math.max(1, Math.ceil(orders.data.totalRows / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [orders.data, page, pageSize]);
  const selected = new Set(selectedOrderIds);
  const allChildSelected = allChildIds.length > 0 && allChildIds.every((id) => selected.has(id));
  return (
    <div className="pace-inventory-order-group">
      <button
        aria-controls={`pace-order-group-${student.id}`}
        aria-expanded={open}
        className="pace-inventory-order-group__trigger"
        onClick={toggle}
        type="button"
      >
        <strong>{student.fullName}</strong>
        <span>
          {String(count)} shown · {String(countForStatus(counts, student.id, 'Ordered'))} ordered ·{' '}
          {String(countForStatus(counts, student.id, 'InTransit'))} in transit ·{' '}
          {String(countForStatus(counts, student.id, 'Delivered'))} delivered ·{' '}
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open ? (
        <div className="pace-inventory-order-group__body" id={`pace-order-group-${student.id}`}>
          {allChildIds.length > 0 ? (
            <label className="pace-order-selection__all">
              <input
                aria-label={`Select all matching orders for ${student.fullName}`}
                checked={allChildSelected}
                disabled={pending}
                onChange={(event) => {
                  onSelectionChange(
                    event.target.checked
                      ? [...new Set([...selectedOrderIds, ...allChildIds])]
                      : selectedOrderIds.filter((id) => !allChildIds.includes(id)),
                  );
                }}
                type="checkbox"
              />
              Select all {String(allChildIds.length)} eligible for this child
            </label>
          ) : null}
          {orders.isLoading ? <p role="status">Loading orders…</p> : null}
          {orders.error ? <p role="alert">{friendlyErrorMessage(orders.error)}</p> : null}
          {orders.data ? (
            <>
              <PaceInventoryOrderList
                onAdvance={onAdvance}
                onSelectionChange={onSelectionChange}
                orders={orders.data.rows}
                pending={pending}
                selectedOrderIds={selectedOrderIds}
                student={student}
              />
              <InventoryPagination
                label={`${student.fullName} orders`}
                onPageChange={setPage}
                page={page}
                pageSize={pageSize}
                total={orders.data.totalRows}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PaceInventoryOrders({
  invalidateInventory,
  refreshSummary,
  summary,
}: {
  invalidateInventory: () => Promise<void>;
  refreshSummary: () => Promise<unknown>;
  summary: InventorySummary | undefined;
}) {
  const utils = api.useUtils();
  const [filter, setFilter] = useState<OrderFilter>('Outstanding');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const students = summary?.students ?? [];
  const counts = summary?.orderCountsByStudent ?? [];
  const eligibleOrders = (summary?.orders ?? []).filter(
    (order) => order.status !== 'Delivered' && PACE_CATALOGUE.includes(order.paceNumber),
  );
  const eligibleById = new Map(eligibleOrders.map((order) => [order.id, order]));

  useEffect(() => {
    if (!summary) return;
    const eligible = new Set(
      summary.orders.filter((order) => order.status !== 'Delivered').map((order) => order.id),
    );
    setSelectedOrderIds((current) => current.filter((id) => eligible.has(id)));
  }, [summary]);

  const updateOne = api.academicInventory.updateOrderStatus.useMutation({
    async onSuccess(_, input) {
      setSelectedOrderIds((current) => current.filter((id) => id !== input.orderId));
      showSuccessToast(
        `Order marked ${input.status === 'InTransit' ? 'in transit' : 'delivered'}.`,
      );
      await invalidateInventory();
    },
    onError(error) {
      setErrorMessage(friendlyErrorMessage(error));
      void Promise.all([refreshSummary(), utils.academicInventory.ordersForStudent.invalidate()]);
    },
  });
  const markTransit = api.academicInventory.markOrdersInTransit.useMutation({
    async onSuccess(result, input) {
      setSelectedOrderIds((current) => current.filter((id) => !input.orderIds.includes(id)));
      setErrorMessage(null);
      showSuccessToast(`${String(result.count)} orders marked in transit.`);
      await invalidateInventory();
    },
    onError(error) {
      setErrorMessage(friendlyErrorMessage(error));
      void Promise.all([refreshSummary(), utils.academicInventory.ordersForStudent.invalidate()]);
    },
  });
  const markDelivered = api.academicInventory.markOrdersDelivered.useMutation({
    async onSuccess(result, input) {
      setSelectedOrderIds((current) => current.filter((id) => !input.orderIds.includes(id)));
      setErrorMessage(null);
      showSuccessToast(`${String(result.count)} orders marked delivered.`);
      await invalidateInventory();
    },
    onError(error) {
      setErrorMessage(friendlyErrorMessage(error));
      void Promise.all([refreshSummary(), utils.academicInventory.ordersForStudent.invalidate()]);
    },
  });
  const pending = updateOne.isPending || markTransit.isPending || markDelivered.isPending;
  const matchingStudents = students
    .filter(
      (student) =>
        student.fullName.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
        countForStatus(counts, student.id, filter) > 0,
    )
    .sort(
      (left, right) =>
        left.fullName.localeCompare(right.fullName) || left.id.localeCompare(right.id),
    );
  const matchingIds = new Set(matchingStudents.map((student) => student.id));
  const matchingEligibleIds = eligibleOrders
    .filter(
      (order) =>
        matchingIds.has(order.studentId) && (filter === 'Outstanding' || order.status === filter),
    )
    .map((order) => order.id);
  const selectedTransit = selectedOrderIds.filter(
    (id) => eligibleById.get(id)?.status === 'Ordered',
  );
  const selectedDelivery = selectedOrderIds.filter(
    (id) => eligibleById.get(id)?.status === 'InTransit',
  );
  const shownStudents = matchingStudents.slice((page - 1) * pageSize, page * pageSize);

  function changeFilter(value: OrderFilter): void {
    setFilter(value);
    setPage(1);
    setOpenStudentId(null);
    setSelectedOrderIds([]);
    setErrorMessage(null);
  }

  return (
    <section
      aria-labelledby="pace-orders-title"
      className="panel pace-inventory__secondary pace-inventory-orders"
    >
      <div className="panel__body">
        <div className="section-title">
          <div>
            <h2 id="pace-orders-title">Tracked orders</h2>
            <p className="muted">Orders grouped by child.</p>
          </div>
          <Button
            onClick={() => {
              void refreshSummary();
              void utils.academicInventory.ordersForStudent.invalidate();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={14} /> Refresh
          </Button>
        </div>
        <div className="pace-inventory-orders__filters">
          <Field label="Find child">
            <TextInput
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setOpenStudentId(null);
                setSelectedOrderIds([]);
              }}
              value={search}
            />
          </Field>
          <Field label="Order status">
            <SelectInput
              disabled={pending}
              onChange={(event) => {
                changeFilter(event.target.value as OrderFilter);
              }}
              value={filter}
            >
              {orderFilters.map((status) => (
                <option key={status} value={status}>
                  {status === 'InTransit' ? 'In transit' : status}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        {matchingEligibleIds.length > 0 ? (
          <Button
            disabled={pending}
            onClick={() => {
              setSelectedOrderIds(matchingEligibleIds);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Select all {String(matchingEligibleIds.length)} matching orders
          </Button>
        ) : null}
        {matchingStudents.length === 0 ? (
          <p className="empty-state">No orders match this view.</p>
        ) : null}
        {shownStudents.map((student) => {
          const childIds = eligibleOrders
            .filter(
              (order) =>
                order.studentId === student.id &&
                (filter === 'Outstanding' || order.status === filter),
            )
            .map((order) => order.id);
          return (
            <OrderGroup
              allChildIds={childIds}
              count={countForStatus(counts, student.id, filter)}
              counts={counts}
              filter={filter}
              key={student.id}
              onAdvance={(order, status) => {
                setErrorMessage(null);
                updateOne.mutate({ orderId: order.id, status });
              }}
              onSelectionChange={setSelectedOrderIds}
              open={openStudentId === student.id}
              pageSize={pageSize}
              pending={pending}
              selectedOrderIds={selectedOrderIds}
              student={student}
              toggle={() => {
                setOpenStudentId((current) => (current === student.id ? null : student.id));
              }}
            />
          );
        })}
        <InventoryPagination
          label="Children with orders"
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
          total={matchingStudents.length}
        />
      </div>
      {selectedOrderIds.length > 0 || errorMessage ? (
        <div aria-live="polite" className="pace-inventory-bulk-bar">
          <strong>{String(selectedOrderIds.length)} selected</strong>
          <Button
            disabled={pending}
            onClick={() => {
              setSelectedOrderIds([]);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
          <Button
            disabled={pending || selectedTransit.length === 0}
            onClick={() => {
              markTransit.mutate({ orderIds: selectedTransit });
            }}
            pending={markTransit.isPending}
            size="sm"
            type="button"
          >
            Mark {String(selectedTransit.length)} in transit
          </Button>
          <Button
            disabled={pending || selectedDelivery.length === 0}
            onClick={() => {
              markDelivered.mutate({ orderIds: selectedDelivery });
            }}
            pending={markDelivered.isPending}
            size="sm"
            type="button"
            variant="secondary"
          >
            Mark {String(selectedDelivery.length)} delivered
          </Button>
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
