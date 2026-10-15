'use client';

import { Truck } from 'lucide-react';
import { PACE_CATALOGUE } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

type InventoryOrder = RouterOutputs['academicInventory']['ordersForStudent']['rows'][number];
type InventoryStudent = RouterOutputs['academicInventory']['summary']['students'][number];
const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function PaceInventoryOrderList({
  onAdvance,
  onSelectionChange,
  orders,
  pending,
  selectedOrderIds,
  student,
}: {
  onAdvance: (order: InventoryOrder, status: 'InTransit' | 'Delivered') => void;
  onSelectionChange: (orderIds: string[]) => void;
  orders: InventoryOrder[];
  pending: boolean;
  selectedOrderIds: readonly string[];
  student: InventoryStudent;
}) {
  const selected = new Set(selectedOrderIds);
  const eligible = orders
    .filter((order) => order.status !== 'Delivered' && PACE_CATALOGUE.includes(order.paceNumber))
    .map((order) => order.id);
  const allVisibleSelected = eligible.length > 0 && eligible.every((id) => selected.has(id));
  const columns: readonly DataTableColumn<InventoryOrder>[] = [
    {
      id: 'select',
      header: (
        <label className="pace-order-selection__all">
          <input
            aria-label="Select visible orders"
            checked={allVisibleSelected}
            disabled={pending || eligible.length === 0}
            onChange={(event) => {
              onSelectionChange(
                event.target.checked
                  ? [...new Set([...selectedOrderIds, ...eligible])]
                  : selectedOrderIds.filter((id) => !eligible.includes(id)),
              );
            }}
            type="checkbox"
          />
          Page
        </label>
      ),
      render: (order) =>
        order.status === 'Delivered' || !PACE_CATALOGUE.includes(order.paceNumber) ? (
          '—'
        ) : (
          <input
            aria-label={`Select PACE #${String(order.paceNumber)} order for ${student.fullName}`}
            checked={selected.has(order.id)}
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
        ),
    },
    {
      id: 'subject',
      header: 'Subject',
      render: (order) => {
        const assignment = student.subjects.find((row) => row.subjectId === order.subjectId);
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
          {order.status === 'InTransit' ? 'In transit' : order.status}
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
        if (!PACE_CATALOGUE.includes(order.paceNumber)) {
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
            <Truck aria-hidden="true" size={14} /> Mark{' '}
            {nextStatus === 'InTransit' ? 'in transit' : 'delivered'}
          </Button>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      empty="No orders in this status."
      getRowKey={(order) => order.id}
      rows={orders}
    />
  );
}
