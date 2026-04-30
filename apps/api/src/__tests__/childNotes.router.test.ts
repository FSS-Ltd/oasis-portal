import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { childLogRouter } from '../routers/childLog.js';
import { childNotesRouter } from '../routers/childNotes.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const supervisorUser: SessionUser = { id: 'u_sup', role: 'Supervisor', tags: [], requires2fa: false };
const sensitiveViewerUser: SessionUser = {
  id: 'u_sensitive',
  role: 'Supervisor',
  tags: ['sensitive-note-viewer'],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };

interface StoredChildNote {
  id: string;
  studentId: string;
  noteEnc: string;
  sensitive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChildNoteWhere {
  studentId: string;
  sensitive?: boolean;
  createdAt?: { gte: Date; lt: Date };
}

interface StoredChildNoteCreateInput {
  studentId: string;
  noteEnc: string;
  sensitive: boolean;
  createdById: string;
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeFakeDb() {
  const notes: StoredChildNote[] = [];
  const users = [
    { id: headUser.id, fullNameEnc: 'enc:Head User', role: headUser.role },
    { id: supervisorUser.id, fullNameEnc: 'enc:Supervisor User', role: supervisorUser.role },
    { id: sensitiveViewerUser.id, fullNameEnc: 'enc:Sensitive Viewer', role: sensitiveViewerUser.role },
  ];
  const db = {
    $enc: {
      encrypt: vi.fn((value: string | null | undefined) => (value ? `enc:${value}` : null)),
      decrypt: vi.fn(decrypt),
    },
    auditLog: { create: vi.fn(() => Promise.resolve({ id: 'audit' })) },
    student: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'student_1'
            ? { id: 'student_1', active: true, fullNameEnc: 'enc:Jane Learner', yearGroup: 'Year 6' }
            : null,
        ),
      ),
    },
    childNote: {
      create: vi.fn(({ data }: { data: StoredChildNoteCreateInput }) => {
        const minute = String(notes.length).padStart(2, '0');
        const rowNumber = String(notes.length + 1);
        const now = new Date(`2026-04-30T10:${minute}:00.000Z`);
        const row: StoredChildNote = {
          id: `note_${rowNumber}`,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        notes.push(row);
        return Promise.resolve(row);
      }),
      findMany: vi.fn(({ where, include }: { where: ChildNoteWhere; include?: { createdBy?: unknown } }) => {
        const rows = notes.filter((note) => {
          if (note.studentId !== where.studentId) return false;
          if (where.sensitive === false && note.sensitive) return false;
          if (where.createdAt) {
            return note.createdAt >= where.createdAt.gte && note.createdAt < where.createdAt.lt;
          }
          return true;
        });
        if (!include?.createdBy) return Promise.resolve(rows);
        return Promise.resolve(
          rows.map((note) => ({
            ...note,
            createdBy: users.find((user) => user.id === note.createdById) ?? users[0],
          })),
        );
      }),
    },
    attendance: {
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            id: 'att_1',
            date: day('2026-04-29'),
            status: 'Late',
            recordedById: headUser.id,
            createdAt: day('2026-04-29'),
          },
        ]),
      ),
    },
    pacePolicy: { findUnique: vi.fn(() => Promise.resolve({ passThreshold: 80 })) },
    meritLedger: {
      aggregate: vi.fn(() => Promise.resolve({ _sum: { delta: 17 } })),
    },
    paceRecord: {
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            id: 'pace_1',
            subjectId: 'subject_1',
            paceNumber: 1001,
            paceTestScore: 90,
            completedAt: day('2026-04-29'),
            createdAt: day('2026-04-29'),
            subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
            recordedById: supervisorUser.id,
            recordedBy: users.find((user) => user.id === supervisorUser.id),
          },
        ]),
      ),
    },
    behaviourEntry: {
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            id: 'behaviour_1',
            type: 'Merit',
            category: 'Focus',
            visibility: 'General',
            meritDelta: 3,
            recordedById: supervisorUser.id,
            createdAt: day('2026-04-29'),
            noteEnc: 'enc:Focused well',
            recordedBy: users.find((user) => user.id === supervisorUser.id),
          },
        ]),
      ),
    },
  };

  return { db, notes };
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>['db']): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  };
}

function makeCaller(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>['db']) {
  const appRouter = router({ childNotes: childNotesRouter, childLog: childLogRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('childNotes', () => {
  it('creates encrypted notes and filters sensitive notes by Head or tag', async () => {
    const { db, notes } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'General note',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Sensitive note',
      sensitive: true,
    });

    expect(notes.map((note) => note.noteEnc)).toEqual(['enc:General note', 'enc:Sensitive note']);
    expect(notes[0]?.createdById).toBe(supervisorUser.id);

    await expect(makeCaller(parentUser, db).childNotes.create({ studentId: 'student_1', note: 'x' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    await expect(makeCaller(supervisorUser, db).childNotes.listForStudent({ studentId: 'student_1' })).resolves.toMatchObject({
      notes: [{ note: 'General note', sensitive: false }],
    });
    const headNotes = await makeCaller(headUser, db).childNotes.listForStudent({ studentId: 'student_1' });
    expect(headNotes.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'Sensitive note', sensitive: true }),
        expect.objectContaining({ note: 'General note', sensitive: false }),
      ]),
    );
    const taggedNotes = await makeCaller(sensitiveViewerUser, db).childNotes.listForStudent({ studentId: 'student_1' });
    expect(taggedNotes.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'Sensitive note', sensitive: true }),
        expect.objectContaining({ note: 'General note', sensitive: false }),
      ]),
    );
  });
});

describe('childLog.snapshot', () => {
  it('returns attendance, passed tests, behaviour, and visible notes for the range', async () => {
    const { db } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Visible note',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Hidden note',
      sensitive: true,
    });

    const snapshot = await makeCaller(supervisorUser, db).childLog.snapshot({
      studentId: 'student_1',
      from: day('2026-04-29'),
      to: day('2026-04-30'),
    });

    expect(snapshot.tardiness).toHaveLength(1);
    expect(snapshot.passedTests).toMatchObject([{ subjectCode: 'MATH', score: 90 }]);
    expect(snapshot.behaviour).toMatchObject([{ type: 'Merit', meritDelta: 3, note: 'Focused well', recordedByName: 'Supervisor User' }]);
    expect(snapshot.notes).toMatchObject([{ note: 'Visible note', sensitive: false }]);
    expect(snapshot.student).toMatchObject({ supervisorName: 'Supervisor User', totalMerits: 17 });
  });
});
