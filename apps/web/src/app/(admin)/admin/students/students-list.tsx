'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { api, type RouterOutputs } from '@/lib/trpc';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { TextInput } from '@/components/ui/field';

type StudentRow = RouterOutputs['childLog']['listAccessibleStudents'][number];

export function StudentsList() {
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState<string | undefined>(undefined);
  const studentsQuery = api.childLog.listAccessibleStudents.useQuery(undefined, { retry: false });

  const students = useMemo(() => {
    const rows = studentsQuery.data ?? [];
    if (!search) return rows;
    const query = search.toLowerCase();
    return rows.filter((student) => student.fullName.toLowerCase().includes(query));
  }, [search, studentsQuery.data]);
  const columns = useMemo<readonly DataTableColumn<StudentRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
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
            {student.active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        render: (student) => (
          <Link className="button button--secondary button--sm" href={`/admin/students/${student.id}`}>
            Open
          </Link>
        ),
      },
    ],
    [],
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
      </div>

      <div className="panel panel--scroll">
        <DataTable
          columns={columns}
          empty={
            <EmptyState detail="Create the first student or adjust the search." title="No students found" />
          }
          errorMessage={studentsQuery.error?.message}
          getRowKey={(student) => student.id}
          loading={studentsQuery.isLoading}
          loadingLabel="Loading students..."
          rows={students}
        />
      </div>
    </section>
  );
}
