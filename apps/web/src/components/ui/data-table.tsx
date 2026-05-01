'use client';

import type { Key, ReactNode } from 'react';
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
  getRowKey: (row: T) => Key;
  loading?: boolean;
  loadingLabel?: string | undefined;
  rows: readonly T[];
  tableClassName?: string | undefined;
}

function stateNode(content: ReactNode, className?: string): ReactNode {
  if (typeof content === 'string') return <div className={cn('empty-state', className)}>{content}</div>;
  return content;
}

export function DataTable<T>({
  animateRows = true,
  className,
  columns,
  empty,
  errorMessage,
  getRowKey,
  loading = false,
  loadingLabel,
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
      <table className={cn('table', tableClassName)}>
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
            const cells = columns.map((column) => (
              <td className={column.className} key={column.id}>
                {column.render(row)}
              </td>
            ));

            return animateRows ? (
              <MotionTableRow key={getRowKey(row)}>{cells}</MotionTableRow>
            ) : (
              <tr key={getRowKey(row)}>{cells}</tr>
            );
          })}
        </tbody>
      </table>
    );

    content = animateRows ? <MotionList>{table}</MotionList> : table;
  }

  return className ? <div className={className}>{content}</div> : content;
}
