import { describe, expect, it } from 'vitest';
import type { LibraryBookCollection } from '@oasis/domain';
import { libraryRouter } from '../routers/library.js';
import { makeTestContext } from './helpers/test-context.js';

function fixture(quantity = 2) {
  const loans: Array<{ id: string; studentId: string; returnedAt: Date | null }> = [];
  const book = {
    id: 'cbook000000000000000000001',
    barcode: '123',
    title: 'Test book',
    author: 'Author',
    coverUrl: 'https://example.com/cover.jpg',
    quantity,
    collection: 'General' as LibraryBookCollection,
    loanedCopies: 0,
    active: true,
    coverBucket: 'covers',
    coverPath: 'library-books/owner/cover.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const db = {
    $queryRaw: () => [book],
    $enc: { decrypt: (value: string) => value },
    auditLog: { create: () => ({}) },
    libraryBook: {
      fields: { quantity: { _ref: 'quantity', _container: 'LibraryBook' } },
      findMany: ({
        where,
      }: {
        where: {
          collection?: string;
          loanedCopies?: { lt?: unknown; gt?: number };
          loans?: { none?: unknown; some?: unknown };
        };
      }) => {
        if (where.collection && where.collection !== book.collection) return [];
        if (where.loanedCopies?.lt && book.loanedCopies >= book.quantity) return [];
        if (where.loanedCopies?.gt !== undefined && book.loanedCopies <= where.loanedCopies.gt)
          return [];
        if (where.loans?.none && book.loanedCopies > 0) return [];
        if (where.loans?.some && book.loanedCopies === 0) return [];
        return [book];
      },
      update: ({ data }: { data: Partial<typeof book> }) => Object.assign(book, data),
      findUnique: () => ({
        ...book,
        loans: loans
          .filter((loan) => !loan.returnedAt)
          .map((loan) => ({
            ...loan,
            dueOn: new Date(),
            student: { id: loan.studentId, fullNameEnc: 'Child', yearGroup: 'Year 1' },
          })),
      }),
    },
    student: {
      findFirst: () => ({ id: 'cstudent000000000000000001' }),
      findUnique: ({ where }: { where: { id: string } }) => ({
        id: where.id,
        active: true,
        guardians: [],
      }),
    },
    libraryLoan: {
      create: ({ data }: { data: { studentId: string } }) => {
        const loan = {
          ...data,
          id: `cloan00000000000000000000${String(loans.length)}`,
          returnedAt: null,
        };
        loans.push(loan);
        book.loanedCopies += 1;
        return loan;
      },
      findFirst: ({ where }: { where: { id?: string } }) =>
        loans.find((loan) => !loan.returnedAt && (!where.id || loan.id === where.id)) ?? null,
      updateMany: ({ where }: { where: { id: string } }) => {
        const loan = loans.find((item) => item.id === where.id && !item.returnedAt);
        if (!loan) return { count: 0 };
        loan.returnedAt = new Date();
        book.loanedCopies -= 1;
        return { count: 1 };
      },
    },
  };
  const caller = libraryRouter.createCaller(
    makeTestContext({
      db,
      rls: { kind: 'db', db },
      user: { id: 'librarian', role: 'Supervisor', tags: ['librarian'], requires2fa: false },
    }),
  );
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 14);
  const checkout = (studentId: string) =>
    caller.checkout({
      barcode: '123',
      dueOn: due.toISOString().slice(0, 10),
      studentId,
    });
  const parentCaller = libraryRouter.createCaller(
    makeTestContext({
      db,
      rls: { kind: 'db', db },
      user: { id: 'parent', role: 'Parent', tags: [], requires2fa: false },
    }),
  );
  return { caller, parentCaller, checkout, book, loans };
}

describe('library copy circulation', () => {
  it('moves edited books between library collections while retaining the same circulation record', async () => {
    const { caller, parentCaller, checkout, book } = fixture();
    await caller.updateBook({
      id: book.id,
      barcode: book.barcode,
      title: book.title,
      author: book.author,
      quantity: 2,
      collection: 'RhinoReaders',
    });
    expect((await parentCaller.parentCatalogue({ collection: 'General' })).items).toEqual([]);
    expect((await parentCaller.parentCatalogue({ collection: 'RhinoReaders' })).items).toHaveLength(
      1,
    );
    await checkout('cstudent000000000000000001');
    expect(book.loanedCopies).toBe(1);
  });

  it('keeps partly borrowed titles in the available catalogue and removes exhausted stock', async () => {
    const { parentCaller, checkout } = fixture();
    await checkout('cstudent000000000000000001');
    const page = await parentCaller.parentCatalogue({ availability: 'Available' });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ availableCopies: 1, availability: 'Available' });
    expect(page.items[0]).not.toHaveProperty('openLoans');
    await checkout('cstudent000000000000000002');
    expect((await parentCaller.parentCatalogue({ availability: 'Available' })).items).toEqual([]);
    expect((await parentCaller.parentCatalogue({ availability: 'OnLoan' })).items).toHaveLength(1);
  });

  it('edits a submitted book while keeping its existing cover', async () => {
    const { caller, book } = fixture();
    await caller.updateBook({
      id: book.id,
      barcode: '456',
      title: 'Updated title',
      author: 'Updated author',
      quantity: 3,
    });
    expect(book).toMatchObject({
      barcode: '456',
      title: 'Updated title',
      author: 'Updated author',
      quantity: 3,
      coverUrl: 'https://example.com/cover.jpg',
      coverPath: 'library-books/owner/cover.jpg',
    });
  });

  it('rejects an edited quantity below copies on loan', async () => {
    const { caller, checkout, book } = fixture();
    await checkout('cstudent000000000000000001');
    await checkout('cstudent000000000000000002');
    await expect(
      caller.updateBook({
        id: book.id,
        barcode: '123',
        title: book.title,
        author: book.author,
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Quantity cannot be less than the copies on loan',
    });
    expect(book.quantity).toBe(2);
  });

  it('lends both copies to different children and rejects a third checkout', async () => {
    const { checkout, loans } = fixture();
    await checkout('cstudent000000000000000001');
    await checkout('cstudent000000000000000002');
    await expect(checkout('cstudent000000000000000003')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(loans.map((loan) => loan.studentId)).toEqual([
      'cstudent000000000000000001',
      'cstudent000000000000000002',
    ]);
  });

  it('returns the selected child’s copy and makes it available to borrow again', async () => {
    const { caller, checkout, loans, book } = fixture();
    await checkout('cstudent000000000000000001');
    await checkout('cstudent000000000000000002');
    await caller.checkin({ barcode: '123', loanId: 'cloan000000000000000000001' });
    expect(loans[0]?.returnedAt).toBeNull();
    expect(loans[1]?.returnedAt).toBeInstanceOf(Date);
    expect(book.loanedCopies).toBe(1);
    await checkout('cstudent000000000000000003');
    expect(book.loanedCopies).toBe(2);
  });

  it('requires a loan selection when a barcode has multiple borrowers', async () => {
    const { caller, checkout, book } = fixture();
    await checkout('cstudent000000000000000001');
    await checkout('cstudent000000000000000002');
    await expect(caller.checkin({ barcode: '123' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(book.loanedCopies).toBe(2);
  });

  it('reports remaining copies even when the title has an open loan', async () => {
    const { caller, checkout } = fixture();
    await checkout('cstudent000000000000000001');
    await expect(caller.lookupBarcode({ barcode: '123' })).resolves.toMatchObject({
      quantity: 2,
      availableCopies: 1,
    });
  });
});
