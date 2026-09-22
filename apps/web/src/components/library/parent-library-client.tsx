'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/trpc';

type Availability = 'All' | 'Available' | 'OnLoan';

function dueLabel(dueOn: Date, today: string): string {
  const due = dueOn.toISOString().slice(0, 10);
  if (due < today) return 'Overdue';
  if (due === today) return 'Due today';
  return `Due ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(dueOn)}`;
}

export function ParentLibraryClient() {
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<Availability>('All');
  const [page, setPage] = useState(1);
  const summary = api.library.parentSummary.useQuery(undefined, { retry: false });
  const catalogue = api.library.parentCatalogue.useQuery(
    { availability, page, search },
    { retry: false },
  );
  if (summary.isLoading) return <p>Loading library…</p>;
  if (summary.error || !summary.data)
    return <p className="status--error">Library records are unavailable.</p>;
  return (
    <div className="parent-library library-parent-page">
      <header className="library-hero library-hero--parent">
        <div>
          <p className="eyebrow">Oasis Learning Centre</p>
          <h1>Library</h1>
          <p>Browse the school collection and keep track of books your family has borrowed.</p>
        </div>
      </header>
      <section className="library-loan-section">
        <div className="library-section-heading">
          <h2>Your loans</h2>
          <span>{summary.data.active.length} active</span>
        </div>
        {summary.data.active.length === 0 ? (
          <p className="library-empty">No books are currently on loan.</p>
        ) : (
          <div className="library-loan-grid">
            {summary.data.active.map((loan) => (
              <article className="library-loan-card" key={loan.id}>
                <img alt="" src={loan.book.coverUrl} />
                <div>
                  <h3>{loan.book.title}</h3>
                  <p>
                    {loan.book.author} · {loan.student.name}
                  </p>
                  <strong
                    className={
                      dueLabel(loan.dueOn, summary.data.today) === 'Overdue'
                        ? 'library-due library-due--overdue'
                        : 'library-due'
                    }
                  >
                    {dueLabel(loan.dueOn, summary.data.today)}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="library-loan-section">
        <div className="library-section-heading">
          <h2>Recently returned</h2>
        </div>
        {summary.data.recentReturns.length === 0 ? (
          <p className="library-empty">Returned books will appear here.</p>
        ) : (
          <div className="library-return-list">
            {summary.data.recentReturns.map((loan) => (
              <article key={loan.id}>
                <img alt="" src={loan.book.coverUrl} />
                <span>
                  <strong>{loan.book.title}</strong>
                  <small>
                    {loan.book.author} · {loan.student.name}
                  </small>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="library-catalogue">
        <div className="library-catalogue__heading">
          <div>
            <p className="eyebrow">Catalogue</p>
            <h2>Find a book</h2>
          </div>
          <label className="library-search">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Search the library catalogue</span>
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search title or author"
              value={search}
            />
          </label>
        </div>
        <div aria-label="Filter catalogue" className="library-filter" role="group">
          {(
            [
              ['All', 'All books'],
              ['Available', 'Available now'],
              ['OnLoan', 'On loan'],
            ] as const
          ).map(([value, label]) => (
            <button
              className={`button button--sm ${availability === value ? 'button--primary' : 'button--secondary'}`}
              key={value}
              onClick={() => {
                setAvailability(value);
                setPage(1);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {catalogue.isLoading ? (
          <p className="muted">Loading catalogue…</p>
        ) : catalogue.error ? (
          <p className="status--error">The catalogue is unavailable.</p>
        ) : catalogue.data?.items.length ? (
          <div className="library-book-grid">
            {catalogue.data.items.map((book) => (
              <article className="library-book-card library-book-card--static" key={book.id}>
                <img alt={`Cover of ${book.title}`} src={book.coverUrl} />
                <span className="library-book-card__body">
                  <strong>{book.title}</strong>
                  <small>{book.author}</small>
                  <em
                    className={
                      book.availability === 'On loan'
                        ? 'library-book-card__status library-book-card__status--loan'
                        : 'library-book-card__status'
                    }
                  >
                    {book.availability}
                  </em>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="library-empty">No books match this search.</p>
        )}
        <div className="library-pagination">
          <button
            className="button button--secondary button--sm"
            disabled={page === 1}
            onClick={() => { setPage((value) => value - 1); }}
            type="button"
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="button button--secondary button--sm"
            disabled={!catalogue.data?.nextPage}
            onClick={() => { setPage((value) => value + 1); }}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
