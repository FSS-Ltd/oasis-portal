'use client';

import { displaySchoolYearLabel } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';

type Loan = RouterOutputs['library']['circulationPage']['items'][number];
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const returnedFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Europe/London',
});

export function LibraryLoanTable({
  loans,
  onReturn,
  returningLoanId,
}: {
  loans: readonly Loan[];
  onReturn: (loan: Loan) => void;
  returningLoanId: string | null;
}) {
  return (
    <div
      className="library-table-scroll"
      role="region"
      aria-label="Library loan records"
      tabIndex={0}
    >
      <table className="library-loan-table">
        <caption className="sr-only">
          Book loans with borrowers, checkout dates, due dates and return status
        </caption>
        <thead>
          <tr>
            <th scope="col">Book</th>
            <th scope="col">Student</th>
            <th scope="col">Checked out</th>
            <th scope="col">Due</th>
            <th scope="col">Status / return</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id}>
              <th scope="row">
                <strong>{loan.book.title}</strong>
                <small>
                  {loan.book.author} · {loan.book.barcode}
                </small>
              </th>
              <td>
                <strong>{loan.student.name}</strong>
                <small>{displaySchoolYearLabel(loan.student.yearGroup)}</small>
              </td>
              <td>{returnedFormat.format(loan.checkedOutAt)}</td>
              <td>{dateFormat.format(loan.dueOn)}</td>
              <td>
                <span
                  className={`library-due ${loan.status === 'Overdue' ? 'library-due--overdue' : ''}`}
                >
                  {loan.status}
                </span>
                {loan.returnedAt ? (
                  <small>{returnedFormat.format(loan.returnedAt)}</small>
                ) : (
                  <button
                    className="button button--secondary button--sm"
                    type="button"
                    aria-label={`Mark ${loan.book.title} returned for ${loan.student.name}`}
                    disabled={returningLoanId !== null}
                    onClick={() => {
                      onReturn(loan);
                    }}
                  >
                    {returningLoanId === loan.id ? 'Returning…' : 'Mark returned'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
