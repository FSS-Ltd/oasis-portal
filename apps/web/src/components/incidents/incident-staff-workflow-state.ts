import type { RouterOutputs } from '@/lib/trpc';
import type {
  incidentConfidentialityLabels,
  incidentSeverityLabels,
  incidentTypeLabels,
} from './incident-format';

export type StaffIncident = RouterOutputs['incident']['listStaff'][number];
export type IncidentType = keyof typeof incidentTypeLabels;
export type IncidentSeverity = keyof typeof incidentSeverityLabels;
export type IncidentConfidentiality = keyof typeof incidentConfidentialityLabels;

export interface IncidentFormState {
  activity: string;
  bodyArea: string;
  confidentiality: IncidentConfidentiality;
  dataSharingReason: string;
  directDisclosure: string;
  dslNotified: boolean;
  emergencyServicesContacted: boolean;
  factualAccount: string;
  firstAidGiven: boolean;
  firstAiderId: string;
  headSignOffRequired: boolean;
  hospitalTreatment: boolean;
  immediateActions: string;
  injurySustained: boolean;
  ladoConsidered: boolean;
  location: string;
  medicalNotes: string;
  occurredAt: string;
  offSite: boolean;
  parentCarerNotified: boolean;
  parentNotifiedAt: string;
  parentVisibilityRequested: boolean;
  pastorPrincipalEscalation: boolean;
  riddorCheck: boolean;
  severity: IncidentSeverity;
  socialCarePoliceReferral: boolean;
  staffIds: string[];
  studentIds: string[];
  type: IncidentType;
  witnesses: string;
  witnessStaffIds: string[];
}

export type IncidentBooleanField = {
  [K in keyof IncidentFormState]: IncidentFormState[K] extends boolean ? K : never;
}[keyof IncidentFormState];

export interface ParentCopyFormState {
  parentSummary: string;
  sharingReason: string;
  studentId: string;
}

export interface IncidentFormInput {
  activity?: string;
  bodyArea?: string;
  confidentiality: IncidentConfidentiality;
  dataSharingReason?: string;
  directDisclosure?: string;
  dslNotified: boolean;
  emergencyServicesContacted: boolean;
  factualAccount: string;
  firstAidGiven: boolean;
  firstAiderId?: string;
  headSignOffRequired: boolean;
  hospitalTreatment: boolean;
  immediateActions?: string;
  injurySustained: boolean;
  ladoConsidered: boolean;
  location: string;
  medicalNotes?: string;
  occurredAt: Date;
  offSite: boolean;
  parentCarerNotified: boolean;
  parentNotifiedAt?: Date;
  parentVisibilityRequested: boolean;
  pastorPrincipalEscalation: boolean;
  riddorCheck: boolean;
  severity: IncidentSeverity;
  socialCarePoliceReferral: boolean;
  staffIds: string[];
  studentIds: string[];
  type: IncidentType;
  witnesses?: string;
  witnessStaffIds: string[];
}

export const defaultIncidentForm: IncidentFormState = {
  activity: '',
  bodyArea: '',
  confidentiality: 'StaffOnly',
  dataSharingReason: '',
  directDisclosure: '',
  dslNotified: false,
  emergencyServicesContacted: false,
  factualAccount: '',
  firstAidGiven: false,
  firstAiderId: '',
  headSignOffRequired: true,
  hospitalTreatment: false,
  immediateActions: '',
  injurySustained: false,
  ladoConsidered: false,
  location: '',
  medicalNotes: '',
  occurredAt: new Date().toISOString().slice(0, 16),
  offSite: false,
  parentCarerNotified: false,
  parentNotifiedAt: '',
  parentVisibilityRequested: false,
  pastorPrincipalEscalation: false,
  riddorCheck: false,
  severity: 'Medium',
  socialCarePoliceReferral: false,
  staffIds: [],
  studentIds: [],
  type: 'SafeguardingConcern',
  witnesses: '',
  witnessStaffIds: [],
};

export const reportabilityChecks = [
  {
    field: 'dslNotified',
    label: 'DSL notified for safeguarding concern',
    help: 'Use this when the concern has been passed to the Designated Safeguarding Lead for review.',
  },
  {
    field: 'headSignOffRequired',
    label: 'Head sign-off required',
    help: 'Use this when a senior leader must approve the report before any parent-safe copy is released.',
  },
  {
    field: 'pastorPrincipalEscalation',
    label: 'Escalate to Pastor/Principal',
    help: 'Use this for serious safeguarding, reputational, or operational concerns that need senior escalation.',
  },
  {
    field: 'ladoConsidered',
    label: 'Consider LADO if allegation involves staff/adult',
    help: 'LADO means Local Authority Designated Officer. Consider this where an allegation involves an adult working with children.',
  },
  {
    field: 'socialCarePoliceReferral',
    label: "Consider children's social care / police referral",
    help: 'Use this when the facts may meet the threshold for external safeguarding or police advice.',
  },
  {
    field: 'riddorCheck',
    label: 'HSE/RIDDOR check if serious injury, hospital treatment, or dangerous occurrence',
    help: 'HSE is the Health and Safety Executive. RIDDOR is the legal reporting regime for specified workplace injuries and dangerous occurrences.',
  },
] satisfies Array<{ field: IncidentBooleanField; label: string; help: string }>;

export const parentVisibilityRoles = new Set(['Head', 'Pastor', 'HeadOfDiscipline', 'Principal']);

export function emptyCopyForm(report: StaffIncident | null): ParentCopyFormState {
  const student = report?.students[0];
  return {
    parentSummary: '',
    sharingReason: report?.dataSharingReason ?? '',
    studentId: student?.studentId ?? '',
  };
}

export function splitLocalDateTime(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time };
}

export function joinLocalDateTime(date: string, time: string): string {
  return `${date || new Date().toISOString().slice(0, 10)}T${time || '09:00'}`;
}

function dateTimeInputValue(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 16);
  return date.toISOString().slice(0, 16);
}

function timeInputValue(value: Date | string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(11, 16);
}

export function incidentFormFromReport(report: StaffIncident): IncidentFormState {
  return {
    activity: report.activity ?? '',
    bodyArea: report.bodyArea ?? '',
    confidentiality: report.confidentiality as IncidentConfidentiality,
    dataSharingReason: report.dataSharingReason ?? '',
    directDisclosure: report.directDisclosure ?? '',
    dslNotified: report.dslNotified,
    emergencyServicesContacted: report.emergencyServicesContacted,
    factualAccount: report.factualAccount,
    firstAidGiven: report.firstAidGiven,
    firstAiderId: report.firstAiderId ?? '',
    headSignOffRequired: report.headSignOffRequired,
    hospitalTreatment: report.hospitalTreatment,
    immediateActions: report.immediateActions ?? '',
    injurySustained: report.injurySustained,
    ladoConsidered: report.ladoConsidered,
    location: report.location,
    medicalNotes: report.medicalNotes ?? '',
    occurredAt: dateTimeInputValue(report.occurredAt),
    offSite: report.offSite,
    parentCarerNotified: report.parentCarerNotified,
    parentNotifiedAt: timeInputValue(report.parentNotifiedAt),
    parentVisibilityRequested: report.parentVisibilityRequested,
    pastorPrincipalEscalation: report.pastorPrincipalEscalation,
    riddorCheck: report.riddorCheck,
    severity: report.severity as IncidentSeverity,
    socialCarePoliceReferral: report.socialCarePoliceReferral,
    staffIds: report.staff
      .filter((staffMember) => staffMember.kind === 'StaffInvolved')
      .map((staffMember) => staffMember.userId),
    studentIds: report.students.map((student) => student.studentId),
    type: report.type as IncidentType,
    witnesses: report.witnesses ?? '',
    witnessStaffIds: report.staff
      .filter((staffMember) => staffMember.kind === 'Witness')
      .map((staffMember) => staffMember.userId),
  };
}

export function incidentFormProgress(form: IncidentFormState): {
  completed: number;
  total: number;
} {
  const checks = [
    form.type.length > 0,
    form.severity.length > 0,
    form.occurredAt.length > 0,
    form.location.trim().length > 0,
    form.studentIds.length > 0,
    form.factualAccount.trim().length > 0,
    form.immediateActions.trim().length > 0,
    reportabilityChecks.some(({ field }) => form[field]),
  ];

  return { completed: checks.filter(Boolean).length, total: checks.length };
}

export function incidentFormInput(form: IncidentFormState): IncidentFormInput {
  const input: IncidentFormInput = {
    confidentiality: form.confidentiality,
    dslNotified: form.dslNotified,
    emergencyServicesContacted: form.emergencyServicesContacted,
    factualAccount: form.factualAccount,
    firstAidGiven: form.firstAidGiven,
    headSignOffRequired: form.headSignOffRequired,
    hospitalTreatment: form.hospitalTreatment,
    injurySustained: form.injurySustained,
    ladoConsidered: form.ladoConsidered,
    location: form.location,
    occurredAt: new Date(form.occurredAt),
    offSite: form.offSite,
    parentCarerNotified: form.parentCarerNotified,
    parentVisibilityRequested: form.parentVisibilityRequested,
    pastorPrincipalEscalation: form.pastorPrincipalEscalation,
    riddorCheck: form.riddorCheck,
    severity: form.severity,
    socialCarePoliceReferral: form.socialCarePoliceReferral,
    staffIds: form.staffIds,
    studentIds: form.studentIds,
    type: form.type,
    witnessStaffIds: form.witnessStaffIds,
  };

  if (form.activity) input.activity = form.activity;
  if (form.bodyArea) input.bodyArea = form.bodyArea;
  if (form.dataSharingReason) input.dataSharingReason = form.dataSharingReason;
  if (form.directDisclosure) input.directDisclosure = form.directDisclosure;
  if (form.firstAiderId) input.firstAiderId = form.firstAiderId;
  if (form.immediateActions) input.immediateActions = form.immediateActions;
  if (form.medicalNotes) input.medicalNotes = form.medicalNotes;
  if (form.parentNotifiedAt) {
    input.parentNotifiedAt = new Date(
      joinLocalDateTime(splitLocalDateTime(form.occurredAt).date, form.parentNotifiedAt),
    );
  }
  if (form.witnesses) input.witnesses = form.witnesses;

  return input;
}
