import { REGISTRATION_CONSENT_TYPES, type RegistrationConsentType } from '@oasis/domain';

const REGISTRATION_DRAFT_STORAGE_KEY = 'oasis.parentRegistrationDraft.v1';
const REGISTRATION_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface ContactFormValues {
  fullName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  workPhone?: string;
  address?: string;
}

interface EmergencyContactFormValues {
  fullName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  canPickUp: boolean;
}

interface PickupContactFormValues {
  fullName: string;
  relationship: string;
  phone: string;
  idPasswordNote: string;
}

export interface RegistrationStudentFormValues {
  fullName: string;
  preferredName: string;
  dob: string;
  gender: string;
  yearGroup: string;
  startDate: string;
  homeLanguage: string;
  studentNotes: string;
  allergies: string;
  medicalConditions: string;
  medicationAtCentre: string;
  dietaryRestrictions: string;
  learningSupport: string;
  interestsStrengths: string;
  settlingComfortNotes: string;
  additionalInfo: string;
  consents: Record<RegistrationConsentType, { granted: boolean; initials: string }>;
}

export interface RegistrationFormValues {
  homeAddress: string;
  guardianContacts: ContactFormValues[];
  emergencyContacts: EmergencyContactFormValues[];
  pickupContacts: PickupContactFormValues[];
  students: RegistrationStudentFormValues[];
  agreement: {
    guardianName: string;
    agreementDate: string;
  };
}

export function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function blankConsents(): RegistrationStudentFormValues['consents'] {
  return Object.fromEntries(
    REGISTRATION_CONSENT_TYPES.map((type) => [type, { granted: false, initials: '' }]),
  ) as Record<RegistrationConsentType, { granted: boolean; initials: string }>;
}

export function blankStudent(): RegistrationStudentFormValues {
  return {
    fullName: '',
    preferredName: '',
    dob: '',
    gender: '',
    yearGroup: '',
    startDate: todayDateInput(),
    homeLanguage: '',
    studentNotes: '',
    allergies: '',
    medicalConditions: '',
    medicationAtCentre: '',
    dietaryRestrictions: '',
    learningSupport: '',
    interestsStrengths: '',
    settlingComfortNotes: '',
    additionalInfo: '',
    consents: blankConsents(),
  };
}

export function blankRegistrationValues(): RegistrationFormValues {
  return {
    homeAddress: '',
    guardianContacts: [
      {
        fullName: '',
        relationship: '',
        primaryPhone: '',
        secondaryPhone: '',
        email: '',
        workPhone: '',
        address: '',
      },
    ],
    emergencyContacts: [
      {
        fullName: '',
        relationship: '',
        primaryPhone: '',
        secondaryPhone: '',
        email: '',
        canPickUp: false,
      },
    ],
    pickupContacts: [],
    students: [blankStudent()],
    agreement: {
      guardianName: '',
      agreementDate: todayDateInput(),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function booleanValue(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mergeGuardianContact(value: unknown): ContactFormValues {
  const record = isRecord(value) ? value : {};
  return {
    fullName: stringValue(record.fullName),
    relationship: stringValue(record.relationship),
    primaryPhone: stringValue(record.primaryPhone),
    secondaryPhone: stringValue(record.secondaryPhone),
    email: stringValue(record.email),
    workPhone: stringValue(record.workPhone),
    address: stringValue(record.address),
  };
}

function mergeEmergencyContact(value: unknown): EmergencyContactFormValues {
  const record = isRecord(value) ? value : {};
  return {
    fullName: stringValue(record.fullName),
    relationship: stringValue(record.relationship),
    primaryPhone: stringValue(record.primaryPhone),
    secondaryPhone: stringValue(record.secondaryPhone),
    email: stringValue(record.email),
    canPickUp: booleanValue(record.canPickUp),
  };
}

function mergePickupContact(value: unknown): PickupContactFormValues {
  const record = isRecord(value) ? value : {};
  return {
    fullName: stringValue(record.fullName),
    relationship: stringValue(record.relationship),
    phone: stringValue(record.phone),
    idPasswordNote: stringValue(record.idPasswordNote),
  };
}

function mergeConsents(value: unknown): RegistrationStudentFormValues['consents'] {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(
    REGISTRATION_CONSENT_TYPES.map((type) => {
      const consent = isRecord(record[type]) ? record[type] : {};
      return [
        type,
        {
          granted: booleanValue(consent.granted),
          initials: stringValue(consent.initials),
        },
      ];
    }),
  ) as Record<RegistrationConsentType, { granted: boolean; initials: string }>;
}

function mergeStudent(value: unknown): RegistrationStudentFormValues {
  const record = isRecord(value) ? value : {};
  return {
    fullName: stringValue(record.fullName),
    preferredName: stringValue(record.preferredName),
    dob: stringValue(record.dob),
    gender: stringValue(record.gender),
    yearGroup: stringValue(record.yearGroup),
    startDate: stringValue(record.startDate),
    homeLanguage: stringValue(record.homeLanguage),
    studentNotes: stringValue(record.studentNotes),
    allergies: stringValue(record.allergies),
    medicalConditions: stringValue(record.medicalConditions),
    medicationAtCentre: stringValue(record.medicationAtCentre),
    dietaryRestrictions: stringValue(record.dietaryRestrictions),
    learningSupport: stringValue(record.learningSupport),
    interestsStrengths: stringValue(record.interestsStrengths),
    settlingComfortNotes: stringValue(record.settlingComfortNotes),
    additionalInfo: stringValue(record.additionalInfo),
    consents: mergeConsents(record.consents),
  };
}

export function normalizeRegistrationDraftValues(value: unknown): RegistrationFormValues {
  const record = isRecord(value) ? value : {};
  const blankValues = blankRegistrationValues();
  const guardianContacts = arrayValue(record.guardianContacts)
    .slice(0, 2)
    .map(mergeGuardianContact);
  const emergencyContacts = arrayValue(record.emergencyContacts)
    .slice(0, 2)
    .map(mergeEmergencyContact);
  const students = arrayValue(record.students).slice(0, 6).map(mergeStudent);

  return {
    homeAddress: stringValue(record.homeAddress),
    guardianContacts: guardianContacts.length > 0 ? guardianContacts : blankValues.guardianContacts,
    emergencyContacts:
      emergencyContacts.length > 0 ? emergencyContacts : blankValues.emergencyContacts,
    pickupContacts: arrayValue(record.pickupContacts).slice(0, 10).map(mergePickupContact),
    students: students.length > 0 ? students : blankValues.students,
    agreement: {
      guardianName: isRecord(record.agreement) ? stringValue(record.agreement.guardianName) : '',
      agreementDate: isRecord(record.agreement)
        ? stringValue(record.agreement.agreementDate)
        : blankValues.agreement.agreementDate,
    },
  };
}

export function loadRegistrationDraftValues(): RegistrationFormValues {
  if (typeof window === 'undefined') return blankRegistrationValues();

  try {
    const savedDraft = window.localStorage.getItem(REGISTRATION_DRAFT_STORAGE_KEY);
    if (!savedDraft) return blankRegistrationValues();

    const parsed = JSON.parse(savedDraft) as unknown;
    if (
      isRecord(parsed) &&
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt > REGISTRATION_DRAFT_TTL_MS
    ) {
      clearRegistrationDraftValues();
      return blankRegistrationValues();
    }

    return normalizeRegistrationDraftValues(
      isRecord(parsed) && 'values' in parsed ? parsed.values : parsed,
    );
  } catch {
    return blankRegistrationValues();
  }
}

export function saveRegistrationDraftValues(values: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      REGISTRATION_DRAFT_STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        values: normalizeRegistrationDraftValues(values),
      }),
    );
  } catch {
    // Draft saving must never block a parent from completing registration.
  }
}

export function clearRegistrationDraftValues(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore blocked storage cleanup; successful submission has already persisted server-side.
  }
}
