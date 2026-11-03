'use client';

import Image from 'next/image';

type CatalogueBook = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  quantity: number;
  availableCopies: number;
  loanedCopies: number;
};

export function LibraryBookList({
  books,
  onSelect,
}: {
  books: readonly CatalogueBook[];
  onSelect?: (id: string) => void;
}) {
  return (
    <ul className="library-book-grid">
      {books.map((book) => (
        <li key={book.id}>
          <details
            className="library-book-card"
            onToggle={(event) => {
              if (event.currentTarget.open) onSelect?.(book.id);
            }}
          >
            <summary className="library-book-card__body">
              <span>
                <strong>{book.title}</strong>
                <small>{book.author}</small>
              </span>
              <span className="library-book-card__stock">
                <span
                  className={`library-book-card__status ${book.availableCopies === 0 ? 'library-book-card__status--loan' : ''}`}
                >
                  {book.availableCopies} of {book.quantity} available
                </span>
                {book.loanedCopies > 0 ? <small>{book.loanedCopies} on loan</small> : null}
              </span>
            </summary>
            <Image
              alt={`Cover of ${book.title}`}
              height={320}
              src={book.coverUrl}
              unoptimized
              width={240}
            />
          </details>
        </li>
      ))}
    </ul>
  );
}
