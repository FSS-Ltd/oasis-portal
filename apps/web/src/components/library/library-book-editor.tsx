'use client';

import {
  LIBRARY_BOOK_COLLECTIONS,
  LIBRARY_BOOK_COLLECTION_LABELS,
  type LibraryBookCollection,
} from '@oasis/domain';
import { useState, type FormEvent } from 'react';
import { api, type RouterOutputs } from '@/lib/trpc';

type LibraryBook = NonNullable<RouterOutputs['library']['lookupBarcode']>;

export function LibraryBookEditor({
  book,
  onCancel,
  onSaved,
}: {
  book: LibraryBook;
  onCancel: () => void;
  onSaved: (barcode: string) => Promise<void>;
}) {
  const [collection, setCollection] = useState<LibraryBookCollection>(book.collection);
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [barcode, setBarcode] = useState(book.barcode);
  const [quantity, setQuantity] = useState(String(book.quantity));
  const update = api.library.updateBook.useMutation({
    onSuccess: async (result) => onSaved(result.barcode),
  });
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate({ id: book.id, title, author, barcode, quantity: Number(quantity), collection });
  }
  return (
    <form aria-label="Edit book" className="library-add-book" onSubmit={save}>
      <h2>Edit book</h2>
      <label className="field">
        <span className="field__label">Title</span>
        <input
          required
          maxLength={200}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          value={title}
        />
      </label>
      <label className="field">
        <span className="field__label">Author</span>
        <input
          required
          maxLength={200}
          onChange={(event) => {
            setAuthor(event.target.value);
          }}
          value={author}
        />
      </label>
      <label className="field">
        <span className="field__label">Book barcode</span>
        <input
          required
          disabled={book.loanedCopies > 0}
          inputMode="numeric"
          pattern="[0-9]{1,64}"
          onChange={(event) => {
            setBarcode(event.target.value);
          }}
          value={barcode}
        />
        {book.loanedCopies > 0 ? (
          <small>Return all copies before changing the barcode.</small>
        ) : null}
      </label>
      <label className="field">
        <span className="field__label">Quantity</span>
        <input
          required
          min={Math.max(1, book.loanedCopies)}
          max={1000}
          type="number"
          onChange={(event) => {
            setQuantity(event.target.value);
          }}
          value={quantity}
        />
      </label>
      <label className="field">
        <span className="field__label">Collection</span>
        <select
          value={collection}
          onChange={(event) => {
            const value = LIBRARY_BOOK_COLLECTIONS.find((item) => item === event.target.value);
            if (value) setCollection(value);
          }}
        >
          {LIBRARY_BOOK_COLLECTIONS.map((value) => (
            <option key={value} value={value}>
              {LIBRARY_BOOK_COLLECTION_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      {update.error ? (
        <p className="status--error" role="alert">
          {update.error.message}
        </p>
      ) : null}
      <div className="library-hero__actions">
        <button
          className="button button--primary button--md"
          disabled={update.isPending || !title.trim() || !author.trim()}
          type="submit"
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          className="button button--secondary button--md"
          disabled={update.isPending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
