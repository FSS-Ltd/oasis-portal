'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { friendlyErrorMessage } from '@/lib/notifications';
import { api, type RouterOutputs } from '@/lib/trpc';
import {
  DailyDemeritBadge,
  useDailyDemeritStatusMap,
} from '@/components/behaviour/daily-demerit-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { TextInput } from '@/components/ui/field';

type AccessibleStudentRow = RouterOutputs['childLog']['listAccessibleStudents'][number];
type ManagedStudentRow = RouterOutputs['student']['list'][number];
type StudentDirectoryRow = Pick<
  ManagedStudentRow | AccessibleStudentRow,
  'active' | 'fullName' | 'id' | 'subjects' | 'yearGroup'
> & {
  enrolmentDate: Date | string;
};

type StudentStatusFilter = 'active' | 'archived' | 'all';

interface StudentsListProps {
  canManageStudents: boolean;
}

const statusFilters: readonly { id: StudentStatusFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];

const studentDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatStudentDate(value: Date | string): string {
  if (typeof value === 'string') return value;
  return studentDateFormatter.format(value);
}

export function StudentsList({ canManageStudents }: StudentsListProps) {
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>('active');
  const activeStudentsQuery = api.childLog.listAccessibleStudents.useQuery(undefined, {
    enabled: !canManageStudents,
    retry: false,
  });
  const managedStudentsQuery = api.student.list.useQuery(
    { includeInactive: true },
    { enabled: canManageStudents, retry: false },
  );
  const [today] = useState(
    () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`),
  );
  const demeritStatusQuery = useDailyDemeritStatusMap(today);
  const rows = (canManageStudents ? managedStudentsQuery.data : activeStudentsQuery.data) as
    | readonly StudentDirectoryRow[]
    | undefined;
  const loading = canManageStudents
    ? managedStudentsQuery.isLoading
    : activeStudentsQuery.isLoading;
  const errorMessage = canManageStudents
    ? managedStudentsQuery.error
      ? friendlyErrorMessage(managedStudentsQuery.error)
      : undefined
    : activeStudentsQuery.error
      ? friendlyErrorMessage(activeStudentsQuery.error)
      : undefined;

  const students = useMemo(() => {
    const availableRows = rows ?? [];
    const query = search?.toLowerCase() ?? '';
    return availableRows.filter((student) => {
      const matchesSearch = !search || student.fullName.toLowerCase().includes(query);
      const matchesStatus =
        !canManageStudents ||
        statusFilter === 'all' ||
        (statusFilter === 'active' && student.active) ||
        (statusFilter === 'archived' && !student.active);
      return matchesSearch && matchesStatus;
    });
  }, [canManageStudents, rows, search, statusFilter]);
  const columns = useMemo<readonly DataTableColumn<StudentDirectoryRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        render: (student) => (
          <div className="student-row">
            <Avatar className="student-row__avatar" name={student.fullName} />
            <span className="student-row__text">
              <strong>{student.fullName}</strong>
              <span>Joined Oasis {formatStudentDate(student.enrolmentDate)}</span>
            </span>
            <DailyDemeritBadge status={demeritStatusQuery.statusByStudentId.get(student.id)} />
          </div>
        ),
      },
      {
        id: 'year',
        header: 'Year',
        render: (student) => displaySchoolYearLabel(student.yearGroup),
      },
      {
        id: 'subjects',
        header: 'Subjects',
        render: (student) => (
          <div className="badge-list">
            {student.subjects.length > 0 ? (
              student.subjects.map((subject) => (
                <Badge key={subject.subjectId}>{subject.code}</Badge>
              ))
            ) : (
              <span className="muted">None assigned</span>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        render: (student) => (
          <Badge tone={student.active ? 'green' : 'amber'}>
            {student.active ? 'Active' : 'Archived'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        render: (student) => (
          <Link
            className="button button--secondary button--sm"
            href={`/admin/students/${student.id}`}
          >
            Open
          </Link>
        ),
      },
    ],
    [demeritStatusQuery.statusByStudentId],
  );

  return (
    <section>
      <div className="toolbar">
        <form
          className="toolbar__search"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draftSearch.trim();
            setSearch(value.length > 0 ? value : undefined);
          }}
        >
          <TextInput
            aria-label="Search students by name"
            onChange={(event) => {
              setDraftSearch(event.target.value);
            }}
            placeholder="Search students"
            value={draftSearch}
          />
          <Button type="submit" variant="secondary">
            <Search aria-hidden="true" size={16} />
            Search
          </Button>
        </form>
        {search ? (
          <Button
            onClick={() => {
              setDraftSearch('');
              setSearch(undefined);
            }}
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
        {canManageStudents ? (
          <div className="toolbar__filters" role="tablist">
            {statusFilters.map((option) => (
              <button
                aria-selected={statusFilter === option.id}
                className={statusFilter === option.id ? 'is-selected' : undefined}
                key={option.id}
                onClick={() => {
                  setStatusFilter(option.id);
                }}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel panel--scroll">
        <DataTable
          columns={columns}
          empty={
            <EmptyState
              detail="Create the first student or adjust the search."
              title="No students found"
            />
          }
          errorMessage={errorMessage}
          getRowKey={(student) => student.id}
          loading={loading}
          loadingLabel="Loading students..."
          rows={students}
        />
      </div>
    </section>
  );
}
