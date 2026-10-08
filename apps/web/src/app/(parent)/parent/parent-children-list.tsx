'use client';

import Link from 'next/link';
import { displaySchoolYearLabel } from '@oasis/domain';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

type ChildRow = RouterOutputs['childLog']['listAccessibleStudents'][number];
type ParentChildrenListVariant = 'parent' | 'admin' | 'supervisor';

const CHILDREN_LIST_CONFIG = {
  admin: {
    emptyDetail: 'Ask the Head of Centre to link children to this account.',
    routePrefix: '/admin/children',
  },
  parent: {
    emptyDetail: 'Ask the Head of Centre to link your child to this account.',
    routePrefix: '/parent/children',
  },
  supervisor: {
    emptyDetail: 'Ask the Head of Centre to link children to this account.',
    routePrefix: '/supervisor/children',
  },
} as const satisfies Record<
  ParentChildrenListVariant,
  { emptyDetail: string; routePrefix: string }
>;

const columns: readonly DataTableColumn<ChildRow>[] = [
  {
    id: 'student',
    header: 'Child',
    render: (student) => (
      <div className="student-row">
        <Avatar className="student-row__avatar" name={student.fullName} />
        <span className="student-row__text">
          <strong>{student.fullName}</strong>
          <span>Joined Oasis {student.enrolmentDate}</span>
        </span>
      </div>
    ),
  },
  { id: 'year', header: 'Year', render: (student) => displaySchoolYearLabel(student.yearGroup) },
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

function linkedChildColumns(routePrefix: string): readonly DataTableColumn<ChildRow>[] {
  return columns.map((column) => {
    if (column.id !== 'actions') return column;
    return {
      ...column,
      render: (student: ChildRow) => (
        <Link
          className="button button--secondary button--sm"
          href={{ pathname: `${routePrefix}/${student.id}` }}
        >
          View
        </Link>
      ),
    };
  });
}

interface ParentChildrenListProps {
  variant?: ParentChildrenListVariant | undefined;
}

export function ParentChildrenList({ variant = 'parent' }: ParentChildrenListProps) {
  const config = CHILDREN_LIST_CONFIG[variant];
  const childrenQuery = api.childLog.listAccessibleStudents.useQuery(
    { linkedOnly: true },
    { retry: false },
  );
  const children = childrenQuery.data ?? [];

  return (
    <div className="panel panel--scroll">
      <DataTable
        columns={linkedChildColumns(config.routePrefix)}
        empty={<EmptyState detail={config.emptyDetail} title="No linked children found" />}
        errorMessage={childrenQuery.error ? friendlyErrorMessage(childrenQuery.error) : undefined}
        getRowKey={(student) => student.id}
        loading={childrenQuery.isLoading}
        loadingLabel="Loading linked children..."
        rows={children}
      />
    </div>
  );
}
