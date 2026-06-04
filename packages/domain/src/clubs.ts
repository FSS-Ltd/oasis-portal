/**
 * Clubs module — v1 is deliberately minimal: tracking only.
 *
 * - Full admins and ClubsAdmin can create/edit clubs, assign students/leads, and send notices.
 * - ClubsLead users can operate only on assigned clubs.
 * - Parents and linked-child staff/admin guardians sign their own children up.
 * - No capacity enforcement yet unless the club sets one.
 */
import {
  canUseClubLeadAccess,
  canUseLinkedChildGuardianAccess,
  requireClubsAdminOrFullAdmin,
  type SessionUser,
} from './rbac.js';

export interface ClubDraft {
  name: string;
  description?: string;
  schedule?: string | ClubScheduleDraft | null;
  capacity?: number;
}

export const CLUB_SCHEDULE_FREQUENCIES = ['Weekly'] as const;
export type ClubScheduleFrequency = (typeof CLUB_SCHEDULE_FREQUENCIES)[number];

export interface ClubScheduleDraft {
  startDate: Date;
  startMinute: number;
  endMinute: number;
  frequency: ClubScheduleFrequency;
}

export function assertCanManageClub(user: SessionUser): void {
  requireClubsAdminOrFullAdmin(user);
}

export function canUseLinkedChildClubSignup(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'ClubsAdmin' || canUseLinkedChildGuardianAccess(user);
}

export function canOperateAssignedClub(
  user: Pick<SessionUser, 'role' | 'tags' | 'id'>,
  assignedClubIds: readonly string[],
  clubId: string,
): boolean {
  return canUseClubLeadAccess(user) && assignedClubIds.includes(clubId);
}

export function validateClubDraft(draft: ClubDraft): Required<Pick<ClubDraft, 'name'>> & ClubDraft {
  const name = draft.name.trim();
  if (!name) throw new Error('club name is required');
  if (draft.capacity !== undefined) {
    if (!Number.isInteger(draft.capacity) || draft.capacity <= 0) {
      throw new Error('capacity must be a positive integer');
    }
  }
  return { ...draft, name };
}

export function validateClubScheduleDraft(
  draft: ClubScheduleDraft | null | undefined,
): ClubScheduleDraft | null {
  if (!draft) return null;
  if (Number.isNaN(draft.startDate.getTime())) throw new Error('club schedule date is invalid');
  if (!Number.isInteger(draft.startMinute) || draft.startMinute < 0 || draft.startMinute > 1439) {
    throw new Error('club schedule start time is invalid');
  }
  if (!Number.isInteger(draft.endMinute) || draft.endMinute < 1 || draft.endMinute > 1440) {
    throw new Error('club schedule end time is invalid');
  }
  if (draft.startMinute >= draft.endMinute) {
    throw new Error('club schedule start time must be before end time');
  }
  return draft;
}

function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function formatClubSchedule(schedule: ClubScheduleDraft | null | undefined): string | null {
  const validSchedule = validateClubScheduleDraft(schedule);
  if (!validSchedule) return null;
  return `Weekly from ${validSchedule.startDate.toISOString().slice(0, 10)}, ${formatMinute(
    validSchedule.startMinute,
  )}-${formatMinute(validSchedule.endMinute)}`;
}

export interface SignupCheckInput {
  capacity?: number;
  currentActiveSignups: number;
  alreadySignedUp: boolean;
}

export function canSignUpForClub(input: SignupCheckInput): true | string {
  if (input.alreadySignedUp) return 'student is already signed up for this club';
  if (input.capacity !== undefined && input.currentActiveSignups >= input.capacity) {
    return 'club is at capacity';
  }
  return true;
}
