import { describe, expect, it } from 'vitest';
import { libraryRouter } from '../routers/library.js';
import { makeTestContext } from './helpers/test-context.js';

describe('library borrower level search', () => {
  it.each(['Level 5', 'Year 6', 'Jane'])('finds a borrower by %s', async (search) => {
    const db = {
      $enc: { decrypt: (value: string) => value },
      student: {
        findMany: () => [
          {
            id: 'student-six',
            fullNameEnc: 'Jane Learner',
            yearGroup: 'Year 6',
            guardians: [],
          },
          {
            id: 'student-seven',
            fullNameEnc: 'Amos Scholar',
            yearGroup: 'Y7',
            guardians: [],
          },
        ],
      },
    };
    const caller = libraryRouter.createCaller(
      makeTestContext({
        db,
        rls: { kind: 'db', db },
        user: { id: 'librarian', role: 'Supervisor', tags: ['librarian'], requires2fa: false },
      }),
    );

    const rows = await caller.borrowers({ search });

    expect(rows).toEqual([
      {
        id: 'student-six',
        name: 'Jane Learner',
        yearGroup: 'Year 6',
        hasReminderRecipient: false,
      },
    ]);
  });
});
