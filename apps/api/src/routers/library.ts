import { randomUUID } from 'node:crypto';
import { Prisma } from '@oasis/db';
import {
  canManageLibrary,
  libraryBarcodeSchema,
  libraryBookDraftSchema,
  libraryCheckoutSchema,
  libraryLondonDateKey,
  requireCanManageLibrary,
} from '@oasis/domain';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  assertUploadedLibraryCover,
  deleteLibraryCover,
  libraryCoverBucket,
  libraryCoverPublicUrl,
  type LibraryCoverUpload,
} from '../services/library-cover-storage.js';
import { authedProcedure, router } from '../trpc.js';

const PAGE_SIZE = 100;
const bookInput = libraryBookDraftSchema;
const updateBookInput = bookInput.extend({ id: z.string().cuid() });

function isConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function decrypt(
  ctx: { db: { $enc: { decrypt(value: string | null): string | null } } },
  value: string,
): string {
  return ctx.db.$enc.decrypt(value) ?? 'Unknown student';
}

function dateAtUtcMidnight(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function assertDueOn(dueOn: Date): void {
  const diff = Math.floor(
    (dueOn.getTime() - dateAtUtcMidnight(libraryLondonDateKey(new Date())).getTime()) / 86_400_000,
  );
  if (diff < 1 || diff > 365)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Due date must be between 1 and 365 days from today',
    });
}

function safeFileName(value: string): string {
  return (
    value
      .replaceAll('\\', '/')
      .split('/')
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]/gu, '-') || 'cover'
  );
}

function coverPath(userId: string, fileName: string): string {
  return `library-books/${userId}/${randomUUID()}-${safeFileName(fileName)}`;
}

function mapBook(
  ctx: Parameters<typeof decrypt>[0],
  book: {
    id: string;
    barcode: string;
    title: string;
    author: string;
    coverUrl: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    loans?: Array<{
      id: string;
      dueOn: Date;
      returnedAt: Date | null;
      student: { id: string; fullNameEnc: string; yearGroup: string };
    }>;
  },
) {
  const loan = book.loans?.[0] ?? null;
  return {
    id: book.id,
    barcode: book.barcode,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    active: book.active,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    openLoan: loan
      ? {
          id: loan.id,
          dueOn: loan.dueOn,
          studentId: loan.student.id,
          studentName: decrypt(ctx, loan.student.fullNameEnc),
          studentYearGroup: loan.student.yearGroup,
        }
      : null,
  };
}

function librarianProcedure() {
  return authedProcedure.use(({ ctx, next }) => {
    try {
      requireCanManageLibrary(ctx.user);
    } catch (cause) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'library circulation requires the librarian tag',
        cause,
      });
    }
    return next();
  });
}

export const libraryRouter = router({
  canManage: authedProcedure.query(({ ctx }) => canManageLibrary(ctx.user)),

  catalogue: librarianProcedure()
    .input(
      z
        .object({
          search: z.string().trim().max(200).optional(),
          includeRetired: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search ?? '';
      const books = await ctx.withRls((tx) =>
        tx.libraryBook.findMany({
          where: {
            ...(input?.includeRetired ? {} : { active: true }),
            ...(search
              ? {
                  OR: [
                    { barcode: { contains: search } },
                    { title: { contains: search, mode: 'insensitive' } },
                    { author: { contains: search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            loans: {
              where: { returnedAt: null },
              include: { student: { select: { id: true, fullNameEnc: true, yearGroup: true } } },
              take: 1,
            },
          },
          orderBy: [{ title: 'asc' }, { id: 'asc' }],
          take: PAGE_SIZE,
        }),
      );
      return books.map((book) => mapBook(ctx, book));
    }),

  lookupBarcode: librarianProcedure()
    .input(z.object({ barcode: libraryBarcodeSchema }))
    .query(async ({ ctx, input }) => {
      const book = await ctx.withRls((tx) =>
        tx.libraryBook.findUnique({
          where: { barcode: input.barcode },
          include: {
            loans: {
              where: { returnedAt: null },
              include: { student: { select: { id: true, fullNameEnc: true, yearGroup: true } } },
              take: 1,
            },
          },
        }),
      );
      return book ? mapBook(ctx, book) : null;
    }),

  borrowers: librarianProcedure()
    .input(z.object({ search: z.string().trim().max(200).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.withRls((tx) =>
        tx.student.findMany({
          where: { active: true },
          select: {
            id: true,
            fullNameEnc: true,
            yearGroup: true,
            guardians: {
              where: { user: { active: true, emailEnc: { not: null } } },
              select: { id: true },
            },
          },
          orderBy: { id: 'asc' },
          take: PAGE_SIZE,
        }),
      );
      const search = input?.search?.toLocaleLowerCase() ?? '';
      return rows
        .map((row) => ({
          id: row.id,
          name: decrypt(ctx, row.fullNameEnc),
          yearGroup: row.yearGroup,
          hasReminderRecipient: row.guardians.length > 0,
        }))
        .filter(
          (row) => !search || `${row.name} ${row.yearGroup}`.toLocaleLowerCase().includes(search),
        );
    }),

  loans: librarianProcedure()
    .input(z.object({ status: z.enum(['Open', 'Returned', 'All']).default('Open') }).optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? 'Open';
      const loans = await ctx.withRls((tx) =>
        tx.libraryLoan.findMany({
          where:
            status === 'Open'
              ? { returnedAt: null }
              : status === 'Returned'
                ? { returnedAt: { not: null } }
                : {},
          include: {
            book: {
              select: { id: true, barcode: true, title: true, author: true, coverUrl: true },
            },
            student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
          },
          orderBy: [{ returnedAt: 'asc' }, { dueOn: 'asc' }],
          take: PAGE_SIZE,
        }),
      );
      return loans.map((loan) => ({
        ...loan,
        student: {
          id: loan.student.id,
          name: decrypt(ctx, loan.student.fullNameEnc),
          yearGroup: loan.student.yearGroup,
        },
      }));
    }),

  prepareCoverUpload: librarianProcedure()
    .input(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        sizeBytes: z
          .number()
          .int()
          .positive()
          .max(5 * 1024 * 1024),
      }),
    )
    .mutation(({ ctx, input }) => {
      const cover = {
        ...input,
        storageBucket: libraryCoverBucket(),
        storagePath: coverPath(ctx.user.id, input.fileName),
      } satisfies LibraryCoverUpload;
      return { ...cover, publicUrl: libraryCoverPublicUrl(cover) };
    }),

  createBook: librarianProcedure()
    .input(bookInput)
    .mutation(async ({ ctx, input }) => {
      const cover = input.cover;
      if (
        cover.storageBucket !== libraryCoverBucket() ||
        !cover.storagePath.startsWith(`library-books/${ctx.user.id}/`)
      )
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid library cover upload' });
      await assertUploadedLibraryCover(cover);
      try {
        const book = await ctx.withRls((tx) =>
          tx.libraryBook.create({
            data: {
              barcode: input.barcode,
              title: input.title,
              author: input.author,
              coverUrl: libraryCoverPublicUrl(cover),
              coverBucket: cover.storageBucket,
              coverPath: cover.storagePath,
              coverMimeType: cover.mimeType,
              coverSizeBytes: cover.sizeBytes,
              createdById: ctx.user.id,
              updatedById: ctx.user.id,
            },
          }),
        );
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'LibraryBook',
            entityId: book.id,
            meta: { barcode: book.barcode, source: 'library.createBook' },
          },
        });
        return book;
      } catch (error) {
        if (isConflict(error))
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This barcode is already in the library',
          });
        throw error;
      }
    }),

  updateBook: librarianProcedure()
    .input(updateBookInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.withRls((tx) =>
        tx.libraryBook.findUnique({
          where: { id: input.id },
          include: { loans: { where: { returnedAt: null }, select: { id: true } } },
        }),
      );
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Library book not found' });
      if (existing.loans.length > 0 && existing.barcode !== input.barcode)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Return this book before changing its barcode',
        });
      const cover = input.cover;
      if (
        cover.storageBucket !== libraryCoverBucket() ||
        !cover.storagePath.startsWith(`library-books/${ctx.user.id}/`)
      )
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid library cover upload' });
      if (cover.storagePath !== existing.coverPath) await assertUploadedLibraryCover(cover);
      try {
        const book = await ctx.withRls((tx) =>
          tx.libraryBook.update({
            where: { id: input.id },
            data: {
              barcode: input.barcode,
              title: input.title,
              author: input.author,
              coverUrl: libraryCoverPublicUrl(cover),
              coverBucket: cover.storageBucket,
              coverPath: cover.storagePath,
              coverMimeType: cover.mimeType,
              coverSizeBytes: cover.sizeBytes,
              updatedById: ctx.user.id,
            },
          }),
        );
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'LibraryBook',
            entityId: book.id,
            meta: { source: 'library.updateBook' },
          },
        });
        if (
          cover.storagePath !== existing.coverPath ||
          cover.storageBucket !== existing.coverBucket
        )
          void deleteLibraryCover({
            storageBucket: existing.coverBucket,
            storagePath: existing.coverPath,
          });
        return book;
      } catch (error) {
        if (isConflict(error))
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This barcode is already in the library',
          });
        throw error;
      }
    }),

  retireBook: librarianProcedure()
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const book = await ctx.withRls((tx) =>
        tx.libraryBook.findUnique({
          where: { id: input.id },
          include: { loans: { where: { returnedAt: null }, select: { id: true } } },
        }),
      );
      if (!book) throw new TRPCError({ code: 'NOT_FOUND', message: 'Library book not found' });
      if (book.loans.length > 0)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Return this book before retiring it',
        });
      const result = await ctx.withRls((tx) =>
        tx.libraryBook.update({
          where: { id: input.id },
          data: { active: false, updatedById: ctx.user.id },
        }),
      );
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Delete',
          entity: 'LibraryBook',
          entityId: result.id,
          meta: { source: 'library.retireBook' },
        },
      });
      return result;
    }),

  checkout: librarianProcedure()
    .input(libraryCheckoutSchema)
    .mutation(async ({ ctx, input }) => {
      const dueOn = dateAtUtcMidnight(input.dueOn);
      assertDueOn(dueOn);
      const result = await ctx.withRls(async (tx) => {
        const [book, student] = await Promise.all([
          tx.libraryBook.findUnique({
            where: { barcode: input.barcode },
            include: { loans: { where: { returnedAt: null }, select: { id: true } } },
          }),
          tx.student.findUnique({
            where: { id: input.studentId },
            select: {
              id: true,
              active: true,
              guardians: {
                where: { user: { active: true, emailEnc: { not: null } } },
                select: { id: true },
              },
            },
          }),
        ]);
        if (!book) throw new TRPCError({ code: 'NOT_FOUND', message: 'Library book not found' });
        if (!book.active)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This book is retired' });
        if (book.loans.length)
          throw new TRPCError({ code: 'CONFLICT', message: 'This book is already checked out' });
        if (!student?.active)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose an active student' });
        const loan = await tx.libraryLoan.create({
          data: { bookId: book.id, studentId: student.id, checkedOutById: ctx.user.id, dueOn },
        });
        return { loan, hasReminderRecipient: student.guardians.length > 0 };
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'LibraryLoan',
          entityId: result.loan.id,
          meta: {
            barcode: input.barcode,
            dueOn: input.dueOn,
            source: 'library.checkout',
            studentId: input.studentId,
          },
        },
      });
      return result;
    }),

  checkin: librarianProcedure()
    .input(z.object({ barcode: libraryBarcodeSchema }))
    .mutation(async ({ ctx, input }) => {
      const loan = await ctx.withRls(async (tx) => {
        const book = await tx.libraryBook.findUnique({
          where: { barcode: input.barcode },
          include: { loans: { where: { returnedAt: null }, select: { id: true } } },
        });
        if (!book) throw new TRPCError({ code: 'NOT_FOUND', message: 'Library book not found' });
        const openLoan = book.loans[0];
        if (!openLoan)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This book is already available' });
        return tx.libraryLoan.update({
          where: { id: openLoan.id },
          data: { returnedAt: new Date(), returnedById: ctx.user.id },
        });
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'LibraryLoan',
          entityId: loan.id,
          meta: { barcode: input.barcode, source: 'library.checkin' },
        },
      });
      return loan;
    }),

  parentSummary: authedProcedure.query(async ({ ctx }) => {
    const loans = await ctx.withRls((tx) =>
      tx.libraryLoan.findMany({
        where: { student: { guardians: { some: { userId: ctx.user.id } } } },
        include: {
          book: { select: { barcode: true, title: true, author: true, coverUrl: true } },
          student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
        },
        orderBy: [{ returnedAt: 'asc' }, { dueOn: 'asc' }],
        take: 120,
      }),
    );
    const todayKey = libraryLondonDateKey(new Date());
    const inTwoDays = new Date(dateAtUtcMidnight(todayKey).getTime() + 2 * 86_400_000);
    const active = loans.filter((loan) => loan.returnedAt === null);
    return {
      active: active.map((loan) => ({
        ...loan,
        student: {
          id: loan.student.id,
          name: decrypt(ctx, loan.student.fullNameEnc),
          yearGroup: loan.student.yearGroup,
        },
      })),
      recentReturns: loans
        .filter((loan) => loan.returnedAt !== null)
        .slice(0, 20)
        .map((loan) => ({
          ...loan,
          student: {
            id: loan.student.id,
            name: decrypt(ctx, loan.student.fullNameEnc),
            yearGroup: loan.student.yearGroup,
          },
        })),
      actionCount: active.filter((loan) => loan.dueOn <= inTwoDays).length,
      today: todayKey,
    };
  }),
});
