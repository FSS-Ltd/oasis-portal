import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  effectiveStudentPortalLock,
  studentMeritShopAccess,
  type StudentPortalLockSource,
} from '@oasis/domain/studentPortalSettings';
import type { AppContext } from '../context.js';

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

const studentPortalPolicySelect = Prisma.validator<Prisma.StudentPortalSettingsSelect>()({
  parentAccountLocked: true,
  parentLockReasonEnc: true,
  headAcademicLocked: true,
  headAcademicLockReasonEnc: true,
  parentMeritShopBlocked: true,
});

type StudentPortalPolicyRow = Prisma.StudentPortalSettingsGetPayload<{
  select: typeof studentPortalPolicySelect;
}>;

interface StudentPortalPolicyState {
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
}

interface StudentPortalLockDetails {
  locked: boolean;
  message: string | null;
  source: StudentPortalLockSource | null;
}

function defaultPolicyState(settings: StudentPortalPolicyRow | null): StudentPortalPolicyState {
  return {
    parentAccountLocked: settings?.parentAccountLocked ?? false,
    parentLockReasonEnc: settings?.parentLockReasonEnc ?? null,
    headAcademicLocked: settings?.headAcademicLocked ?? false,
    headAcademicLockReasonEnc: settings?.headAcademicLockReasonEnc ?? null,
    parentMeritShopBlocked: settings?.parentMeritShopBlocked ?? false,
  };
}

function lockMessage(source: StudentPortalLockSource): string {
  return source === 'HeadAcademic'
    ? 'Student portal is locked by Oasis Learning Centre for academic reasons.'
    : 'Student portal is locked by a parent or carer.';
}

function lockDetails(settings: StudentPortalPolicyRow | null): StudentPortalLockDetails {
  const state = defaultPolicyState(settings);
  const lock = effectiveStudentPortalLock(state);
  const source = lock.primarySource ?? null;

  return {
    locked: lock.locked,
    message: source ? lockMessage(source) : null,
    source,
  };
}

async function loadStudentPortalPolicy(
  ctx: AuthedContext,
  studentId: string,
): Promise<StudentPortalPolicyRow | null> {
  return ctx.db.studentPortalSettings.findUnique({
    where: { studentId },
    select: studentPortalPolicySelect,
  });
}

async function auditStudentPortalPolicyDenied(
  ctx: AuthedContext,
  input: {
    entity: string;
    reason: 'AccountLocked' | 'ParentShopBlock';
    studentId: string;
    lockSource?: StudentPortalLockSource | undefined;
  },
): Promise<void> {
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: input.entity,
      entityId: input.studentId,
      meta: {
        role: ctx.user.role,
        reason: input.reason,
        lockSource: input.lockSource ?? null,
      },
    },
  });
}

export async function assertStudentPortalUnlocked(
  ctx: AuthedContext,
  input: { entity: string; studentId: string },
): Promise<void> {
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  const lock = lockDetails(settings);

  if (!lock.locked) return;

  await auditStudentPortalPolicyDenied(ctx, {
    entity: input.entity,
    reason: 'AccountLocked',
    studentId: input.studentId,
    lockSource: lock.source ?? undefined,
  });

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: lock.message ?? 'Student portal is locked.',
  });
}

export async function assertStudentMeritShopAccess(
  ctx: AuthedContext,
  input: { entity: string; studentId: string },
): Promise<void> {
  const settings = await loadStudentPortalPolicy(ctx, input.studentId);
  const state = defaultPolicyState(settings);
  const access = studentMeritShopAccess(state);

  if (access.allowed) return;

  if (access.reason === 'AccountLocked') {
    const lock = lockDetails(settings);
    await auditStudentPortalPolicyDenied(ctx, {
      entity: input.entity,
      reason: 'AccountLocked',
      studentId: input.studentId,
      lockSource: lock.source ?? undefined,
    });
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: lock.message ?? 'Student portal is locked.',
    });
  }

  await auditStudentPortalPolicyDenied(ctx, {
    entity: input.entity,
    reason: 'ParentShopBlock',
    studentId: input.studentId,
  });
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Merit Shop access is blocked by a parent or carer.',
  });
}
