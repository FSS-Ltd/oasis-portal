'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { api, type RouterOutputs } from '@/lib/trpc';

type ArchivedStudentRow = RouterOutputs['student']['list'][number];

function formatDate(value: Date | string | null): string {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function ArchivedStudentsClient() {
  const utils = api.useUtils();
  const archivedQuery = api.student.list.useQuery(
    { archivedOnly: true, includeInactive: true },
    { retry: false },
  );
  const restoreStudent = api.admin.restoreArchivedStudent.useMutation({
    async onSuccess() {
      await Promise.all([
        utils.student.list.invalidate(),
        utils.childLog.listAccessibleStudents.invalidate(),
      ]);
    },
  });

  const columns: readonly DataTableColumn<ArchivedStudentRow>[] = [
    {
      id: 'student',
      header: 'Student',
      render: (student) => (
        <div className="student-row">
          <Avatar className="student-row__avatar" name={student.fullName} />
          <span className="student-row__text">
            <strong>{student.fullName}</strong>
            <span>Enrolled {formatDate(student.enrolmentDate)}</span>
          </span>
        </div>
      ),
    },
    {
      id: 'year',
      header: 'Year',
      render: (student) => displaySchoolYearLabel(student.yearGroup),
    },
    {
      id: 'archived',
      header: 'Archived',
      render: (student) => formatDate(student.archivedAt),
    },
    {
      id: 'status',
      header: 'Status',
      render: () => <Badge tone="grey">Archived</Badge>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (student) => (
        <div className="archive-actions">
          <Link
            className="button button--secondary button--sm"
            href={`/admin/students/${student.id}`}
          >
            Open
          </Link>
          <Button
            onClick={() => {
              restoreStudent.mutate({ studentId: student.id });
            }}
            pending={restoreStudent.isPending}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RotateCcw aria-hidden="true" size={14} />
            Restore
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="panel panel--scroll">
      <DataTable
        columns={columns}
        empty={
          <EmptyState
            detail="Archived student profiles will appear here."
            title="No archived students"
          />
        }
        errorMessage={archivedQuery.error?.message ?? restoreStudent.error?.message}
        getRowKey={(student) => student.id}
        loading={archivedQuery.isLoading}
        loadingLabel="Loading archived students..."
        rows={archivedQuery.data ?? []}
      />
    </section>
  );
}
