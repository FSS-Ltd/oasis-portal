'use client';

import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { useSession } from '@clerk/nextjs';
import { BookOpen, Camera, ImageUp, Search } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { LibraryBookList } from './library-book-list';
import { LibraryCollectionTabs } from './library-collection-tabs';
import {
  LIBRARY_BOOK_COLLECTIONS,
  LIBRARY_BOOK_COLLECTION_LABELS,
  type LibraryBookCollection,
} from '@oasis/domain';
import { LibraryBookEditor } from './library-book-editor';
import { LibraryBarcodeScanner } from './library-barcode-scanner';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/trpc';

type UploadedCover = {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
};
type Availability = 'All' | 'Available' | 'OnLoan';

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function LibraryWorkflowClient() {
  const { session } = useSession();
  const [editing, setEditing] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cover, setCover] = useState<UploadedCover | null>(null);
  const [studentId, setStudentId] = useState('');
  const [dueOn, setDueOn] = useState(dateAfter(14));
  const [collection, setCollection] = useState<LibraryBookCollection>('General');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState<Availability>('All');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const barcodeImageInput = useRef<HTMLInputElement>(null);
  const supabase = useMemo(
    () =>
      createClient({
        accessToken: async () => session?.getToken() ?? null,
      }),
    [session],
  );
  const utils = api.useUtils();
  const catalogue = api.library.cataloguePage.useQuery({ availability, page, search, collection });
  const lookup = api.library.lookupBarcode.useQuery(
    { barcode },
    { enabled: /^\d{1,64}$/.test(barcode), retry: false },
  );
  const borrowers = api.library.borrowers.useQuery(undefined);
  const createBook = api.library.createBook.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.library.cataloguePage.invalidate(),
        utils.library.lookupBarcode.invalidate(),
      ]);
      setBarcode('');
      setTitle('');
      setAuthor('');
      setQuantity(1);
      setCover(null);
      setMessage('Book added to the library.');
    },
  });
  const checkout = api.library.checkout.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.library.cataloguePage.invalidate(),
        utils.library.lookupBarcode.invalidate(),
      ]);
      setStudentId('');
      setMessage(
        result.hasReminderRecipient
          ? 'Book checked out.'
          : 'Book checked out. This student has no active guardian email for reminders.',
      );
    },
  });
  const checkin = api.library.checkin.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.library.cataloguePage.invalidate(),
        utils.library.lookupBarcode.invalidate(),
      ]);
      setMessage('Book checked in.');
    },
  });
  const selectedBook = useMemo(
    () => catalogue.data?.items.find((book) => book.barcode === barcode) ?? lookup.data ?? null,
    [barcode, catalogue.data, lookup.data],
  );

  function selectBarcode(value: string, successMessage?: string) {
    setEditing(false);
    setBarcode(value.trim());
    setStudentId('');
    setScannerOpen(false);
    if (successMessage) setMessage(successMessage);
  }

  async function scanImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      selectBarcode(result.getText(), 'Barcode read from image.');
    } catch {
      setMessage('We could not read a barcode from that image. Enter it manually instead.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage('Choose a JPEG, PNG, or WebP cover no larger than 5 MB.');
      return;
    }
    setIsCoverUploading(true);
    try {
      const response = await fetch('/api/library/cover/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
        }),
      });
      const payload = (await response.json()) as {
        bucket?: string;
        cover?: UploadedCover & { token: string };
        error?: string;
      };
      if (!response.ok || !payload.cover || !payload.bucket)
        throw new Error(payload.error ?? 'Cover upload could not be prepared.');
      const { token, ...storedCover } = payload.cover;
      const { error } = await supabase.storage
        .from(payload.bucket)
        .uploadToSignedUrl(storedCover.storagePath, token, file, {
          contentType: storedCover.mimeType,
        });
      if (error) throw error;
      setCover(storedCover);
      setMessage('Cover uploaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cover upload failed.');
    } finally {
      setIsCoverUploading(false);
    }
  }

  function addBook() {
    if (!cover) {
      setMessage('Upload a book cover before adding this book.');
      return;
    }
    createBook.mutate({ barcode, title, author, cover, quantity, collection });
  }

  return (
    <div className="library-workflow">
      <header className="library-hero">
        <div>
          <p className="eyebrow">Oasis Learning Centre</p>
          <h1>Your library</h1>
          <p>Find a title, manage circulation, or scan a physical copy.</p>
        </div>
        <div className="library-hero__actions">
          <button
            className="button button--primary button--md"
            onClick={() => {
              setScannerOpen(true);
            }}
            type="button"
          >
            <Camera aria-hidden="true" size={17} />
            Scan barcode
          </button>
          <button
            className="button button--secondary button--md"
            onClick={() => barcodeImageInput.current?.click()}
            type="button"
          >
            <ImageUp aria-hidden="true" size={17} />
            Upload image
          </button>
        </div>
      </header>
      <input
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => void scanImage(event)}
        ref={barcodeImageInput}
        type="file"
      />
      {scannerOpen ? (
        <LibraryBarcodeScanner
          onClose={() => {
            setScannerOpen(false);
          }}
          onDetected={(value) => {
            selectBarcode(value, 'Barcode scanned.');
          }}
        />
      ) : null}
      {message ? (
        <p className="library-status" role="status">
          {message}
        </p>
      ) : null}
      {createBook.error || checkout.error || checkin.error || lookup.error ? (
        <p className="status--error" role="alert">
          {(createBook.error ?? checkout.error ?? checkin.error ?? lookup.error)?.message}
        </p>
      ) : null}
      <section className="library-circulation panel">
        <div className="library-circulation__intro">
          <BookOpen aria-hidden="true" size={21} />
          <div>
            <h2>Circulation desk</h2>
            <p>Enter a barcode to check a copy in, lend it, or add it to the catalogue.</p>
          </div>
        </div>
        <label className="field library-barcode-field">
          <span className="field__label">Book barcode</span>
          <input
            inputMode="numeric"
            onChange={(event) => {
              selectBarcode(event.target.value);
            }}
            placeholder="Scan or enter barcode"
            value={barcode}
          />
        </label>
        {selectedBook ? (
          <div className="library-action-card">
            <strong>{selectedBook.title}</strong>
            <button
              className="button button--secondary button--sm"
              onClick={() => {
                setEditing(true);
              }}
              type="button"
            >
              Edit book
            </button>
            <p>
              {selectedBook.availableCopies} of {selectedBook.quantity} copies available.
            </p>
            {selectedBook.openLoans.map((loan) => (
              <div className="library-return-action" key={loan.id}>
                <span>Checked out to {loan.studentName}.</span>
                <button
                  className="button button--secondary button--sm"
                  disabled={checkin.isPending}
                  onClick={() => {
                    checkin.mutate({ barcode, loanId: loan.id });
                  }}
                  type="button"
                >
                  Check in {loan.studentName}’s copy
                </button>
              </div>
            ))}
            {selectedBook.availableCopies > 0 ? (
              <BorrowerForm
                borrowers={borrowers.data ?? []}
                dueOn={dueOn}
                onCheckout={() => {
                  checkout.mutate({ barcode, studentId, dueOn });
                }}
                onDueOn={setDueOn}
                onStudentId={setStudentId}
                pending={checkout.isPending}
                studentId={studentId}
              />
            ) : (
              <p>All copies are on loan.</p>
            )}
          </div>
        ) : null}
        {editing && selectedBook ? (
          <LibraryBookEditor
            book={selectedBook}
            key={selectedBook.id}
            onCancel={() => {
              setEditing(false);
            }}
            onSaved={async (savedBarcode) => {
              selectBarcode(savedBarcode);
              await Promise.all([
                utils.library.cataloguePage.invalidate(),
                utils.library.lookupBarcode.invalidate(),
              ]);
              setMessage('Book updated.');
            }}
          />
        ) : null}
        {barcode && !selectedBook ? (
          <div className="library-add-book">
            <h2>Add a new book</h2>
            <label className="field">
              <span className="field__label">Title</span>
              <input
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                value={title}
              />
            </label>
            <label className="field">
              <span className="field__label">Author</span>
              <input
                onChange={(event) => {
                  setAuthor(event.target.value);
                }}
                value={author}
              />
            </label>
            <label className="field">
              <span className="field__label">Quantity</span>
              <input
                min={1}
                onChange={(event) => {
                  setQuantity(Math.max(1, event.currentTarget.valueAsNumber || 1));
                }}
                type="number"
                value={quantity}
              />
            </label>
            <label className="field">
              <span className="field__label">Collection</span>
              <select
                value={collection}
                onChange={(event) => {
                  const value = LIBRARY_BOOK_COLLECTIONS.find(
                    (item) => item === event.target.value,
                  );
                  if (value) {
                    setCollection(value);
                    setPage(1);
                  }
                }}
              >
                {LIBRARY_BOOK_COLLECTIONS.map((value) => (
                  <option key={value} value={value}>
                    {LIBRARY_BOOK_COLLECTION_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Cover image</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={isCoverUploading}
                onChange={(event) => void uploadCover(event)}
                type="file"
              />
              {isCoverUploading ? <span className="muted">Uploading cover…</span> : null}
            </label>
            <button
              className="button button--primary button--md"
              disabled={createBook.isPending || !cover}
              onClick={addBook}
              type="button"
            >
              {createBook.isPending ? 'Adding…' : 'Add book'}
            </button>
          </div>
        ) : null}
      </section>
      <LibraryCollectionTabs
        value={collection}
        onChange={(value) => {
          setCollection(value);
          setPage(1);
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
                setSearch(event.target.value);
                setPage(1);
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
          <LibraryBookList
            books={catalogue.data.items}
            onSelect={(id) => {
              const book = catalogue.data.items.find((item) => item.id === id);
              if (book) selectBarcode(book.barcode);
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
            disabled={page === 1}
            onClick={() => {
              setPage((value) => value - 1);
            }}
            type="button"
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            className="button button--secondary button--sm"
            disabled={!catalogue.data?.nextPage}
            onClick={() => {
              setPage((value) => value + 1);
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

function BorrowerForm({
  borrowers,
  dueOn,
  onCheckout,
  onDueOn,
  onStudentId,
  pending,
  studentId,
}: {
  borrowers: Array<{ id: string; name: string; yearGroup: string; hasReminderRecipient: boolean }>;
  dueOn: string;
  onCheckout: () => void;
  onDueOn: (value: string) => void;
  onStudentId: (value: string) => void;
  pending: boolean;
  studentId: string;
}) {
  return (
    <div className="library-borrower-form">
      <label className="field">
        <span className="field__label">Student</span>
        <select
          onChange={(event) => {
            onStudentId(event.target.value);
          }}
          value={studentId}
        >
          <option value="">Choose a student</option>
          {borrowers.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} · {student.yearGroup}
              {student.hasReminderRecipient ? '' : ' · no guardian email'}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Due date</span>
        <input
          onChange={(event) => {
            onDueOn(event.target.value);
          }}
          type="date"
          value={dueOn}
        />
      </label>
      <div className="library-loan-periods">
        {[7, 14, 21, 28].map((days) => (
          <button
            className="button button--secondary button--sm"
            key={days}
            onClick={() => {
              onDueOn(dateAfter(days));
            }}
            type="button"
          >
            {days} days
          </button>
        ))}
      </div>
      <button
        className="button button--primary button--md"
        disabled={!studentId || pending}
        onClick={onCheckout}
        type="button"
      >
        {pending ? 'Checking out…' : 'Check out'}
      </button>
    </div>
  );
}
