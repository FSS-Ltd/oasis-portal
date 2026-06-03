import { TRPCError } from '@trpc/server';
import type { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  DEFAULT_LEADERBOARD,
  LEADERBOARD_KINDS,
  canViewDemeritLeaderboard,
  investmentReturnPct,
  rankStudentMetrics,
  type LeaderboardKind,
  type LeaderboardRow,
  type RankableStudentMetric,
  type SessionUser,
} from '@oasis/domain';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { assertStudentPortalAccess } from '../lib/student-portal-access.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

interface StudentIdentity {
  id: string;
  fullNameEnc: string;
  yearGroup: string;
  enrolmentDate: Date;
}

interface LeaderboardMetricCandidate extends RankableStudentMetric {
  fullNameEnc: string;
  yearGroup: string;
}

export interface LeaderboardResultDto {
  kind: LeaderboardKind;
  asOf: Date;
  rows: LeaderboardRow[];
}

const getInput = z
  .object({
    kind: z.enum(LEADERBOARD_KINDS).default(DEFAULT_LEADERBOARD),
    limit: z.number().int().positive().max(50).default(10),
  })
  .optional();

function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value.toString());
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student PII decrypt failed' });
  }
  return decrypted;
}

async function auditPermissionDenied(
  ctx: AuthedContext,
  kind: LeaderboardKind,
  denied: AccessDeniedError,
): Promise<never> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'leaderboard.get',
      meta: { kind, role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function requireCanViewLeaderboard(ctx: AuthedContext, kind: LeaderboardKind): Promise<void> {
  if (ctx.user.role === 'Student') {
    const student = await ctx.db.student.findUnique({
      where: { userId: ctx.user.id },
      select: { id: true, active: true },
    });
    if (!student?.active) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
    }
    await assertStudentPortalAccess(ctx, { entity: 'leaderboard.get', studentId: student.id });
  }

  if (kind !== 'HighestDemerits' || canViewDemeritLeaderboard(ctx.user)) return;

  await auditPermissionDenied(
    ctx,
    kind,
    new AccessDeniedError('demerit leaderboard requires full-admin or leaderboard-admin'),
  );
}

async function auditLeaderboardDecrypt(
  ctx: AuthedContext,
  kind: LeaderboardKind,
  count: number,
): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'Student',
      meta: { count, kind, source: 'leaderboard.get' },
    },
  });
}

async function loadActiveStudentMap(
  ctx: AuthedContext,
  studentIds: readonly string[],
): Promise<ReadonlyMap<string, StudentIdentity>> {
  const uniqueStudentIds = [...new Set(studentIds)];
  if (uniqueStudentIds.length === 0) return new Map();

  const students = await ctx.db.student.findMany({
    where: { id: { in: uniqueStudentIds }, active: true },
    select: { id: true, fullNameEnc: true, yearGroup: true, enrolmentDate: true },
  });

  return new Map(students.map((student) => [student.id, student]));
}

async function loadPositiveLedgerCandidates(
  ctx: AuthedContext,
  account: 'Saving' | 'TithePaid',
): Promise<LeaderboardMetricCandidate[]> {
  const totals = await ctx.db.meritLedger.groupBy({
    by: ['studentId'],
    where: { account },
    _sum: { delta: true },
  });
  const students = await loadActiveStudentMap(
    ctx,
    totals.map((total) => total.studentId),
  );

  return totals.flatMap((total) => {
    const metric = total._sum.delta ?? 0;
    const student = students.get(total.studentId);
    if (!student || metric <= 0) return [];

    return [
      {
        studentId: student.id,
        fullNameEnc: student.fullNameEnc,
        yearGroup: student.yearGroup,
        metric,
        enrolmentDate: student.enrolmentDate,
      },
    ];
  });
}

async function loadLatestNav(ctx: AuthedContext): Promise<number | null> {
  const row = await ctx.db.investmentNav.findFirst({
    orderBy: { date: 'desc' },
    select: { nav: true },
  });
  return row ? toNumber(row.nav) : null;
}

async function loadInvestmentCandidates(ctx: AuthedContext): Promise<LeaderboardMetricCandidate[]> {
  const [latestNav, accounts] = await Promise.all([
    loadLatestNav(ctx),
    ctx.db.investmentAccount.findMany({
      where: { student: { active: true } },
      select: {
        studentId: true,
        units: true,
        student: { select: { fullNameEnc: true, yearGroup: true, enrolmentDate: true } },
      },
    }),
  ]);

  if (latestNav === null || accounts.length === 0) return [];

  const costBasisRows = await ctx.db.meritLedger.groupBy({
    by: ['studentId'],
    where: {
      studentId: { in: accounts.map((account) => account.studentId) },
      account: 'Investment',
    },
    _sum: { delta: true },
  });
  const costBasisByStudent = new Map(
    costBasisRows.map((row) => [row.studentId, row._sum.delta ?? 0]),
  );

  return accounts.flatMap((account) => {
    const costBasis = costBasisByStudent.get(account.studentId) ?? 0;
    const units = toNumber(account.units);
    if (costBasis <= 0 || units <= 0) return [];

    return [
      {
        studentId: account.studentId,
        fullNameEnc: account.student.fullNameEnc,
        yearGroup: account.student.yearGroup,
        enrolmentDate: account.student.enrolmentDate,
        metric: investmentReturnPct({
          costBasis,
          currentValue: Math.floor(units * latestNav),
        }),
      },
    ];
  });
}

async function loadDemeritCandidates(ctx: AuthedContext): Promise<LeaderboardMetricCandidate[]> {
  const totals = await ctx.db.behaviourEntry.groupBy({
    by: ['studentId'],
    where: { type: 'Demerit', deletedAt: null },
    _sum: { meritDelta: true },
  });
  const students = await loadActiveStudentMap(
    ctx,
    totals.map((total) => total.studentId),
  );

  return totals.flatMap((total) => {
    const metric = Math.abs(total._sum.meritDelta ?? 0);
    const student = students.get(total.studentId);
    if (!student || metric <= 0) return [];

    return [
      {
        studentId: student.id,
        fullNameEnc: student.fullNameEnc,
        yearGroup: student.yearGroup,
        metric,
        enrolmentDate: student.enrolmentDate,
      },
    ];
  });
}

async function loadCandidates(
  ctx: AuthedContext,
  kind: LeaderboardKind,
): Promise<LeaderboardMetricCandidate[]> {
  switch (kind) {
    case 'TopTithers':
      return loadPositiveLedgerCandidates(ctx, 'TithePaid');
    case 'TopSavers':
      return loadPositiveLedgerCandidates(ctx, 'Saving');
    case 'TopInvestors':
      return loadInvestmentCandidates(ctx);
    case 'HighestDemerits':
      return loadDemeritCandidates(ctx);
  }
}

async function buildRows(
  ctx: AuthedContext,
  kind: LeaderboardKind,
  candidates: readonly LeaderboardMetricCandidate[],
  limit: number,
): Promise<LeaderboardRow[]> {
  const ranked = rankStudentMetrics(candidates, limit);
  const rows = ranked.map((row) => ({
    rank: row.rank,
    studentId: row.studentId,
    displayName: decryptRequired(ctx.db.$enc.decrypt, row.fullNameEnc),
    yearGroup: row.yearGroup,
    score: row.metric,
  }));

  await auditLeaderboardDecrypt(ctx, kind, rows.length);
  return rows;
}

export const leaderboardRouter = router({
  get: authedProcedure.input(getInput).query(async ({ ctx, input }) => {
    const kind = input?.kind ?? DEFAULT_LEADERBOARD;
    const limit = input?.limit ?? 10;

    await requireCanViewLeaderboard(ctx, kind);
    const candidates = await loadCandidates(ctx, kind);

    return {
      kind,
      asOf: new Date(),
      rows: await buildRows(ctx, kind, candidates, limit),
    } satisfies LeaderboardResultDto;
  }),
});
