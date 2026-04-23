/**
 * Clubs module — v1 is deliberately minimal: tracking only.
 *
 * - Full admins and ClubsAdmin can create/edit clubs and send notifications.
 * - Parents sign their own children up (uses requireOwnChild in the caller).
 * - No capacity enforcement yet unless the club sets one.
 */
import { requireClubsAdminOrFullAdmin, type SessionUser } from './rbac.js';

export interface ClubDraft {
  name: string;
  description?: string;
  schedule?: string;
  capacity?: number;
}

export function assertCanManageClub(user: SessionUser): void {
  requireClubsAdminOrFullAdmin(user);
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
