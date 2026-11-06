import type { Prisma } from '@oasis/db';
import {
  libraryLondonDateKey,
  libraryLoanStatus,
  type LibraryBorrowerHistoryPageInput,
  type LibraryCirculationPageInput,
} from '@oasis/domain';
import type { AppContext } from '../context.js';

const LOAN_PAGE_SIZE = 20;
const STUDENT_PAGE_SIZE = 12;

/** Call only behind the library-management procedure; every read retains RLS. */
export async function readCirculationPage(ctx: AppContext, input: LibraryCirculationPageInput) {
  const today = libraryLondonDateKey(new Date());
  const where: Prisma.LibraryLoanWhereInput = {
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.bookId ? { bookId: input.bookId } : {}),
    ...(input.status === 'Returned'
      ? { returnedAt: { not: null } }
      : input.status === 'All'
        ? {}
        : { returnedAt: null }),
    ...(input.status === 'Overdue' ? { dueOn: { lt: new Date(`${today}T00:00:00Z`) } } : {}),
    ...(input.search
      ? {
          book: {
            OR: [
              { title: { contains: input.search, mode: 'insensitive' } },
              { author: { contains: input.search, mode: 'insensitive' } },
              { barcode: { contains: input.search } },
            ],
          },
        }
      : {}),
  };
  const orderBy: Prisma.LibraryLoanOrderByWithRelationInput[] =
    input.status === 'Returned'
      ? [{ returnedAt: 'desc' }, { id: 'desc' }]
      : input.status === 'All'
        ? [{ checkedOutAt: 'desc' }, { id: 'desc' }]
        : [{ dueOn: 'asc' }, { id: 'asc' }];
  const rows = await ctx.withRls((tx) =>
    tx.libraryLoan.findMany({
      where,
      select: {
        id: true,
        checkedOutAt: true,
        dueOn: true,
        returnedAt: true,
        book: { select: { id: true, barcode: true, title: true, author: true } },
        student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
      },
      orderBy,
      skip: (input.page - 1) * LOAN_PAGE_SIZE,
      take: LOAN_PAGE_SIZE + 1,
    }),
  );
  return {
    items: rows.slice(0, LOAN_PAGE_SIZE).map((row) => ({
      id: row.id,
      checkedOutAt: row.checkedOutAt,
      dueOn: row.dueOn,
      returnedAt: row.returnedAt,
      book: row.book,
      status: libraryLoanStatus(row.dueOn, row.returnedAt, today),
      student: {
        id: row.student.id,
        name: ctx.db.$enc.decrypt(row.student.fullNameEnc),
        yearGroup: row.student.yearGroup,
      },
    })),
    nextPage: rows.length > LOAN_PAGE_SIZE ? input.page + 1 : null,
    today,
  };
}

export async function readBorrowerHistoryPage(
  ctx: AppContext,
  input: LibraryBorrowerHistoryPageInput,
) {
  const rows = await ctx.withRls((tx) =>
    tx.student.findMany({
      // Keep former pupils' loan history accessible to authorized librarians.
      where: {
        libraryLoans: { some: {} },
        ...(input.search ? { nameBidx: ctx.db.$enc.blindIndex(input.search) } : {}),
      },
      select: {
        id: true,
        fullNameEnc: true,
        yearGroup: true,
        active: true,
        _count: { select: { libraryLoans: true } },
      },
      orderBy: [{ yearGroup: 'asc' }, { id: 'asc' }],
      skip: (input.page - 1) * STUDENT_PAGE_SIZE,
      take: STUDENT_PAGE_SIZE + 1,
    }),
  );
  return {
    items: rows.slice(0, STUDENT_PAGE_SIZE).map((row) => ({
      id: row.id,
      name: ctx.db.$enc.decrypt(row.fullNameEnc),
      yearGroup: row.yearGroup,
      active: row.active,
      totalLoans: row._count.libraryLoans,
    })),
    nextPage: rows.length > STUDENT_PAGE_SIZE ? input.page + 1 : null,
  };
}
