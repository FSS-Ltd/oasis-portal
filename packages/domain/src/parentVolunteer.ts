import { isStaffParentVolunteerEligibleRole, type Role } from './rbac.js';

export type ParentVolunteerAccess = 'parent' | 'staff' | null;

export interface ParentVolunteerAccessCandidate {
  active: boolean;
  activeGuardianCount: number;
  role: Role;
  staffParentVolunteerAccess: boolean;
}

export function resolveParentVolunteerAccess(
  candidate: ParentVolunteerAccessCandidate,
): ParentVolunteerAccess {
  if (candidate.role === 'Parent') return 'parent';
  if (
    candidate.active &&
    candidate.activeGuardianCount > 0 &&
    candidate.staffParentVolunteerAccess &&
    isStaffParentVolunteerEligibleRole(candidate)
  ) {
    return 'staff';
  }

  return null;
}

export function canUseParentVolunteerNavigation(access: ParentVolunteerAccess): boolean {
  return access !== null;
}
