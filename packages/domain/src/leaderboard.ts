/**
 * Leaderboards.
 *
 * Public: TopTithers (default view), TopInvestors (by invested value), TopSavers
 *   (by Saving balance). Visible to Parents, Staff, Students.
 * Admin-only: HighestDemerits — gated to full-admin or `leaderboard-admin`.
 *
 * Pure functions — take pre-fetched rows, return ranked lists.
 * Ties: older students first (earlier enrolmentDate), then student id.
 */
import { canUseAdminOperations, hasTag, type SessionUser } from './rbac.js';

export const LEADERBOARD_KINDS = [
  'TopTithers',
  'TopInvestors',
  'TopSavers',
  'HighestDemerits',
] as const;
export type LeaderboardKind = (typeof LEADERBOARD_KINDS)[number];

export const DEFAULT_LEADERBOARD: LeaderboardKind = 'TopTithers';

export interface StudentMetric {
  studentId: string;
  displayName: string;
  yearGroup: string;
  metric: number;
  enrolmentDate: Date;
  realizedProfitMerits?: number;
  withdrawnProfitGbp?: number;
  withdrawnProfitMerits?: number;
}

export interface RankableStudentMetric {
  studentId: string;
  metric: number;
  enrolmentDate: Date;
}

export interface LeaderboardRow {
  rank: number;
  studentId: string;
  displayName: string;
  yearGroup: string;
  score: number;
  realizedProfitMerits?: number;
  withdrawnProfitGbp?: number;
  withdrawnProfitMerits?: number;
}

export function canViewDemeritLeaderboard(user: SessionUser): boolean {
  return canUseAdminOperations(user) || hasTag(user, 'leaderboard-admin');
}

export function isPublicLeaderboard(kind: LeaderboardKind): boolean {
  return kind !== 'HighestDemerits';
}

export function rankStudentMetrics<T extends RankableStudentMetric>(
  rows: readonly T[],
  limit = 10,
): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => {
    if (b.metric !== a.metric) return b.metric - a.metric;
    const enrolmentDiff = a.enrolmentDate.getTime() - b.enrolmentDate.getTime();
    if (enrolmentDiff !== 0) return enrolmentDiff;
    return a.studentId.localeCompare(b.studentId);
  });

  return sorted.slice(0, limit).map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}

export function rankLeaderboard(rows: readonly StudentMetric[], limit = 10): LeaderboardRow[] {
  return rankStudentMetrics(rows, limit).map((r) => ({
    rank: r.rank,
    studentId: r.studentId,
    displayName: r.displayName,
    yearGroup: r.yearGroup,
    score: r.metric,
    ...(r.realizedProfitMerits !== undefined
      ? { realizedProfitMerits: r.realizedProfitMerits }
      : {}),
    ...(r.withdrawnProfitGbp !== undefined ? { withdrawnProfitGbp: r.withdrawnProfitGbp } : {}),
    ...(r.withdrawnProfitMerits !== undefined
      ? { withdrawnProfitMerits: r.withdrawnProfitMerits }
      : {}),
  }));
}

export function investmentReturnPct(params: { costBasis: number; currentValue: number }): number {
  if (params.costBasis <= 0) return 0;
  return ((params.currentValue - params.costBasis) / params.costBasis) * 100;
}
