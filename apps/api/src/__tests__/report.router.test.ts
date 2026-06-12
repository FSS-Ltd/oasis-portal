import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { REPORT_NOTIFICATION_EMAIL_SUBJECT, type EmailClient } from '../lib/email.js';
import { createReportRouter } from '../routers/report.js';
import { router } from '../trpc.js';

type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type BehaviourType = 'Merit' | 'Demerit' | 'General';
type BehaviourVisibility = 'General' | 'Sensitive';
type TermReportStatus = 'Draft' | 'UnderReview' | 'Sent';

const headUser: SessionUser = {
  id: 'ckreporthead000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'ckreportparent000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const linkedGuardianUser = {
  id: parentUser.id,
  role: parentUser.role,
  fullNameEnc: encrypt('Jane Parent') ?? '',
  emailEnc: encrypt('jane.parent@example.com') ?? '',
};
const otherParentUser: SessionUser = {
  id: 'ckreportparent000000002',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckreportsup000000000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const studentId = 'ckreportstudent000000001';
const subjectId = 'ckreportsubject000000001';
const reportId = 'ckreportterm00000000001';

interface StoredStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  subjects: Array<{
    subjectId: string;
    currentPaceNumber: number;
    subject: { code: string; name: string };
  }>;
}

interface StoredAttendance {
  studentId: string;
  date: Date;
  status: AttendanceStatus;
}

interface StoredPaceRecord {
  studentId: string;
  subjectId: string;
  selfTestScore: number | null;
  paceTestScore: number | null;
  completedAt: Date;
}

interface StoredBehaviourEntry {
  studentId: string;
  type: BehaviourType;
  category: string;
  noteEnc: string | null;
  visibility: BehaviourVisibility;
  meritDelta: number;
  deletedAt: Date | null;
  createdAt: Date;
}

interface StoredChildNote {
  studentId: string;
  noteEnc: string;
  sensitive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}

interface StoredLedgerRow {
  studentId: string;
  account:
    | 'Spend'
    | 'Saving'
    | 'Investment'
    | 'InvestmentReturn'
    | 'TithePaid'
    | 'Given'
    | 'FeeSink'
    | 'ShopReserved';
  delta: number;
  reason: string;
  createdAt: Date;
}

interface StoredTermReport {
  id: string;
  studentId: string;
  term: string;
  status: TermReportStatus;
  compiledJsonEnc: string;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  attendance: { findMany: ReturnType<typeof vi.fn> };
  behaviourEntry: { findMany: ReturnType<typeof vi.fn> };
  childNote: { findMany: ReturnType<typeof vi.fn> };
  guardian: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  meritLedger: { findMany: ReturnType<typeof vi.fn> };
  paceRecord: { findMany: ReturnType<typeof vi.fn> };
  student: { findUnique: ReturnType<typeof vi.fn> };
  termReport: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  reports: StoredTermReport[];
  behaviourEntries: StoredBehaviourEntry[];
}

interface AuditData {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}

function auditData(db: FakeDb): AuditData[] {
  return db.auditLog.create.mock.calls.map(
    (call: unknown[]) => (call[0] as { data: AuditData }).data,
  );
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function encrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `enc:${Buffer.from(value, 'utf8').toString('base64')}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!value.startsWith('enc:')) return value;
  return Buffer.from(value.slice(4), 'base64').toString('utf8');
}

function inRange(date: Date, range: { gte?: Date; lt?: Date } | undefined): boolean {
  if (!range) return true;
  if (range.gte && date < range.gte) return false;
  if (range.lt && date >= range.lt) return false;
  return true;
}

function makeStudent(): StoredStudent {
  const fullNameEnc = encrypt('Jane Learner');
  if (!fullNameEnc) throw new Error('test encryption failed');
  return {
    id: studentId,
    active: true,
    fullNameEnc,
    subjects: [
      {
        subjectId,
        currentPaceNumber: 1042,
        subject: { code: 'MATH', name: 'Mathematics' },
      },
    ],
  };
}

function makeFakeDb() {
  const student = makeStudent();
  const attendanceRows: StoredAttendance[] = [
    { studentId, date: day('2026-05-01'), status: 'Present' },
    { studentId, date: day('2026-05-02'), status: 'Present' },
    { studentId, date: day('2026-05-03'), status: 'Absent' },
    { studentId, date: day('2026-05-04'), status: 'Late' },
  ];
  const paceRows: StoredPaceRecord[] = [
    {
      studentId,
      subjectId,
      selfTestScore: null,
      paceTestScore: 90,
      completedAt: day('2026-05-10'),
    },
    {
      studentId,
      subjectId,
      selfTestScore: 80,
      paceTestScore: null,
      completedAt: day('2026-05-11'),
    },
  ];
  const behaviourEntries: StoredBehaviourEntry[] = [
    {
      studentId,
      type: 'Merit',
      category: 'Academic Excellence',
      noteEnc: encrypt('Great test'),
      visibility: 'General',
      meritDelta: 10,
      deletedAt: null,
      createdAt: day('2026-05-12'),
    },
    {
      studentId,
      type: 'Demerit',
      category: 'Correction',
      noteEnc: encrypt('Late work'),
      visibility: 'General',
      meritDelta: -5,
      deletedAt: null,
      createdAt: day('2026-05-13'),
    },
    {
      studentId,
      type: 'General',
      category: 'Character',
      noteEnc: encrypt('Served others well'),
      visibility: 'General',
      meritDelta: 0,
      deletedAt: null,
      createdAt: day('2026-05-14'),
    },
    {
      studentId,
      type: 'General',
      category: 'Private',
      noteEnc: encrypt('Sensitive note'),
      visibility: 'Sensitive',
      meritDelta: 0,
      deletedAt: null,
      createdAt: day('2026-05-15'),
    },
  ];
  const notes: StoredChildNote[] = [
    {
      studentId,
      noteEnc: encrypt('Reading has improved') ?? '',
      sensitive: false,
      deletedAt: null,
      createdAt: day('2026-05-16'),
    },
    {
      studentId,
      noteEnc: encrypt('Private family note') ?? '',
      sensitive: true,
      deletedAt: null,
      createdAt: day('2026-05-17'),
    },
  ];
  const ledgerRows: StoredLedgerRow[] = [
    {
      studentId,
      account: 'Spend',
      delta: 30,
      reason: 'Merit: Academic Excellence',
      createdAt: day('2026-05-01'),
    },
    {
      studentId,
      account: 'Saving',
      delta: 10,
      reason: 'Transfer to Saving',
      createdAt: day('2026-05-02'),
    },
    {
      studentId,
      account: 'TithePaid',
      delta: 4,
      reason: 'Weekly tithe',
      createdAt: day('2026-05-03'),
    },
  ];
  const reports: StoredTermReport[] = [];

  const db: FakeDb = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    attendance: {
      findMany: vi.fn(
        ({ where }: { where: { studentId: string; date?: { gte?: Date; lt?: Date } } }) =>
          Promise.resolve(
            attendanceRows
              .filter((row) => row.studentId === where.studentId && inRange(row.date, where.date))
              .map((row) => ({ status: row.status })),
          ),
      ),
    },
    behaviourEntry: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            studentId: string;
            createdAt?: { gte?: Date; lt?: Date };
            deletedAt?: null;
            visibility?: BehaviourVisibility;
          };
        }) =>
          Promise.resolve(
            behaviourEntries
              .filter((entry) => entry.studentId === where.studentId)
              .filter((entry) => inRange(entry.createdAt, where.createdAt))
              .filter((entry) => where.deletedAt !== null || entry.deletedAt === null)
              .filter((entry) => !where.visibility || entry.visibility === where.visibility)
              .map((entry) => ({
                type: entry.type,
                category: entry.category,
                noteEnc: entry.noteEnc,
                meritDelta: entry.meritDelta,
                createdAt: entry.createdAt,
              })),
          ),
      ),
    },
    childNote: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            studentId: string;
            createdAt?: { gte?: Date; lt?: Date };
            deletedAt?: null;
            sensitive?: boolean;
          };
        }) =>
          Promise.resolve(
            notes
              .filter((note) => note.studentId === where.studentId)
              .filter((note) => inRange(note.createdAt, where.createdAt))
              .filter((note) => where.deletedAt !== null || note.deletedAt === null)
              .filter((note) => where.sensitive === undefined || note.sensitive === where.sensitive)
              .map((note) => ({ noteEnc: note.noteEnc, createdAt: note.createdAt })),
          ),
      ),
    },
    guardian: {
      findMany: vi.fn(({ where }: { where: { studentId: string } }) =>
        Promise.resolve(where.studentId === studentId ? [{ user: linkedGuardianUser }] : []),
      ),
      findUnique: vi.fn(
        ({ where }: { where: { userId_studentId: { userId: string; studentId: string } } }) =>
          Promise.resolve(
            (where.userId_studentId.userId === parentUser.id ||
              where.userId_studentId.userId === supervisorUser.id) &&
              where.userId_studentId.studentId === studentId
              ? { studentId }
              : null,
          ),
      ),
    },
    meritLedger: {
      findMany: vi.fn(
        ({
          where,
          orderBy,
        }: {
          where: { studentId: string; createdAt?: { lt?: Date } };
          orderBy?: { createdAt: 'asc' | 'desc' };
        }) =>
          Promise.resolve(
            ledgerRows
              .filter((row) => row.studentId === where.studentId)
              .filter((row) => !where.createdAt?.lt || row.createdAt < where.createdAt.lt)
              .sort((a, b) =>
                orderBy?.createdAt === 'desc'
                  ? b.createdAt.getTime() - a.createdAt.getTime()
                  : a.createdAt.getTime() - b.createdAt.getTime(),
              )
              .map((row) => ({
                account: row.account,
                delta: row.delta,
                reason: row.reason,
                createdAt: row.createdAt,
              })),
          ),
      ),
    },
    paceRecord: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            studentId: string;
            subjectId?: { in: string[] };
            completedAt?: { gte?: Date; lt?: Date };
          };
        }) =>
          Promise.resolve(
            paceRows
              .filter((row) => row.studentId === where.studentId)
              .filter((row) => !where.subjectId || where.subjectId.in.includes(row.subjectId))
              .filter((row) => inRange(row.completedAt, where.completedAt))
              .map((row) => ({
                subjectId: row.subjectId,
                selfTestScore: row.selfTestScore,
                paceTestScore: row.paceTestScore,
              })),
          ),
      ),
    },
    student: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === student.id ? student : null),
      ),
    },
    termReport: {
      create: vi.fn(
        ({
          data,
        }: {
          data: Omit<StoredTermReport, 'id' | 'sentAt' | 'createdAt' | 'updatedAt'>;
        }) => {
          const now = new Date('2026-05-20T10:00:00.000Z');
          const report: StoredTermReport = {
            id: reportId,
            sentAt: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          reports.push(report);
          return Promise.resolve(report);
        },
      ),
      findMany: vi.fn(({ where }: { where: { studentId: string; status?: TermReportStatus } }) =>
        Promise.resolve(
          reports
            .filter((report) => report.studentId === where.studentId)
            .filter((report) => !where.status || report.status === where.status),
        ),
      ),
      findUnique: vi.fn(
        ({
          where,
        }: {
          where: { id: string } | { studentId_term: { studentId: string; term: string } };
        }) => {
          if ('id' in where) {
            return Promise.resolve(reports.find((report) => report.id === where.id) ?? null);
          }
          return Promise.resolve(
            reports.find(
              (report) =>
                report.studentId === where.studentId_term.studentId &&
                report.term === where.studentId_term.term,
            ) ?? null,
          );
        },
      ),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Partial<StoredTermReport> }) => {
          const report = reports.find((candidate) => candidate.id === where.id);
          if (!report) throw new Error('report not found');
          Object.assign(report, data, { updatedAt: new Date('2026-05-20T11:00:00.000Z') });
          return Promise.resolve(report);
        },
      ),
    },
    reports,
    behaviourEntries,
  };

  return db;
}

function makeFakeEmailClient(result = { id: 'report_email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_report_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb(), emailClient?: EmailClient) {
  const appRouter = router({
    report: createReportRouter({ emailClient: emailClient ?? makeFakeEmailClient().client }),
  });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

async function createDraft(db = makeFakeDb()) {
  const { caller } = makeCaller(headUser, db);
  const draft = await caller.report.draft({ studentId, term: '2026-Summer' });
  return { db, draft };
}

describe('report.draft', () => {
  it('compiles and stores an encrypted term report snapshot', async () => {
    const { caller, db } = makeCaller(headUser);

    const draft = await caller.report.draft({ studentId, term: '2026-Summer' });

    expect(draft).toMatchObject({
      id: reportId,
      studentId,
      term: '2026-Summer',
      status: 'Draft',
      compiled: {
        studentDisplayName: 'Jane Learner',
        attendance: { total: 4, present: 2, absent: 1, late: 1, attendancePct: 75 },
        behaviour: {
          meritsEarned: 10,
          demeritsCount: 1,
          demeritsMerits: 5,
        },
        balances: { Spend: 30, Saving: 10, TithePaid: 4 },
      },
    });
    expect(draft.compiled.paces).toEqual([
      {
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        currentPace: 1042,
        pacesCompletedThisTerm: 1,
        averageTestScore: 85,
      },
    ]);
    expect(draft.compiled.behaviour.generalEntries).toEqual([
      {
        createdAt: '2026-05-14T00:00:00.000Z',
        category: 'Character',
        note: 'Served others well',
      },
    ]);
    expect(draft.compiled.notes).toEqual([
      { createdAt: '2026-05-16T00:00:00.000Z', note: 'Reading has improved' },
    ]);
    expect(draft.compiled.meritActivity).toEqual([
      {
        createdAt: '2026-05-03T00:00:00.000Z',
        account: 'TithePaid',
        delta: 4,
        reason: 'Weekly tithe',
      },
      {
        createdAt: '2026-05-02T00:00:00.000Z',
        account: 'Saving',
        delta: 10,
        reason: 'Transfer to Saving',
      },
      {
        createdAt: '2026-05-01T00:00:00.000Z',
        account: 'Spend',
        delta: 30,
        reason: 'Merit: Academic Excellence',
      },
    ]);
    expect(db.reports[0]?.compiledJsonEnc).not.toContain('Jane Learner');
    expect(db.reports[0]?.compiledJsonEnc).not.toContain('Reading has improved');
    expect(auditData(db)).toContainEqual({
      userId: headUser.id,
      action: 'Create',
      entity: 'TermReport',
      entityId: reportId,
      meta: { source: 'report.draft', studentId, term: '2026-Summer' },
    });
  });

  it('rejects non-full-admin draft attempts', async () => {
    const { caller } = makeCaller(supervisorUser);

    await expect(caller.report.draft({ studentId, term: '2026-Summer' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('report.review and report.send', () => {
  it('updates the Head summary and moves the draft under review', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);

    const reviewed = await caller.report.review({
      reportId: draft.id,
      headSummary: 'A strong term with steady progress.',
    });

    expect(reviewed.status).toBe('UnderReview');
    expect(reviewed.compiled.headSummary).toBe('A strong term with steady progress.');
    expect(db.reports[0]?.compiledJsonEnc).not.toContain('strong term');
  });

  it('sends without recompiling later source data', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);
    db.behaviourEntries.push({
      studentId,
      type: 'Merit',
      category: 'Late addition',
      noteEnc: encrypt('Should not affect sent report'),
      visibility: 'General',
      meritDelta: 99,
      deletedAt: null,
      createdAt: day('2026-05-18'),
    });

    const sent = await caller.report.send({ reportId: draft.id });

    expect(sent.status).toBe('Sent');
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect(sent.compiled.behaviour.meritsEarned).toBe(10);
    expect(db.reports[0]?.status).toBe('Sent');
  });

  it('notifies linked guardians when a report is sent', async () => {
    const email = makeFakeEmailClient();
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db, email.client);

    await caller.report.send({ reportId: draft.id });

    expect(email.send).toHaveBeenCalledTimes(1);
    const sentEmail = email.send.mock.calls[0]?.[0];
    if (!sentEmail) throw new Error('expected report email send');
    expect(sentEmail.to).toBe('jane.parent@example.com');
    expect(sentEmail.subject).toBe(REPORT_NOTIFICATION_EMAIL_SUBJECT);
    expect(sentEmail.text).toContain('Jane Learner');
    expect(sentEmail.text).not.toContain('Reading has improved');

    const emailAudit = auditData(db).find(
      (entry) => entry.entity === 'Email' && entry.entityId === 'report_email_123',
    );
    expect(emailAudit).toMatchObject({
      userId: headUser.id,
      action: 'Create',
      entity: 'Email',
      meta: {
        source: 'report.send.notification',
        emailStatus: 'Sent',
        reportId: draft.id,
        studentId,
        subject: REPORT_NOTIFICATION_EMAIL_SUBJECT,
        term: '2026-Summer',
        toUserId: parentUser.id,
        toRole: parentUser.role,
      },
    });
  });

  it('rejects re-drafting a sent report before recompiling source data', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);
    await caller.report.send({ reportId: draft.id });
    db.attendance.findMany.mockClear();

    await expect(caller.report.draft({ studentId, term: '2026-Summer' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.attendance.findMany).not.toHaveBeenCalled();
  });
});

describe('report.listForStudent', () => {
  it('allows linked parents to read sent reports only', async () => {
    const { db, draft } = await createDraft();
    const headCaller = makeCaller(headUser, db).caller;
    await headCaller.report.send({ reportId: draft.id });
    await headCaller.report.draft({ studentId, term: '2026-Autumn' });

    const { caller } = makeCaller(parentUser, db);
    const result = await caller.report.listForStudent({ studentId });

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toMatchObject({
      id: reportId,
      status: 'Sent',
      compiled: { studentDisplayName: 'Jane Learner' },
    });
  });

  it('allows linked supervisors to read sent reports for linked children only', async () => {
    const { db, draft } = await createDraft();
    const headCaller = makeCaller(headUser, db).caller;
    await headCaller.report.send({ reportId: draft.id });
    await headCaller.report.draft({ studentId, term: '2026-Autumn' });

    const { caller } = makeCaller(supervisorUser, db);
    const result = await caller.report.listForStudent({ studentId });

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toMatchObject({
      id: reportId,
      status: 'Sent',
      compiled: { studentDisplayName: 'Jane Learner' },
    });
  });

  it('blocks parents from reading another student report', async () => {
    const { db } = await createDraft();
    const { caller } = makeCaller(otherParentUser, db);

    await expect(caller.report.listForStudent({ studentId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(
      auditData(db).some(
        (entry) =>
          entry.userId === otherParentUser.id &&
          entry.action === 'PermissionDenied' &&
          entry.entity === 'report.listForStudent' &&
          entry.entityId === studentId,
      ),
    ).toBe(true);
  });
});
