import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REPORT_SECTIONS,
  type ReportSections,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { REPORT_NOTIFICATION_EMAIL_SUBJECT, type EmailClient } from '../lib/email.js';
import type {
  GenerateStudentReportPdfInput,
  GeneratedStudentReportPdf,
} from '../reports/student-report-pdf.js';
import { createReportRouter } from '../routers/report.js';
import { router } from '../trpc.js';

type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type BehaviourType = 'Merit' | 'Demerit' | 'General';
type BehaviourVisibility = 'General' | 'Sensitive';
type TermReportStatus = 'Draft' | 'UnderReview' | 'Sent';
type ReportPeriodType = 'Term' | 'AcademicYear' | 'Custom';

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
  yearGroup: string;
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
  id: string;
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
  id: string;
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
  periodKey: string;
  periodType: ReportPeriodType;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  status: TermReportStatus;
  compiledJsonEnc: string;
  pdfBytesEnc: string | null;
  pdfFileNameEnc: string | null;
  pdfGeneratedAt: Date | null;
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
  user: { findUnique: ReturnType<typeof vi.fn> };
  termReport: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  reports: StoredTermReport[];
  behaviourEntries: StoredBehaviourEntry[];
  ledgerRows: StoredLedgerRow[];
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
    yearGroup: 'Year 3',
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
      id: 'ckbehaviourreport000001',
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
      id: 'ckbehaviourreport000002',
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
      id: 'ckbehaviourreport000003',
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
      id: 'ckbehaviourreport000004',
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
      id: 'ckchildnotereport000001',
      studentId,
      noteEnc: encrypt('Reading has improved') ?? '',
      sensitive: false,
      deletedAt: null,
      createdAt: day('2026-05-16'),
    },
    {
      id: 'ckchildnotereport000002',
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
  const cloneReport = (report: StoredTermReport): StoredTermReport => ({ ...report });

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
                id: entry.id,
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
              .map((note) => ({ id: note.id, noteEnc: note.noteEnc, createdAt: note.createdAt })),
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
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === headUser.id ? { fullNameEnc: encrypt('Harriet Head') } : null,
        ),
      ),
    },
    termReport: {
      create: vi.fn(
        ({
          data,
        }: {
          data: Omit<
            StoredTermReport,
            | 'id'
            | 'pdfBytesEnc'
            | 'pdfFileNameEnc'
            | 'pdfGeneratedAt'
            | 'sentAt'
            | 'createdAt'
            | 'updatedAt'
          >;
        }) => {
          const now = new Date('2026-05-20T10:00:00.000Z');
          const report: StoredTermReport = {
            id: reportId,
            pdfBytesEnc: null,
            pdfFileNameEnc: null,
            pdfGeneratedAt: null,
            sentAt: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          reports.push(report);
          return Promise.resolve(cloneReport(report));
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
          where:
            | { id: string }
            | { studentId_periodKey: { studentId: string; periodKey: string } };
        }) => {
          if ('id' in where) {
            const report = reports.find((candidate) => candidate.id === where.id);
            return Promise.resolve(report ? cloneReport(report) : null);
          }
          const report = reports.find(
              (report) =>
                report.studentId === where.studentId_periodKey.studentId &&
                report.periodKey === where.studentId_periodKey.periodKey,
            );
          return Promise.resolve(report ? cloneReport(report) : null);
        },
      ),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Partial<StoredTermReport> }) => {
          const report = reports.find((candidate) => candidate.id === where.id);
          if (!report) throw new Error('report not found');
          Object.assign(report, data, { updatedAt: new Date(report.updatedAt.getTime() + 1) });
          return Promise.resolve(cloneReport(report));
        },
      ),
      updateMany: vi.fn(
        ({
          where,
          data,
        }: {
          where: {
            id: string;
            status: TermReportStatus;
            updatedAt: Date;
            compiledJsonEnc: string;
          };
          data: Partial<StoredTermReport>;
        }) => {
          const report = reports.find(
            (candidate) =>
              candidate.id === where.id &&
              candidate.status === where.status &&
              candidate.updatedAt.getTime() === where.updatedAt.getTime() &&
              candidate.compiledJsonEnc === where.compiledJsonEnc,
          );
          if (!report) return Promise.resolve({ count: 0 });
          Object.assign(report, data, { updatedAt: new Date(report.updatedAt.getTime() + 1) });
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    reports,
    behaviourEntries,
    ledgerRows,
  };

  return db;
}

function makeFakeEmailClient(result = { id: 'report_email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

type PdfGenerator = (
  input: GenerateStudentReportPdfInput,
) => Promise<GeneratedStudentReportPdf>;

function makeFakePdfGenerator(
  result: GeneratedStudentReportPdf = {
    bytes: Uint8Array.from([37, 80, 68, 70, 45, 49, 46, 55]),
    fileName: 'Jane-Learner-Summer-2026-report.pdf',
    mimeType: 'application/pdf',
  },
) {
  const generate = vi.fn<PdfGenerator>().mockResolvedValue(result);
  return { generate, result };
}

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_report_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeCaller(
  user: SessionUser | null,
  db = makeFakeDb(),
  deps: { emailClient?: EmailClient; pdfGenerator?: PdfGenerator } = {},
) {
  const appRouter = router({
    report: createReportRouter({
      emailClient: deps.emailClient ?? makeFakeEmailClient().client,
      pdfGenerator: deps.pdfGenerator ?? makeFakePdfGenerator().generate,
    }),
  });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

function defaultDraftInput() {
  return {
    studentId,
    period: { type: 'Term' as const, term: '2026-Summer' },
    sections: { ...DEFAULT_REPORT_SECTIONS } satisfies ReportSections,
  };
}

function defaultReviewInput(reportIdValue: string) {
  return {
    reportId: reportIdValue,
    progressComment: '',
    behaviourNotes: [],
    generalNotes: [],
  };
}

async function createDraft(db = makeFakeDb()) {
  const { caller } = makeCaller(headUser, db);
  const draft = await caller.report.draft(defaultDraftInput());
  return { db, draft };
}

describe('report.draft', () => {
  it('compiles and stores an encrypted student report snapshot', async () => {
    const { caller, db } = makeCaller(headUser);

    const draft = await caller.report.draft(defaultDraftInput());

    expect(draft).toMatchObject({
      id: reportId,
      studentId,
      period: {
        type: 'Term',
        key: '2026-Summer',
        label: 'Summer 2026',
        from: '2026-04-01',
        to: '2026-08-31',
      },
      status: 'Draft',
      compiled: {
        studentDisplayName: 'Jane Learner',
        sections: DEFAULT_REPORT_SECTIONS,
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
        status: {
          status: 'Ahead',
          tone: 'green',
          testingLevel: 4,
          testingLevelLabel: 'Testing at Level 4',
          detail: 'Testing at Level 4',
        },
      },
    ]);
    expect(draft.compiled.behaviour.generalEntries).toEqual([
      {
        id: 'ckbehaviourreport000003',
        origin: 'Source',
        createdAt: '2026-05-14T00:00:00.000Z',
        category: 'Character',
        note: 'Served others well',
      },
    ]);
    expect(draft.compiled.notes).toEqual([
      {
        id: 'ckchildnotereport000001',
        origin: 'Source',
        createdAt: '2026-05-16T00:00:00.000Z',
        note: 'Reading has improved',
      },
    ]);
    expect(draft.compiled.author).toEqual({ name: 'Harriet Head', role: 'Head of Centre' });
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
      meta: { source: 'report.draft', studentId, periodKey: '2026-Summer' },
    });
  });

  it('uses pre-period ledger rows for balances without exposing them as period activity', async () => {
    const { caller, db } = makeCaller(headUser);
    db.ledgerRows.push({
      studentId,
      account: 'Spend',
      delta: 5,
      reason: 'Previous term balance',
      createdAt: day('2026-03-31'),
    });

    const draft = await caller.report.draft(defaultDraftInput());

    expect(draft.compiled.balances.Spend).toBe(35);
    expect(draft.compiled.meritActivity).not.toContainEqual(
      expect.objectContaining({ reason: 'Previous term balance' }),
    );
  });

  it.each([
    [
      { type: 'Term' as const, term: '2026-Summer' },
      { key: '2026-Summer', from: '2026-04-01', to: '2026-08-31' },
    ],
    [
      { type: 'AcademicYear' as const, startYear: 2025 },
      { key: '2025-AcademicYear', from: '2025-09-01', to: '2026-08-31' },
    ],
    [
      { type: 'Custom' as const, from: '2026-05-10', to: '2026-05-12' },
      { key: '2026-05-10_to_2026-05-12', from: '2026-05-10', to: '2026-05-12' },
    ],
  ])('compiles a %s period with frozen metadata', async (period, expected) => {
    const { caller } = makeCaller(headUser);

    const draft = await caller.report.draft({
      studentId,
      period,
      sections: { ...DEFAULT_REPORT_SECTIONS },
    });

    expect(draft.period).toMatchObject(expected);
    expect(draft.compiled.period).toMatchObject(expected);
  });

  it('copies only selected sections and freezes PACE status', async () => {
    const { caller, db } = makeCaller(headUser);
    const draft = await caller.report.draft({
      ...defaultDraftInput(),
      sections: {
        ...DEFAULT_REPORT_SECTIONS,
        behaviourNotes: false,
        generalNotes: false,
        meritActivity: false,
      },
    });

    expect(draft.compiled.sections.behaviourNotes).toBe(false);
    expect(draft.compiled.behaviour.generalEntries).toEqual([]);
    expect(draft.compiled.notes).toEqual([]);
    expect(draft.compiled.meritActivity).toEqual([]);
    expect(draft.compiled.paces[0]?.status.status).toBe('Ahead');
    expect(db.$enc.decrypt).not.toHaveBeenCalledWith(encrypt('Served others well'));
    expect(db.$enc.decrypt).not.toHaveBeenCalledWith(encrypt('Reading has improved'));
  });

  it('treats both custom date endpoints as inclusive', async () => {
    const { caller } = makeCaller(headUser);
    const draft = await caller.report.draft({
      ...defaultDraftInput(),
      period: { type: 'Custom', from: '2026-05-12', to: '2026-05-12' },
    });

    expect(draft.compiled.behaviour.meritsEarned).toBe(10);
    expect(draft.compiled.attendance.total).toBe(0);
  });

  it('rejects impossible custom dates as a bad request', async () => {
    const { caller } = makeCaller(headUser);

    await expect(
      caller.report.draft({
        ...defaultDraftInput(),
        period: { type: 'Custom', from: '2026-02-30', to: '2026-03-01' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects non-full-admin draft attempts', async () => {
    const { caller } = makeCaller(supervisorUser);

    await expect(caller.report.draft(defaultDraftInput())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('report.review and report.send', () => {
  it('updates the Progress Comment and moves the draft under review', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);

    const reviewed = await caller.report.review({
      ...defaultReviewInput(draft.id),
      progressComment: 'A strong term with steady progress.',
    });

    expect(reviewed.status).toBe('UnderReview');
    expect(reviewed.compiled.headSummary).toBe('A strong term with steady progress.');
    expect(db.reports[0]?.compiledJsonEnc).not.toContain('strong term');
  });

  it('adds, edits, and removes only report-specific notes', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);
    const behaviourId = '3caaf78c-c3be-4eb6-948b-0c93799c8d22';
    const generalId = '8957af68-17a3-4790-a703-2f11cab89654';

    const reviewed = await caller.report.review({
      reportId: draft.id,
      progressComment: 'Jane is making steady progress.',
      behaviourNotes: [
        { id: behaviourId, category: 'Character', note: 'Shows initiative.' },
      ],
      generalNotes: [{ id: generalId, note: 'Enjoys independent reading.' }],
    });

    expect(reviewed.compiled.headSummary).toBe('Jane is making steady progress.');
    expect(reviewed.compiled.behaviour.generalEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: behaviourId,
          origin: 'Report',
          note: 'Shows initiative.',
        }),
        expect.objectContaining({ origin: 'Source', note: 'Served others well' }),
      ]),
    );
    expect(reviewed.compiled.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: generalId,
          origin: 'Report',
          note: 'Enjoys independent reading.',
        }),
        expect.objectContaining({ origin: 'Source', note: 'Reading has improved' }),
      ]),
    );

    const edited = await caller.report.review({
      ...defaultReviewInput(draft.id),
      progressComment: 'Jane is making steady progress.',
      behaviourNotes: [
        { id: behaviourId, category: 'Character', note: 'Shows consistent initiative.' },
      ],
    });
    expect(edited.compiled.behaviour.generalEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: behaviourId, note: 'Shows consistent initiative.' }),
      ]),
    );
    expect(edited.compiled.behaviour.generalEntries).toEqual(
      expect.arrayContaining([expect.objectContaining({ origin: 'Source' })]),
    );

    const removed = await caller.report.review(defaultReviewInput(draft.id));
    expect(removed.compiled.behaviour.generalEntries).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ origin: 'Report' })]),
    );
    expect(removed.compiled.notes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ origin: 'Report' })]),
    );
    expect(removed.compiled.behaviour.generalEntries).toEqual(
      expect.arrayContaining([expect.objectContaining({ origin: 'Source' })]),
    );
  });

  it('preserves report additions and Progress Comment when a draft is refreshed', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, db);
    const draft = await caller.report.draft(defaultDraftInput());
    const manualId = '3caaf78c-c3be-4eb6-948b-0c93799c8d22';
    await caller.report.review({
      reportId: draft.id,
      progressComment: 'Keep this progress comment.',
      behaviourNotes: [{ id: manualId, category: 'Character', note: 'Keep this note.' }],
      generalNotes: [],
    });
    db.behaviourEntries.push({
      id: 'ckbehaviourreport000006',
      studentId,
      type: 'General',
      category: 'Service',
      noteEnc: encrypt('New source note'),
      visibility: 'General',
      meritDelta: 0,
      deletedAt: null,
      createdAt: day('2026-05-18'),
    });

    const refreshed = await caller.report.draft(defaultDraftInput());

    expect(refreshed.status).toBe('Draft');
    expect(refreshed.compiled.headSummary).toBe('Keep this progress comment.');
    expect(refreshed.compiled.behaviour.generalEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: manualId, origin: 'Report', note: 'Keep this note.' }),
        expect.objectContaining({ origin: 'Source', note: 'New source note' }),
      ]),
    );
  });

  it('preserves report additions while their sections are hidden and later restored', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);
    const behaviourId = 'aa11396e-4620-4708-93f4-a1b0ec354517';
    const generalId = 'dfe63dcf-ad74-4a37-8e30-8be96b182fc2';
    await caller.report.review({
      reportId: draft.id,
      progressComment: 'Keep all report-only content.',
      behaviourNotes: [{ id: behaviourId, category: 'Character', note: 'Keep behaviour note.' }],
      generalNotes: [{ id: generalId, note: 'Keep general note.' }],
    });

    const hidden = await caller.report.draft({
      ...defaultDraftInput(),
      sections: {
        ...DEFAULT_REPORT_SECTIONS,
        behaviourNotes: false,
        generalNotes: false,
      },
    });

    expect(hidden.compiled.sections.behaviourNotes).toBe(false);
    expect(hidden.compiled.sections.generalNotes).toBe(false);
    expect(hidden.compiled.behaviour.generalEntries).toContainEqual(
      expect.objectContaining({ id: behaviourId, origin: 'Report', note: 'Keep behaviour note.' }),
    );
    expect(hidden.compiled.notes).toContainEqual(
      expect.objectContaining({ id: generalId, origin: 'Report', note: 'Keep general note.' }),
    );

    const restored = await caller.report.draft(defaultDraftInput());
    expect(restored.compiled.behaviour.generalEntries).toContainEqual(
      expect.objectContaining({ id: behaviourId, origin: 'Report', note: 'Keep behaviour note.' }),
    );
    expect(restored.compiled.notes).toContainEqual(
      expect.objectContaining({ id: generalId, origin: 'Report', note: 'Keep general note.' }),
    );
  });

  it('rejects invalid report-specific note payloads', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);
    const duplicateId = '3caaf78c-c3be-4eb6-948b-0c93799c8d22';

    await expect(
      caller.report.review({
        ...defaultReviewInput(draft.id),
        behaviourNotes: [
          { id: duplicateId, note: 'First note.' },
          { id: duplicateId, note: 'Second note.' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.report.review({
        ...defaultReviewInput(draft.id),
        generalNotes: [{ id: duplicateId, note: '   ' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.report.review({
        ...defaultReviewInput(draft.id),
        progressComment: 'x'.repeat(5001),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('keeps sent report content immutable', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);
    await caller.report.send({ reportId: draft.id });

    await expect(
      caller.report.review({
        ...defaultReviewInput(draft.id),
        progressComment: 'Too late to change.',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('sends without recompiling later source data', async () => {
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db);
    db.behaviourEntries.push({
      id: 'ckbehaviourreport000005',
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

  it('generates and encrypts the exact final PDF before marking the report sent', async () => {
    const { db, draft } = await createDraft();
    const pdf = makeFakePdfGenerator();
    pdf.generate.mockImplementation(() => {
      expect(db.reports[0]?.status).toBe('Draft');
      return Promise.resolve(pdf.result);
    });
    const { caller } = makeCaller(headUser, db, { pdfGenerator: pdf.generate });

    const sent = await caller.report.send({ reportId: draft.id });
    const stored = db.reports[0];

    const generatedInput = pdf.generate.mock.calls[0]?.[0];
    if (!generatedInput) throw new Error('expected PDF generation input');
    expect(generatedInput.report).toMatchObject({
      studentId,
      studentDisplayName: 'Jane Learner',
      period: draft.period,
    });
    expect(generatedInput.generatedAt).toBeInstanceOf(Date);
    expect(sent.status).toBe('Sent');
    expect(stored?.pdfGeneratedAt).toEqual(stored?.sentAt);
    expect(stored?.pdfBytesEnc).not.toContain(Buffer.from(pdf.result.bytes).toString('base64'));
    expect(decrypt(stored?.pdfBytesEnc)).toBe(Buffer.from(pdf.result.bytes).toString('base64'));
    expect(decrypt(stored?.pdfFileNameEnc)).toBe(pdf.result.fileName);
    const sendAudit = auditData(db).find((entry) => entry.meta?.['source'] === 'report.send');
    expect(sendAudit).toMatchObject({
      action: 'Update',
      entity: 'TermReport',
      entityId: draft.id,
      meta: { source: 'report.send' },
    });
  });

  it('keeps the report unsent and skips notifications when final PDF generation fails', async () => {
    const email = makeFakeEmailClient();
    const { db, draft } = await createDraft();
    const pdfGenerator = vi.fn<PdfGenerator>().mockRejectedValue(new Error('renderer failed'));
    const { caller } = makeCaller(headUser, db, {
      emailClient: email.client,
      pdfGenerator,
    });

    await expect(caller.report.send({ reportId: draft.id })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Could not generate the report PDF. Please try again.',
    });

    expect(db.reports[0]).toMatchObject({
      status: 'Draft',
      sentAt: null,
      pdfGeneratedAt: null,
      pdfBytesEnc: null,
      pdfFileNameEnc: null,
    });
    expect(db.termReport.update).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('allows only one concurrent send to freeze and notify a report', async () => {
    const email = makeFakeEmailClient();
    const { db, draft } = await createDraft();
    const firstPdf = deferred<GeneratedStudentReportPdf>();
    const secondPdf = deferred<GeneratedStudentReportPdf>();
    const pdf = makeFakePdfGenerator();
    pdf.generate
      .mockImplementationOnce(() => firstPdf.promise)
      .mockImplementationOnce(() => secondPdf.promise);
    const firstCaller = makeCaller(headUser, db, {
      emailClient: email.client,
      pdfGenerator: pdf.generate,
    }).caller;
    const secondCaller = makeCaller(headUser, db, {
      emailClient: email.client,
      pdfGenerator: pdf.generate,
    }).caller;

    const firstSend = firstCaller.report.send({ reportId: draft.id });
    await vi.waitFor(() => {
      expect(pdf.generate).toHaveBeenCalledTimes(1);
    });
    const secondSend = secondCaller.report.send({ reportId: draft.id });
    await vi.waitFor(() => {
      expect(pdf.generate).toHaveBeenCalledTimes(2);
    });
    firstPdf.resolve(pdf.result);
    secondPdf.resolve(pdf.result);

    const results = await Promise.allSettled([firstSend, secondSend]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(auditData(db).filter((entry) => entry.meta?.['source'] === 'report.send')).toHaveLength(1);
    expect(db.reports[0]?.status).toBe('Sent');
  });

  it('rejects a stale send when review changes the frozen snapshot first', async () => {
    const email = makeFakeEmailClient();
    const { db, draft } = await createDraft();
    const pendingPdf = deferred<GeneratedStudentReportPdf>();
    const pdf = makeFakePdfGenerator();
    pdf.generate.mockImplementationOnce(() => pendingPdf.promise);
    const { caller } = makeCaller(headUser, db, {
      emailClient: email.client,
      pdfGenerator: pdf.generate,
    });

    const send = caller.report.send({ reportId: draft.id });
    await vi.waitFor(() => {
      expect(pdf.generate).toHaveBeenCalledTimes(1);
    });
    const reviewed = await caller.report.review({
      ...defaultReviewInput(draft.id),
      progressComment: 'Reviewed while the old PDF was rendering.',
    });
    pendingPdf.resolve(pdf.result);

    await expect(send).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(reviewed.status).toBe('UnderReview');
    expect(db.reports[0]?.status).toBe('UnderReview');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('rejects a stale draft refresh when send freezes the report first', async () => {
    const email = makeFakeEmailClient();
    const { db, draft } = await createDraft();
    const pendingAttendance = deferred<Array<{ status: AttendanceStatus }>>();
    db.attendance.findMany.mockImplementationOnce(() => pendingAttendance.promise);
    const { caller } = makeCaller(headUser, db, { emailClient: email.client });

    const refresh = caller.report.draft(defaultDraftInput());
    await vi.waitFor(() => {
      expect(db.attendance.findMany).toHaveBeenCalledTimes(2);
    });
    await caller.report.send({ reportId: draft.id });
    pendingAttendance.resolve([{ status: 'Present' }]);

    await expect(refresh).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.reports[0]?.status).toBe('Sent');
    expect(db.reports[0]?.pdfGeneratedAt).toBeInstanceOf(Date);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('notifies linked guardians when a report is sent', async () => {
    const email = makeFakeEmailClient();
    const { db, draft } = await createDraft();
    const { caller } = makeCaller(headUser, db, { emailClient: email.client });

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
        periodLabel: 'Summer 2026',
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

    await expect(caller.report.draft(defaultDraftInput())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.attendance.findMany).not.toHaveBeenCalled();
  });
});

describe('report.downloadPdf', () => {
  it('allows an administrator to preview a draft from its frozen snapshot', async () => {
    const { db, draft } = await createDraft();
    const pdf = makeFakePdfGenerator();
    const { caller } = makeCaller(headUser, db, { pdfGenerator: pdf.generate });

    const download = await caller.report.downloadPdf({ reportId: draft.id });

    expect(download).toEqual({
      reportId: draft.id,
      fileName: pdf.result.fileName,
      mimeType: 'application/pdf',
      pdfBase64: Buffer.from(pdf.result.bytes).toString('base64'),
    });
    const generatedInput = pdf.generate.mock.calls[0]?.[0];
    if (!generatedInput) throw new Error('expected PDF generation input');
    expect(generatedInput.report).toMatchObject({
      studentId,
      period: draft.period,
      compiledAt: draft.compiled.compiledAt,
    });
    expect(generatedInput.generatedAt).toBeInstanceOf(Date);
    expect(db.reports[0]?.pdfGeneratedAt).toBeNull();
  });

  it('returns the exact stored sent bytes to a linked parent without regenerating', async () => {
    const { db, draft } = await createDraft();
    const finalPdf = makeFakePdfGenerator({
      bytes: Uint8Array.from([37, 80, 68, 70, 45, 102, 105, 110, 97, 108]),
      fileName: 'Jane-Learner-final-report.pdf',
      mimeType: 'application/pdf',
    });
    await makeCaller(headUser, db, { pdfGenerator: finalPdf.generate }).caller.report.send({
      reportId: draft.id,
    });
    const shouldNotRegenerate = vi
      .fn<PdfGenerator>()
      .mockRejectedValue(new Error('stored reports must not regenerate'));

    const download = await makeCaller(parentUser, db, {
      pdfGenerator: shouldNotRegenerate,
    }).caller.report.downloadPdf({ reportId: draft.id });

    expect(download.fileName).toBe(finalPdf.result.fileName);
    expect(Buffer.from(download.pdfBase64, 'base64')).toEqual(Buffer.from(finalPdf.result.bytes));
    expect(shouldNotRegenerate).not.toHaveBeenCalled();
  });

  it('rejects parent downloads for drafts and reports belonging to unlinked students', async () => {
    const { db, draft } = await createDraft();

    await expect(
      makeCaller(parentUser, db).caller.report.downloadPdf({ reportId: draft.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(auditData(db)).toContainEqual(
      expect.objectContaining({
        userId: parentUser.id,
        action: 'PermissionDenied',
        entity: 'report.downloadPdf',
        entityId: draft.id,
      }),
    );

    await makeCaller(headUser, db).caller.report.send({ reportId: draft.id });
    await expect(
      makeCaller(otherParentUser, db).caller.report.downloadPdf({ reportId: draft.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('generates legacy PDFs from the encrypted frozen snapshot without rewriting it', async () => {
    const { db, draft } = await createDraft();
    const stored = db.reports[0];
    if (!stored) throw new Error('expected stored report');
    stored.status = 'Sent';
    stored.sentAt = new Date('2026-05-20T12:00:00.000Z');
    stored.pdfGeneratedAt = null;
    stored.pdfBytesEnc = null;
    stored.pdfFileNameEnc = null;
    const pdf = makeFakePdfGenerator();

    const download = await makeCaller(headUser, db, {
      pdfGenerator: pdf.generate,
    }).caller.report.downloadPdf({ reportId: draft.id });

    expect(download.pdfBase64).toBe(Buffer.from(pdf.result.bytes).toString('base64'));
    const generatedInput = pdf.generate.mock.calls[0]?.[0];
    if (!generatedInput) throw new Error('expected PDF generation input');
    expect(generatedInput.report).toMatchObject({
      studentId,
      compiledAt: draft.compiled.compiledAt,
    });
    expect(generatedInput.generatedAt).toEqual(stored.sentAt);
    expect(stored.pdfGeneratedAt).toBeNull();
    expect(stored.pdfBytesEnc).toBeNull();
  });

  it('does not silently regenerate an incomplete stored final PDF', async () => {
    const { db, draft } = await createDraft();
    const stored = db.reports[0];
    if (!stored) throw new Error('expected stored report');
    stored.status = 'Sent';
    stored.sentAt = new Date('2026-05-20T12:00:00.000Z');
    stored.pdfGeneratedAt = stored.sentAt;
    stored.pdfBytesEnc = null;
    stored.pdfFileNameEnc = encrypt('Jane-Learner-final-report.pdf');
    const pdf = makeFakePdfGenerator();

    await expect(
      makeCaller(headUser, db, { pdfGenerator: pdf.generate }).caller.report.downloadPdf({
        reportId: draft.id,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Stored report PDF is incomplete.',
    });
    expect(pdf.generate).not.toHaveBeenCalled();
  });
});

describe('report.listForStudent', () => {
  it('normalises legacy encrypted snapshots without rewriting them', async () => {
    const { db, draft } = await createDraft();
    const report = db.reports[0];
    if (!report) throw new Error('expected stored report');
    const legacyCompiled = {
      studentId: draft.compiled.studentId,
      studentDisplayName: draft.compiled.studentDisplayName,
      term: '2026-Summer',
      attendance: draft.compiled.attendance,
      paces: draft.compiled.paces.map((pace) => ({
        subjectCode: pace.subjectCode,
        subjectName: pace.subjectName,
        currentPace: pace.currentPace,
        pacesCompletedThisTerm: pace.pacesCompletedThisTerm,
        averageTestScore: pace.averageTestScore,
      })),
      behaviour: {
        ...draft.compiled.behaviour,
        generalEntries: draft.compiled.behaviour.generalEntries.map((entry) => ({
          createdAt: entry.createdAt,
          ...(entry.category ? { category: entry.category } : {}),
          note: entry.note,
        })),
      },
      notes: draft.compiled.notes.map((entry) => ({
        createdAt: entry.createdAt,
        ...(entry.category ? { category: entry.category } : {}),
        note: entry.note,
      })),
      meritActivity: draft.compiled.meritActivity,
      balances: draft.compiled.balances,
      headSummary: draft.compiled.headSummary,
      compiledAt: draft.compiled.compiledAt,
    };
    report.compiledJsonEnc = encrypt(JSON.stringify(legacyCompiled)) ?? '';

    const result = await makeCaller(headUser, db).caller.report.listForStudent({ studentId });
    const compiled = result.reports[0]?.compiled;

    expect(compiled?.period).toEqual(draft.period);
    expect(compiled?.sections).toEqual(DEFAULT_REPORT_SECTIONS);
    expect(compiled?.paces[0]?.status.status).toBe('Unavailable');
    expect(compiled?.notes[0]).toMatchObject({
      id: 'legacy:note:0:2026-05-16T00:00:00.000Z',
      origin: 'Source',
    });
    expect(report.compiledJsonEnc).toBe(encrypt(JSON.stringify(legacyCompiled)));
  });

  it('allows linked parents to read sent reports only', async () => {
    const { db, draft } = await createDraft();
    const headCaller = makeCaller(headUser, db).caller;
    await headCaller.report.send({ reportId: draft.id });
    await headCaller.report.draft({
      ...defaultDraftInput(),
      period: { type: 'Term', term: '2026-Autumn' },
    });

    const { caller } = makeCaller(parentUser, db);
    const result = await caller.report.listForStudent({ studentId });

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toMatchObject({
      id: reportId,
      status: 'Sent',
      compiled: { studentDisplayName: 'Jane Learner' },
    });
  });

  it('does not expose preserved report-only notes from hidden sections to parents', async () => {
    const { db, draft } = await createDraft();
    const headCaller = makeCaller(headUser, db).caller;
    await headCaller.report.review({
      reportId: draft.id,
      progressComment: 'Hidden progress comment.',
      behaviourNotes: [
        {
          id: '16635882-372f-4d99-b760-776ad3aa9b76',
          category: 'Character',
          note: 'Hidden behaviour note.',
        },
      ],
      generalNotes: [
        { id: '0658301f-8a25-48c6-b200-d3cb7def258b', note: 'Hidden general note.' },
      ],
    });
    await headCaller.report.draft({
      ...defaultDraftInput(),
      sections: {
        ...DEFAULT_REPORT_SECTIONS,
        behaviourNotes: false,
        generalNotes: false,
        progressComment: false,
      },
    });
    await headCaller.report.send({ reportId: draft.id });

    const result = await makeCaller(parentUser, db).caller.report.listForStudent({ studentId });
    const compiled = result.reports[0]?.compiled;

    expect(compiled?.behaviour.generalEntries).toEqual([]);
    expect(compiled?.notes).toEqual([]);
    expect(compiled?.headSummary).toBe('');
  });

  it('allows linked supervisors to read sent reports for linked children only', async () => {
    const { db, draft } = await createDraft();
    const headCaller = makeCaller(headUser, db).caller;
    await headCaller.report.send({ reportId: draft.id });
    await headCaller.report.draft({
      ...defaultDraftInput(),
      period: { type: 'Term', term: '2026-Autumn' },
    });

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
