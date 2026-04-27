'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { api } from '@/lib/trpc';
import { MotionList, MotionTableRow } from '@/components/admin/motion';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';

export function StudentsList() {
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState<string | undefined>(undefined);
  const studentsQuery = api.student.list.useQuery(
    search ? { search } : undefined,
    { retry: false },
  );

  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);

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
            aria-label="Search students by exact name"
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search by exact student name"
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
        {studentsQuery.isLoading ? (
          <div className="empty-state">Loading students...</div>
        ) : studentsQuery.error ? (
          <div className="empty-state status--error">{studentsQuery.error.message}</div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <strong>No students found</strong>
            <span>Create the first student or adjust the exact-name search.</span>
          </div>
        ) : (
          <MotionList>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Year</th>
                  <th>Subjects</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <MotionTableRow key={student.id}>
                    <td>
                      <div className="student-row">
                        <strong>{student.fullName}</strong>
                        <span>DOB {student.dob}</span>
                      </div>
                    </td>
                    <td>{student.yearGroup}</td>
                    <td>
                      <div className="badge-list">
                        {student.subjects.length > 0 ? (
                          student.subjects.map((subject) => (
                            <span className="badge" key={subject.subjectId}>
                              {subject.code}
                            </span>
                          ))
                        ) : (
                          <span className="muted">None assigned</span>
                        )}
                      </div>
                    </td>
                    <td>{student.active ? 'Active' : 'Inactive'}</td>
                    <td>
                      <Link
                        className="button button--secondary button--sm"
                        href={`/admin/students/${student.id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </MotionTableRow>
                ))}
              </tbody>
            </table>
          </MotionList>
        )}
      </div>
    </section>
  );
}
