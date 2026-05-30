import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  REGISTRATION_CONSENT_TYPES,
  canAnswerChildRegistrationPrompt,
  canSubmitInitialRegistration,
  parentInitialRegistrationInput,
  parentRegistrationSiblingInput,
  parentRegistrationSiblingsInput,
  parentRegistrationUpdateInput,
  type ChildRegistrationPromptStatus,
  type ParentInitialRegistrationInput,
  type ParentRegistrationSiblingInput,
  type ParentRegistrationUpdateInput,
  type RegistrationConsentType,
  type Role,
} from '@oasis/domain';
import { authedProcedure, fullAdminProcedure, router } from '../trpc.js';

const answerChildRegistrationPromptInput = z.object({
  hasChildren: z.boolean(),
});

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

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
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

export const registrationRouter = router({
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

  byStudent: fullAdminProcedure
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
