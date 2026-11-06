'use client';

import { Search } from 'lucide-react';
import type { LibraryBookCollection } from '@oasis/domain';
import type { RouterOutputs } from '@/lib/trpc';
import { LibraryBookList } from './library-book-list';
import { LibraryCollectionTabs } from './library-collection-tabs';

export type LibraryAvailability = 'All' | 'Available' | 'OnLoan';

export function LibraryCataloguePanel({
  collection,
  onCollection,
  search,
  onSearch,
  availability,
  onAvailability,
  page,
  onPage,
  data,
  loading,
  failed,
  pending,
  onSelect,
}: {
  collection: LibraryBookCollection;
  onCollection: (collection: LibraryBookCollection) => void;
  search: string;
  onSearch: (search: string) => void;
  availability: LibraryAvailability;
  onAvailability: (value: LibraryAvailability) => void;
  page: number;
  onPage: (page: number) => void;
  data: RouterOutputs['library']['cataloguePage'] | undefined;
  loading: boolean;
  failed: boolean;
  pending: boolean;
  onSelect: (barcode: string) => void;
}) {
  return (
    <>
      <LibraryCollectionTabs
        value={collection}
        onChange={(value) => {
          onCollection(value);
          onPage(1);
        }}
      />
      <section
        className="library-catalogue"
        id="library-catalogue-panel"
        role="tabpanel"
        aria-labelledby={`library-collection-${collection}`}
      >
        <div className="library-catalogue__heading">
          <div>
            <p className="eyebrow">Catalogue</p>
            <h2>Explore books</h2>
          </div>
          <label className="library-search">
            <Search aria-hidden="true" size={17} />
            <span className="sr-only">Search the catalogue</span>
            <input
              onChange={(event) => {
                onSearch(event.target.value);
                onPage(1);
              }}
              placeholder="Search title, author, or barcode"
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
                onAvailability(value);
                onPage(1);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="muted">Loading catalogue…</p>
        ) : failed ? (
          <p className="status--error">The catalogue is unavailable.</p>
        ) : data?.items.length ? (
          <LibraryBookList
            books={data.items}
            onSelect={(id) => {
              const book = data.items.find((item) => item.id === id);
              if (book) onSelect(book.barcode);
            }}
          />
        ) : (
          <p className="library-empty">
            {collection === 'RhinoReaders' && !search
              ? 'No Rhino Readers books yet. Choose this collection when adding or editing a book.'
              : 'No books match this search.'}
          </p>
        )}
        <div className="library-pagination">
          <button
            className="button button--secondary button--sm"
            disabled={page === 1 || pending}
            onClick={() => {
              onPage(page - 1);
            }}
            type="button"
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="button button--secondary button--sm"
            disabled={!data?.nextPage || pending}
            onClick={() => {
              onPage(page + 1);
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}
