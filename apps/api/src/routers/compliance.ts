import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { Prisma } from '@oasis/db';
import {
  COMPLIANCE_ACCOUNT_ROLES,
  canUseCompliance,
  complianceBadgeSummary,
  isComplianceAccount,
  updateAdultComplianceInput,
  type Role,
  type UpdateAdultComplianceInput,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  complianceBadgeProcedure,
  complianceEditorProcedure,
  complianceProcedure,
  router,
} from '../trpc.js';

const registerInput = z.object({
  page: z.number().int().min(1).default(1),
  search: z.string().trim().max(100).default(''),
});
const badgeInput = z.object({ userIds: z.array(z.string().min(1)).max(250) });
const personInput = z.object({ userId: z.string().min(1) });
const PAGE_SIZE = 25;
const EMPTY_MEDICAL_DETAIL = /^(?:n\/a|none|not recorded|healthy)$/i;

type ComplianceRecord = Prisma.AdultComplianceGetPayload<Record<string, never>>;

function dateOnly(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

function dbDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function medicalDetail(value: string | null): string | null {
  const detail = value?.trim() ?? '';
  return detail && !EMPTY_MEDICAL_DETAIL.test(detail) ? detail : null;
}

function encryptedText(ctx: AppContext, value: string | null): string | null {
  return value ? ctx.db.$enc.encrypt(value) : null;
}

function personDob(
  ctx: AppContext,
  user: { role: Role; dobEnc: string | null; studentProfile: { dobEnc: string } | null },
): string | null {
  return ctx.db.$enc.decrypt(user.role === 'Student' ? user.studentProfile?.dobEnc : user.dobEnc);
}

function mapRecord(ctx: AppContext, record: ComplianceRecord | null) {
  return {
    dbsCertificateNumber: ctx.db.$enc.decrypt(record?.dbsCertificateNumberEnc),
    dbsApplicationReference: ctx.db.$enc.decrypt(record?.dbsApplicationReferenceEnc),
    dbsCompletedAt: dateOnly(record?.dbsCompletedAt ?? null),
    dbsIssueDate: dateOnly(record?.dbsIssueDate ?? null),
    dbsApplicationType: record?.dbsApplicationType ?? null,
    dbsStatus: record?.dbsStatus ?? 'AwaitingCertificate',
    firstAidCompletedAt: dateOnly(record?.firstAidCompletedAt ?? null),
    firstAidLevel: record?.firstAidLevel ?? null,
    safeguardingCompletedAt: dateOnly(record?.safeguardingCompletedAt ?? null),
    safeguardingLevel: record?.safeguardingLevel ?? null,
  };
}

function recordData(ctx: AppContext, input: UpdateAdultComplianceInput) {
  return {
    dbsCertificateNumberEnc: encryptedText(ctx, input.dbsCertificateNumber),
    dbsApplicationReferenceEnc: encryptedText(ctx, input.dbsApplicationReference),
    dbsCompletedAt: dbDate(input.dbsCompletedAt),
    dbsIssueDate: dbDate(input.dbsIssueDate),
    dbsApplicationType: input.dbsApplicationType,
    dbsStatus: input.dbsStatus,
    firstAidCompletedAt: dbDate(input.firstAidCompletedAt),
    firstAidLevel: input.firstAidLevel || null,
    safeguardingCompletedAt: dbDate(input.safeguardingCompletedAt),
    safeguardingLevel: input.safeguardingLevel || null,
  };
}

export const complianceRouter = router({
  peopleOptions: complianceEditorProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: { role: { in: [...COMPLIANCE_ACCOUNT_ROLES] } },
      select: {
        id: true,
        role: true,
        active: true,
        fullNameEnc: true,
        dobEnc: true,
        studentProfile: { select: { dobEnc: true } },
      },
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: users.length, source: 'compliance.peopleOptions' },
      },
    });
    return users
      .filter((user) => isComplianceAccount(user.role, personDob(ctx, user)))
      .map((user) => ({
        id: user.id,
        role: user.role,
        active: user.active,
        fullName: ctx.db.$enc.decrypt(user.fullNameEnc),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }),

  register: complianceProcedure.input(registerInput).query(async ({ ctx, input }) => {
    const users = await ctx.db.user.findMany({
      where: {
        role: { in: [...COMPLIANCE_ACCOUNT_ROLES] },
        OR: [{ role: { not: 'Supervisor' } }, { active: true }],
      },
      select: {
        id: true,
        role: true,
        active: true,
        fullNameEnc: true,
        dobEnc: true,
        studentProfile: { select: { dobEnc: true } },
      },
    });
    const search = input.search.toLocaleLowerCase();
    const matching = users
      .map((user) => ({
        id: user.id,
        role: user.role,
        active: user.active,
        fullName: ctx.db.$enc.decrypt(user.fullNameEnc),
        dob: personDob(ctx, user),
      }))
      .filter((user) => isComplianceAccount(user.role, user.dob))
      .filter((user) => user.fullName.toLocaleLowerCase().includes(search))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    const pageUsers = matching.slice((input.page - 1) * PAGE_SIZE, input.page * PAGE_SIZE);
    const records = pageUsers.length
      ? await ctx.withRls((tx) =>
          tx.adultCompliance.findMany({
            where: { userId: { in: pageUsers.map((user) => user.id) } },
          }),
        )
      : [];
    const byUserId = new Map(records.map((record) => [record.userId, record]));
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'AdultCompliance',
        meta: {
          scannedCount: users.length,
          returnedCount: pageUsers.length,
          source: 'compliance.register',
        },
      },
    });
    return {
      canEdit: canUseCompliance(ctx.user),
      page: input.page,
      pageSize: PAGE_SIZE,
      total: matching.length,
      rows: pageUsers.map((user) => ({
        id: user.id,
        role: user.role,
        active: user.active,
        fullName: user.fullName,
        dob: user.dob,
        ...mapRecord(ctx, byUserId.get(user.id) ?? null),
        badges: complianceBadgeSummary(byUserId.get(user.id) ?? null),
      })),
    };
  }),

  person: complianceEditorProcedure.input(personInput).query(async ({ ctx, input }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        role: true,
        active: true,
        fullNameEnc: true,
        dobEnc: true,
        studentProfile: { select: { dobEnc: true } },
      },
    });
    if (!user || !isComplianceAccount(user.role, personDob(ctx, user))) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Person not found in the register.' });
    }
    const record = await ctx.withRls((tx) =>
      tx.adultCompliance.findUnique({ where: { userId: user.id } }),
    );
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'AdultCompliance',
        entityId: user.id,
        meta: { source: 'compliance.person' },
      },
    });
    return {
      id: user.id,
      role: user.role,
      active: user.active,
      fullName: ctx.db.$enc.decrypt(user.fullNameEnc),
      dob: personDob(ctx, user),
      ...mapRecord(ctx, record),
    };
  }),

  update: complianceEditorProcedure
    .input(updateAdultComplianceInput)
    .mutation(async ({ ctx, input }) => {
      const data = recordData(ctx, input);
      await ctx.withRls(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            role: true,
            dobEnc: true,
            studentProfile: { select: { dobEnc: true } },
          },
        });
        if (!user || !isComplianceAccount(user.role, personDob(ctx, user))) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Person not found in the register.' });
        }
        if (!isComplianceAccount(user.role, input.dob)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Under-18 accounts cannot have compliance records.',
          });
        }
        await tx.user.update({
          where: { id: user.id },
          data: { dobEnc: encryptedText(ctx, input.dob) },
        });
        if (user.role === 'Student' && input.dob) {
          await tx.student.update({
            where: { userId: user.id },
            data: { dobEnc: ctx.db.$enc.encrypt(input.dob) },
          });
        }
        await tx.adultCompliance.upsert({
          where: { userId: user.id },
          create: { userId: user.id, ...data },
          update: data,
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'AdultCompliance',
            entityId: user.id,
            meta: {
              source: 'compliance.update',
              fields: Object.keys(data).concat(
                user.role === 'Student' ? ['dobEnc', 'studentDobEnc'] : ['dobEnc'],
              ),
            },
          },
        });
      });
      return { userId: input.userId };
    }),

  medTab: complianceProcedure.query(async ({ ctx }) => {
    const profiles = await ctx.db.studentRegistrationProfile.findMany({
      where: { student: { active: true } },
      select: {
        studentId: true,
        student: { select: { fullNameEnc: true, yearGroup: true } },
        allergiesEnc: true,
        medicalConditionsEnc: true,
        medicationAtCentreEnc: true,
      },
    });
    const rows = profiles
      .map((profile) => ({
        studentId: profile.studentId,
        fullName: ctx.db.$enc.decrypt(profile.student.fullNameEnc),
        yearGroup: profile.student.yearGroup,
        allergies: medicalDetail(ctx.db.$enc.decrypt(profile.allergiesEnc)),
        medicalConditions: medicalDetail(ctx.db.$enc.decrypt(profile.medicalConditionsEnc)),
        medicationAtCentre: medicalDetail(ctx.db.$enc.decrypt(profile.medicationAtCentreEnc)),
      }))
      .filter((row) => row.allergies || row.medicalConditions || row.medicationAtCentre)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'ReadSensitive',
        entity: 'StudentRegistrationProfile',
        meta: { count: rows.length, source: 'compliance.medTab' },
      },
    });
    return rows;
  }),

  badgeSummaries: complianceBadgeProcedure.input(badgeInput).query(async ({ ctx, input }) => {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return [];
    const users = await ctx.withRls((tx) =>
      tx.user.findMany({
        where: { id: { in: userIds }, role: { in: [...COMPLIANCE_ACCOUNT_ROLES] } },
        select: {
          id: true,
          role: true,
          dobEnc: true,
          studentProfile: { select: { dobEnc: true } },
          adultCompliance: {
            select: {
              dbsStatus: true,
              firstAidCompletedAt: true,
              firstAidLevel: true,
              safeguardingCompletedAt: true,
              safeguardingLevel: true,
            },
          },
        },
      }),
    );
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'AdultCompliance',
        meta: { count: users.length, source: 'compliance.badgeSummaries' },
      },
    });
    return users
      .filter((user) => isComplianceAccount(user.role, personDob(ctx, user)))
      .map((user) => ({
        userId: user.id,
        badges: complianceBadgeSummary(user.adultCompliance),
      }));
  }),

  allBadgeSummaries: complianceBadgeProcedure.query(async ({ ctx }) => {
    const users = await ctx.withRls((tx) =>
      tx.user.findMany({
        where: { role: { in: [...COMPLIANCE_ACCOUNT_ROLES] } },
        select: {
          id: true,
          role: true,
          dobEnc: true,
          studentProfile: { select: { dobEnc: true } },
          adultCompliance: {
            select: {
              dbsStatus: true,
              firstAidCompletedAt: true,
              firstAidLevel: true,
              safeguardingCompletedAt: true,
              safeguardingLevel: true,
            },
          },
        },
      }),
    );
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'AdultCompliance',
        meta: { count: users.length, source: 'compliance.allBadgeSummaries' },
      },
    });
    return users
      .filter((user) => isComplianceAccount(user.role, personDob(ctx, user)))
      .map((user) => ({
        userId: user.id,
        badges: complianceBadgeSummary(user.adultCompliance),
      }));
  }),
});
