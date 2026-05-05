import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  REGISTRATION_CONSENT_TYPES,
  canAnswerChildRegistrationPrompt,
  canSubmitInitialRegistration,
  parentInitialRegistrationInput,
  type ChildRegistrationPromptStatus,
  type ParentInitialRegistrationInput,
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

function consentEntries(consents: ParentInitialRegistrationInput['students'][number]['consents']) {
  return REGISTRATION_CONSENT_TYPES.map((consentType) => ({
    consentType,
    granted: consents[consentType].granted,
    initials: consents[consentType].initials,
  }));
}

function mapConsents(
  decrypt: (value: string | null | undefined) => string | null,
  consents: RegistrationStudentRow['consents'],
) {
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
    guardianContacts: registration.guardianContacts.map((contact) => ({
      fullName: decryptRequired(decrypt, contact.fullNameEnc, 'registration guardian PII'),
      relationship: decryptRequired(decrypt, contact.relationshipEnc, 'registration guardian PII'),
      primaryPhone: decryptRequired(decrypt, contact.primaryPhoneEnc, 'registration guardian PII'),
      secondaryPhone: decryptOptional(decrypt, contact.secondaryPhoneEnc),
      email: decryptOptional(decrypt, contact.emailEnc),
      workPhone: decryptOptional(decrypt, contact.workPhoneEnc),
      address: decryptOptional(decrypt, contact.addressEnc),
    })),
    emergencyContacts: registration.emergencyContacts.map((contact) => ({
      fullName: decryptRequired(decrypt, contact.fullNameEnc, 'registration emergency PII'),
      relationship: decryptRequired(decrypt, contact.relationshipEnc, 'registration emergency PII'),
      primaryPhone: decryptRequired(decrypt, contact.primaryPhoneEnc, 'registration emergency PII'),
      secondaryPhone: decryptOptional(decrypt, contact.secondaryPhoneEnc),
      email: decryptOptional(decrypt, contact.emailEnc),
      canPickUp: contact.canPickUp,
    })),
    pickupContacts: registration.pickupContacts.map((contact) => ({
      fullName: decryptRequired(decrypt, contact.fullNameEnc, 'registration pickup PII'),
      relationship: decryptRequired(decrypt, contact.relationshipEnc, 'registration pickup PII'),
      phone: decryptRequired(decrypt, contact.phoneEnc, 'registration pickup PII'),
      idPasswordNote: decryptOptional(decrypt, contact.idPasswordNoteEnc),
    })),
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
              homeAddressEnc: ctx.db.$enc.encrypt(input.homeAddress),
              agreementNameEnc: ctx.db.$enc.encrypt(input.agreement.guardianName),
              agreementDate: input.agreement.agreementDate,
              guardianContacts: {
                create: input.guardianContacts.map((contact, index) => ({
                  position: index + 1,
                  fullNameEnc: ctx.db.$enc.encrypt(contact.fullName),
                  relationshipEnc: ctx.db.$enc.encrypt(contact.relationship),
                  primaryPhoneEnc: ctx.db.$enc.encrypt(contact.primaryPhone),
                  secondaryPhoneEnc: encryptOptional(ctx.db.$enc.encrypt, contact.secondaryPhone),
                  emailEnc: encryptOptional(ctx.db.$enc.encrypt, contact.email),
                  workPhoneEnc: encryptOptional(ctx.db.$enc.encrypt, contact.workPhone),
                  addressEnc: encryptOptional(ctx.db.$enc.encrypt, contact.address),
                })),
              },
              emergencyContacts: {
                create: input.emergencyContacts.map((contact, index) => ({
                  position: index + 1,
                  fullNameEnc: ctx.db.$enc.encrypt(contact.fullName),
                  relationshipEnc: ctx.db.$enc.encrypt(contact.relationship),
                  primaryPhoneEnc: ctx.db.$enc.encrypt(contact.primaryPhone),
                  secondaryPhoneEnc: encryptOptional(ctx.db.$enc.encrypt, contact.secondaryPhone),
                  emailEnc: encryptOptional(ctx.db.$enc.encrypt, contact.email),
                  canPickUp: contact.canPickUp,
                })),
              },
              pickupContacts: {
                create: input.pickupContacts.map((contact, index) => ({
                  position: index + 1,
                  fullNameEnc: ctx.db.$enc.encrypt(contact.fullName),
                  relationshipEnc: ctx.db.$enc.encrypt(contact.relationship),
                  phoneEnc: ctx.db.$enc.encrypt(contact.phone),
                  idPasswordNoteEnc: encryptOptional(ctx.db.$enc.encrypt, contact.idPasswordNote),
                })),
              },
            },
            select: { id: true },
          });

          const studentIds: string[] = [];
          for (const studentInput of input.students) {
            const student = await tx.student.create({
              data: {
                fullNameEnc: ctx.db.$enc.encrypt(studentInput.fullName),
                nameBidx: ctx.db.$enc.blindIndex(studentInput.fullName),
                dobEnc: ctx.db.$enc.encrypt(dateOnly(studentInput.dob)),
                yearGroup: studentInput.yearGroup,
                enrolmentDate: studentInput.startDate,
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
                preferredNameEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.preferredName),
                genderEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.gender),
                homeLanguageEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.homeLanguage),
                studentNotesEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.studentNotes),
                allergiesEnc: encryptOptional(ctx.db.$enc.encrypt, studentInput.allergies),
                medicalConditionsEnc: encryptOptional(
                  ctx.db.$enc.encrypt,
                  studentInput.medicalConditions,
                ),
                medicationAtCentreEnc: encryptOptional(
                  ctx.db.$enc.encrypt,
                  studentInput.medicationAtCentre,
                ),
                dietaryRestrictionsEnc: encryptOptional(
                  ctx.db.$enc.encrypt,
                  studentInput.dietaryRestrictions,
                ),
                learningSupportEnc: encryptOptional(
                  ctx.db.$enc.encrypt,
                  studentInput.learningSupport,
                ),
                interestsStrengthsEnc: encryptOptional(
                  ctx.db.$enc.encrypt,
                  studentInput.interestsStrengths,
                ),
                settlingComfortNotesEnc: encryptOptional(
                  ctx.db.$enc.encrypt,
                  studentInput.settlingComfortNotes,
                ),
                additionalInfoEnc: encryptOptional(
                  ctx.db.$enc.encrypt,
                  studentInput.additionalInfo,
                ),
                consents: {
                  create: consentEntries(studentInput.consents).map((consent) => ({
                    consentType: consent.consentType,
                    granted: consent.granted,
                    initialsEnc: ctx.db.$enc.encrypt(consent.initials),
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
