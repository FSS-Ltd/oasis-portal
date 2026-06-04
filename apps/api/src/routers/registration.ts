import { randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  REGISTRATION_CONSENT_TYPES,
  approveStudentSelfRegistrationInput,
  canAnswerChildRegistrationPrompt,
  canSubmitInitialRegistration,
  createStudentRegistrationCodeInput,
  declineStudentSelfRegistrationInput,
  parentInitialRegistrationInput,
  parentRegistrationSiblingInput,
  parentRegistrationSiblingsInput,
  parentRegistrationUpdateInput,
  studentSelfRegistrationIdInput,
  submitStudentSelfRegistrationInput,
  type ChildRegistrationPromptStatus,
  type ParentInitialRegistrationInput,
  type ParentRegistrationSiblingInput,
  type ParentRegistrationUpdateInput,
  type PermissionTag,
  type RegistrationConsentType,
  type Role,
} from '@oasis/domain';
import {
  createDefaultClerkInvitationClient,
  type ClerkInvitationClient,
  type ClerkInvitationResult,
} from '../lib/clerk.js';
import { buildUserInviteEmail, createResendEmailClient, type EmailClient } from '../lib/email.js';
import { adminOperationsProcedure, authedProcedure, publicProcedure, router } from '../trpc.js';

const answerChildRegistrationPromptInput = z.object({
  hasChildren: z.boolean(),
});
const POST_SIGN_IN_PATH = '/post-sign-in';
const STUDENT_INVITATION_TAGS: PermissionTag[] = [];

const registrationAccessUserSelect = Prisma.validator<Prisma.UserSelect>()({
  childRegistrationPromptStatus: true,
});

type RegistrationAccessUser = Prisma.UserGetPayload<{
  select: typeof registrationAccessUserSelect;
}>;

function childRegistrationPromptStatusForAnswer(
  hasChildren: boolean,
): Exclude<ChildRegistrationPromptStatus, 'Unanswered'> {
  return hasChildren ? 'HasChildren' : 'NoChildren';
}

function denyRegistrationAccess(): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'child registration requires a parent account or confirmed children at Oasis',
  });
}

async function loadRegistrationAccessUser(ctx: {
  db: {
    user: {
      findUnique: (args: Prisma.UserFindUniqueArgs) => Promise<RegistrationAccessUser | null>;
    };
  };
  user: { id: string };
}): Promise<RegistrationAccessUser> {
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.user.id },
    select: registrationAccessUserSelect,
  });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
  }
  return user;
}

async function requireCanUseInitialRegistration(ctx: {
  db: {
    user: {
      findUnique: (args: Prisma.UserFindUniqueArgs) => Promise<RegistrationAccessUser | null>;
    };
  };
  user: { id: string; role: Role };
}): Promise<RegistrationAccessUser> {
  const user = await loadRegistrationAccessUser(ctx);
  if (!canSubmitInitialRegistration(ctx.user, user.childRegistrationPromptStatus)) {
    denyRegistrationAccess();
  }
  return user;
}

const registrationStudentInclude = Prisma.validator<Prisma.StudentRegistrationProfileInclude>()({
  consents: true,
  student: {
    select: {
      id: true,
      fullNameEnc: true,
      dobEnc: true,
      addressEnc: true,
      yearGroup: true,
      enrolmentDate: true,
      active: true,
    },
  },
  registration: {
    select: {
      id: true,
      parentUserId: true,
      homeAddressEnc: true,
      agreementNameEnc: true,
      agreementDate: true,
      submittedAt: true,
      guardianContacts: { orderBy: { position: 'asc' } },
      emergencyContacts: { orderBy: { position: 'asc' } },
      pickupContacts: { orderBy: { position: 'asc' } },
      studentProfiles: {
        orderBy: { createdAt: 'asc' },
        select: {
          student: {
            select: {
              id: true,
              fullNameEnc: true,
              yearGroup: true,
              active: true,
            },
          },
        },
      },
    },
  },
});

type RegistrationStudentRow = Prisma.StudentRegistrationProfileGetPayload<{
  include: typeof registrationStudentInclude;
}>;

const parentRegistrationInclude = Prisma.validator<Prisma.ParentRegistrationInclude>()({
  guardianContacts: { orderBy: { position: 'asc' } },
  emergencyContacts: { orderBy: { position: 'asc' } },
  pickupContacts: { orderBy: { position: 'asc' } },
  studentProfiles: {
    orderBy: { createdAt: 'asc' },
    include: {
      consents: true,
      student: {
        select: {
          id: true,
          fullNameEnc: true,
          dobEnc: true,
          yearGroup: true,
          enrolmentDate: true,
          active: true,
        },
      },
    },
  },
});

type ParentRegistrationRow = Prisma.ParentRegistrationGetPayload<{
  include: typeof parentRegistrationInclude;
}>;

const studentRegistrationCodeSelect = Prisma.validator<Prisma.StudentRegistrationCodeSelect>()({
  id: true,
  label: true,
  active: true,
  maxUses: true,
  usedCount: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
});

type StudentRegistrationCodeRow = Prisma.StudentRegistrationCodeGetPayload<{
  select: typeof studentRegistrationCodeSelect;
}>;

const studentSelfRegistrationSelect = Prisma.validator<Prisma.StudentSelfRegistrationSelect>()({
  id: true,
  firstNameEnc: true,
  lastNameEnc: true,
  fullNameEnc: true,
  emailEnc: true,
  emailBidx: true,
  dobEnc: true,
  yearGroup: true,
  status: true,
  parentConsentConfirmedAt: true,
  approvedAt: true,
  declinedAt: true,
  declineReasonEnc: true,
  activationEmailSentAt: true,
  activationEmailMessageId: true,
  studentId: true,
  createdAt: true,
  updatedAt: true,
  registrationCode: {
    select: {
      id: true,
      label: true,
    },
  },
  invitation: {
    select: {
      id: true,
      emailStatus: true,
      status: true,
    },
  },
});

type StudentSelfRegistrationRow = Prisma.StudentSelfRegistrationGetPayload<{
  select: typeof studentSelfRegistrationSelect;
}>;

export interface RegistrationRouterDeps {
  appUrl?: string | undefined;
  clerk?: ClerkInvitationClient | undefined;
  emailClient?: EmailClient | undefined;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildPostSignInRedirectUrl(appUrl: string | undefined): string {
  const trimmed = appUrl?.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'APP_URL is required to create invitation redirect URL',
    });
  }

  try {
    return new URL(POST_SIGN_IN_PATH, trimmed).toString();
  } catch {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'APP_URL must be a valid absolute URL to create invitation redirect URL',
    });
  }
}

function generateStudentRegistrationCode(): string {
  return `OASIS-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function normaliseRegistrationCode(code: string): string {
  return code.trim().toUpperCase();
}

function fullNameFromParts(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/gu, ' ').trim();
}

function assertCodeCanBeUsed(code: {
  active: boolean;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
}): void {
  if (!code.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'registration code is inactive' });
  }
  if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'registration code has expired' });
  }
  if (code.maxUses !== null && code.usedCount >= code.maxUses) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'registration code has no uses left' });
  }
}

function mapStudentRegistrationCode(code: StudentRegistrationCodeRow) {
  return {
    id: code.id,
    label: code.label,
    active: code.active,
    maxUses: code.maxUses,
    usedCount: code.usedCount,
    expiresAt: code.expiresAt,
    createdAt: code.createdAt,
    updatedAt: code.updatedAt,
  };
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}

function decryptOptional(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
): string | null {
  return decrypt(value);
}

function encryptOptional(
  encrypt: (value: string | null | undefined) => string | null,
  value: string | null | undefined,
): string | null {
  return encrypt(value);
}

function encryptRequired(
  encrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const encrypted = encrypt(value);
  if (!encrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} encrypt failed` });
  }
  return encrypted;
}

function mapStudentSelfRegistration(
  ctx: {
    db: { $enc: { decrypt: (value: string | null | undefined) => string | null } };
  },
  row: StudentSelfRegistrationRow,
) {
  const decrypt = ctx.db.$enc.decrypt;
  return {
    id: row.id,
    firstName: decryptRequired(decrypt, row.firstNameEnc, 'student self-registration PII'),
    lastName: decryptRequired(decrypt, row.lastNameEnc, 'student self-registration PII'),
    fullName: decryptRequired(decrypt, row.fullNameEnc, 'student self-registration PII'),
    email: decryptRequired(decrypt, row.emailEnc, 'student self-registration PII'),
    dob: decryptRequired(decrypt, row.dobEnc, 'student self-registration PII'),
    yearGroup: row.yearGroup,
    status: row.status,
    parentConsentConfirmedAt: row.parentConsentConfirmedAt,
    approvedAt: row.approvedAt,
    declinedAt: row.declinedAt,
    declineReason: decryptOptional(decrypt, row.declineReasonEnc),
    activationEmailSentAt: row.activationEmailSentAt,
    activationEmailMessageId: row.activationEmailMessageId,
    studentId: row.studentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    registrationCode: row.registrationCode,
    invitation: row.invitation,
  };
}

function consentEntries(consents: ParentInitialRegistrationInput['students'][number]['consents']) {
  return REGISTRATION_CONSENT_TYPES.map((consentType) => ({
    consentType,
    granted: consents[consentType].granted,
    initials: consents[consentType].initials,
  }));
}

type EncryptionContext = {
  db: {
    $enc: {
      blindIndex: (value: string) => string;
      encrypt: (value: string | null | undefined) => string | null;
    };
  };
};

type RegistrationDecrypt = (value: string | null | undefined) => string | null;

type GuardianContactRow = {
  fullNameEnc: string;
  relationshipEnc: string;
  primaryPhoneEnc: string;
  secondaryPhoneEnc: string | null;
  emailEnc: string | null;
  workPhoneEnc: string | null;
  addressEnc: string | null;
};

type EmergencyContactRow = {
  fullNameEnc: string;
  relationshipEnc: string;
  primaryPhoneEnc: string;
  secondaryPhoneEnc: string | null;
  emailEnc: string | null;
  canPickUp: boolean;
};

type PickupContactRow = {
  fullNameEnc: string;
  relationshipEnc: string;
  phoneEnc: string;
  idPasswordNoteEnc: string | null;
};

function guardianContactData(
  ctx: EncryptionContext,
  contact: ParentInitialRegistrationInput['guardianContacts'][number],
  index: number,
) {
  return {
    position: index + 1,
    fullNameEnc: encryptRequired(
      ctx.db.$enc.encrypt,
      contact.fullName,
      'registration guardian PII',
    ),
    relationshipEnc: encryptRequired(
      ctx.db.$enc.encrypt,
      contact.relationship,
      'registration guardian PII',
    ),
    primaryPhoneEnc: encryptRequired(
      ctx.db.$enc.encrypt,
      contact.primaryPhone,
      'registration guardian PII',
    ),
    secondaryPhoneEnc: encryptOptional(ctx.db.$enc.encrypt, contact.secondaryPhone),
    emailEnc: encryptOptional(ctx.db.$enc.encrypt, contact.email),
    workPhoneEnc: encryptOptional(ctx.db.$enc.encrypt, contact.workPhone),
    addressEnc: encryptOptional(ctx.db.$enc.encrypt, contact.address),
  };
}

function emergencyContactData(
  ctx: EncryptionContext,
  contact: ParentInitialRegistrationInput['emergencyContacts'][number],
  index: number,
) {
  return {
    position: index + 1,
    fullNameEnc: encryptRequired(
      ctx.db.$enc.encrypt,
      contact.fullName,
      'registration emergency PII',
    ),
    relationshipEnc: encryptRequired(
      ctx.db.$enc.encrypt,
      contact.relationship,
      'registration emergency PII',
    ),
    primaryPhoneEnc: encryptRequired(
      ctx.db.$enc.encrypt,
      contact.primaryPhone,
      'registration emergency PII',
    ),
    secondaryPhoneEnc: encryptOptional(ctx.db.$enc.encrypt, contact.secondaryPhone),
    emailEnc: encryptOptional(ctx.db.$enc.encrypt, contact.email),
    canPickUp: contact.canPickUp,
  };
}

function pickupContactData(
  ctx: EncryptionContext,
  contact: ParentInitialRegistrationInput['pickupContacts'][number],
  index: number,
) {
  return {
    position: index + 1,
    fullNameEnc: encryptRequired(ctx.db.$enc.encrypt, contact.fullName, 'registration pickup PII'),
    relationshipEnc: encryptRequired(
      ctx.db.$enc.encrypt,
      contact.relationship,
      'registration pickup PII',
    ),
    phoneEnc: encryptRequired(ctx.db.$enc.encrypt, contact.phone, 'registration pickup PII'),
    idPasswordNoteEnc: encryptOptional(ctx.db.$enc.encrypt, contact.idPasswordNote),
  };
}

function studentData(
  ctx: EncryptionContext,
  studentInput: ParentRegistrationSiblingInput['student'],
) {
  return {
    fullNameEnc: encryptRequired(ctx.db.$enc.encrypt, studentInput.fullName, 'student PII'),
    nameBidx: ctx.db.$enc.blindIndex(studentInput.fullName),
    dobEnc: encryptRequired(ctx.db.$enc.encrypt, dateOnly(studentInput.dob), 'student PII'),
    yearGroup: studentInput.yearGroup,
    enrolmentDate: studentInput.startDate,
  };
}

function studentProfileData(
  ctx: EncryptionContext,
  studentInput: ParentRegistrationSiblingInput['student'],
) {
  return {
    preferredNameEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.preferredName),
    genderEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.gender),
    homeLanguageEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.homeLanguage),
    studentNotesEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.studentNotes),
    allergiesEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.allergies),
    medicalConditionsEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.medicalConditions),
    medicationAtCentreEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.medicationAtCentre),
    dietaryRestrictionsEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.dietaryRestrictions),
    learningSupportEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.learningSupport),
    interestsStrengthsEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.interestsStrengths),
    settlingComfortNotesEnc: encryptOptional(
      ctx.db.$enc.encrypt,
      studentInput.settlingComfortNotes,
    ),
    additionalInfoEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.additionalInfo),
  };
}

function mapGuardianContacts(
  decrypt: RegistrationDecrypt,
  contacts: readonly GuardianContactRow[],
) {
  return contacts.map((contact) => ({
    fullName: decryptRequired(decrypt, contact.fullNameEnc, 'registration guardian PII'),
    relationship: decryptRequired(decrypt, contact.relationshipEnc, 'registration guardian PII'),
    primaryPhone: decryptRequired(decrypt, contact.primaryPhoneEnc, 'registration guardian PII'),
    secondaryPhone: decryptOptional(decrypt, contact.secondaryPhoneEnc),
    email: decryptOptional(decrypt, contact.emailEnc),
    workPhone: decryptOptional(decrypt, contact.workPhoneEnc),
    address: decryptOptional(decrypt, contact.addressEnc),
  }));
}

function mapEmergencyContacts(
  decrypt: RegistrationDecrypt,
  contacts: readonly EmergencyContactRow[],
) {
  return contacts.map((contact) => ({
    fullName: decryptRequired(decrypt, contact.fullNameEnc, 'registration emergency PII'),
    relationship: decryptRequired(decrypt, contact.relationshipEnc, 'registration emergency PII'),
    primaryPhone: decryptRequired(decrypt, contact.primaryPhoneEnc, 'registration emergency PII'),
    secondaryPhone: decryptOptional(decrypt, contact.secondaryPhoneEnc),
    email: decryptOptional(decrypt, contact.emailEnc),
    canPickUp: contact.canPickUp,
  }));
}

function mapPickupContacts(decrypt: RegistrationDecrypt, contacts: readonly PickupContactRow[]) {
  return contacts.map((contact) => ({
    fullName: decryptRequired(decrypt, contact.fullNameEnc, 'registration pickup PII'),
    relationship: decryptRequired(decrypt, contact.relationshipEnc, 'registration pickup PII'),
    phone: decryptRequired(decrypt, contact.phoneEnc, 'registration pickup PII'),
    idPasswordNote: decryptOptional(decrypt, contact.idPasswordNoteEnc),
  }));
}

function mapConsents(decrypt: RegistrationDecrypt, consents: RegistrationStudentRow['consents']) {
  return Object.fromEntries(
    REGISTRATION_CONSENT_TYPES.map((type) => {
      const consent = consents.find((row) => row.consentType === type);
      if (!consent) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `registration consent ${type} missing`,
        });
      }
      return [
        type,
        {
          granted: consent.granted,
          initials: decryptRequired(decrypt, consent.initialsEnc, 'registration consent PII'),
        },
      ];
    }),
  ) as Record<RegistrationConsentType, { granted: boolean; initials: string }>;
}

function mapParentRegistration(
  ctx: {
    db: { $enc: { decrypt: (value: string | null | undefined) => string | null } };
  },
  registration: ParentRegistrationRow,
) {
  const decrypt = ctx.db.$enc.decrypt;

  return {
    registrationId: registration.id,
    parentUserId: registration.parentUserId,
    submittedAt: registration.submittedAt,
    homeAddress: decryptRequired(decrypt, registration.homeAddressEnc, 'registration PII'),
    agreement: {
      guardianName: decryptRequired(decrypt, registration.agreementNameEnc, 'registration PII'),
      agreementDate: dateOnly(registration.agreementDate),
    },
    guardianContacts: mapGuardianContacts(decrypt, registration.guardianContacts),
    emergencyContacts: mapEmergencyContacts(decrypt, registration.emergencyContacts),
    pickupContacts: mapPickupContacts(decrypt, registration.pickupContacts),
    students: registration.studentProfiles.map((profile) => ({
      studentId: profile.student.id,
      fullName: decryptRequired(decrypt, profile.student.fullNameEnc, 'student PII'),
      preferredName: decryptOptional(decrypt, profile.preferredNameEnc),
      dob: decryptRequired(decrypt, profile.student.dobEnc, 'student PII'),
      gender: decryptOptional(decrypt, profile.genderEnc),
      yearGroup: profile.student.yearGroup,
      startDate: dateOnly(profile.student.enrolmentDate),
      active: profile.student.active,
      homeLanguage: decryptOptional(decrypt, profile.homeLanguageEnc),
      studentNotes: decryptOptional(decrypt, profile.studentNotesEnc),
      allergies: decryptOptional(decrypt, profile.allergiesEnc),
      medicalConditions: decryptOptional(decrypt, profile.medicalConditionsEnc),
      medicationAtCentre: decryptOptional(decrypt, profile.medicationAtCentreEnc),
      dietaryRestrictions: decryptOptional(decrypt, profile.dietaryRestrictionsEnc),
      learningSupport: decryptOptional(decrypt, profile.learningSupportEnc),
      interestsStrengths: decryptOptional(decrypt, profile.interestsStrengthsEnc),
      settlingComfortNotes: decryptOptional(decrypt, profile.settlingComfortNotesEnc),
      additionalInfo: decryptOptional(decrypt, profile.additionalInfoEnc),
      consents: mapConsents(decrypt, profile.consents),
    })),
  };
}

function mapRegistrationByStudent(
  ctx: {
    db: { $enc: { decrypt: (value: string | null | undefined) => string | null } };
  },
  row: RegistrationStudentRow,
) {
  const decrypt = ctx.db.$enc.decrypt;
  const registration = row.registration;
  const homeAddress = decryptRequired(decrypt, registration.homeAddressEnc, 'registration PII');

  return {
    registrationId: registration.id,
    parentUserId: registration.parentUserId,
    submittedAt: registration.submittedAt,
    agreement: {
      guardianName: decryptRequired(decrypt, registration.agreementNameEnc, 'registration PII'),
      agreementDate: dateOnly(registration.agreementDate),
    },
    homeAddress,
    guardianContacts: mapGuardianContacts(decrypt, registration.guardianContacts),
    emergencyContacts: mapEmergencyContacts(decrypt, registration.emergencyContacts),
    pickupContacts: mapPickupContacts(decrypt, registration.pickupContacts),
    student: {
      id: row.student.id,
      fullName: decryptRequired(decrypt, row.student.fullNameEnc, 'student PII'),
      dob: decryptRequired(decrypt, row.student.dobEnc, 'student PII'),
      address: decryptOptional(decrypt, row.student.addressEnc) ?? homeAddress,
      yearGroup: row.student.yearGroup,
      enrolmentDate: row.student.enrolmentDate,
      active: row.student.active,
      preferredName: decryptOptional(decrypt, row.preferredNameEnc),
      gender: decryptOptional(decrypt, row.genderEnc),
      homeLanguage: decryptOptional(decrypt, row.homeLanguageEnc),
      studentNotes: decryptOptional(decrypt, row.studentNotesEnc),
      allergies: decryptOptional(decrypt, row.allergiesEnc),
      medicalConditions: decryptOptional(decrypt, row.medicalConditionsEnc),
      medicationAtCentre: decryptOptional(decrypt, row.medicationAtCentreEnc),
      dietaryRestrictions: decryptOptional(decrypt, row.dietaryRestrictionsEnc),
      learningSupport: decryptOptional(decrypt, row.learningSupportEnc),
      interestsStrengths: decryptOptional(decrypt, row.interestsStrengthsEnc),
      settlingComfortNotes: decryptOptional(decrypt, row.settlingComfortNotesEnc),
      additionalInfo: decryptOptional(decrypt, row.additionalInfoEnc),
      consents: mapConsents(decrypt, row.consents),
    },
    siblings: registration.studentProfiles.map((profile) => ({
      id: profile.student.id,
      fullName: decryptRequired(decrypt, profile.student.fullNameEnc, 'student PII'),
      yearGroup: profile.student.yearGroup,
      active: profile.student.active,
    })),
  };
}

function assertUpdateStudentSet(
  registration: Pick<ParentRegistrationRow, 'studentProfiles'>,
  students: ParentRegistrationUpdateInput['students'],
): void {
  const existingIds = new Set(registration.studentProfiles.map((profile) => profile.studentId));
  const inputIds = new Set(students.map((student) => student.studentId));
  if (existingIds.size !== inputIds.size || students.length !== inputIds.size) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'registration students do not match existing records',
    });
  }
  for (const studentId of inputIds) {
    if (!existingIds.has(studentId)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'student is not attached to this registration',
      });
    }
  }
}

function assertSiblingCapacity(
  registration: Pick<ParentRegistrationRow, 'studentProfiles'>,
  newSiblingCount: number,
): void {
  if (registration.studentProfiles.length + newSiblingCount > 6) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'registration already has the maximum number of children',
    });
  }
}

export function createRegistrationRouter(deps: RegistrationRouterDeps = {}) {
  let cachedClerk: ClerkInvitationClient | null = deps.clerk ?? null;
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;

  const getClerk = (): ClerkInvitationClient => {
    if (cachedClerk) return cachedClerk;
    cachedClerk = createDefaultClerkInvitationClient();
    return cachedClerk;
  };

  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  const getInvitationRedirectUrl = (): string =>
    buildPostSignInRedirectUrl(deps.appUrl ?? process.env.APP_URL);

  const createStudentInvitation = async (email: string): Promise<ClerkInvitationResult> => {
    const invitation = await getClerk().createInvitation({
      emailAddress: email,
      publicMetadata: { role: 'Student', tags: STUDENT_INVITATION_TAGS },
      redirectUrl: getInvitationRedirectUrl(),
      ignoreExisting: true,
      notify: false,
    });
    if (!invitation.url) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'clerk invitation link missing',
      });
    }
    return invitation;
  };

  return router({
    createStudentRegistrationCode: adminOperationsProcedure
      .input(createStudentRegistrationCodeInput)
      .mutation(async ({ ctx, input }) => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const code = generateStudentRegistrationCode();
          try {
            const created = await ctx.db.studentRegistrationCode.create({
              data: {
                codeBidx: ctx.db.$enc.blindIndex(normaliseRegistrationCode(code)),
                label: input.label,
                maxUses: input.maxUses ?? null,
                expiresAt: input.expiresAt ?? null,
                createdById: ctx.user.id,
              },
              select: studentRegistrationCodeSelect,
            });

            await ctx.db.auditLog.create({
              data: {
                userId: ctx.user.id,
                action: 'Create',
                entity: 'StudentRegistrationCode',
                entityId: created.id,
                meta: {
                  label: created.label,
                  maxUses: created.maxUses,
                  expiresAt: created.expiresAt,
                  source: 'registration.createStudentRegistrationCode',
                },
              },
            });

            return { ...mapStudentRegistrationCode(created), code };
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
              continue;
            }
            throw err;
          }
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'could not generate a unique registration code',
        });
      }),

    listStudentRegistrationCodes: adminOperationsProcedure.query(async ({ ctx }) => {
      const codes = await ctx.db.studentRegistrationCode.findMany({
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
        select: studentRegistrationCodeSelect,
      });

      return codes.map(mapStudentRegistrationCode);
    }),

    submitStudentSelfRegistration: publicProcedure
      .input(submitStudentSelfRegistrationInput)
      .mutation(async ({ ctx, input }) => {
        const codeBidx = ctx.db.$enc.blindIndex(normaliseRegistrationCode(input.registrationCode));
        const code = await ctx.db.studentRegistrationCode.findUnique({
          where: { codeBidx },
          select: {
            id: true,
            active: true,
            expiresAt: true,
            maxUses: true,
            usedCount: true,
          },
        });
        if (!code) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'registration code is invalid' });
        }
        assertCodeCanBeUsed(code);

        const fullName = fullNameFromParts(input.firstName, input.lastName);
        const emailBidx = ctx.db.$enc.blindIndex(input.email);
        const [existingUser, existingRegistration] = await Promise.all([
          ctx.db.user.findUnique({
            where: { emailBidx },
            select: { id: true },
          }),
          ctx.db.studentSelfRegistration.findFirst({
            where: {
              emailBidx,
              status: { in: ['Pending', 'AwaitingConsent', 'Activated'] },
            },
            select: { id: true, status: true },
          }),
        ]);

        if (existingUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'an account already exists for this email',
          });
        }
        if (existingRegistration) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'a student registration is already pending for this email',
          });
        }

        try {
          return await ctx.db.$transaction(async (tx) => {
            const consumed = await tx.studentRegistrationCode.updateMany({
              where: {
                id: code.id,
                active: true,
                ...(code.expiresAt ? { expiresAt: { gt: new Date() } } : {}),
                ...(code.maxUses !== null ? { usedCount: { lt: code.maxUses } } : {}),
              },
              data: { usedCount: { increment: 1 } },
            });
            if (consumed.count !== 1) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'registration code can no longer be used',
              });
            }

            const registration = await tx.studentSelfRegistration.create({
              data: {
                firstNameEnc: encryptRequired(
                  ctx.db.$enc.encrypt,
                  input.firstName,
                  'student self-registration PII',
                ),
                lastNameEnc: encryptRequired(
                  ctx.db.$enc.encrypt,
                  input.lastName,
                  'student self-registration PII',
                ),
                fullNameEnc: encryptRequired(
                  ctx.db.$enc.encrypt,
                  fullName,
                  'student self-registration PII',
                ),
                emailEnc: encryptRequired(
                  ctx.db.$enc.encrypt,
                  input.email,
                  'student self-registration PII',
                ),
                emailBidx,
                dobEnc: encryptRequired(
                  ctx.db.$enc.encrypt,
                  dateOnly(input.dob),
                  'student self-registration PII',
                ),
                yearGroup: input.yearGroup,
                registrationCodeId: code.id,
              },
              select: { id: true, status: true },
            });

            await tx.auditLog.create({
              data: {
                userId: null,
                action: 'Create',
                entity: 'StudentSelfRegistration',
                entityId: registration.id,
                meta: {
                  registrationCodeId: code.id,
                  source: 'registration.submitStudentSelfRegistration',
                },
              },
            });

            return {
              registrationId: registration.id,
              status: registration.status,
            };
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'a student registration is already pending for this email',
            });
          }
          throw err;
        }
      }),

    listStudentSelfRegistrations: adminOperationsProcedure.query(async ({ ctx }) => {
      const registrations = await ctx.db.studentSelfRegistration.findMany({
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
        select: studentSelfRegistrationSelect,
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'StudentSelfRegistration',
          meta: {
            count: registrations.length,
            source: 'registration.listStudentSelfRegistrations',
          },
        },
      });

      return registrations.map((registration) => mapStudentSelfRegistration(ctx, registration));
    }),

    approveStudentSelfRegistration: adminOperationsProcedure
      .input(approveStudentSelfRegistrationInput)
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.db.studentSelfRegistration.findUnique({
          where: { id: input.id },
          select: studentSelfRegistrationSelect,
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student registration not found' });
        }
        if (existing.status === 'Activated') {
          return mapStudentSelfRegistration(ctx, existing);
        }
        if (existing.status === 'Declined') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'declined student registrations cannot be approved',
          });
        }

        if (!input.parentConsentConfirmed) {
          const updated = await ctx.db.studentSelfRegistration.update({
            where: { id: input.id },
            data: {
              status: 'AwaitingConsent',
              approvedById: ctx.user.id,
              approvedAt: existing.approvedAt ?? new Date(),
            },
            select: studentSelfRegistrationSelect,
          });
          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'StudentSelfRegistration',
              entityId: updated.id,
              meta: {
                status: updated.status,
                source: 'registration.approveStudentSelfRegistration',
              },
            },
          });
          return mapStudentSelfRegistration(ctx, updated);
        }

        const email = decryptRequired(
          ctx.db.$enc.decrypt,
          existing.emailEnc,
          'student self-registration PII',
        );
        const fullName = decryptRequired(
          ctx.db.$enc.decrypt,
          existing.fullNameEnc,
          'student self-registration PII',
        );
        const [existingUser, existingInvite] = await Promise.all([
          ctx.db.user.findUnique({
            where: { emailBidx: existing.emailBidx },
            select: { id: true },
          }),
          ctx.db.userInvitation.findFirst({
            where: { emailBidx: existing.emailBidx, status: 'Pending' },
            select: { id: true },
          }),
        ]);
        if (existingUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'an account already exists for this email',
          });
        }
        if (existingInvite) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'a pending invitation already exists for this email',
          });
        }

        const clerkInvitation = await createStudentInvitation(email);
        const inviteUrl = clerkInvitation.url;
        if (!inviteUrl) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'clerk invitation link missing',
          });
        }
        const activated = await ctx.db.$transaction(async (tx) => {
          const student = await tx.student.create({
            data: {
              fullNameEnc: existing.fullNameEnc,
              nameBidx: ctx.db.$enc.blindIndex(fullName),
              dobEnc: existing.dobEnc,
              yearGroup: existing.yearGroup,
              enrolmentDate: new Date(),
              active: true,
            },
            select: { id: true },
          });

          const invitation = await tx.userInvitation.create({
            data: {
              clerkInvitationId: clerkInvitation.id,
              role: 'Student',
              tags: STUDENT_INVITATION_TAGS,
              emailEnc: existing.emailEnc,
              emailBidx: existing.emailBidx,
              status: 'Pending',
              emailStatus: 'NotSent',
              invitedById: ctx.user.id,
              studentSelfRegistrationId: existing.id,
            },
            select: { id: true },
          });

          const updated = await tx.studentSelfRegistration.update({
            where: { id: existing.id },
            data: {
              status: 'Activated',
              approvedById: ctx.user.id,
              approvedAt: existing.approvedAt ?? new Date(),
              parentConsentConfirmedAt: new Date(),
              studentId: student.id,
            },
            select: studentSelfRegistrationSelect,
          });

          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'Student',
              entityId: student.id,
              meta: {
                studentSelfRegistrationId: existing.id,
                source: 'registration.approveStudentSelfRegistration',
              },
            },
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'UserInvitation',
              entityId: invitation.id,
              meta: {
                role: 'Student',
                studentSelfRegistrationId: existing.id,
                source: 'registration.approveStudentSelfRegistration',
              },
            },
          });

          return updated;
        });

        const emailInput = buildUserInviteEmail({
          inviteUrl,
          role: 'Student',
          to: email,
        });

        try {
          const result = await getEmailClient().send(emailInput);
          const updated = await ctx.db.studentSelfRegistration.update({
            where: { id: activated.id },
            data: {
              activationEmailSentAt: new Date(),
              activationEmailMessageId: result.id,
              invitation: {
                update: {
                  emailStatus: 'Sent',
                  emailMessageId: result.id,
                },
              },
            },
            select: studentSelfRegistrationSelect,
          });
          await ctx.db.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'Email',
              entityId: result.id,
              meta: {
                subject: emailInput.subject,
                studentSelfRegistrationId: activated.id,
                source: 'registration.approveStudentSelfRegistration',
              },
            },
          });
          return mapStudentSelfRegistration(ctx, updated);
        } catch (err) {
          await ctx.db.userInvitation.update({
            where: { studentSelfRegistrationId: activated.id },
            data: { emailStatus: 'Failed', emailMessageId: null },
            select: { id: true },
          });
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'student activation email send failed',
            cause: err instanceof Error ? err : undefined,
          });
        }
      }),

    declineStudentSelfRegistration: adminOperationsProcedure
      .input(declineStudentSelfRegistrationInput)
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.db.studentSelfRegistration.findUnique({
          where: { id: input.id },
          select: { id: true, status: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student registration not found' });
        }
        if (existing.status === 'Activated') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'activated student registrations cannot be declined',
          });
        }

        const updated = await ctx.db.studentSelfRegistration.update({
          where: { id: input.id },
          data: {
            status: 'Declined',
            declinedById: ctx.user.id,
            declinedAt: new Date(),
            declineReasonEnc: encryptOptional(ctx.db.$enc.encrypt, input.reason),
          },
          select: studentSelfRegistrationSelect,
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'StudentSelfRegistration',
            entityId: updated.id,
            meta: {
              status: updated.status,
              source: 'registration.declineStudentSelfRegistration',
            },
          },
        });

        return mapStudentSelfRegistration(ctx, updated);
      }),

    getStudentSelfRegistration: adminOperationsProcedure
      .input(studentSelfRegistrationIdInput)
      .query(async ({ ctx, input }) => {
        const registration = await ctx.db.studentSelfRegistration.findUnique({
          where: { id: input.id },
          select: studentSelfRegistrationSelect,
        });
        if (!registration) return null;
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptPii',
            entity: 'StudentSelfRegistration',
            entityId: registration.id,
            meta: { source: 'registration.getStudentSelfRegistration' },
          },
        });
        return mapStudentSelfRegistration(ctx, registration);
      }),

    status: authedProcedure.query(async ({ ctx }) => {
      const accessUser = await requireCanUseInitialRegistration(ctx);
      const [registration, linkedChildrenCount] = await Promise.all([
        ctx.db.parentRegistration.findUnique({
          where: { parentUserId: ctx.user.id },
          select: { id: true, submittedAt: true },
        }),
        ctx.db.guardian.count({ where: { userId: ctx.user.id } }),
      ]);

      return {
        requiresRegistration: !registration && linkedChildrenCount === 0,
        linkedChildrenCount,
        registrationId: registration?.id ?? null,
        submittedAt: registration?.submittedAt ?? null,
        childRegistrationPromptStatus: accessUser.childRegistrationPromptStatus,
      };
    }),

    answerChildRegistrationPrompt: authedProcedure
      .input(answerChildRegistrationPromptInput)
      .mutation(async ({ ctx, input }) => {
        if (!canAnswerChildRegistrationPrompt(ctx.user)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'child registration prompt is only for adult non-parent accounts',
          });
        }

        const current = await loadRegistrationAccessUser(ctx);
        if (current.childRegistrationPromptStatus !== 'Unanswered') {
          return {
            childRegistrationPromptStatus: current.childRegistrationPromptStatus,
            updated: false,
          };
        }

        const childRegistrationPromptStatus = childRegistrationPromptStatusForAnswer(
          input.hasChildren,
        );
        const updated = await ctx.db.user.update({
          where: { id: ctx.user.id },
          data: {
            childRegistrationPromptStatus,
            childRegistrationPromptAnsweredAt: new Date(),
          },
          select: registrationAccessUserSelect,
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'User',
            entityId: ctx.user.id,
            meta: {
              childRegistrationPromptStatus: updated.childRegistrationPromptStatus,
              source: 'registration.answerChildRegistrationPrompt',
            },
          },
        });

        return {
          childRegistrationPromptStatus: updated.childRegistrationPromptStatus,
          updated: true,
        };
      }),

    mine: authedProcedure.query(async ({ ctx }) => {
      const registration = await ctx.db.parentRegistration.findUnique({
        where: { parentUserId: ctx.user.id },
        include: parentRegistrationInclude,
      });
      if (!registration) return null;

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'ReadSensitive',
          entity: 'ParentRegistration',
          entityId: registration.id,
          meta: {
            source: 'registration.mine',
            studentCount: registration.studentProfiles.length,
          },
        },
      });

      return mapParentRegistration(ctx, registration);
    }),

    updateMine: authedProcedure
      .input(parentRegistrationUpdateInput)
      .mutation(async ({ ctx, input }) => {
        const registration = await ctx.db.parentRegistration.findUnique({
          where: { parentUserId: ctx.user.id },
          include: parentRegistrationInclude,
        });
        if (!registration) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'registration not found' });
        }
        assertUpdateStudentSet(registration, input.students);

        const profileByStudentId = new Map(
          registration.studentProfiles.map((profile) => [profile.studentId, profile]),
        );
        const studentIds = input.students.map((student) => student.studentId);

        await ctx.db.$transaction(async (tx) => {
          await tx.parentRegistration.update({
            where: { id: registration.id },
            data: {
              homeAddressEnc: encryptRequired(
                ctx.db.$enc.encrypt,
                input.homeAddress,
                'registration PII',
              ),
              agreementNameEnc: encryptRequired(
                ctx.db.$enc.encrypt,
                input.agreement.guardianName,
                'registration PII',
              ),
              agreementDate: input.agreement.agreementDate,
              guardianContacts: {
                deleteMany: {},
                create: input.guardianContacts.map((contact, index) =>
                  guardianContactData(ctx, contact, index),
                ),
              },
              emergencyContacts: {
                deleteMany: {},
                create: input.emergencyContacts.map((contact, index) =>
                  emergencyContactData(ctx, contact, index),
                ),
              },
              pickupContacts: {
                deleteMany: {},
                create: input.pickupContacts.map((contact, index) =>
                  pickupContactData(ctx, contact, index),
                ),
              },
            },
            select: { id: true },
          });

          for (const studentInput of input.students) {
            const profile = profileByStudentId.get(studentInput.studentId);
            if (!profile) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'student is not attached to this registration',
              });
            }

            await tx.student.update({
              where: { id: studentInput.studentId },
              data: studentData(ctx, studentInput),
              select: { id: true },
            });

            await tx.studentRegistrationProfile.update({
              where: { studentId: studentInput.studentId },
              data: studentProfileData(ctx, studentInput),
              select: { id: true },
            });

            for (const consent of consentEntries(studentInput.consents)) {
              await tx.studentRegistrationConsent.upsert({
                where: {
                  profileId_consentType: {
                    profileId: profile.id,
                    consentType: consent.consentType,
                  },
                },
                update: {
                  granted: consent.granted,
                  initialsEnc: encryptRequired(
                    ctx.db.$enc.encrypt,
                    consent.initials,
                    'registration consent PII',
                  ),
                },
                create: {
                  profileId: profile.id,
                  consentType: consent.consentType,
                  granted: consent.granted,
                  initialsEnc: encryptRequired(
                    ctx.db.$enc.encrypt,
                    consent.initials,
                    'registration consent PII',
                  ),
                },
                select: { id: true },
              });
            }

            await tx.auditLog.create({
              data: {
                userId: ctx.user.id,
                action: 'Update',
                entity: 'Student',
                entityId: studentInput.studentId,
                meta: {
                  registrationId: registration.id,
                  source: 'registration.updateMine',
                },
              },
            });
          }

          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'ParentRegistration',
              entityId: registration.id,
              meta: {
                source: 'registration.updateMine',
                studentIds,
              },
            },
          });
        });

        return { registrationId: registration.id, studentIds };
      }),

    addSibling: authedProcedure
      .input(parentRegistrationSiblingInput)
      .mutation(async ({ ctx, input }) => {
        const registration = await ctx.db.parentRegistration.findUnique({
          where: { parentUserId: ctx.user.id },
          include: parentRegistrationInclude,
        });
        if (!registration) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'registration not found' });
        }
        assertSiblingCapacity(registration, 1);

        return ctx.db.$transaction(async (tx) => {
          await tx.parentRegistration.update({
            where: { id: registration.id },
            data: {
              homeAddressEnc: encryptRequired(
                ctx.db.$enc.encrypt,
                input.homeAddress,
                'registration PII',
              ),
              agreementNameEnc: encryptRequired(
                ctx.db.$enc.encrypt,
                input.agreement.guardianName,
                'registration PII',
              ),
              agreementDate: input.agreement.agreementDate,
              guardianContacts: {
                deleteMany: {},
                create: input.guardianContacts.map((contact, index) =>
                  guardianContactData(ctx, contact, index),
                ),
              },
              emergencyContacts: {
                deleteMany: {},
                create: input.emergencyContacts.map((contact, index) =>
                  emergencyContactData(ctx, contact, index),
                ),
              },
              pickupContacts: {
                deleteMany: {},
                create: input.pickupContacts.map((contact, index) =>
                  pickupContactData(ctx, contact, index),
                ),
              },
            },
            select: { id: true },
          });

          const student = await tx.student.create({
            data: {
              ...studentData(ctx, input.student),
              active: true,
            },
            select: { id: true },
          });

          await tx.guardian.create({
            data: { userId: ctx.user.id, studentId: student.id },
            select: { id: true },
          });

          await tx.studentRegistrationProfile.create({
            data: {
              registrationId: registration.id,
              studentId: student.id,
              ...studentProfileData(ctx, input.student),
              consents: {
                create: consentEntries(input.student.consents).map((consent) => ({
                  consentType: consent.consentType,
                  granted: consent.granted,
                  initialsEnc: encryptRequired(
                    ctx.db.$enc.encrypt,
                    consent.initials,
                    'registration consent PII',
                  ),
                })),
              },
            },
            select: { id: true },
          });

          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'Student',
              entityId: student.id,
              meta: {
                registrationId: registration.id,
                source: 'registration.addSibling',
              },
            },
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Create',
              entity: 'Guardian',
              meta: {
                parentUserId: ctx.user.id,
                studentId: student.id,
                registrationId: registration.id,
                source: 'registration.addSibling',
              },
            },
          });
          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'ParentRegistration',
              entityId: registration.id,
              meta: {
                source: 'registration.addSibling',
                studentId: student.id,
              },
            },
          });

          return { registrationId: registration.id, studentId: student.id };
        });
      }),

    addSiblings: authedProcedure
      .input(parentRegistrationSiblingsInput)
      .mutation(async ({ ctx, input }) => {
        const registration = await ctx.db.parentRegistration.findUnique({
          where: { parentUserId: ctx.user.id },
          include: parentRegistrationInclude,
        });
        if (!registration) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'registration not found' });
        }
        assertSiblingCapacity(registration, input.students.length);

        return ctx.db.$transaction(async (tx) => {
          const studentIds: string[] = [];

          for (const studentInput of input.students) {
            const student = await tx.student.create({
              data: {
                ...studentData(ctx, studentInput),
                active: true,
              },
              select: { id: true },
            });
            studentIds.push(student.id);

            await tx.guardian.create({
              data: { userId: ctx.user.id, studentId: student.id },
              select: { id: true },
            });

            await tx.studentRegistrationProfile.create({
              data: {
                registrationId: registration.id,
                studentId: student.id,
                ...studentProfileData(ctx, studentInput),
                consents: {
                  create: consentEntries(studentInput.consents).map((consent) => ({
                    consentType: consent.consentType,
                    granted: consent.granted,
                    initialsEnc: encryptRequired(
                      ctx.db.$enc.encrypt,
                      consent.initials,
                      'registration consent PII',
                    ),
                  })),
                },
              },
              select: { id: true },
            });

            await tx.auditLog.create({
              data: {
                userId: ctx.user.id,
                action: 'Create',
                entity: 'Student',
                entityId: student.id,
                meta: {
                  registrationId: registration.id,
                  source: 'registration.addSiblings',
                },
              },
            });
            await tx.auditLog.create({
              data: {
                userId: ctx.user.id,
                action: 'Create',
                entity: 'Guardian',
                meta: {
                  parentUserId: ctx.user.id,
                  studentId: student.id,
                  registrationId: registration.id,
                  source: 'registration.addSiblings',
                },
              },
            });
          }

          await tx.auditLog.create({
            data: {
              userId: ctx.user.id,
              action: 'Update',
              entity: 'ParentRegistration',
              entityId: registration.id,
              meta: {
                source: 'registration.addSiblings',
                studentIds,
              },
            },
          });

          return { registrationId: registration.id, studentIds };
        });
      }),

    submitInitial: authedProcedure
      .input(parentInitialRegistrationInput)
      .mutation(async ({ ctx, input }) => {
        await requireCanUseInitialRegistration(ctx);
        const [existingRegistration, linkedChildrenCount] = await Promise.all([
          ctx.db.parentRegistration.findUnique({
            where: { parentUserId: ctx.user.id },
            select: { id: true },
          }),
          ctx.db.guardian.count({ where: { userId: ctx.user.id } }),
        ]);
        if (existingRegistration || linkedChildrenCount > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'initial registration has already been completed for this account',
          });
        }

        try {
          return await ctx.db.$transaction(async (tx) => {
            const registration = await tx.parentRegistration.create({
              data: {
                parentUserId: ctx.user.id,
                homeAddressEnc: encryptRequired(
                  ctx.db.$enc.encrypt,
                  input.homeAddress,
                  'registration PII',
                ),
                agreementNameEnc: encryptRequired(
                  ctx.db.$enc.encrypt,
                  input.agreement.guardianName,
                  'registration PII',
                ),
                agreementDate: input.agreement.agreementDate,
                guardianContacts: {
                  create: input.guardianContacts.map((contact, index) =>
                    guardianContactData(ctx, contact, index),
                  ),
                },
                emergencyContacts: {
                  create: input.emergencyContacts.map((contact, index) =>
                    emergencyContactData(ctx, contact, index),
                  ),
                },
                pickupContacts: {
                  create: input.pickupContacts.map((contact, index) =>
                    pickupContactData(ctx, contact, index),
                  ),
                },
              },
              select: { id: true },
            });

            const studentIds: string[] = [];
            for (const studentInput of input.students) {
              const student = await tx.student.create({
                data: {
                  ...studentData(ctx, studentInput),
                  active: true,
                },
                select: { id: true },
              });
              studentIds.push(student.id);

              await tx.guardian.create({
                data: { userId: ctx.user.id, studentId: student.id },
                select: { id: true },
              });

              await tx.studentRegistrationProfile.create({
                data: {
                  registrationId: registration.id,
                  studentId: student.id,
                  ...studentProfileData(ctx, studentInput),
                  consents: {
                    create: consentEntries(studentInput.consents).map((consent) => ({
                      consentType: consent.consentType,
                      granted: consent.granted,
                      initialsEnc: encryptRequired(
                        ctx.db.$enc.encrypt,
                        consent.initials,
                        'registration consent PII',
                      ),
                    })),
                  },
                },
                select: { id: true },
              });

              await tx.auditLog.create({
                data: {
                  userId: ctx.user.id,
                  action: 'Create',
                  entity: 'Student',
                  entityId: student.id,
                  meta: {
                    registrationId: registration.id,
                    source: 'registration.submitInitial',
                  },
                },
              });
              await tx.auditLog.create({
                data: {
                  userId: ctx.user.id,
                  action: 'Create',
                  entity: 'Guardian',
                  meta: {
                    parentUserId: ctx.user.id,
                    studentId: student.id,
                    registrationId: registration.id,
                    source: 'registration.submitInitial',
                  },
                },
              });
            }

            await tx.auditLog.create({
              data: {
                userId: ctx.user.id,
                action: 'Create',
                entity: 'ParentRegistration',
                entityId: registration.id,
                meta: { studentIds, source: 'registration.submitInitial' },
              },
            });

            return { registrationId: registration.id, studentIds };
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'initial registration has already been completed for this account',
            });
          }
          throw err;
        }
      }),

    byStudent: adminOperationsProcedure
      .input(z.object({ studentId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const row = await ctx.db.studentRegistrationProfile.findUnique({
          where: { studentId: input.studentId },
          include: registrationStudentInclude,
        });
        if (!row) return null;

        const mapped = mapRegistrationByStudent(ctx, row);
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'ReadSensitive',
            entity: 'ParentRegistration',
            entityId: row.registrationId,
            meta: {
              source: 'registration.byStudent',
              studentId: input.studentId,
              siblingCount: mapped.siblings.length,
            },
          },
        });
        return mapped;
      }),
  });
}

export const registrationRouter = createRegistrationRouter();
