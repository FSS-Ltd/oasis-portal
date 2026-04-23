/**
 * Leaderboards.
 *
 * Public: TopTithers (default view), TopInvestors (by total return %), TopSavers
 *   (by Saving balance). Visible to Parents, Staff, Students.
 * Admin-only: HighestDemerits — gated to `leaderboard-admin` tag.
 *
 * Pure functions — take pre-fetched rows, return ranked lists.
 * Ties: stable sort, older students first (earlier enrolmentDate).
 */
import { hasTag, type SessionUser } from './rbac.js';

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
  metric: number;
  enrolmentDate: Date;
}

export interface LeaderboardRow {
  rank: number;
  studentId: string;
  displayName: string;
  score: number;
}

export function canViewDemeritLeaderboard(user: SessionUser): boolean {
  return hasTag(user, 'leaderboard-admin');
}

export function isPublicLeaderboard(kind: LeaderboardKind): boolean {
  return kind !== 'HighestDemerits';
}

export function rankLeaderboard(
  rows: readonly StudentMetric[],
  limit = 10,
): LeaderboardRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.metric !== a.metric) return b.metric - a.metric;
    return a.enrolmentDate.getTime() - b.enrolmentDate.getTime();
  });

  return sorted.slice(0, limit).map((r, idx) => ({
    rank: idx + 1,
    studentId: r.studentId,
    displayName: r.displayName,
    score: r.metric,
  }));
}

/**
 * Total return % on Investment = (currentValue - costBasis) / costBasis * 100.
 * costBasis = sum of merits put in (positive Buy deltas in ledger);
 * currentValue = units * latestNav.
 */
export function investmentReturnPct(params: {
  costBasis: number;
  currentValue: number;
}): number {
  if (params.costBasis <= 0) return 0;
  return ((params.currentValue - params.costBasis) / params.costBasis) * 100;
}
