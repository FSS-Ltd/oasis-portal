import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  AccessDeniedError,
  canUseLinkedChildGuardianAccess,
  canUseAdminOperations,
  compileStudentReport,
  DEFAULT_REPORT_SECTIONS,
  paceProgressStatusForYear,
  reportPeriodInputSchema,
  reportSectionsSchema,
  resolveReportPeriod,
  type CompiledReport,
  type ReportPeriodInput,
  type ReportSections,
  type ResolvedReportPeriod,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  buildReportNotificationEmail,
  createResendEmailClient,
  REPORT_NOTIFICATION_EMAIL_SUBJECT,
  type EmailClient,
} from '../lib/email.js';
import { decryptRequiredText } from '../lib/encrypted-text.js';
import { logOperationalEvent, operationalErrorMessage } from '../lib/observability.js';
import { adminOperationsProcedure, authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };
type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type TermReportStatus = 'Draft' | 'UnderReview' | 'Sent';
type ReportPeriodType = 'Term' | 'AcademicYear' | 'Custom';

export interface ReportRouterDeps {
  emailClient?: EmailClient;
}

interface ActiveReportStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
  subjects: Array<{
    currentPaceNumber: number;
    subject: { code: string; name: string };
    subjectId: string;
  }>;
}

interface TermReportRow {
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

interface ReportNotificationGuardian {
  user: {
    id: string;
    role: SessionUser['role'];
    fullNameEnc: string;
    emailEnc: string | null;
  };
}

const draftInput = z.object({
  studentId: z.string().cuid(),
  period: reportPeriodInputSchema,
  sections: reportSectionsSchema,
});

const reportEditableTextSchema = z.string().trim().min(1).max(5000);
const reportSpecificNoteSchema = z.object({
  id: z.string().uuid(),
  category: z.string().trim().min(1).max(120).optional(),
  note: reportEditableTextSchema,
});

const reviewInput = z
  .object({
    reportId: z.string().cuid(),
    progressComment: z.string().trim().max(5000),
    behaviourNotes: z.array(reportSpecificNoteSchema).max(50),
    generalNotes: z.array(reportSpecificNoteSchema.omit({ category: true })).max(50),
  })
  .superRefine((input, ctx) => {
    for (const key of ['behaviourNotes', 'generalNotes'] as const) {
      const seen = new Set<string>();
      input[key].forEach((entry, index) => {
        if (seen.has(entry.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'report note ids must be unique',
            path: [key, index, 'id'],
          });
        }
        seen.add(entry.id);
      });
    }
  });

type ReportSpecificNoteInput = z.infer<typeof reportSpecificNoteSchema>;

const reportIdInput = z.object({ reportId: z.string().cuid() });
const studentInput = z.object({ studentId: z.string().cuid() });

const storedTextEntrySchema = z.object({
  id: z.string().optional(),
  origin: z.enum(['Source', 'Report']).optional(),
  createdAt: z.string(),
  category: z.string().optional(),
  note: z.string().nullable(),
});

const paceStatusSchema = z.object({
  status: z.enum(['Behind', 'On Track', 'Ahead', 'Unavailable']),
  tone: z.enum(['amber', 'blue', 'green', 'grey']),
  testingLevel: z.number().nullable(),
  testingLevelLabel: z.string().nullable(),
  detail: z.string(),
});

const reportPeriodSnapshotSchema = z.object({
  type: z.enum(['Term', 'AcademicYear', 'Custom']),
  key: z.string(),
  label: z.string(),
  from: z.string(),
  to: z.string(),
});

const storedCompiledReportSchema = z.object({
  studentId: z.string(),
  studentDisplayName: z.string(),
  term: z.string().optional(),
  period: reportPeriodSnapshotSchema.optional(),
  sections: reportSectionsSchema.optional(),
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
      status: paceStatusSchema.optional(),
    }),
  ),
  behaviour: z.object({
    meritsEarned: z.number(),
    demeritsCount: z.number(),
    demeritsMerits: z.number(),
    generalEntries: z.array(storedTextEntrySchema),
  }),
  notes: z.array(storedTextEntrySchema),
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
        'TaxSink',
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
    TaxSink: z.number(),
    ShopReserved: z.number(),
  }),
  headSummary: z.string(),
  compiledAt: z.string(),
});

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
  entity: string,
): string {
  return decryptRequiredText({ decrypt }, value, entity);
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
  if (canUseAdminOperations(ctx.user)) return;

  if (canUseLinkedChildGuardianAccess(ctx.user)) {
    const guardian = await ctx.db.guardian.findUnique({
      where: { userId_studentId: { userId: ctx.user.id, studentId } },
      select: { studentId: true },
    });
    if (guardian) return;
    await auditPermissionDenied(
      ctx,
      entity,
      studentId,
      new AccessDeniedError('linked-child guardian is not linked to this student'),
    );
  }

  await auditPermissionDenied(
    ctx,
    entity,
    studentId,
    new AccessDeniedError(`role ${ctx.user.role} cannot read student reports`),
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
      yearGroup: true,
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

function resolveDraftPeriod(input: ReportPeriodInput): ResolvedReportPeriod {
  try {
    return resolveReportPeriod(input);
  } catch (error) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error instanceof Error ? error.message : 'report period is invalid',
      cause: error,
    });
  }
}

const EMPTY_REPORT_BALANCES: CompiledReport['balances'] = {
  Spend: 0,
  Saving: 0,
  Investment: 0,
  InvestmentReturn: 0,
  TithePaid: 0,
  Given: 0,
  FeeSink: 0,
  TaxSink: 0,
  ShopReserved: 0,
};

async function compileReportSnapshot(
  ctx: AuthedContext,
  input: {
    studentId: string;
    period: ResolvedReportPeriod;
    sections: ReportSections;
    headSummary?: string;
  },
): Promise<CompiledReport> {
  const student = await loadActiveStudent(ctx, input.studentId);
  const studentName = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII');
  const subjectIds = student.subjects.map((assignment) => assignment.subjectId);
  const range = {
    gte: input.period.queryFrom,
    lt: input.period.queryToExclusive,
  };

  const [attendanceRows, paceRows, behaviourRows, noteRows, ledgerRows] = await Promise.all([
    input.sections.attendance
      ? ctx.db.attendance.findMany({
          where: { studentId: student.id, date: range },
          select: { status: true },
        })
      : Promise.resolve([]),
    !input.sections.paceProgress || subjectIds.length === 0
      ? Promise.resolve([])
      : ctx.db.paceRecord.findMany({
          where: {
            studentId: student.id,
            subjectId: { in: subjectIds },
            completedAt: range,
            OR: [{ selfTestScore: { not: null } }, { paceTestScore: { not: null } }],
          },
          select: {
            subjectId: true,
            selfTestScore: true,
            paceTestScore: true,
          },
        }),
    input.sections.behaviourSummary || input.sections.behaviourNotes
      ? ctx.db.behaviourEntry.findMany({
          where: {
            studentId: student.id,
            createdAt: range,
            deletedAt: null,
            visibility: 'General',
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            category: true,
            noteEnc: true,
            meritDelta: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    input.sections.generalNotes
      ? ctx.db.childNote.findMany({
          where: {
            studentId: student.id,
            createdAt: range,
            deletedAt: null,
            sensitive: false,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            noteEnc: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    input.sections.meritActivity || input.sections.balances
      ? ctx.db.meritLedger.findMany({
          where: { studentId: student.id, createdAt: { lt: input.period.queryToExclusive } },
          orderBy: { createdAt: 'desc' },
          select: { account: true, delta: true, reason: true, createdAt: true },
        })
      : Promise.resolve([]),
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

  const paces = input.sections.paceProgress ? student.subjects.map((assignment) => {
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
      status: paceProgressStatusForYear(assignment.currentPaceNumber, student.yearGroup),
    };
  }) : [];

  const behaviourSummaryRows = input.sections.behaviourSummary ? behaviourRows : [];
  const behaviour = {
    meritsEarned: behaviourSummaryRows
      .filter((entry) => entry.type === 'Merit')
      .reduce((sum, entry) => sum + Math.max(entry.meritDelta, 0), 0),
    demeritsCount: behaviourSummaryRows.filter((entry) => entry.type === 'Demerit').length,
    demeritsMerits: behaviourSummaryRows
      .filter((entry) => entry.type === 'Demerit')
      .reduce((sum, entry) => sum + Math.abs(entry.meritDelta), 0),
    generalEntries: input.sections.behaviourNotes
      ? behaviourRows
          .filter((entry) => entry.type === 'General')
          .map((entry) => ({
            id: entry.id,
            origin: 'Source' as const,
            createdAt: entry.createdAt,
            category: entry.category,
            note: entry.noteEnc
              ? decryptRequired(ctx.db.$enc.decrypt, entry.noteEnc, 'behaviour note')
              : null,
          }))
      : [],
  };

  const notes = noteRows.map((note) => ({
    id: note.id,
    origin: 'Source' as const,
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
        periodKey: input.period.snapshot.key,
        behaviourEntries: behaviourRows.length,
        notes: noteRows.length,
      },
    },
  });

  const compiled = compileStudentReport({
    studentId: student.id,
    studentDisplayName: studentName,
    period: input.period.snapshot,
    sections: input.sections,
    attendance,
    paces,
    behaviour,
    notes,
    ledgerRows,
    headSummary: input.headSummary,
  });

  return {
    ...compiled,
    meritActivity: input.sections.meritActivity ? compiled.meritActivity : [],
    balances: input.sections.balances ? compiled.balances : EMPTY_REPORT_BALANCES,
  };
}

function encryptCompiledReport(ctx: AuthedContext, report: CompiledReport): string {
  return encryptRequired(
    ctx.db.$enc.encrypt,
    JSON.stringify(report),
    'compiled term report snapshot',
  );
}

function dateKey(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

const LEGACY_UNAVAILABLE_PACE_STATUS = {
  status: 'Unavailable',
  tone: 'grey',
  testingLevel: null,
  testingLevelLabel: null,
  detail: 'Status unavailable',
} as const;

type StoredTextEntry = z.infer<typeof storedTextEntrySchema>;

function normaliseTextEntry(
  entry: StoredTextEntry,
  kind: 'behaviour' | 'note',
  index: number,
): CompiledReport['notes'][number] {
  return {
    id: entry.id ?? `legacy:${kind}:${String(index)}:${entry.createdAt}`,
    origin: entry.origin ?? 'Source',
    createdAt: entry.createdAt,
    ...(entry.category ? { category: entry.category } : {}),
    note: entry.note,
  };
}

function reportEntries(
  existing: CompiledReport['notes'],
  input: readonly ReportSpecificNoteInput[],
  now: Date,
): CompiledReport['notes'] {
  const existingCreatedAt = new Map(
    existing
      .filter((entry) => entry.origin === 'Report')
      .map((entry) => [entry.id, entry.createdAt]),
  );
  return [
    ...existing.filter((entry) => entry.origin === 'Source'),
    ...input.map((entry) => ({
      id: entry.id,
      origin: 'Report' as const,
      createdAt: existingCreatedAt.get(entry.id) ?? now.toISOString(),
      ...(entry.category ? { category: entry.category } : {}),
      note: entry.note,
    })),
  ];
}

function preserveEditableDraftContent(
  fresh: CompiledReport,
  existing: CompiledReport | null,
): CompiledReport {
  if (!existing) return fresh;

  const behaviourReportEntries = existing.behaviour.generalEntries.filter(
    (entry) => entry.origin === 'Report',
  );
  const generalReportEntries = existing.notes.filter((entry) => entry.origin === 'Report');
  return {
    ...fresh,
    headSummary: existing.headSummary,
    behaviour: {
      ...fresh.behaviour,
      generalEntries: fresh.sections.behaviourNotes
        ? [...fresh.behaviour.generalEntries, ...behaviourReportEntries]
        : [],
    },
    notes: fresh.sections.generalNotes ? [...fresh.notes, ...generalReportEntries] : [],
  };
}

function decryptCompiledReport(ctx: AuthedContext, row: TermReportRow): CompiledReport {
  const json = decryptRequired(
    ctx.db.$enc.decrypt,
    row.compiledJsonEnc,
    'compiled term report snapshot',
  );
  const parsed = storedCompiledReportSchema.safeParse(JSON.parse(json) as unknown);
  if (!parsed.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'compiled term report snapshot is invalid',
    });
  }

  const stored = parsed.data;
  return {
    studentId: stored.studentId,
    studentDisplayName: stored.studentDisplayName,
    period: stored.period ?? {
      type: row.periodType,
      key: row.periodKey,
      label: row.periodLabel,
      from: dateKey(row.periodStart),
      to: dateKey(row.periodEnd),
    },
    sections: stored.sections ?? { ...DEFAULT_REPORT_SECTIONS },
    attendance: stored.attendance,
    paces: stored.paces.map((pace) => ({
      ...pace,
      status: pace.status ?? LEGACY_UNAVAILABLE_PACE_STATUS,
    })),
    behaviour: {
      meritsEarned: stored.behaviour.meritsEarned,
      demeritsCount: stored.behaviour.demeritsCount,
      demeritsMerits: stored.behaviour.demeritsMerits,
      generalEntries: stored.behaviour.generalEntries.map((entry, index) =>
        normaliseTextEntry(entry, 'behaviour', index),
      ),
    },
    notes: stored.notes.map((entry, index) => normaliseTextEntry(entry, 'note', index)),
    meritActivity: stored.meritActivity,
    balances: stored.balances,
    headSummary: stored.headSummary,
    compiledAt: stored.compiledAt,
  };
}

function mapReport(ctx: AuthedContext, row: TermReportRow) {
  return {
    id: row.id,
    studentId: row.studentId,
    period: {
      type: row.periodType,
      key: row.periodKey,
      label: row.periodLabel,
      from: dateKey(row.periodStart),
      to: dateKey(row.periodEnd),
    },
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
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student report not found' });
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
          periodLabel: report.periodLabel,
          ...meta,
        },
      },
    });
  } catch (auditErr) {
    logOperationalEvent({
      event: 'audit.write_failed',
      level: 'error',
      message: 'Report notification failure audit failed',
      meta: {
        error: operationalErrorMessage(auditErr),
        reportId: report.id,
        studentId: report.studentId,
      },
      requestId: ctx.requestId,
      userId: ctx.user.id,
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
    logOperationalEvent({
      event: 'email.recipient_resolution_failed',
      level: 'error',
      message: 'Report notification recipient resolution failed',
      meta: {
        error: operationalErrorMessage(err),
        reportId: report.id,
        studentId: report.studentId,
      },
      requestId: ctx.requestId,
      userId: ctx.user.id,
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
        term: report.periodLabel,
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
            periodLabel: report.periodLabel,
            toUserId: guardian.user.id,
            toRole: guardian.user.role,
          },
        },
      });
    } catch (err) {
      logOperationalEvent({
        event: 'email.delivery_failed',
        level: 'error',
        message: 'Report notification email delivery failed',
        meta: {
          error: operationalErrorMessage(err),
          reportId: report.id,
          studentId: report.studentId,
          toUserId: guardian.user.id,
        },
        requestId: ctx.requestId,
        userId: ctx.user.id,
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
    draft: adminOperationsProcedure.input(draftInput).mutation(async ({ ctx, input }) => {
      const period = resolveDraftPeriod(input.period);
      const existing = await ctx.db.termReport.findUnique({
        where: {
          studentId_periodKey: {
            studentId: input.studentId,
            periodKey: period.snapshot.key,
          },
        },
      });

      if (existing?.status === 'Sent') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'sent reports cannot be re-drafted' });
      }

      const existingCompiled = existing ? decryptCompiledReport(ctx, existing) : null;
      const compiled = preserveEditableDraftContent(
        await compileReportSnapshot(ctx, {
          studentId: input.studentId,
          period,
          sections: input.sections,
          ...(existingCompiled ? { headSummary: existingCompiled.headSummary } : {}),
        }),
        existingCompiled,
      );
      const compiledJsonEnc = encryptCompiledReport(ctx, compiled);
      const periodEnd = new Date(period.queryToExclusive.getTime() - 86_400_000);

      const report = existing
        ? await ctx.db.termReport.update({
            where: { id: existing.id },
            data: {
              periodType: period.snapshot.type,
              periodLabel: period.snapshot.label,
              periodStart: period.queryFrom,
              periodEnd,
              compiledJsonEnc,
              status: 'Draft',
              sentAt: null,
            },
          })
        : await ctx.db.termReport.create({
            data: {
              studentId: input.studentId,
              periodKey: period.snapshot.key,
              periodType: period.snapshot.type,
              periodLabel: period.snapshot.label,
              periodStart: period.queryFrom,
              periodEnd,
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
          meta: {
            source: 'report.draft',
            studentId: input.studentId,
            periodKey: period.snapshot.key,
          },
        },
      });

      return mapReport(ctx, report);
    }),

    review: adminOperationsProcedure.input(reviewInput).mutation(async ({ ctx, input }) => {
      const existing = await loadReport(ctx, input.reportId);
      if (existing.status === 'Sent') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'sent reports cannot be reviewed' });
      }

      const compiled = decryptCompiledReport(ctx, existing);
      const now = new Date();
      const updatedCompiled: CompiledReport = {
        ...compiled,
        headSummary: input.progressComment,
        behaviour: {
          ...compiled.behaviour,
          generalEntries: reportEntries(
            compiled.behaviour.generalEntries,
            input.behaviourNotes,
            now,
          ),
        },
        notes: reportEntries(compiled.notes, input.generalNotes, now),
        compiledAt: now.toISOString(),
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
          meta: {
            source: 'report.review',
            studentId: report.studentId,
            periodKey: report.periodKey,
          },
        },
      });

      return mapReport(ctx, report);
    }),

    send: adminOperationsProcedure.input(reportIdInput).mutation(async ({ ctx, input }) => {
      const existing = await loadReport(ctx, input.reportId);
      if (existing.status === 'Sent') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student report is already sent' });
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
          meta: {
            source: 'report.send',
            studentId: report.studentId,
            periodKey: report.periodKey,
            sentAt,
          },
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
          ...(canUseAdminOperations(ctx.user) ? {} : { status: 'Sent' as const }),
        },
        orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
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
