'use client';

import { useState } from 'react';
import { displaySchoolYearLabel } from '@oasis/domain';
import { api, type RouterOutputs } from '@/lib/trpc';
import { LibraryCirculationPanel } from './library-circulation-panel';
import { LibraryPagination } from './library-pagination';

type Borrower = RouterOutputs['library']['borrowerHistoryPage']['items'][number];

function StudentHistory({ student }: { student: Borrower }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="library-student-record"
      onToggle={(event) => {
        setExpanded(event.currentTarget.open);
      }}
    >
      <summary>
        <span>
          <strong>{student.name}</strong>
          <small>
            {displaySchoolYearLabel(student.yearGroup)}
            {student.active ? '' : ' · Former student'}
          </small>
        </span>
        <span>
          {student.totalLoans} {student.totalLoans === 1 ? 'loan' : 'loans'}
        </span>
      </summary>
      {expanded ? <LibraryCirculationPanel status="All" studentId={student.id} /> : null}
    </details>
  );
}

export function LibraryBorrowingHistory() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const students = api.library.borrowerHistoryPage.useQuery({ page, search });
  return (
    <div className="library-records">
      <form
        className="library-history-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <label className="field">
          <span className="field__label">Find a student by full name</span>
          <input
            maxLength={200}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            placeholder="Exact full name"
          />
        </label>
        <button type="submit" className="button button--secondary button--md">
          Find student
        </button>
        {search ? (
          <button
            type="button"
            className="button button--secondary button--md"
            onClick={() => {
              setDraft('');
              setSearch('');
              setPage(1);
            }}
          >
            Clear
          </button>
        ) : null}
      </form>
      {students.isLoading ? (
        <p role="status">Loading student records…</p>
      ) : students.error ? (
        <div role="alert">
          <p className="status--error">Student records could not be loaded.</p>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={() => void students.refetch()}
          >
            Try again
          </button>
        </div>
      ) : students.data?.items.length ? (
        <div className="library-student-records">
          {students.data.items.map((student) => (
            <StudentHistory key={student.id} student={student} />
          ))}
        </div>
      ) : (
        <p className="library-empty">
          {search
            ? 'No borrowing records match this full name.'
            : 'Student borrowing records will appear here.'}
        </p>
      )}
      <LibraryPagination
        label="Student record pages"
        page={page}
        nextPage={students.data?.nextPage}
        pending={students.isFetching}
        onPage={setPage}
      />
    </div>
  );
}
