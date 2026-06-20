import type { RouterOutputs } from '../../lib/trpc';

export type StudentClub = RouterOutputs['club']['studentClubs'][number];
export type StudentClubDetail = RouterOutputs['club']['studentClubDetail'];
export type StudentFaithCorner = RouterOutputs['faithCorner']['currentForStudent'];
export type FaithCornerComment = RouterOutputs['faithCorner']['listComments'][number];
export type ClubStatus = StudentClub['status'];
export type StudentStateBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'blue';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

export const clubsFaithBlockedCopy = [
  'Student portal locked',
  'Off-limit day',
  'Usage limit reached',
] as const;

export function formatStudentDate(value: Date | string | null): string {
  if (!value) return 'Not set';
  return dateFormatter.format(new Date(value));
}

export function clubStatusVariant(status: ClubStatus): StudentStateBadgeVariant {
  if (status === 'Member') return 'success';
  if (status === 'Interested') return 'warning';
  if (status === 'Full') return 'neutral';
  return 'blue';
}

export function clubSpacesLabel(club: Pick<StudentClub, 'activeSignupCount' | 'capacity'>): string {
  if (club.capacity === null) return `${String(club.activeSignupCount)} members`;
  return `${String(club.activeSignupCount)}/${String(club.capacity)} places`;
}

export function clubLeadLabel(supervisorNames: readonly string[]): string {
  if (supervisorNames.length === 0) return 'Supervisor to be confirmed';
  if (supervisorNames.length === 1) return supervisorNames[0] ?? 'Supervisor to be confirmed';
  return `${supervisorNames[0] ?? 'Supervisor'} + ${String(supervisorNames.length - 1)} more`;
}

export function trimComment(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
