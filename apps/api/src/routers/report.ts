import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccessDeniedError,
  compileTermReport,
  isFullAdmin,
  requireOwnChild,
  type CompiledReport,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  buildReportNotificationEmail,
  createResendEmailClient,
  REPORT_NOTIFICATION_EMAIL_SUBJECT,
  type EmailClient,
} from '../lib/email.js';
import { authedProcedure, fullAdminProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };
type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type TermReportStatus = 'Draft' | 'UnderReview' | 'Sent';

export interface ReportRouterDeps {
  emailClient?: EmailClient;
}

interface ActiveReportStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  subjects: Array<{
    currentPaceNumber: number;
    subject: { code: string; name: string };
    subjectId: string;
  }>;
}

interface TermReportRow {
  id: string;
  studentId: string;
  term: string;
  status: TermReportStatus;
  compiledJsonEnc: string;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReportNotificationGuardian {
  user: {
    id: string;
    role: SessionUser['role'];
    fullNameEnc: string;
    emailEnc: string;
  };
}

const termSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(Spring|Summer|Autumn)$/u, 'term must use YYYY-Spring, YYYY-Summer, or YYYY-Autumn');

const draftInput = z.object({
  studentId: z.string().cuid(),
  term: termSchema,
});

const reviewInput = z.object({
  reportId: z.string().cuid(),
  headSummary: z.string().trim().max(5000).optional(),
});

const reportIdInput = z.object({ reportId: z.string().cuid() });
const studentInput = z.object({ studentId: z.string().cuid() });

const textEntrySchema = z.object({
  createdAt: z.string(),
  category: z.string().optional(),
  note: z.string().nullable(),
});

const compiledReportSchema = z.object({
  studentId: z.string(),
  studentDisplayName: z.string(),
  term: z.string(),
  attendance: z.object({
    total: z.number(),
    present: z.number(),
    absent: z.number(),
    late: z.number(),
    attendancePct: z.number(),
  }),
  paces: z.array(
    z.object({
      subjectCode: z.string(),
      subjectName: z.string(),
      currentPace: z.number(),
      pacesCompletedThisTerm: z.number(),
      averageTestScore: z.number().nullable(),
    }),
  ),
  behaviour: z.object({
    meritsEarned: z.number(),
    demeritsCount: z.number(),
    demeritsMerits: z.number(),
    generalEntries: z.array(textEntrySchema),
  }),
  notes: z.array(textEntrySchema),
  meritActivity: z.array(
    z.object({
      createdAt: z.string(),
      account: z.enum([
        'Spend',
        'Saving',
        'Investment',
        'InvestmentReturn',
        'TithePaid',
        'Given',
        'FeeSink',
        'ShopReserved',
      ]),
      delta: z.number(),
      reason: z.string(),
    }),
  ),
  balances: z.object({
    Spend: z.number(),
    Saving: z.number(),
    Investment: z.number(),
    InvestmentReturn: z.number(),
    TithePaid: z.number(),
    Given: z.number(),
    FeeSink: z.number(),
    ShopReserved: z.number(),
  }),
  headSummary: z.string(),
  compiledAt: z.string(),
});

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}

function encryptRequired(
  encrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const encrypted = encrypt(value);
  if (!encrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} encrypt failed` });
  }
  return encrypted;
}

function termRange(term: string): { from: Date; to: Date } {
  const match = /^(\d{4})-(Spring|Summer|Autumn)$/u.exec(term);
  if (!match) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'term must use YYYY-Spring, YYYY-Summer, or YYYY-Autumn',
    });
  }

  const year = Number(match[1]);
  const season = match[2];
  if (season === 'Spring') {
    return {
      from: new Date(`${String(year)}-01-01T00:00:00.000Z`),
      to: new Date(`${String(year)}-04-01T00:00:00.000Z`),
    };
  }
  if (season === 'Summer') {
    return {
      from: new Date(`${String(year)}-04-01T00:00:00.000Z`),
      to: new Date(`${String(year)}-09-01T00:00:00.000Z`),
    };
  }
  return {
    from: new Date(`${String(year)}-09-01T00:00:00.000Z`),
    to: new Date(`${String(year + 1)}-01-01T00:00:00.000Z`),
  };
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  entity: string,
  studentId: string,
  denied: AccessDeniedError,
): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      entityId: studentId,
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function assertCanReadReports(
  ctx: AuthedContext,
  studentId: string,
  entity: string,
): Promise<void> {
  if (isFullAdmin(ctx.user)) return;

  if (ctx.user.role === 'Parent') {
    const guardian = await ctx.db.guardian.findUnique({
      where: { userId_studentId: { userId: ctx.user.id, studentId } },
      select: { studentId: true },
    });
    try {
      requireOwnChild(ctx.user, studentId, guardian ? [guardian.studentId] : []);
      return;
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        await auditPermissionDenied(ctx, entity, studentId, err);
      }
      throw err;
    }
  }

  await auditPermissionDenied(
    ctx,
    entity,
    studentId,
    new AccessDeniedError(`role ${ctx.user.role} cannot read term reports`),
  );
}

async function loadActiveStudent(
  ctx: AuthedContext,
  studentId: string,
): Promise<ActiveReportStudent> {
  const student = await ctx.db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      active: true,
      fullNameEnc: true,
      subjects: {
        select: {
          subjectId: true,
          currentPaceNumber: true,
          subject: { select: { code: true, name: true } },
        },
        orderBy: { subject: { code: 'asc' } },
      },
    },
  });

  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  if (!student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
  return student;
}

function scoreForRecord(record: { selfTestScore: number | null; paceTestScore: number | null }) {
  return record.paceTestScore ?? record.selfTestScore;
}

async function compileReportSnapshot(
  ctx: AuthedContext,
  input: { studentId: string; term: string; headSummary?: string },
): Promise<CompiledReport> {
  const student = await loadActiveStudent(ctx, input.studentId);
  const range = termRange(input.term);
  const studentName = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII');
  const subjectIds = student.subjects.map((assignment) => assignment.subjectId);

  const [attendanceRows, paceRows, behaviourRows, noteRows, ledgerRows] = await Promise.all([
    ctx.db.attendance.findMany({
      where: { studentId: student.id, date: { gte: range.from, lt: range.to } },
      select: { status: true },
    }),
    subjectIds.length === 0
      ? Promise.resolve([])
      : ctx.db.paceRecord.findMany({
          where: {
            studentId: student.id,
            subjectId: { in: subjectIds },
            completedAt: { gte: range.from, lt: range.to },
            OR: [{ selfTestScore: { not: null } }, { paceTestScore: { not: null } }],
          },
          select: {
            subjectId: true,
            selfTestScore: true,
            paceTestScore: true,
          },
        }),
    ctx.db.behaviourEntry.findMany({
      where: {
        studentId: student.id,
        createdAt: { gte: range.from, lt: range.to },
        deletedAt: null,
        visibility: 'General',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        type: true,
        category: true,
        noteEnc: true,
        meritDelta: true,
        createdAt: true,
      },
    }),
    ctx.db.childNote.findMany({
      where: {
        studentId: student.id,
        createdAt: { gte: range.from, lt: range.to },
        deletedAt: null,
        sensitive: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        noteEnc: true,
        createdAt: true,
      },
    }),
    ctx.db.meritLedger.findMany({
      where: { studentId: student.id, createdAt: { lt: range.to } },
      orderBy: { createdAt: 'desc' },
      select: { account: true, delta: true, reason: true, createdAt: true },
    }),
  ]);

  const attendance = attendanceRows.reduce(
    (summary, row: { status: AttendanceStatus }) => {
      summary.total += 1;
      if (row.status === 'Present') summary.present += 1;
      if (row.status === 'Absent') summary.absent += 1;
      if (row.status === 'Late') summary.late += 1;
      return summary;
    },
    { total: 0, present: 0, absent: 0, late: 0 },
  );

  const paces = student.subjects.map((assignment) => {
    const subjectRecords = paceRows.filter((row) => row.subjectId === assignment.subjectId);
    const scores = subjectRecords
      .map(scoreForRecord)
      .filter((score): score is number => score !== null);
    const averageTestScore =
      scores.length === 0
        ? null
        : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    return {
      subjectCode: assignment.subject.code,
      subjectName: assignment.subject.name,
      currentPace: assignment.currentPaceNumber,
      pacesCompletedThisTerm: subjectRecords.filter(
        (record) => record.paceTestScore !== null && record.paceTestScore >= 80,
      ).length,
      averageTestScore,
    };
  });

  const behaviour = {
    meritsEarned: behaviourRows
      .filter((entry) => entry.type === 'Merit')
      .reduce((sum, entry) => sum + Math.max(entry.meritDelta, 0), 0),
    demeritsCount: behaviourRows.filter((entry) => entry.type === 'Demerit').length,
    demeritsMerits: behaviourRows
      .filter((entry) => entry.type === 'Demerit')
      .reduce((sum, entry) => sum + Math.abs(entry.meritDelta), 0),
    generalEntries: behaviourRows
      .filter((entry) => entry.type === 'General')
      .map((entry) => ({
        createdAt: entry.createdAt,
        category: entry.category,
        note: entry.noteEnc
          ? decryptRequired(ctx.db.$enc.decrypt, entry.noteEnc, 'behaviour note')
          : null,
      })),
  };

  const notes = noteRows.map((note) => ({
    createdAt: note.createdAt,
    note: decryptRequired(ctx.db.$enc.decrypt, note.noteEnc, 'child note'),
  }));

  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'TermReport',
      entityId: student.id,
      meta: {
        source: 'report.compile',
        term: input.term,
        behaviourEntries: behaviourRows.length,
        notes: noteRows.length,
      },
    },
  });

  return compileTermReport({
    studentId: student.id,
    studentDisplayName: studentName,
    term: input.term,
    attendance,
    paces,
    behaviour,
    notes,
    ledgerRows,
    headSummary: input.headSummary,
  });
}

function encryptCompiledReport(ctx: AuthedContext, report: CompiledReport): string {
  return encryptRequired(
    ctx.db.$enc.encrypt,
    JSON.stringify(report),
    'compiled term report snapshot',
  );
}

function decryptCompiledReport(ctx: AuthedContext, row: TermReportRow) {
  const json = decryptRequired(
    ctx.db.$enc.decrypt,
    row.compiledJsonEnc,
    'compiled term report snapshot',
  );
  const parsed = compiledReportSchema.safeParse(JSON.parse(json) as unknown);
  if (!parsed.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'compiled term report snapshot is invalid',
    });
  }
  return parsed.data;
}

function mapReport(ctx: AuthedContext, row: TermReportRow) {
  return {
    id: row.id,
    studentId: row.studentId,
    term: row.term,
    status: row.status,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    compiled: decryptCompiledReport(ctx, row),
  };
}

async function loadReport(ctx: AuthedContext, reportId: string): Promise<TermReportRow> {
  const report = await ctx.db.termReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'term report not found' });
  }
  return report;
}

function parentReportPath(report: TermReportRow): string {
  const studentId = encodeURIComponent(report.studentId);
  const reportId = encodeURIComponent(report.id);
  return `/parent/reports?studentId=${studentId}&reportId=${reportId}`;
}

async function auditReportNotificationFailure(
  ctx: AuthedContext,
  report: TermReportRow,
  meta: Record<string, unknown>,
): Promise<void> {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'TermReport',
        entityId: report.id,
        meta: {
          source: 'report.send.notification',
          emailStatus: 'Failed',
          studentId: report.studentId,
          term: report.term,
          ...meta,
        },
      },
    });
  } catch (auditErr) {
    console.error('Report notification failure audit failed', {
      error: auditErr instanceof Error ? auditErr.message : 'unknown error',
      reportId: report.id,
      studentId: report.studentId,
    });
  }
}

async function notifyReportGuardians({
  ctx,
  getEmailClient,
  report,
}: {
  ctx: AuthedContext;
  getEmailClient: () => EmailClient;
  report: TermReportRow;
}): Promise<void> {
  let childName: string;
  let guardians: ReportNotificationGuardian[];

  try {
    const [student, guardianRows] = await Promise.all([
      ctx.db.student.findUnique({
        where: { id: report.studentId },
        select: { fullNameEnc: true },
      }),
      ctx.db.guardian.findMany({
        where: { studentId: report.studentId, user: { active: true } },
        select: {
          user: {
            select: {
              id: true,
              role: true,
              fullNameEnc: true,
              emailEnc: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!student) {
      throw new Error('report student not found');
    }
    childName = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII');
    guardians = guardianRows;
  } catch (err) {
    console.error('Report notification recipient resolution failed', {
      error: err instanceof Error ? err.message : 'unknown error',
      reportId: report.id,
      studentId: report.studentId,
    });
    await auditReportNotificationFailure(ctx, report, { reason: 'recipient-resolution' });
    return;
  }

  for (const guardian of guardians) {
    try {
      const recipientName = decryptRequired(
        ctx.db.$enc.decrypt,
        guardian.user.fullNameEnc,
        'guardian name',
      );
      const recipientEmail = decryptRequired(
        ctx.db.$enc.decrypt,
        guardian.user.emailEnc,
        'guardian email',
      );
      const email = buildReportNotificationEmail({
        to: recipientEmail,
        recipientName,
        childName,
        term: report.term,
        reportPath: parentReportPath(report),
      });
      const result = await getEmailClient().send(email);

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'Email',
          entityId: result.id,
          meta: {
            source: 'report.send.notification',
            emailStatus: 'Sent',
            reportId: report.id,
            studentId: report.studentId,
            subject: REPORT_NOTIFICATION_EMAIL_SUBJECT,
            term: report.term,
            toUserId: guardian.user.id,
            toRole: guardian.user.role,
          },
        },
      });
    } catch (err) {
      console.error('Report notification email delivery failed', {
        error: err instanceof Error ? err.message : 'unknown error',
        reportId: report.id,
        studentId: report.studentId,
        toUserId: guardian.user.id,
      });
      await auditReportNotificationFailure(ctx, report, {
        toUserId: guardian.user.id,
        toRole: guardian.user.role,
      });
    }
  }
}

export function createReportRouter(deps: ReportRouterDeps = {}) {
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  return router({
    draft: fullAdminProcedure.input(draftInput).mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.termReport.findUnique({
        where: { studentId_term: { studentId: input.studentId, term: input.term } },
      });

      if (existing?.status === 'Sent') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'sent reports cannot be re-drafted' });
      }

      const compiled = await compileReportSnapshot(ctx, input);
      const compiledJsonEnc = encryptCompiledReport(ctx, compiled);

      const report = existing
        ? await ctx.db.termReport.update({
            where: { id: existing.id },
            data: { compiledJsonEnc, status: 'Draft', sentAt: null },
          })
        : await ctx.db.termReport.create({
            data: {
              studentId: input.studentId,
              term: input.term,
              status: 'Draft',
              compiledJsonEnc,
            },
          });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: existing ? 'Update' : 'Create',
          entity: 'TermReport',
          entityId: report.id,
          meta: { source: 'report.draft', studentId: input.studentId, term: input.term },
        },
      });

      return mapReport(ctx, report);
    }),

    review: fullAdminProcedure.input(reviewInput).mutation(async ({ ctx, input }) => {
      const existing = await loadReport(ctx, input.reportId);
      if (existing.status === 'Sent') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'sent reports cannot be reviewed' });
      }

      const compiled = decryptCompiledReport(ctx, existing);
      const updatedCompiled: CompiledReport = {
        ...compiled,
        headSummary: input.headSummary ?? compiled.headSummary,
        compiledAt: new Date().toISOString(),
      };
      const report = await ctx.db.termReport.update({
        where: { id: existing.id },
        data: {
          status: 'UnderReview',
          compiledJsonEnc: encryptCompiledReport(ctx, updatedCompiled),
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'TermReport',
          entityId: report.id,
          meta: { source: 'report.review', studentId: report.studentId, term: report.term },
        },
      });

      return mapReport(ctx, report);
    }),

    send: fullAdminProcedure.input(reportIdInput).mutation(async ({ ctx, input }) => {
      const existing = await loadReport(ctx, input.reportId);
      if (existing.status === 'Sent') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'term report is already sent' });
      }

      const sentAt = new Date();
      const report = await ctx.db.termReport.update({
        where: { id: existing.id },
        data: { status: 'Sent', sentAt },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'TermReport',
          entityId: report.id,
          meta: { source: 'report.send', studentId: report.studentId, term: report.term, sentAt },
        },
      });

      await notifyReportGuardians({ ctx, getEmailClient, report });

      return mapReport(ctx, report);
    }),

    listForStudent: authedProcedure.input(studentInput).query(async ({ ctx, input }) => {
      await loadActiveStudent(ctx, input.studentId);
      await assertCanReadReports(ctx, input.studentId, 'report.listForStudent');

      const reports = await ctx.db.termReport.findMany({
        where: {
          studentId: input.studentId,
          ...(isFullAdmin(ctx.user) ? {} : { status: 'Sent' as const }),
        },
        orderBy: [{ term: 'desc' }, { createdAt: 'desc' }],
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'TermReport',
          entityId: input.studentId,
          meta: {
            source: 'report.listForStudent',
            studentId: input.studentId,
            count: reports.length,
          },
        },
      });

      return {
        studentId: input.studentId,
        reports: reports.map((report) => mapReport(ctx, report)),
      };
    }),
  });
}

export const reportRouter = createReportRouter();
