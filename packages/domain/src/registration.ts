import { z } from 'zod';
import { standardSchoolYearSchema } from './schoolYears.js';

export const REGISTRATION_CONSENT_TYPES = [
  'Contact',
  'EmergencyMedical',
  'LocalActivities',
  'PhotoVideo',
  'Accuracy',
] as const;
export type RegistrationConsentType = (typeof REGISTRATION_CONSENT_TYPES)[number];

export const REGISTRATION_GENDER_OPTIONS = ['Male', 'Female'] as const;
export type RegistrationGender = (typeof REGISTRATION_GENDER_OPTIONS)[number];

export const REGISTRATION_CONSENT_COPY = {
  Contact: 'Centre contact by phone, SMS, or email',
  EmergencyMedical: 'Emergency medical treatment if guardian cannot be reached',
  LocalActivities: 'Supervised walks, visits, or local learning activities',
  PhotoVideo: 'Photographs or videos for internal displays or communication',
  Accuracy: 'Information is accurate and complete',
} as const satisfies Record<RegistrationConsentType, string>;

const requiredText = (max = 500) => z.string().trim().min(1).max(max);
const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const dateInput = z.coerce.date();
const notFutureDateInput = dateInput.refine((date) => date.getTime() <= Date.now(), {
  message: 'date cannot be in the future',
});

export const registrationGuardianContactInput = z
  .object({
    fullName: requiredText(120),
    relationship: requiredText(80),
    primaryPhone: requiredText(50),
    secondaryPhone: optionalText(50),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    workPhone: optionalText(50),
    address: optionalText(500),
  })
  .strict();
export type RegistrationGuardianContactInput = z.infer<typeof registrationGuardianContactInput>;

export const registrationEmergencyContactInput = z
  .object({
    fullName: requiredText(120),
    relationship: requiredText(80),
    primaryPhone: requiredText(50),
    secondaryPhone: optionalText(50),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    canPickUp: z.boolean(),
  })
  .strict();
export type RegistrationEmergencyContactInput = z.infer<typeof registrationEmergencyContactInput>;

export const registrationPickupContactInput = z
  .object({
    fullName: requiredText(120),
    relationship: requiredText(80),
    phone: requiredText(50),
    idPasswordNote: optionalText(500),
  })
  .strict();
export type RegistrationPickupContactInput = z.infer<typeof registrationPickupContactInput>;

const consentInput = z
  .object({
    granted: z.boolean(),
    initials: requiredText(12),
  })
  .strict();

export const registrationConsentsInput = z
  .object({
    Contact: consentInput,
    EmergencyMedical: consentInput,
    LocalActivities: consentInput,
    PhotoVideo: consentInput,
    Accuracy: consentInput,
  })
  .strict();
export type RegistrationConsentsInput = z.infer<typeof registrationConsentsInput>;

export const registrationStudentInput = z
  .object({
    fullName: requiredText(120),
    preferredName: optionalText(120),
    dob: notFutureDateInput,
    gender: z.enum(REGISTRATION_GENDER_OPTIONS),
    yearGroup: standardSchoolYearSchema,
    startDate: dateInput,
    homeLanguage: optionalText(120),
    studentNotes: optionalText(1000),
    allergies: optionalText(2000),
    medicalConditions: optionalText(2000),
    medicationAtCentre: optionalText(2000),
    dietaryRestrictions: optionalText(2000),
    learningSupport: optionalText(2000),
    interestsStrengths: optionalText(2000),
    settlingComfortNotes: optionalText(2000),
    additionalInfo: optionalText(2000),
    consents: registrationConsentsInput,
  })
  .strict();
export type RegistrationStudentInput = z.infer<typeof registrationStudentInput>;

export const parentInitialRegistrationInput = z
  .object({
    homeAddress: requiredText(500),
    guardianContacts: z.array(registrationGuardianContactInput).min(1).max(2),
    emergencyContacts: z.array(registrationEmergencyContactInput).min(1).max(2),
    pickupContacts: z.array(registrationPickupContactInput).max(10).default([]),
    students: z.array(registrationStudentInput).min(1).max(6),
    agreement: z
      .object({
        guardianName: requiredText(120),
        agreementDate: notFutureDateInput,
      })
      .strict(),
  })
  .strict();
export type ParentInitialRegistrationInput = z.infer<typeof parentInitialRegistrationInput>;
