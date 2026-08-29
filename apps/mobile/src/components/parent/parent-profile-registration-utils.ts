import { type RouterInputs, type RouterOutputs } from '../../lib/trpc';
import { REGISTRATION_LEVEL_OPTIONS, type RegistrationLevel } from '@oasis/domain';

type ParentProfile = RouterOutputs['profile']['me'];
type Registration = NonNullable<RouterOutputs['registration']['mine']>;
type RegistrationUpdateInput = RouterInputs['registration']['updateMine'];
type RegistrationStudentInput = RegistrationUpdateInput['students'][number];
type SiblingInput = RouterInputs['registration']['addSiblings']['students'][number];
type SiblingConsentType = keyof SiblingInput['consents'];

const REGISTRATION_CONSENT_TYPES: readonly SiblingConsentType[] = [
  'Contact',
  'EmergencyMedical',
  'LocalActivities',
  'PhotoVideo',
  'Accuracy',
];
const registrationLevelSet = new Set<string>(REGISTRATION_LEVEL_OPTIONS);

export interface ProfileForm {
  address: string;
  email: string;
  fullName: string;
  phone: string;
}

export interface RegistrationForm {
  agreementDate: string;
  guardianName: string;
  homeAddress: string;
}

export interface SiblingForm {
  dob: string;
  fullName: string;
  preferredName: string;
  registrationLevel: RegistrationLevel | '';
  startDate: string;
}

export function profileForm(profile: ParentProfile | undefined): ProfileForm {
  return {
    address: profile?.address ?? '',
    email: profile?.email ?? '',
    fullName: profile?.fullName ?? '',
    phone: profile?.phone ?? '',
  };
}

function dateInput(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export function registrationForm(registration: Registration | null | undefined): RegistrationForm {
  return {
    agreementDate: dateInput(registration?.agreement.agreementDate),
    guardianName: registration?.agreement.guardianName ?? '',
    homeAddress: registration?.homeAddress ?? '',
  };
}

export function blankSibling(): SiblingForm {
  return {
    dob: '',
    fullName: '',
    preferredName: '',
    registrationLevel: '',
    startDate: new Date().toISOString().slice(0, 10),
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function hasValidDate(value: string): boolean {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

export function hasRegistrationLevel(value: string): value is RegistrationLevel {
  return registrationLevelSet.has(value);
}

function parentInitials(fullName: string): string {
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('')
    .slice(0, 3);
  return initials || 'P';
}

export function updateInputFromRegistration(
  registration: Registration,
  form: RegistrationForm,
): RegistrationUpdateInput {
  return {
    agreement: {
      agreementDate: new Date(form.agreementDate),
      guardianName: form.guardianName,
    },
    emergencyContacts: registration.emergencyContacts.map((contact) => ({
      canPickUp: contact.canPickUp,
      email: contact.email ?? undefined,
      fullName: contact.fullName,
      primaryPhone: contact.primaryPhone,
      relationship: contact.relationship,
      secondaryPhone: contact.secondaryPhone ?? undefined,
    })),
    guardianContacts: registration.guardianContacts.map((contact) => ({
      address: contact.address ?? undefined,
      email: contact.email ?? undefined,
      fullName: contact.fullName,
      primaryPhone: contact.primaryPhone,
      relationship: contact.relationship,
      secondaryPhone: contact.secondaryPhone ?? undefined,
      workPhone: contact.workPhone ?? undefined,
    })),
    homeAddress: form.homeAddress,
    pickupContacts: registration.pickupContacts.map((contact) => ({
      fullName: contact.fullName,
      idPasswordNote: contact.idPasswordNote ?? undefined,
      phone: contact.phone,
      relationship: contact.relationship,
    })),
    students: registration.students.map(
      (student): RegistrationStudentInput => ({
        additionalInfo: student.additionalInfo ?? undefined,
        allergies: student.allergies ?? undefined,
        consents: student.consents,
        dietaryRestrictions: student.dietaryRestrictions ?? undefined,
        dob: new Date(student.dob),
        fullName: student.fullName,
        gender: student.gender ?? undefined,
        homeLanguage: student.homeLanguage ?? undefined,
        interestsStrengths: student.interestsStrengths ?? undefined,
        learningSupport: student.learningSupport ?? undefined,
        medicalConditions: student.medicalConditions ?? undefined,
        medicationAtCentre: student.medicationAtCentre ?? undefined,
        preferredName: student.preferredName ?? undefined,
        registrationLevel: student.registrationLevel,
        settlingComfortNotes: student.settlingComfortNotes ?? undefined,
        startDate: new Date(student.startDate),
        studentId: student.studentId,
        studentNotes: student.studentNotes ?? undefined,
      }),
    ),
  };
}

export function siblingInputFromForm(
  form: SiblingForm,
  profile: ParentProfile | undefined,
): SiblingInput {
  if (!hasRegistrationLevel(form.registrationLevel)) {
    throw new Error('Choose ABC, Primary, or Secondary.');
  }
  const initials = parentInitials(profile?.fullName ?? '');
  return {
    additionalInfo: undefined,
    allergies: undefined,
    consents: Object.fromEntries(
      REGISTRATION_CONSENT_TYPES.map((type) => [type, { granted: false, initials }]),
    ) as SiblingInput['consents'],
    dietaryRestrictions: undefined,
    dob: new Date(form.dob),
    fullName: form.fullName,
    gender: undefined,
    homeLanguage: undefined,
    interestsStrengths: undefined,
    learningSupport: undefined,
    medicalConditions: undefined,
    medicationAtCentre: undefined,
    preferredName: optional(form.preferredName),
    registrationLevel: form.registrationLevel,
    settlingComfortNotes: undefined,
    startDate: new Date(form.startDate),
    studentNotes: undefined,
  };
}
