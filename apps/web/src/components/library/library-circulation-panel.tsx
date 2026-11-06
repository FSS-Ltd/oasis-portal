'use client';

import { useState } from 'react';
import type { LibraryCirculationPageInput } from '@oasis/domain';
import { api } from '@/lib/trpc';
import { LibraryLoanTable } from './library-loan-table';
import { LibraryPagination } from './library-pagination';

type Status = LibraryCirculationPageInput['status'];
const emptyLabels: Record<Status, string> = {
  Open: 'No books are currently checked out.',
  Overdue: 'No overdue books. Books due today remain in Checked Out.',
  Returned: 'Returned books will appear here.',
  All: 'No borrowing records for this student.',
};

export function LibraryCirculationPanel({
  status,
  studentId,
  bookId,
}: {
  status: Status;
  studentId?: string;
  bookId?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const records = api.library.circulationPage.useQuery({ status, page, search, studentId, bookId });
  const utils = api.useUtils();
  const checkin = api.library.checkin.useMutation({
    onSuccess: async () => {
      setMessage('Selected loan returned. Other loans remain unchanged.');
      if (records.data?.items.length === 1 && page > 1) setPage(page - 1);
      await utils.library.invalidate();
    },
  });
  return (
    <div className="library-records">
      <label className="field library-record-search">
        <span className="field__label">Search books in these records</span>
        <input
          value={search}
          placeholder="Title, author, or barcode"
          maxLength={200}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </label>
      {message ? (
        <p className="library-status" role="status">
          {message}
        </p>
      ) : null}
      {checkin.error ? (
        <p className="status--error" role="alert">
          {checkin.error.message}
        </p>
      ) : null}
      {records.isLoading ? (
        <p role="status">Loading loans…</p>
      ) : records.error ? (
        <div role="alert">
          <p className="status--error">Library loans could not be loaded.</p>
          <button
            type="button"
            className="button button--secondary button--sm"
            onClick={() => void records.refetch()}
          >
            Try again
          </button>
        </div>
      ) : records.data?.items.length ? (
        <LibraryLoanTable
          loans={records.data.items}
          returningLoanId={checkin.isPending ? (checkin.variables.loanId ?? null) : null}
          onReturn={(loan) => {
            setMessage(null);
            checkin.mutate(
              { barcode: loan.book.barcode, loanId: loan.id },
              {
                onSuccess: () => {
                  setMessage(`${loan.book.title} returned for ${loan.student.name}.`);
                },
              },
            );
          }}
        />
      ) : (
        <p className="library-empty">
          {search ? 'No books match this search.' : emptyLabels[status]}
        </p>
      )}
      <LibraryPagination
        label="Loan pages"
        page={page}
        nextPage={records.data?.nextPage}
        pending={records.isFetching || checkin.isPending}
        onPage={setPage}
      />
    </div>
  );
}
