import type { RouterOutputs } from '../../lib/trpc';

export type StudentPace = RouterOutputs['pace']['forStudent'];
export type StudentAttendance = RouterOutputs['attendance']['studentSummary'];
export type StudentDashboard = RouterOutputs['student']['dashboard'];
export type StudentLeaderboard = RouterOutputs['leaderboard']['get'];
export type PublicLeaderboardKind = 'TopTithers' | 'TopInvestors' | 'TopSavers';
export type LearningBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'blue';

export interface LeaderboardOption {
  kind: PublicLeaderboardKind;
  label: string;
  scoreLabel: string;
}

export const leaderboardOptions: readonly LeaderboardOption[] = [
  { kind: 'TopTithers', label: 'Top Tithers', scoreLabel: 'tithed' },
  { kind: 'TopSavers', label: 'Top Savers', scoreLabel: 'saved' },
  { kind: 'TopInvestors', label: 'Top Investors', scoreLabel: 'invested' },
];

const numberFormatter = new Intl.NumberFormat('en-GB');
const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

export function formatLearningDate(value: Date | string | null): string {
  if (!value) return 'No date';
  return shortDateFormatter.format(new Date(value));
}

export function formatLearningMerits(value: number): string {
  return `${numberFormatter.format(Math.round(value))} merits`;
}

export function formatAttendanceRate(value: number | null): string {
  return value === null ? 'No records' : `${String(value)}%`;
}

export function scoreLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? 'No score' : `${String(value)}%`;
}

export function paceStatusVariant(
  tone: StudentPace['subjects'][number]['status']['tone'],
): LearningBadgeVariant {
  if (tone === 'green') return 'success';
  if (tone === 'amber') return 'warning';
  if (tone === 'blue') return 'blue';
  return 'neutral';
}

export function attendanceStatusVariant(
  status: StudentAttendance['records'][number]['status'],
): LearningBadgeVariant {
  if (status === 'Present') return 'success';
  if (status === 'Late') return 'warning';
  return 'danger';
}

export function leaderboardScoreLabel(kind: PublicLeaderboardKind): string {
  return leaderboardOptions.find((option) => option.kind === kind)?.scoreLabel ?? 'merits';
}
