'use client';

import { useEffect, useRef } from 'react';
import { Truck } from 'lucide-react';
import type { RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PACE_CATALOGUE } from '@oasis/domain';

type InventorySummary = RouterOutputs['academicInventory']['summary'];
type InventoryOrder = InventorySummary['orders'][number];
type InventoryStudent = InventorySummary['students'][number];
const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

function orderSelectionLabel(order: InventoryOrder, students: InventoryStudent[]): string {
  const student = students.find((row) => row.id === order.studentId);
  const assignment = student?.subjects.find((row) => row.subjectId === order.subjectId);
  return `Select PACE #${String(order.paceNumber)} order for ${student?.fullName ?? 'student'}, ${assignment?.subject.name ?? 'subject'}`;
}

function SelectAllOrders({
  checked,
  disabled,
  mixed,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  mixed: boolean;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="pace-order-selection__all">
      <input
        ref={inputRef}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        type="checkbox"
      />
      Select all
    </label>
  );
}

export function PaceInventoryOrderList({
  onAdvance,
  onMarkSelected,
  onSelectionChange,
  orders,
  pending,
  selectedOrderIds,
  students,
  bulkPending,
}: {
  bulkPending: boolean;
  onAdvance: (order: InventoryOrder, status: 'InTransit' | 'Delivered') => void;
  onMarkSelected: () => void;
  onSelectionChange: (orderIds: string[]) => void;
  orders: InventoryOrder[];
  pending: boolean;
  selectedOrderIds: readonly string[];
  students: InventoryStudent[];
}) {
  const eligibleOrders = orders.filter((order) => order.status === 'Ordered');
  const eligibleIds = eligibleOrders.map((order) => order.id);
  const selectedIds = new Set(selectedOrderIds);
  const selectedCount = eligibleIds.filter((id) => selectedIds.has(id)).length;

  const columns: readonly DataTableColumn<InventoryOrder>[] = [
    {
      id: 'select',
      header: 'Select',
      render: (order) =>
        order.status === 'Ordered' ? (
          <input
            aria-label={orderSelectionLabel(order, students)}
            checked={selectedIds.has(order.id)}
            disabled={pending}
            onChange={(event) => {
              onSelectionChange(
                event.target.checked
                  ? [...selectedOrderIds, order.id]
                  : selectedOrderIds.filter((id) => id !== order.id),
              );
            }}
            type="checkbox"
          />
        ) : (
          '—'
        ),
    },
    {
      id: 'student',
      header: 'Student',
      render: (order) =>
        students.find((row) => row.id === order.studentId)?.fullName ?? 'Unknown student',
    },
    {
      id: 'subject',
      header: 'Subject',
      render: (order) => {
        const student = students.find((row) => row.id === order.studentId);
        const assignment = student?.subjects.find((row) => row.subjectId === order.subjectId);
        return assignment
          ? `${assignment.subject.code} · ${assignment.subject.name}`
          : 'No assigned subject';
      },
    },
    { id: 'pace', header: 'PACE', render: (order) => `PACE #${String(order.paceNumber)}` },
    {
      id: 'status',
      header: 'Status',
      render: (order) => (
        <Badge
          tone={
            order.status === 'Delivered' ? 'green' : order.status === 'InTransit' ? 'blue' : 'grey'
          }
        >
          {order.status}
        </Badge>
      ),
    },
    {
      id: 'ordered',
      header: 'Ordered',
      render: (order) => dateFormatter.format(new Date(order.orderedAt)),
    },
    {
      id: 'action',
      header: 'Next action',
      render: (order) => {
        const nextStatus =
          order.status === 'Ordered'
            ? 'InTransit'
            : order.status === 'InTransit'
              ? 'Delivered'
              : null;
        if (!nextStatus) return 'Complete';
        if (nextStatus === 'Delivered' && !PACE_CATALOGUE.includes(order.paceNumber)) {
          return 'PACE order is outside the supported range and cannot be delivered.';
        }
        return (
          <Button
            disabled={pending}
            onClick={() => {
              onAdvance(order, nextStatus);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Truck aria-hidden="true" size={14} />
            Mark {nextStatus}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <div className="pace-order-selection">
        <SelectAllOrders
          checked={eligibleIds.length > 0 && selectedCount === eligibleIds.length}
          disabled={pending || eligibleIds.length === 0}
          mixed={selectedCount > 0 && selectedCount < eligibleIds.length}
          onChange={(checked) => {
            onSelectionChange(checked ? eligibleIds : []);
          }}
        />
        <span aria-live="polite">
          {String(selectedCount)} {selectedCount === 1 ? 'order' : 'orders'} selected
        </span>
        <Button
          disabled={pending || selectedCount === 0}
          onClick={() => {
            onSelectionChange([]);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Clear selection
        </Button>
        <Button
          disabled={pending || selectedCount === 0}
          onClick={onMarkSelected}
          pending={bulkPending}
          size="sm"
          type="button"
        >
          <Truck aria-hidden="true" size={14} />
          {bulkPending ? 'Marking in transit…' : 'Mark selected in transit'}
        </Button>
      </div>
      <DataTable
        columns={columns}
        empty="No PACE orders have been created yet."
        getRowKey={(order) => order.id}
        rows={orders}
      />
    </>
  );
}
