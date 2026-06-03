import { createClerkClient } from '@clerk/backend';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  canParentControlStudent,
  effectiveStudentPortalLock,
  isStudentAdult,
  validateStudentPortalUsageLimits,
} from '@oasis/domain/studentPortalSettings';
import type { AppContext } from '../context.js';
import { assertStudentPortalUnlocked } from '../lib/student-portal-access.js';
import { roleProcedure, router } from '../trpc.js';

export interface StudentCredentialAdapter {
  setPassword(input: { clerkUserId: string; password: string }): Promise<void>;
}

export interface StudentSettingsRouterDeps {
  credentialAdapter?: StudentCredentialAdapter;
}

const passwordInput = z.string().min(12).max(128);
const studentIdInput = z.object({ studentId: z.string().min(1) });
const loginHandleInput = studentIdInput.extend({
  loginHandle: z.string().trim().min(1).max(80).nullable(),
});
const passwordControlInput = studentIdInput.extend({
  studentCanManagePassword: z.boolean(),
});
const usageLimitsInput = studentIdInput.extend({
  hourlyUsageLimitMinutes: z.number().int().min(1).max(60).nullable().optional(),
  dailyUsageLimitMinutes: z.number().int().min(1).max(1_440).nullable().optional(),
  weeklyUsageLimitMinutes: z.number().int().min(1).max(10_080).nullable().optional(),
});
const parentLockInput = studentIdInput.extend({
  locked: z.boolean(),
  reason: z.string().trim().max(500).nullable().optional(),
});
const shopBlockInput = studentIdInput.extend({
  blocked: z.boolean(),
});
const childPasswordInput = studentIdInput.extend({
  password: passwordInput,
});
const myPasswordInput = z.object({
  password: passwordInput,
});

const settingsSelect = Prisma.validator<Prisma.StudentPortalSettingsSelect>()({
  id: true,
  studentId: true,
  loginHandleEnc: true,
  loginHandleBidx: true,
  studentCanManagePassword: true,
  hourlyUsageLimitMinutes: true,
  dailyUsageLimitMinutes: true,
  weeklyUsageLimitMinutes: true,
  parentAccountLocked: true,
  parentLockReasonEnc: true,
  headAcademicLocked: true,
  headAcademicLockReasonEnc: true,
  parentMeritShopBlocked: true,
  settingsUpdatedById: true,
  settingsUpdatedAt: true,
  parentLockUpdatedById: true,
  parentLockUpdatedAt: true,
  headLockUpdatedById: true,
  headLockUpdatedAt: true,
  shopBlockUpdatedById: true,
  shopBlockUpdatedAt: true,
});

const studentSelect = Prisma.validator<Prisma.StudentSelect>()({
  id: true,
  userId: true,
  fullNameEnc: true,
  dobEnc: true,
  yearGroup: true,
  active: true,
  user: { select: { clerkId: true } },
  portalSettings: { select: settingsSelect },
});

type StudentSettingsRow = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;
type SettingsRow = Prisma.StudentPortalSettingsGetPayload<{ select: typeof settingsSelect }>;
type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

interface SettingsMutationData {
  loginHandleEnc?: string | null;
  loginHandleBidx?: string | null;
  studentCanManagePassword?: boolean;
  hourlyUsageLimitMinutes?: number | null;
  dailyUsageLimitMinutes?: number | null;
  weeklyUsageLimitMinutes?: number | null;
  parentAccountLocked?: boolean;
  parentLockReasonEnc?: string | null;
  headAcademicLocked?: boolean;
  headAcademicLockReasonEnc?: string | null;
  parentMeritShopBlocked?: boolean;
  settingsUpdatedById?: string;
  settingsUpdatedAt?: Date;
  parentLockUpdatedById?: string;
  parentLockUpdatedAt?: Date;
  headLockUpdatedById?: string;
  headLockUpdatedAt?: Date;
  shopBlockUpdatedById?: string;
  shopBlockUpdatedAt?: Date;
}

interface SettingsDefaults {
  loginHandleEnc: string | null;
  studentCanManagePassword: boolean;
  hourlyUsageLimitMinutes: number | null;
  dailyUsageLimitMinutes: number | null;
  weeklyUsageLimitMinutes: number | null;
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
}

function createDefaultStudentCredentialAdapter(): StudentCredentialAdapter {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'CLERK_SECRET_KEY is required to create the default student credential adapter',
    );
  }
  const client = createClerkClient({ secretKey });
  const users = client.users as unknown as {
    updateUser(
      clerkUserId: string,
      input: { password: string; signOutOfOtherSessions: boolean },
    ): Promise<unknown>;
  };

  return {
    async setPassword(input) {
      await users.updateUser(input.clerkUserId, {
        password: input.password,
        signOutOfOtherSessions: true,
      });
    },
  };
}

function decryptRequired(ctx: AppContext, value: string, entity: string): string {
  const decrypted = ctx.db.$enc.decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} decrypt failed` });
  }
  return decrypted;
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function defaultsFor(settings: SettingsRow | null): SettingsDefaults {
  return {
    loginHandleEnc: settings?.loginHandleEnc ?? null,
    studentCanManagePassword: settings?.studentCanManagePassword ?? false,
    hourlyUsageLimitMinutes: settings?.hourlyUsageLimitMinutes ?? null,
    dailyUsageLimitMinutes: settings?.dailyUsageLimitMinutes ?? null,
    weeklyUsageLimitMinutes: settings?.weeklyUsageLimitMinutes ?? null,
    parentAccountLocked: settings?.parentAccountLocked ?? false,
    parentLockReasonEnc: settings?.parentLockReasonEnc ?? null,
    headAcademicLocked: settings?.headAcademicLocked ?? false,
    headAcademicLockReasonEnc: settings?.headAcademicLockReasonEnc ?? null,
    parentMeritShopBlocked: settings?.parentMeritShopBlocked ?? false,
  };
}

function mapParentSettings(
  ctx: AppContext,
  student: StudentSettingsRow,
  settings = student.portalSettings,
) {
  const fullName = decryptRequired(ctx, student.fullNameEnc, 'student PII');
  const dob = decryptRequired(ctx, student.dobEnc, 'student PII');
  const state = defaultsFor(settings);
  const effectiveLock = effectiveStudentPortalLock(state);

  return {
    studentId: student.id,
    fullName,
    yearGroup: student.yearGroup,
    parentControlAllowed: canParentControlStudent({ dateOfBirth: dob }),
    loginHandle: state.loginHandleEnc ? ctx.db.$enc.decrypt(state.loginHandleEnc) : null,
    studentCanManagePassword: state.studentCanManagePassword,
    hourlyUsageLimitMinutes: state.hourlyUsageLimitMinutes,
    dailyUsageLimitMinutes: state.dailyUsageLimitMinutes,
    weeklyUsageLimitMinutes: state.weeklyUsageLimitMinutes,
    parentAccountLocked: state.parentAccountLocked,
    parentLockReason: state.parentLockReasonEnc
      ? ctx.db.$enc.decrypt(state.parentLockReasonEnc)
      : null,
    headAcademicLocked: state.headAcademicLocked,
    headAcademicLockReason: state.headAcademicLockReasonEnc
      ? ctx.db.$enc.decrypt(state.headAcademicLockReasonEnc)
      : null,
    parentMeritShopBlocked: state.parentMeritShopBlocked,
    effectiveLock,
  };
}

function mapStudentSettings(
  ctx: AppContext,
  student: StudentSettingsRow,
  settings = student.portalSettings,
) {
  const dob = decryptRequired(ctx, student.dobEnc, 'student PII');
  const state = defaultsFor(settings);

  return {
    studentId: student.id,
    adult: isStudentAdult({ dateOfBirth: dob }),
    studentCanManagePassword: state.studentCanManagePassword,
    hourlyUsageLimitMinutes: state.hourlyUsageLimitMinutes,
    dailyUsageLimitMinutes: state.dailyUsageLimitMinutes,
    weeklyUsageLimitMinutes: state.weeklyUsageLimitMinutes,
    parentMeritShopBlocked: state.parentMeritShopBlocked,
    effectiveLock: effectiveStudentPortalLock(state),
  };
}

async function auditSettingsUpdate(
  ctx: AuthedContext,
  input: { studentId: string; source: string; fields: string[] },
) {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Update',
      entity: 'StudentPortalSettings',
      entityId: input.studentId,
      meta: { source: input.source, fields: input.fields },
    },
  });
}

async function loadLinkedStudent(
  ctx: AuthedContext,
  studentId: string,
): Promise<StudentSettingsRow> {
  const student = await ctx.db.student.findFirst({
    where: {
      id: studentId,
      active: true,
      guardians: { some: { userId: ctx.user.id } },
    },
    select: studentSelect,
  });
  if (!student) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'student is not linked to this parent' });
  }
  return student;
}

async function loadParentControlledStudent(
  ctx: AuthedContext,
  studentId: string,
): Promise<StudentSettingsRow> {
  const student = await loadLinkedStudent(ctx, studentId);
  const dob = decryptRequired(ctx, student.dobEnc, 'student PII');
  if (!canParentControlStudent({ dateOfBirth: dob })) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'parent account control is disabled for students who are 18 or older',
    });
  }
  return student;
}

async function loadOwnStudent(ctx: AuthedContext): Promise<StudentSettingsRow> {
  const student = await ctx.db.student.findUnique({
    where: { userId: ctx.user.id },
    select: studentSelect,
  });
  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }
  return student;
}

async function loadStudentForHead(
  ctx: AuthedContext,
  studentId: string,
): Promise<StudentSettingsRow> {
  const student = await ctx.db.student.findFirst({
    where: { id: studentId, active: true },
    select: studentSelect,
  });
  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  return student;
}

function requireStudentClerkId(student: StudentSettingsRow): string {
  const clerkId = student.user?.clerkId;
  if (!clerkId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'student account is not linked to a login user',
    });
  }
  return clerkId;
}

async function upsertSettings(
  ctx: AppContext,
  studentId: string,
  data: SettingsMutationData,
): Promise<SettingsRow> {
  return ctx.db.studentPortalSettings.upsert({
    where: { studentId },
    create: {
      studentId,
      ...data,
    },
    update: data,
    select: settingsSelect,
  });
}

export function createStudentSettingsRouter(deps: StudentSettingsRouterDeps = {}) {
  const credentialAdapter = () => deps.credentialAdapter ?? createDefaultStudentCredentialAdapter();
  const parentProcedure = roleProcedure('Parent');

  return router({
    listLinkedChildren: parentProcedure.query(async ({ ctx }) => {
      const students = await ctx.db.student.findMany({
        where: {
          active: true,
          guardians: { some: { userId: ctx.user.id } },
        },
        select: studentSelect,
        orderBy: { createdAt: 'desc' },
      });
      return students.map((student) => mapParentSettings(ctx, student));
    }),

    getChildSettings: parentProcedure.input(studentIdInput).query(async ({ ctx, input }) => {
      const student = await loadLinkedStudent(ctx, input.studentId);
      return mapParentSettings(ctx, student);
    }),

    setLoginHandle: parentProcedure.input(loginHandleInput).mutation(async ({ ctx, input }) => {
      const student = await loadParentControlledStudent(ctx, input.studentId);
      const loginHandle = optionalText(input.loginHandle);
      const now = new Date();
      const settings = await upsertSettings(ctx, student.id, {
        loginHandleEnc: loginHandle ? ctx.db.$enc.encrypt(loginHandle) : null,
        loginHandleBidx: loginHandle ? ctx.db.$enc.blindIndex(loginHandle) : null,
        settingsUpdatedById: ctx.user.id,
        settingsUpdatedAt: now,
      });
      await auditSettingsUpdate(ctx, {
        studentId: student.id,
        source: 'studentSettings.setLoginHandle',
        fields: ['loginHandle'],
      });
      return mapParentSettings(ctx, student, settings);
    }),

    setChildPassword: parentProcedure.input(childPasswordInput).mutation(async ({ ctx, input }) => {
      const student = await loadParentControlledStudent(ctx, input.studentId);
      await credentialAdapter().setPassword({
        clerkUserId: requireStudentClerkId(student),
        password: input.password,
      });
      await auditSettingsUpdate(ctx, {
        studentId: student.id,
        source: 'studentSettings.setChildPassword',
        fields: ['password'],
      });
      return { ok: true };
    }),

    setPasswordControl: parentProcedure
      .input(passwordControlInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadParentControlledStudent(ctx, input.studentId);
        const now = new Date();
        const settings = await upsertSettings(ctx, student.id, {
          studentCanManagePassword: input.studentCanManagePassword,
          settingsUpdatedById: ctx.user.id,
          settingsUpdatedAt: now,
        });
        await auditSettingsUpdate(ctx, {
          studentId: student.id,
          source: 'studentSettings.setPasswordControl',
          fields: ['studentCanManagePassword'],
        });
        return mapParentSettings(ctx, student, settings);
      }),

    setUsageLimits: parentProcedure.input(usageLimitsInput).mutation(async ({ ctx, input }) => {
      const student = await loadParentControlledStudent(ctx, input.studentId);
      const limits = validateStudentPortalUsageLimits({
        hourlyUsageLimitMinutes: input.hourlyUsageLimitMinutes ?? null,
        dailyUsageLimitMinutes: input.dailyUsageLimitMinutes ?? null,
        weeklyUsageLimitMinutes: input.weeklyUsageLimitMinutes ?? null,
      });
      const now = new Date();
      const settings = await upsertSettings(ctx, student.id, {
        ...limits,
        settingsUpdatedById: ctx.user.id,
        settingsUpdatedAt: now,
      });
      await auditSettingsUpdate(ctx, {
        studentId: student.id,
        source: 'studentSettings.setUsageLimits',
        fields: ['hourlyUsageLimitMinutes', 'dailyUsageLimitMinutes', 'weeklyUsageLimitMinutes'],
      });
      return mapParentSettings(ctx, student, settings);
    }),

    setParentLock: parentProcedure.input(parentLockInput).mutation(async ({ ctx, input }) => {
      const student = await loadParentControlledStudent(ctx, input.studentId);
      const reason = optionalText(input.reason);
      const now = new Date();
      const settings = await upsertSettings(ctx, student.id, {
        parentAccountLocked: input.locked,
        parentLockReasonEnc: input.locked && reason ? ctx.db.$enc.encrypt(reason) : null,
        parentLockUpdatedById: ctx.user.id,
        parentLockUpdatedAt: now,
      });
      await auditSettingsUpdate(ctx, {
        studentId: student.id,
        source: 'studentSettings.setParentLock',
        fields: ['parentAccountLocked', 'parentLockReason'],
      });
      return mapParentSettings(ctx, student, settings);
    }),

    setMeritShopBlock: parentProcedure.input(shopBlockInput).mutation(async ({ ctx, input }) => {
      const student = await loadParentControlledStudent(ctx, input.studentId);
      const now = new Date();
      const settings = await upsertSettings(ctx, student.id, {
        parentMeritShopBlocked: input.blocked,
        shopBlockUpdatedById: ctx.user.id,
        shopBlockUpdatedAt: now,
      });
      await auditSettingsUpdate(ctx, {
        studentId: student.id,
        source: 'studentSettings.setMeritShopBlock',
        fields: ['parentMeritShopBlocked'],
      });
      return mapParentSettings(ctx, student, settings);
    }),

    mySettings: roleProcedure('Student').query(async ({ ctx }) => {
      const student = await loadOwnStudent(ctx);
      return mapStudentSettings(ctx, student);
    }),

    setMyPassword: roleProcedure('Student')
      .input(myPasswordInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadOwnStudent(ctx);
        await assertStudentPortalUnlocked(ctx, {
          entity: 'studentSettings.setMyPassword',
          studentId: student.id,
        });
        const dob = decryptRequired(ctx, student.dobEnc, 'student PII');
        const settings = defaultsFor(student.portalSettings);
        if (!isStudentAdult({ dateOfBirth: dob }) && !settings.studentCanManagePassword) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'parent policy does not allow student-managed password changes',
          });
        }
        await credentialAdapter().setPassword({
          clerkUserId: requireStudentClerkId(student),
          password: input.password,
        });
        await auditSettingsUpdate(ctx, {
          studentId: student.id,
          source: 'studentSettings.setMyPassword',
          fields: ['password'],
        });
        return { ok: true };
      }),

    setHeadAcademicLock: roleProcedure('Head')
      .input(parentLockInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadStudentForHead(ctx, input.studentId);
        const reason = optionalText(input.reason);
        const now = new Date();
        const settings = await upsertSettings(ctx, student.id, {
          headAcademicLocked: input.locked,
          headAcademicLockReasonEnc: input.locked && reason ? ctx.db.$enc.encrypt(reason) : null,
          headLockUpdatedById: ctx.user.id,
          headLockUpdatedAt: now,
        });
        await auditSettingsUpdate(ctx, {
          studentId: student.id,
          source: 'studentSettings.setHeadAcademicLock',
          fields: ['headAcademicLocked', 'headAcademicLockReason'],
        });
        return mapParentSettings(ctx, student, settings);
      }),
  });
}

export const studentSettingsRouter = createStudentSettingsRouter();
