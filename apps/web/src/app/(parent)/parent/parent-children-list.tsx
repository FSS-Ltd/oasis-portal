'use client';

import Link from 'next/link';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

type ChildRow = RouterOutputs['childLog']['listAccessibleStudents'][number];

const columns: readonly DataTableColumn<ChildRow>[] = [
  {
    id: 'student',
    header: 'Child',
    render: (student) => (
      <div className="student-row">
        <Avatar className="student-row__avatar" name={student.fullName} />
        <span className="student-row__text">
          <strong>{student.fullName}</strong>
          <span>Enrolled {student.enrolmentDate}</span>
        </span>
      </div>
    ),
  },
  { id: 'year', header: 'Year', render: (student) => student.yearGroup },
  {
    id: 'status',
    header: 'Status',
    render: (student) => (
      <Badge tone={student.active ? 'green' : 'amber'}>
        {student.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    header: <span className="sr-only">Actions</span>,
    render: (student) => (
      <Link className="button button--secondary button--sm" href={`/parent/children/${student.id}`}>
        View
      </Link>
    ),
  },
];

export function ParentChildrenList() {
  const childrenQuery = api.childLog.listAccessibleStudents.useQuery(undefined, { retry: false });
  const children = childrenQuery.data ?? [];

  return (
    <div className="panel panel--scroll">
      <DataTable
        columns={columns}
        empty={
          <EmptyState
            detail="Ask the Head of Centre to link your child to this account."
            title="No linked children found"
          />
        }
        errorMessage={childrenQuery.error?.message}
        getRowKey={(student) => student.id}
        loading={childrenQuery.isLoading}
        loadingLabel="Loading linked children..."
        rows={children}
      />
    </div>
  );
}
