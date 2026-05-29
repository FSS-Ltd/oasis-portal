export const incidentTypeLabels = {
  AccidentFirstAid: 'Accident / first aid',
  BehaviourIncident: 'Behaviour incident',
  BullyingPeerOnPeer: 'Bullying / peer-on-peer abuse',
  MedicalMedication: 'Medical / medication',
  NearMiss: 'Near miss',
  OffSiteTrip: 'Off-site trip',
  OnlineSafety: 'Online safety',
  PhysicalIntervention: 'Physical intervention',
  SafeguardingConcern: 'Safeguarding concern',
} as const;

export const incidentSeverityLabels = {
  Critical: 'Critical',
  High: 'High',
  Low: 'Low',
  Medium: 'Medium',
} as const;

export const incidentConfidentialityLabels = {
  HeadDsl: 'Head / DSL',
  ParentViewableAfterSignOff: 'Parent viewable after sign-off',
  StaffOnly: 'Staff only',
} as const;

export const incidentStatusLabels = {
  Archived: 'Archived',
  Draft: 'Draft',
  Escalated: 'Escalated',
  HeadReview: 'Head review',
  SignedOff: 'Signed off',
} as const;

export function formatIncidentDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatIncidentDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function statusTone(
  status: keyof typeof incidentStatusLabels,
): 'amber' | 'blue' | 'green' | 'grey' | 'red' {
  if (status === 'SignedOff') return 'green';
  if (status === 'Escalated') return 'amber';
  if (status === 'HeadReview') return 'blue';
  if (status === 'Archived') return 'grey';
  return 'red';
}
