import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { incidentSafeguardingNotesRouter } from '../routers/incident-safeguarding-notes.js';
import { router } from '../trpc.js';

const user = (role: SessionUser['role']): SessionUser => ({
  id: role,
  role,
  tags: [],
  requires2fa: false,
});

function makeDb() {
  const notes: Array<{
    id: string;
    reportId: string;
    authorId: string;
    bodyEnc: string;
    createdAt: Date;
    author: { fullNameEnc: string };
  }> = [];
  return {
    incidentReport: {
      findUnique: vi.fn().mockResolvedValue({ id: 'report-1', status: 'HeadReview' }),
    },
    incidentSafeguardingNote: {
      findMany: vi.fn().mockImplementation(() => Promise.resolve(notes)),
      create: vi
        .fn()
        .mockImplementation(
          ({ data }: { data: { reportId: string; authorId: string; bodyEnc: string } }) => {
            const note = {
              id: 'note-1',
              ...data,
              createdAt: new Date('2026-10-13T10:00:00.000Z'),
              author: { fullNameEnc: 'enc:Safeguarding Lead' },
            };
            notes.push(note);
            return Promise.resolve({ id: note.id });
          },
        ),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    $enc: {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace(/^enc:/u, ''),
    },
  };
}

function makeCaller(session: SessionUser, db: ReturnType<typeof makeDb>) {
  const ctx: AppContext = {
    db: db as unknown as AppContext['db'],
    user: session,
    accountAccessState: 'active',
    requestId: 'safeguarding-notes-test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  };
  return router({ safeguardingNotes: incidentSafeguardingNotesRouter }).createCaller(ctx);
}

describe('safeguarding lead notes', () => {
  it('allows a tagged staff member to add and read notes', async () => {
    const db = makeDb();
    const tagged = { ...user('ClubsLead'), tags: ['compliance-admin'] };
    await expect(
      makeCaller(tagged, db).safeguardingNotes.add({ reportId: 'report-1', body: 'Follow up.' }),
    ).resolves.toEqual({ id: 'note-1' });
    await expect(
      makeCaller(tagged, db).safeguardingNotes.list({ reportId: 'report-1' }),
    ).resolves.toHaveLength(1);
    await expect(
      makeCaller(user('ClubsLead'), db).safeguardingNotes.list({ reportId: 'report-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('encrypts appended notes and lets the Head read them', async () => {
    const db = makeDb();
    await expect(
      makeCaller(user('SafeguardingLead'), db).safeguardingNotes.add({
        reportId: 'report-1',
        body: '  Follow up with family.  ',
      }),
    ).resolves.toEqual({ id: 'note-1' });
    expect(db.incidentSafeguardingNote.create).toHaveBeenCalledWith({
      data: {
        reportId: 'report-1',
        authorId: 'SafeguardingLead',
        bodyEnc: 'enc:Follow up with family.',
      },
      select: { id: true },
    });
    await expect(
      makeCaller(user('Head'), db).safeguardingNotes.list({ reportId: 'report-1' }),
    ).resolves.toEqual([
      {
        id: 'note-1',
        body: 'Follow up with family.',
        authorName: 'Safeguarding Lead',
        createdAt: new Date('2026-10-13T10:00:00.000Z'),
      },
    ]);
  });

  it('keeps writing restricted to the Safeguarding Lead and reading to Lead or Head', async () => {
    const db = makeDb();
    await expect(
      makeCaller(user('Head'), db).safeguardingNotes.add({
        reportId: 'report-1',
        body: 'Not allowed',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(user('Supervisor'), db).safeguardingNotes.list({ reportId: 'report-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(user('Parent'), db).safeguardingNotes.list({ reportId: 'report-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not attach notes to a deletable draft', async () => {
    const db = makeDb();
    db.incidentReport.findUnique.mockResolvedValue({ id: 'report-1', status: 'Draft' });
    await expect(
      makeCaller(user('SafeguardingLead'), db).safeguardingNotes.add({
        reportId: 'report-1',
        body: 'Follow up.',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.incidentSafeguardingNote.create).not.toHaveBeenCalled();
  });
});
