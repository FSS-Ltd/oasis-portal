export const incidentTypes = [
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

export const incidentSeverities = ['Low', 'Medium', 'High', 'Critical'] as const;
export const incidentConfidentialities = [
  'StaffOnly',
  'HeadDsl',
  'ParentViewableAfterSignOff',
] as const;

export type IncidentType = (typeof incidentTypes)[number];
export type IncidentSeverity = (typeof incidentSeverities)[number];
export type IncidentConfidentiality = (typeof incidentConfidentialities)[number];

export type IncidentFormState = {
  activity: string;
  confidentiality: IncidentConfidentiality;
  directDisclosure: string;
  dslNotified: boolean;
  emergencyServicesContacted: boolean;
  evidenceNotes: string;
  factualAccount: string;
  firstAidGiven: boolean;
  hospitalTreatment: boolean;
  immediateActions: string;
  injurySustained: boolean;
  location: string;
  occurredDate: string;
  occurredTime: string;
  parentCarerNotified: boolean;
  parentVisibilityRequested: boolean;
  selectedStudentIds: string[];
  severity: IncidentSeverity;
  type: IncidentType;
  witnesses: string;
};

export type IncidentFormErrors = Partial<
  Record<
    'factualAccount' | 'immediateActions' | 'location' | 'occurredAt' | 'selectedStudentIds',
    string
  >
>;

const schoolTimeZone = 'Europe/London';

export const incidentTypeLabels: Record<IncidentType, string> = {
  AccidentFirstAid: 'Accident / first aid',
  BehaviourIncident: 'Behaviour incident',
  BullyingPeerOnPeer: 'Bullying / peer-on-peer abuse',
  MedicalMedication: 'Medical / medication',
  NearMiss: 'Near miss',
  OffSiteTrip: 'Off-site trip',
  OnlineSafety: 'Online safety',
  PhysicalIntervention: 'Physical intervention',
  SafeguardingConcern: 'Safeguarding concern',
};

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  Critical: 'Critical',
  High: 'High',
  Low: 'Low',
  Medium: 'Medium',
};

export const incidentConfidentialityLabels: Record<IncidentConfidentiality, string> = {
  HeadDsl: 'Head / DSL',
  ParentViewableAfterSignOff: 'Parent viewable after sign-off',
  StaffOnly: 'Staff only',
};

export function dateKeyInSchoolTimeZone(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: schoolTimeZone,
    year: 'numeric',
  }).formatToParts(value);
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  return `${year}-${month}-${day}`;
}

export function defaultIncidentTime(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: schoolTimeZone,
  }).formatToParts(value);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '09';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

export function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatIncidentDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(
    dateFromKey(value),
  );
}

export function incidentDateTime(form: Pick<IncidentFormState, 'occurredDate' | 'occurredTime'>) {
  return new Date(`${form.occurredDate}T${form.occurredTime || '09:00'}:00.000Z`);
}

export function newIncidentForm(now = new Date()): IncidentFormState {
  return {
    activity: '',
    confidentiality: 'StaffOnly',
    directDisclosure: '',
    dslNotified: false,
    emergencyServicesContacted: false,
    evidenceNotes: '',
    factualAccount: '',
    firstAidGiven: false,
    hospitalTreatment: false,
    immediateActions: '',
    injurySustained: false,
    location: '',
    occurredDate: dateKeyInSchoolTimeZone(now),
    occurredTime: defaultIncidentTime(now),
    parentCarerNotified: false,
    parentVisibilityRequested: false,
    selectedStudentIds: [],
    severity: 'Medium',
    type: 'SafeguardingConcern',
    witnesses: '',
  };
}

export function validateIncidentForm(form: IncidentFormState): IncidentFormErrors {
  const errors: IncidentFormErrors = {};
  if (form.selectedStudentIds.length === 0) {
    errors.selectedStudentIds = 'Choose at least one student.';
  }
  if (Number.isNaN(incidentDateTime(form).getTime())) {
    errors.occurredAt = 'Enter a valid incident date and time.';
  }
  if (!form.location.trim()) errors.location = 'Enter where the incident happened.';
  if (!form.factualAccount.trim()) errors.factualAccount = 'Describe the factual account.';
  if (!form.immediateActions.trim()) {
    errors.immediateActions = 'Record immediate actions taken.';
  }
  return errors;
}

export function hasIncidentFormErrors(errors: IncidentFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function reportabilitySummary(form: IncidentFormState): string {
  const checks = [
    form.dslNotified ? 'DSL notified' : null,
    form.parentVisibilityRequested ? 'parent visibility requested' : null,
    form.emergencyServicesContacted ? 'emergency services contacted' : null,
    form.hospitalTreatment ? 'hospital treatment' : null,
  ].filter(Boolean);
  return checks.length > 0 ? checks.join(' · ') : 'Head sign-off required by default';
}

export function incidentStatusLabel(status: string): string {
  if (status === 'HeadReview') return 'Head review';
  if (status === 'SignedOff') return 'Signed off';
  return status;
}
