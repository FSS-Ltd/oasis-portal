'use client';

import { api } from '@/lib/trpc';

function dueLabel(dueOn: Date, today: string): string {
  const due = dueOn.toISOString().slice(0, 10);
  if (due < today) return 'Overdue';
  if (due === today) return 'Due today';
  return `Due ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(dueOn)}`;
}

export function ParentLibraryClient() {
  const summary = api.library.parentSummary.useQuery(undefined, { retry: false });
  if (summary.isLoading) return <p>Loading library…</p>;
  if (summary.error || !summary.data)
    return <p className="status--error">Library records are unavailable.</p>;
  return (
    <div className="parent-library">
      <header>
        <p className="eyebrow">Library</p>
        <h1>Books on loan</h1>
        <p className="muted">
          Return books by their due date. Due and overdue books appear here until checked in.
        </p>
      </header>
      <section className="panel panel__body">
        <h2>Current loans</h2>
        {summary.data.active.length === 0 ? (
          <p className="muted">No books are currently on loan.</p>
        ) : (
          <ul>
            {summary.data.active.map((loan) => (
              <li key={loan.id}>
                <img alt="" height={56} src={loan.book.coverUrl} width={40} />
                <span>
                  <strong>{loan.book.title}</strong> by {loan.book.author}
                  <br />
                  {loan.student.name} · <b>{dueLabel(loan.dueOn, summary.data.today)}</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel panel__body">
        <h2>Recently returned</h2>
        {summary.data.recentReturns.length === 0 ? (
          <p className="muted">Returned books will appear here.</p>
        ) : (
          <ul>
            {summary.data.recentReturns.map((loan) => (
              <li key={loan.id}>
                <strong>{loan.book.title}</strong> · {loan.student.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
