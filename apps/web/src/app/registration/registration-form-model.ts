import { REGISTRATION_CONSENT_TYPES, type RegistrationConsentType } from '@oasis/domain';

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
