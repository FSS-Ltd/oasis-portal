import { afterEach, describe, expect, it, vi } from 'vitest';
import { libraryRouter } from '../routers/library.js';
import { makeTestContext } from './helpers/test-context.js';

const studentId = 'cstudent000000000000000001';
function fixture(role: 'Supervisor' | 'Parent' = 'Supervisor') {
  const findMany = vi.fn().mockResolvedValue([]);
  const students = vi.fn().mockResolvedValue([]);
  const db = {
    $enc: { decrypt: (value: string) => value, blindIndex: (value: string) => `hashed:${value}` },
    libraryLoan: { findMany },
    student: { findMany: students },
  };
  const caller = libraryRouter.createCaller(
    makeTestContext({
      db,
      rls: { kind: 'db', db },
      user: {
        id: 'reader',
        role,
        tags: role === 'Supervisor' ? ['librarian'] : [],
        requires2fa: false,
      },
    }),
  );
  return { caller, findMany, students };
}
function loan(id: string) {
  return {
    id,
    studentId,
    checkedOutAt: new Date('2026-06-01T12:00:00Z'),
    dueOn: new Date('2026-06-14T00:00:00Z'),
    returnedAt: null,
    book: { id: 'book', barcode: '123', title: 'A book', author: 'Author' },
    student: { id: studentId, fullNameEnc: 'Jane Learner', yearGroup: 'Year 6' },
  };
}
afterEach(() => vi.useRealTimers());

describe('staff library circulation reads', () => {
  it('filters overdue at the London calendar date, excluding books due today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T23:30:00Z'));
    const { caller, findMany } = fixture();
    const result = await caller.circulationPage({ status: 'Overdue', page: 1 });
    expect(result.today).toBe('2026-06-15');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { returnedAt: null, dueOn: { lt: new Date('2026-06-15T00:00:00Z') } },
      }),
    );
  });

  it('returns bounded loan pages and a next page without exposing internal fields', async () => {
    const { caller, findMany } = fixture();
    findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({ ...loan(String(i)), checkedOutById: 'private' })),
    );
    const result = await caller.circulationPage({ status: 'Open', page: 2, studentId });
    expect(result.items).toHaveLength(20);
    expect(result.nextPage).toBe(3);
    expect(result.items[0]?.student.name).toBe('Jane Learner');
    expect(result.items[0]).not.toHaveProperty('checkedOutById');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId, returnedAt: null },
        skip: 20,
        take: 21,
        orderBy: [{ dueOn: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('scopes the scanned title return list to the exact book ID', async () => {
    const { caller, findMany } = fixture();
    await caller.circulationPage({ status: 'Open', page: 1, bookId: 'cbook000000000000000000001' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookId: 'cbook000000000000000000001', returnedAt: null },
      }),
    );
  });

  it('keeps returned history scoped to the requested student, most recent first', async () => {
    const { caller, findMany } = fixture();
    await caller.circulationPage({ status: 'Returned', page: 1, studentId, search: 'Rhino' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId,
          returnedAt: { not: null },
          book: {
            OR: [
              { title: { contains: 'Rhino', mode: 'insensitive' } },
              { author: { contains: 'Rhino', mode: 'insensitive' } },
              { barcode: { contains: 'Rhino' } },
            ],
          },
        },
        orderBy: [{ returnedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('paginates student headers, including inactive students with historical loans', async () => {
    const { caller, students } = fixture();
    students.mockResolvedValue(
      Array.from({ length: 13 }, (_, i) => ({
        id: `student-${String(i)}`,
        fullNameEnc: 'Former pupil',
        yearGroup: 'Year 6',
        active: false,
        _count: { libraryLoans: 7 },
      })),
    );
    const result = await caller.borrowerHistoryPage({ page: 2, search: 'Former pupil' });
    expect(result.items).toHaveLength(12);
    expect(result.nextPage).toBe(3);
    expect(result.items[0]).toMatchObject({ name: 'Former pupil', totalLoans: 7, active: false });
    expect(students).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { libraryLoans: { some: {} }, nameBidx: 'hashed:Former pupil' },
        skip: 12,
        take: 13,
      }),
    );
  });

  it('denies staff circulation and child history to a parent without librarian access', async () => {
    const { caller, findMany, students } = fixture('Parent');
    await expect(caller.circulationPage({ status: 'All', page: 1 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.borrowerHistoryPage({ page: 1 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(students).not.toHaveBeenCalled();
  });

  it('rejects invalid page and student inputs before reading data', async () => {
    const { caller, findMany } = fixture();
    await expect(caller.circulationPage({ status: 'Open', page: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(
      caller.circulationPage({ status: 'All', page: 1, studentId: 'bad' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(findMany).not.toHaveBeenCalled();
  });
});
