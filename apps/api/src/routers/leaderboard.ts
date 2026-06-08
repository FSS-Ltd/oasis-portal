import { TRPCError } from '@trpc/server';
import type { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  DEFAULT_LEADERBOARD,
  LEADERBOARD_KINDS,
  canUseAdminOperations,
  canUseLinkedChildGuardianAccess,
  canViewDemeritLeaderboard,
  isFullAdmin,
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
  page: number;
  pageSize: number;
  rows: LeaderboardRow[];
  scope: 'public' | 'full';
  totalRows: number;
  viewerRows: LeaderboardRow[];
}

export interface CharityPotDto {
  goalMerits: number;
  currentMerits: number;
  progressPct: number;
  goalReached: boolean;
  updatedAt: Date | null;
  updatedById: string | null;
}

const getInput = z
  .object({
    includeViewerRows: z.boolean().default(true),
    kind: z.enum(LEADERBOARD_KINDS).default(DEFAULT_LEADERBOARD),
    limit: z.number().int().positive().max(50).default(10),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(50).default(20),
    scope: z.enum(['public', 'full']).default('public'),
  })
  .optional();

const charityPotGoalInput = z.object({
  goalMerits: z.number().int().min(0).max(1_000_000),
});

const CHARITY_POT_ID = 'centre';

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

async function requireCanViewFullLeaderboard(ctx: AuthedContext): Promise<void> {
  if (canUseAdminOperations(ctx.user)) return;

  const denied = new AccessDeniedError(
    'full leaderboard requires Head, Principal, Pastor, HeadOfDiscipline, or TechnicalSupport',
  );
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'leaderboard.get',
      meta: { role: ctx.user.role, reason: denied.message, scope: 'full' },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
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

function metricCandidate(
  student: StudentIdentity | undefined,
  metric: number,
): LeaderboardMetricCandidate | null {
  if (!student || metric <= 0) return null;

  return {
    studentId: student.id,
    fullNameEnc: student.fullNameEnc,
    yearGroup: student.yearGroup,
    metric,
    enrolmentDate: student.enrolmentDate,
  };
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
    const candidate = metricCandidate(students.get(total.studentId), metric);
    return candidate ? [candidate] : [];
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

  return accounts.flatMap((account) => {
    const units = toNumber(account.units);
    if (units <= 0) return [];

    return [
      {
        studentId: account.studentId,
        fullNameEnc: account.student.fullNameEnc,
        yearGroup: account.student.yearGroup,
        enrolmentDate: account.student.enrolmentDate,
        metric: Math.floor(units * latestNav),
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
    const candidate = metricCandidate(students.get(total.studentId), metric);
    return candidate ? [candidate] : [];
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

function buildRows(
  ctx: AuthedContext,
  ranked: readonly (LeaderboardMetricCandidate & { rank: number })[],
): LeaderboardRow[] {
  return ranked.map((row) => ({
    rank: row.rank,
    studentId: row.studentId,
    displayName: decryptRequired(ctx.db.$enc.decrypt, row.fullNameEnc),
    yearGroup: row.yearGroup,
    score: row.metric,
  }));
}

async function loadViewerStudentIds(ctx: AuthedContext): Promise<ReadonlySet<string>> {
  if (ctx.user.role === 'Student') {
    const student = await ctx.db.student.findUnique({
      where: { userId: ctx.user.id },
      select: { id: true, active: true },
    });
    return student?.active ? new Set([student.id]) : new Set();
  }

  if (!canUseLinkedChildGuardianAccess(ctx.user)) return new Set();

  const guardians = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id, student: { active: true } },
    select: { studentId: true },
  });
  return new Set(guardians.map((guardian) => guardian.studentId));
}

async function buildLeaderboardResult(
  ctx: AuthedContext,
  kind: LeaderboardKind,
  candidates: readonly LeaderboardMetricCandidate[],
  includeViewerRows: boolean,
  limit: number,
): Promise<
  Pick<LeaderboardResultDto, 'page' | 'pageSize' | 'rows' | 'scope' | 'totalRows' | 'viewerRows'>
> {
  const rankedTop = rankStudentMetrics(candidates, limit);
  const viewerStudentIds = includeViewerRows ? await loadViewerStudentIds(ctx) : new Set<string>();
  const rankedAll =
    viewerStudentIds.size > 0 ? rankStudentMetrics(candidates, candidates.length) : [];
  const viewerRanked = rankedAll.filter((row) => viewerStudentIds.has(row.studentId));

  const rows = buildRows(ctx, rankedTop);
  const viewerRows = buildRows(ctx, viewerRanked);
  await auditLeaderboardDecrypt(ctx, kind, rows.length + viewerRows.length);
  return {
    page: 1,
    pageSize: limit,
    rows,
    scope: 'public',
    totalRows: rows.length,
    viewerRows,
  };
}

async function buildFullLeaderboardResult(
  ctx: AuthedContext,
  kind: LeaderboardKind,
  candidates: readonly LeaderboardMetricCandidate[],
  page: number,
  pageSize: number,
): Promise<
  Pick<LeaderboardResultDto, 'page' | 'pageSize' | 'rows' | 'scope' | 'totalRows' | 'viewerRows'>
> {
  const rankedAll = rankStudentMetrics(candidates, candidates.length);
  const offset = (page - 1) * pageSize;
  const rows = buildRows(ctx, rankedAll.slice(offset, offset + pageSize));

  await auditLeaderboardDecrypt(ctx, kind, rows.length);
  return {
    page,
    pageSize,
    rows,
    scope: 'full',
    totalRows: rankedAll.length,
    viewerRows: [],
  };
}

function charityPotDto(
  row: { goalMerits: number; updatedAt: Date; updatedById: string | null } | null,
  currentMerits: number,
): CharityPotDto {
  const goalMerits = row?.goalMerits ?? 0;
  return {
    goalMerits,
    currentMerits,
    progressPct: goalMerits > 0 ? Math.min(100, Math.floor((currentMerits / goalMerits) * 100)) : 0,
    goalReached: goalMerits > 0 && currentMerits >= goalMerits,
    updatedAt: row?.updatedAt ?? null,
    updatedById: row?.updatedById ?? null,
  };
}

async function loadCharityPot(ctx: AuthedContext): Promise<CharityPotDto> {
  const [row, gifts] = await Promise.all([
    ctx.db.charityPot.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, goalMerits: true, updatedAt: true, updatedById: true },
    }),
    ctx.db.meritLedger.aggregate({
      where: { account: 'Given', delta: { gt: 0 }, reason: { startsWith: 'charity:' } },
      _sum: { delta: true },
    }),
  ]);
  return charityPotDto(row, gifts._sum.delta ?? 0);
}

async function requireCanManageCharityPot(ctx: AuthedContext): Promise<void> {
  if (isFullAdmin(ctx.user)) return;

  const denied = new AccessDeniedError('charity pot goal requires full-admin access');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'leaderboard.charityPot.updateGoal',
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

export const leaderboardRouter = router({
  get: authedProcedure.input(getInput).query(async ({ ctx, input }) => {
    const kind = input?.kind ?? DEFAULT_LEADERBOARD;
    const includeViewerRows = input?.includeViewerRows ?? true;
    const limit = Math.min(input?.limit ?? 10, 10);
    const page = input?.page ?? 1;
    const pageSize = input?.pageSize ?? 20;
    const scope = input?.scope ?? 'public';

    await requireCanViewLeaderboard(ctx, kind);
    if (scope === 'full') {
      await requireCanViewFullLeaderboard(ctx);
    }
    const candidates = await loadCandidates(ctx, kind);
    const rows =
      scope === 'full'
        ? await buildFullLeaderboardResult(ctx, kind, candidates, page, pageSize)
        : await buildLeaderboardResult(ctx, kind, candidates, includeViewerRows, limit);

    return {
      kind,
      asOf: new Date(),
      ...rows,
    } satisfies LeaderboardResultDto;
  }),
  charityPot: router({
    get: authedProcedure.query(async ({ ctx }) => loadCharityPot(ctx)),
    updateGoal: authedProcedure.input(charityPotGoalInput).mutation(async ({ ctx, input }) => {
      await requireCanManageCharityPot(ctx);
      const row = await ctx.db.charityPot.upsert({
        where: { id: CHARITY_POT_ID },
        create: {
          id: CHARITY_POT_ID,
          goalMerits: input.goalMerits,
          updatedById: ctx.user.id,
        },
        update: {
          goalMerits: input.goalMerits,
          updatedById: ctx.user.id,
        },
        select: { id: true, goalMerits: true, updatedAt: true, updatedById: true },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'CharityPot',
          entityId: row.id,
          meta: { goalMerits: row.goalMerits },
        },
      });
      const gifts = await ctx.db.meritLedger.aggregate({
        where: { account: 'Given', delta: { gt: 0 }, reason: { startsWith: 'charity:' } },
        _sum: { delta: true },
      });
      return charityPotDto(row, gifts._sum.delta ?? 0);
    }),
  }),
});
