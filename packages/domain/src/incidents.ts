import {
  AccessDeniedError,
  canUseAdminOperations,
  canUseLinkedChildGuardianAccess,
  type SessionUser,
} from './rbac.js';

export const INCIDENT_REPORT_STATUSES = [
  'Draft',
  'HeadReview',
  'Escalated',
  'SignedOff',
  'Archived',
] as const;
export type IncidentReportStatus = (typeof INCIDENT_REPORT_STATUSES)[number];

export const INCIDENT_PARENT_COPY_STATUSES = ['Draft', 'Generated', 'Shared', 'Archived'] as const;
export type IncidentParentCopyStatus = (typeof INCIDENT_PARENT_COPY_STATUSES)[number];

export const INCIDENT_STATUS_ACTIONS = [
  'submitForHeadReview',
  'signOff',
  'escalate',
  'archive',
] as const;
export type IncidentStatusAction = (typeof INCIDENT_STATUS_ACTIONS)[number];

export const INCIDENT_TYPES = [
  'SafeguardingConcern',
  'AccidentFirstAid',
  'BehaviourIncident',
  'BullyingPeerOnPeer',
  'OnlineSafety',
  'MedicalMedication',
  'PhysicalIntervention',
  'NearMiss',
  'OffSiteTrip',
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_CONFIDENTIALITIES = [
  'StaffOnly',
  'HeadDsl',
  'ParentViewableAfterSignOff',
] as const;
export type IncidentConfidentiality = (typeof INCIDENT_CONFIDENTIALITIES)[number];

export function canCreateIncidentReport(user: Pick<SessionUser, 'role'>): boolean {
  return canUseAdminOperations(user) || user.role === 'Supervisor';
}

export function canSignOffIncidentReport(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'Head' || user.role === 'HeadOfDiscipline';
}

export function canEscalateIncidentReport(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'Pastor' || user.role === 'Principal';
}

export function canShareIncidentParentCopy(user: Pick<SessionUser, 'role'>): boolean {
  return canSignOffIncidentReport(user) || canEscalateIncidentReport(user);
}

export function canOverrideIncidentParentVisibility(user: Pick<SessionUser, 'role'>): boolean {
  return canShareIncidentParentCopy(user);
}

export function canUseLinkedChildIncidentAccess(user: Pick<SessionUser, 'role'>): boolean {
  return canUseLinkedChildGuardianAccess(user);
}

export function requireCanCreateIncidentReport(user: SessionUser): void {
  if (!canCreateIncidentReport(user)) {
    throw new AccessDeniedError(`role ${user.role} cannot record incident reports`);
  }
}

export function requireCanSignOffIncidentReport(user: SessionUser): void {
  if (!canSignOffIncidentReport(user)) {
    throw new AccessDeniedError(`role ${user.role} cannot sign off incident reports`);
  }
}

export function requireCanEscalateIncidentReport(user: SessionUser): void {
  if (!canEscalateIncidentReport(user)) {
    throw new AccessDeniedError(`role ${user.role} cannot handle incident escalations`);
  }
}

export function requireCanShareIncidentParentCopy(user: SessionUser): void {
  if (!canShareIncidentParentCopy(user)) {
    throw new AccessDeniedError(`role ${user.role} cannot share incident parent copies`);
  }
}

export function defaultIncidentParentVisibility(): false {
  return false;
}

export function incidentParentCopyIsVisible(status: IncidentParentCopyStatus): boolean {
  return status === 'Shared';
}

export function nextIncidentStatus(
  currentStatus: IncidentReportStatus,
  action: IncidentStatusAction,
): IncidentReportStatus {
  if (currentStatus === 'Draft' && action === 'submitForHeadReview') return 'HeadReview';
  if (currentStatus === 'HeadReview' && action === 'signOff') return 'SignedOff';
  if (currentStatus === 'HeadReview' && action === 'escalate') return 'Escalated';
  if (currentStatus === 'Escalated' && action === 'signOff') return 'SignedOff';
  if (currentStatus === 'SignedOff' && action === 'archive') return 'Archived';

  throw new Error(`incident status ${currentStatus} cannot ${action}`);
}

export function assertIncidentTransition(
  currentStatus: IncidentReportStatus,
  action: IncidentStatusAction,
): void {
  void nextIncidentStatus(currentStatus, action);
}
