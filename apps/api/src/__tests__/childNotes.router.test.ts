import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { childLogRouter } from '../routers/childLog.js';
import { childNotesRouter } from '../routers/childNotes.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const principalUser: SessionUser = { id: 'u_principal', role: 'Principal', tags: [], requires2fa: false };
const supervisorUser: SessionUser = { id: 'u_sup', role: 'Supervisor', tags: [], requires2fa: false };
const taggedSupervisorUser: SessionUser = {
  id: 'u_tagged_sup',
  role: 'Supervisor',
  tags: ['student-drillthrough-viewer'],
  requires2fa: false,
};
const sensitiveViewerUser: SessionUser = {
  id: 'u_sensitive',
  role: 'Supervisor',
  tags: ['sensitive-note-viewer'],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const unlinkedParentUser: SessionUser = { id: 'u_other_parent', role: 'Parent', tags: [], requires2fa: false };

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
  const students = [
    {
      id: 'student_1',
      active: true,
      fullNameEnc: 'enc:Jane Learner',
      yearGroup: 'Year 6',
      enrolmentDate: day('2024-09-01'),
      createdAt: day('2024-09-01'),
      subjects: [
        {
          subjectId: 'subject_1',
          currentPaceNumber: 1002,
          subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
        },
      ],
    },
  ];
  const guardians = [
    {
      id: 'guardian_1',
      userId: parentUser.id,
      studentId: 'student_1',
      student: students[0],
      createdAt: day('2024-09-01'),
    },
  ];
  const users = [
    { id: headUser.id, fullNameEnc: 'enc:Head User', role: headUser.role },
    { id: principalUser.id, fullNameEnc: 'enc:Principal User', role: principalUser.role },
    { id: supervisorUser.id, fullNameEnc: 'enc:Supervisor User', role: supervisorUser.role },
    { id: taggedSupervisorUser.id, fullNameEnc: 'enc:Tagged Supervisor', role: taggedSupervisorUser.role },
    { id: sensitiveViewerUser.id, fullNameEnc: 'enc:Sensitive Viewer', role: sensitiveViewerUser.role },
  ];
  const db = {
    $enc: {
      encrypt: vi.fn((value: string | null | undefined) => (value ? `enc:${value}` : null)),
      decrypt: vi.fn(decrypt),
    },
    auditLog: { create: vi.fn(() => Promise.resolve({ id: 'audit' })) },
    student: {
      findMany: vi.fn(() => Promise.resolve(students)),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const student = students.find((row) => row.id === where.id);
        if (!student) return Promise.resolve(null);
        return Promise.resolve(student);
      }),
    },
    guardian: {
      findUnique: vi.fn(({ where }: { where: { userId_studentId: { userId: string; studentId: string } } }) =>
        Promise.resolve(
          guardians.find(
            (guardian) =>
              guardian.userId === where.userId_studentId.userId &&
              guardian.studentId === where.userId_studentId.studentId,
          ) ?? null,
        ),
      ),
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(guardians.filter((guardian) => guardian.userId === where.userId)),
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
      groupBy: vi.fn(() =>
        Promise.resolve([
          { account: 'Spend', _sum: { delta: 10 } },
          { account: 'Saving', _sum: { delta: 5 } },
          { account: 'Investment', _sum: { delta: 2 } },
        ]),
      ),
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
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: { visibility?: 'General'; createdAt?: { gte: Date; lt: Date }; studentId?: string };
        }) => {
          const rows = [
          {
            id: 'behaviour_1',
            studentId: 'student_1',
            type: 'Merit',
            category: 'Focus',
            visibility: 'General',
            meritDelta: 3,
            recordedById: supervisorUser.id,
            createdAt: day('2026-04-29'),
            noteEnc: 'enc:Focused well',
            recordedBy: users.find((user) => user.id === supervisorUser.id),
          },
          {
            id: 'behaviour_2',
            studentId: 'student_1',
            type: 'Demerit',
            category: 'Pastoral',
            visibility: 'Sensitive',
            meritDelta: -5,
            recordedById: headUser.id,
            createdAt: day('2026-04-29'),
            noteEnc: 'enc:Sensitive behaviour',
            recordedBy: users.find((user) => user.id === headUser.id),
          },
          ];
          return Promise.resolve(
            rows
              .filter((row) => where?.studentId === undefined || row.studentId === where.studentId)
              .filter((row) => where?.visibility === undefined || row.visibility === where.visibility)
              .filter(
                (row) =>
                  where?.createdAt === undefined ||
                  (row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt),
              ),
          );
        },
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
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
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

  it('lists only accessible students for linked parents', async () => {
    const { db } = makeFakeDb();
    await expect(makeCaller(parentUser, db).childLog.listAccessibleStudents()).resolves.toMatchObject([
      { id: 'student_1', fullName: 'Jane Learner', yearGroup: 'Year 6' },
    ]);
    await expect(makeCaller(unlinkedParentUser, db).childLog.listAccessibleStudents()).resolves.toEqual([]);
  });

  it('returns drill-through data and sensitive behaviour only to Head', async () => {
    const { db } = makeFakeDb();

    const headView = await makeCaller(headUser, db).childLog.drillThrough({ studentId: 'student_1' });
    expect(headView.metrics.meritBalances).toEqual({ Spend: 10, Saving: 5, Investment: 2 });
    expect(headView.metrics.pacesCompletedThisAcademicYear).toBe(1);
    expect(headView.behaviour).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ visibility: 'General', note: 'Focused well' }),
        expect.objectContaining({ visibility: 'Sensitive', note: 'Sensitive behaviour' }),
      ]),
    );

    const principalView = await makeCaller(principalUser, db).childLog.drillThrough({
      studentId: 'student_1',
    });
    expect(principalView.behaviour).toEqual([
      expect.objectContaining({ visibility: 'General', note: 'Focused well' }),
    ]);
  });

  it('allows tagged staff and linked parents, and denies untagged staff or unlinked parents', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(taggedSupervisorUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).resolves.toMatchObject({ student: { id: 'student_1', fullName: 'Jane Learner' } });
    await expect(
      makeCaller(parentUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).resolves.toMatchObject({ student: { id: 'student_1', fullName: 'Jane Learner' } });
    await expect(
      makeCaller(supervisorUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(unlinkedParentUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
