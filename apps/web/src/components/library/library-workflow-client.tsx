'use client';

import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from '@/lib/trpc';

type UploadedCover = {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
};

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function LibraryWorkflowClient() {
  const [barcode, setBarcode] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [cover, setCover] = useState<UploadedCover | null>(null);
  const [studentId, setStudentId] = useState('');
  const [dueOn, setDueOn] = useState(dateAfter(14));
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const utils = api.useUtils();
  const books = api.library.catalogue.useQuery(undefined);
  const borrowers = api.library.borrowers.useQuery(undefined);
  const createBook = api.library.createBook.useMutation({
    onSuccess: async () => {
      await utils.library.catalogue.invalidate();
      setMessage('Book added to the library.');
    },
  });
  const checkout = api.library.checkout.useMutation({
    onSuccess: async (result) => {
      await utils.library.catalogue.invalidate();
      setMessage(
        result.hasReminderRecipient
          ? 'Book checked out.'
          : 'Book checked out. This student has no active guardian email for reminders.',
      );
    },
  });
  const checkin = api.library.checkin.useMutation({
    onSuccess: async () => {
      await utils.library.catalogue.invalidate();
      setMessage('Book checked in.');
    },
  });

  const selectedBook = useMemo(
    () => books.data?.find((book) => book.barcode === barcode) ?? null,
    [barcode, books.data],
  );

  async function scanImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      URL.revokeObjectURL(url);
      setBarcode(result.getText().trim());
      setMessage('Barcode read from image.');
    } catch {
      setMessage('We could not read a numeric barcode from that image. Enter it manually instead.');
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
      const { createClient } = await import('@/lib/supabase/client');
      const client = createClient();
      const { error } = await client.storage
        .from(payload.bucket)
        .uploadToSignedUrl(storedCover.storagePath, token, file, {
          contentType: storedCover.mimeType,
        });
      if (error) throw error;
      setCover(storedCover);
      setMessage('Cover uploaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cover upload failed.');
    }
  }

  function addBook() {
    if (!cover) {
      setMessage('Upload a book cover before adding this book.');
      return;
    }
    createBook.mutate({ barcode, title, author, cover });
  }
  function lendBook() {
    if (!studentId) {
      setMessage('Choose a student.');
      return;
    }
    checkout.mutate({ barcode, studentId, dueOn });
  }

  return (
    <div className="library-workflow">
      <section className="panel panel__body">
        <h1>Library</h1>
        <p className="muted">
          Scan or enter a physical-copy barcode to add, check out, or check in a book.
        </p>
        {message ? (
          <p className="status--info" role="status">
            {message}
          </p>
        ) : null}
        <label>
          Barcode
          <input
            inputMode="numeric"
            onChange={(event) => {
              setBarcode(event.target.value);
            }}
            value={barcode}
          />
        </label>
        <input
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => void scanImage(event)}
          ref={fileInput}
          type="file"
        />
        <button onClick={() => fileInput.current?.click()} type="button">
          Upload barcode image
        </button>
        {selectedBook?.openLoan ? (
          <div>
            <p>
              <strong>{selectedBook.title}</strong> is checked out to{' '}
              {selectedBook.openLoan.studentName}.
            </p>
            <button
              disabled={checkin.isPending}
              onClick={() => {
                checkin.mutate({ barcode });
              }}
              type="button"
            >
              Check in
            </button>
          </div>
        ) : selectedBook ? (
          <div>
            <p>
              <strong>{selectedBook.title}</strong> is available.
            </p>
            <BorrowerForm
              borrowers={borrowers.data ?? []}
              dueOn={dueOn}
              onDueOn={setDueOn}
              onCheckout={lendBook}
              pending={checkout.isPending}
              studentId={studentId}
              onStudentId={setStudentId}
            />
          </div>
        ) : barcode ? (
          <div>
            <h2>Add book</h2>
            <label>
              Title
              <input
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                value={title}
              />
            </label>
            <label>
              Author
              <input
                onChange={(event) => {
                  setAuthor(event.target.value);
                }}
                value={author}
              />
            </label>
            <label>
              Cover
              <input
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void uploadCover(event)}
                type="file"
              />
            </label>
            <button disabled={createBook.isPending} onClick={addBook} type="button">
              Add book
            </button>
          </div>
        ) : null}
      </section>
      <section className="panel panel__body">
        <h2>Catalogue</h2>
        {books.isLoading ? (
          <p>Loading library…</p>
        ) : (
          <ul>
            {books.data?.map((book) => (
              <li key={book.id}>
                <strong>{book.title}</strong> — {book.author} ·{' '}
                {book.active
                  ? book.openLoan
                    ? `Checked out to ${book.openLoan.studentName}`
                    : 'Available'
                  : 'Retired'}
              </li>
            ))}
          </ul>
        )}
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
    <div>
      <label>
        Student
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
      <label>
        Due date
        <input
          onChange={(event) => {
            onDueOn(event.target.value);
          }}
          type="date"
          value={dueOn}
        />
      </label>
      <div>
        {[7, 14, 21, 28].map((days) => (
          <button
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
      <button disabled={pending} onClick={onCheckout} type="button">
        Check out
      </button>
    </div>
  );
}
