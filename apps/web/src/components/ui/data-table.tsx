'use client';

import type { Key, KeyboardEvent, ReactNode } from 'react';
import { MotionList, MotionTableRow } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  className?: string;
  header: ReactNode;
  headerClassName?: string;
  id: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  animateRows?: boolean;
  className?: string | undefined;
  columns: readonly DataTableColumn<T>[];
  empty?: ReactNode;
  errorMessage?: string | undefined;
  getRowClassName?: ((row: T) => string | undefined) | undefined;
  getRowKey: (row: T) => Key;
  loading?: boolean;
  loadingLabel?: string | undefined;
  onRowClick?: ((row: T) => void) | undefined;
  rows: readonly T[];
  tableClassName?: string | undefined;
}

function stateNode(content: ReactNode, className?: string): ReactNode {
  if (typeof content === 'string')
    return <div className={cn('empty-state', className)}>{content}</div>;
  return content;
}

function columnLabel(header: ReactNode): string {
  if (typeof header === 'string' || typeof header === 'number') return String(header);
  return '';
}

export function DataTable<T>({
  animateRows = true,
  className,
  columns,
  empty,
  errorMessage,
  getRowClassName,
  getRowKey,
  loading = false,
  loadingLabel,
  onRowClick,
  rows,
  tableClassName,
}: DataTableProps<T>) {
  let content: ReactNode;

  if (loading) {
    content = stateNode(loadingLabel ?? 'Loading...');
  } else if (errorMessage) {
    content = <div className="empty-state status--error">{errorMessage}</div>;
  } else if (rows.length === 0) {
    content = stateNode(empty ?? 'No rows found');
  } else {
    const table = (
      <table className={cn('table data-table', tableClassName)}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.headerClassName} key={column.id}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowClassName = cn(
              getRowClassName?.(row),
              onRowClick ? 'is-clickable' : undefined,
            );
            const rowProps = onRowClick
              ? {
                  className: rowClassName,
                  onClick: () => {
                    onRowClick(row);
                  },
                  onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onRowClick(row);
                  },
                  role: 'button',
                  tabIndex: 0,
                }
              : { className: rowClassName };
            const cells = columns.map((column) => (
              <td
                className={column.className}
                data-label={columnLabel(column.header)}
                key={column.id}
              >
                {column.render(row)}
              </td>
            ));

            return animateRows ? (
              <MotionTableRow key={getRowKey(row)} {...rowProps}>
                {cells}
              </MotionTableRow>
            ) : (
              <tr key={getRowKey(row)} {...rowProps}>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    content = animateRows ? <MotionList>{table}</MotionList> : table;
  }

  return <div className={cn('table-responsive', className)}>{content}</div>;
}
