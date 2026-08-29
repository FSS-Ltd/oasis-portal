import { randomUUID } from 'node:crypto';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import { attendanceRate } from '@oasis/domain/attendance';
import {
  canParentControlStudent,
  canUseLinkedChildStudentSettingsAccess,
  effectiveStudentPortalLock,
  isStudentAdult,
  validateStudentPortalUsageLimits,
} from '@oasis/domain/studentPortalSettings';
import type { AppContext } from '../context.js';
import { assertStudentPortalAccess } from '../lib/student-portal-access.js';
import { startOfUtcDay } from '../lib/utc-date.js';
import {
  assertUploadedChildIconPhoto,
  type UploadedChildIconPhoto,
} from '../services/child-icon-photo-storage.js';
import { adminOperationsProcedure, authedProcedure, roleProcedure, router } from '../trpc.js';

export interface StudentCredentialAdapter {
  createStudentAccount?(input: {
    fullName: string;
    loginIdentifier: StudentLoginIdentifier;
    password: string;
  }): Promise<{ clerkUserId: string }>;
  createNoEmailStudentAccount?(input: {
    fullName: string;
    password: string;
    username: string;
  }): Promise<{ clerkUserId: string }>;
  deleteStudentAccount?(input: { clerkUserId: string }): Promise<void>;
  setPassword(input: { clerkUserId: string; password: string }): Promise<void>;
}

export interface ChildIconPhotoStorageAdapter {
  assertUploadedPhoto(photo: UploadedChildIconPhoto): Promise<void>;
}

export interface StudentSettingsRouterDeps {
  childIconPhotoStorage?: ChildIconPhotoStorageAdapter;
  credentialAdapter?: StudentCredentialAdapter;
}

const passwordInput = z.string().min(12).max(128);
const studentIdInput = z.object({ studentId: z.string().min(1) });
const childIconPhotoMetadataInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});
const childIconPhotoInput = childIconPhotoMetadataInput.extend({
  storageBucket: z.string().trim().min(1).max(120),
  storagePath: z.string().trim().min(1).max(512),
});
const prepareChildIconPhotoUploadInput = studentIdInput.extend({
  photo: childIconPhotoMetadataInput,
});
const updateChildIconPhotoInput = studentIdInput.extend({
  photo: childIconPhotoInput,
});
const requiredLoginHandleInput = z
  .string()
  .trim()
  .min(4, { message: 'login handle must be at least 4 characters' })
  .max(64, { message: 'login handle must be at most 64 characters' })
  .regex(/^[a-z0-9]+$/iu, {
    message: 'login handle can use letters and numbers only',
  });
const loginHandleInput = studentIdInput.extend({
  loginHandle: z.string().trim().min(1).max(80).nullable(),
});
const childLoginInput = studentIdInput.extend({
  loginHandle: requiredLoginHandleInput,
  password: passwordInput,
});
const adminCreateStudentLoginInput = studentIdInput.extend({
  loginIdentifier: z.string().trim().min(4).max(254),
  password: passwordInput,
});
const passwordControlInput = studentIdInput.extend({
  studentCanManagePassword: z.boolean(),
});
const usageLimitsInput = studentIdInput.extend({
  dailyUsageLimitMinutes: z.number().int().min(1).max(1_440).nullable().optional(),
  offLimitWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
});
const parentLockInput = studentIdInput.extend({
  locked: z.boolean(),
  reason: z.string().trim().max(500).nullable().optional(),
});
const shopBlockInput = studentIdInput.extend({
  blocked: z.boolean(),
});
const paceStatusVisibilityInput = studentIdInput.extend({
  paceStatusVisible: z.boolean(),
});
const childPasswordInput = studentIdInput.extend({
  password: passwordInput,
});
const myPasswordInput = z.object({
  password: passwordInput,
});
const adminReadinessFilterInput = z
  .object({
    ageBand: z.string().trim().min(1).max(80).optional(),
    status: z.enum(['All', 'Ready', 'Exceptions']).default('All'),
  })
  .optional();

const settingsSelect = Prisma.validator<Prisma.StudentPortalSettingsSelect>()({
  id: true,
  studentId: true,
  loginHandleEnc: true,
  loginHandleBidx: true,
  studentCanManagePassword: true,
  dailyUsageLimitMinutes: true,
  offLimitWeekdays: true,
  parentAccountLocked: true,
  parentLockReasonEnc: true,
  headAcademicLocked: true,
  headAcademicLockReasonEnc: true,
  parentMeritShopBlocked: true,
  paceStatusVisible: true,
  settingsUpdatedById: true,
  settingsUpdatedAt: true,
  parentLockUpdatedById: true,
  parentLockUpdatedAt: true,
  headLockUpdatedById: true,
  headLockUpdatedAt: true,
  shopBlockUpdatedById: true,
  shopBlockUpdatedAt: true,
  childIconPhotoUrl: true,
  childIconPhotoBucket: true,
  childIconPhotoPathEnc: true,
  childIconPhotoMimeType: true,
  childIconPhotoSizeBytes: true,
  childIconPhotoUpdatedById: true,
  childIconPhotoUpdatedAt: true,
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
type StudentLoginIdentifier =
  | { kind: 'Email'; value: string }
  | { kind: 'Username'; value: string };

const adminReadinessStudentSelect = Prisma.validator<Prisma.StudentSelect>()({
  id: true,
  userId: true,
  fullNameEnc: true,
  dobEnc: true,
  yearGroup: true,
  active: true,
  createdAt: true,
  portalSettings: { select: settingsSelect },
  guardians: { select: { userId: true } },
});

type AdminReadinessStudentRow = Prisma.StudentGetPayload<{
  select: typeof adminReadinessStudentSelect;
}>;

interface SettingsMutationData {
  loginHandleEnc?: string | null;
  loginHandleBidx?: string | null;
  studentCanManagePassword?: boolean;
  dailyUsageLimitMinutes?: number | null;
  offLimitWeekdays?: number[];
  parentAccountLocked?: boolean;
  parentLockReasonEnc?: string | null;
  headAcademicLocked?: boolean;
  headAcademicLockReasonEnc?: string | null;
  parentMeritShopBlocked?: boolean;
  paceStatusVisible?: boolean;
  settingsUpdatedById?: string;
  settingsUpdatedAt?: Date;
  parentLockUpdatedById?: string;
  parentLockUpdatedAt?: Date;
  headLockUpdatedById?: string;
  headLockUpdatedAt?: Date;
  shopBlockUpdatedById?: string;
  shopBlockUpdatedAt?: Date;
  childIconPhotoUrl?: string | null;
  childIconPhotoBucket?: string | null;
  childIconPhotoPathEnc?: string | null;
  childIconPhotoMimeType?: string | null;
  childIconPhotoSizeBytes?: number | null;
  childIconPhotoUpdatedById?: string;
  childIconPhotoUpdatedAt?: Date;
}

interface SettingsDefaults {
  loginHandleEnc: string | null;
  studentCanManagePassword: boolean;
  dailyUsageLimitMinutes: number | null;
  offLimitWeekdays: number[];
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
  paceStatusVisible: boolean;
  childIconPhotoUrl: string | null;
}

const MAX_CHILD_ICON_PHOTO_BYTES = 5 * 1024 * 1024;
const CHILD_ICON_PHOTO_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp'] as const;

type AllowedChildIconPhotoExtension = (typeof CHILD_ICON_PHOTO_EXTENSIONS)[number];

const childIconPhotoMimeByExtension = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
} as const satisfies Record<AllowedChildIconPhotoExtension, string>;

export function createDefaultStudentCredentialAdapter(): StudentCredentialAdapter {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'CLERK_SECRET_KEY is required to create the default student credential adapter',
    );
  }
  const client = createClerkClient({ secretKey });

  return {
    async createStudentAccount(input) {
      const [firstName, ...lastNameParts] = input.fullName.trim().split(/\s+/u);
      const lastName = lastNameParts.join(' ').trim();
      const nameProps = {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      };
      const identifierProps =
        input.loginIdentifier.kind === 'Email'
          ? { emailAddress: [input.loginIdentifier.value] }
          : { username: input.loginIdentifier.value };
      const createUserInput: Parameters<ClerkClient['users']['createUser']>[0] = {
        ...nameProps,
        ...identifierProps,
        password: input.password,
        publicMetadata: { role: 'Student', tags: [] },
        skipLegalChecks: true,
      };
      const user = await client.users.createUser(createUserInput);
      return { clerkUserId: user.id };
    },
    async createNoEmailStudentAccount(input) {
      const [firstName, ...lastNameParts] = input.fullName.trim().split(/\s+/u);
      const lastName = lastNameParts.join(' ').trim();
      const nameProps = {
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      };
      const createUserInput: Parameters<ClerkClient['users']['createUser']>[0] = {
        ...nameProps,
        username: input.username,
        password: input.password,
        publicMetadata: { role: 'Student', tags: [] },
        skipLegalChecks: true,
      };
      const user = await client.users.createUser(createUserInput);
      return { clerkUserId: user.id };
    },
    async setPassword(input) {
      await client.users.updateUser(input.clerkUserId, {
        password: input.password,
        signOutOfOtherSessions: true,
      });
    },
    async deleteStudentAccount(input) {
      await client.users.deleteUser(input.clerkUserId);
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

function normaliseLoginHandle(value: string): string {
  return value.trim().toLowerCase();
}

function normaliseAdminLoginIdentifier(value: string): StudentLoginIdentifier {
  const normalised = normaliseLoginHandle(value);
  if (normalised.includes('@')) {
    const result = z.string().email().safeParse(normalised);
    if (!result.success) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'email address is invalid' });
    }
    return { kind: 'Email', value: result.data };
  }

  const username = requiredLoginHandleInput.safeParse(normalised);
  if (!username.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'login handle can use letters and numbers only',
    });
  }
  return { kind: 'Username', value: username.data };
}

function usernameLoginIdentifier(value: string): StudentLoginIdentifier {
  return { kind: 'Username', value: normaliseLoginHandle(value) };
}

type StudentCredentialOperation = 'createLogin' | 'setPassword';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numericField(record: Record<string, unknown>, field: string): number | null {
  const value = record[field];
  return typeof value === 'number' ? value : null;
}

function collectErrorMessages(value: unknown, messages: string[]): void {
  if (typeof value === 'string' && value.trim()) {
    messages.push(value.trim());
    return;
  }

  if (value instanceof Error && value.message.trim()) {
    messages.push(value.message.trim());
  }

  if (!isRecord(value)) return;

  for (const field of ['message', 'longMessage', 'code']) {
    const entry = value[field];
    if (typeof entry === 'string' && entry.trim()) {
      messages.push(entry.trim());
    }
  }

  const errors = value['errors'];
  if (Array.isArray(errors)) {
    for (const error of errors) {
      collectErrorMessages(error, messages);
    }
  }

  const meta = value['meta'];
  if (isRecord(meta)) {
    for (const field of ['paramName', 'parameterName', 'field', 'name']) {
      const entry = meta[field];
      if (typeof entry === 'string' && entry.trim()) {
        messages.push(entry.trim());
      }
    }
  }
}

function clerkStatusCode(error: unknown): number | null {
  if (!isRecord(error)) return null;
  return numericField(error, 'status') ?? numericField(error, 'statusCode');
}

function mappedStudentCredentialError(
  error: unknown,
  operation: StudentCredentialOperation,
): TRPCError | null {
  const messages: string[] = [];
  collectErrorMessages(error, messages);
  const normalised = messages.join(' ').toLowerCase();
  const statusCode = clerkStatusCode(error);

  if (![400, 422].includes(statusCode ?? 0) && !normalised.includes('unprocessable entity')) {
    return null;
  }

  let message: string;
  if (
    normalised.includes('identifier_exists') ||
    normalised.includes('already exists') ||
    normalised.includes('already in use') ||
    normalised.includes('taken')
  ) {
    message = 'login handle is already in use';
  } else if (normalised.includes('password')) {
    message = 'password does not meet the sign-in requirements';
  } else if (normalised.includes('legal') || normalised.includes('consent')) {
    message = 'student login could not be created because legal consent is required';
  } else if (
    normalised.includes('email') &&
    (normalised.includes('missing') ||
      normalised.includes('required') ||
      normalised.includes('not enabled') ||
      normalised.includes('invalid'))
  ) {
    message = 'student login requires username sign-in to be enabled in Clerk';
  } else if (
    (normalised.includes('username') || normalised.includes('identifier')) &&
    (normalised.includes('invalid') || normalised.includes('format'))
  ) {
    message = 'login handle was rejected by the sign-in provider';
  } else if (
    (normalised.includes('username') || normalised.includes('identifier')) &&
    (normalised.includes('disabled') ||
      normalised.includes('not enabled') ||
      normalised.includes('not allowed') ||
      normalised.includes('unsupported'))
  ) {
    message = 'student username login is not enabled; contact an administrator';
  } else {
    message =
      operation === 'createLogin'
        ? 'student login could not be created; check the login handle and password'
        : 'password does not meet the sign-in requirements';
  }

  return new TRPCError({ code: 'BAD_REQUEST', message, cause: error });
}

async function createStudentCredentialAccount(
  adapter: StudentCredentialAdapter,
  input: {
    fullName: string;
    loginIdentifier: StudentLoginIdentifier;
    password: string;
  },
): Promise<{ clerkUserId: string }> {
  try {
    if (adapter.createStudentAccount) {
      return await adapter.createStudentAccount(input);
    }
    if (input.loginIdentifier.kind === 'Email') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'student email login is not enabled; contact an administrator',
      });
    }
    if (!adapter.createNoEmailStudentAccount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'student username login is not enabled; contact an administrator',
      });
    }
    return await adapter.createNoEmailStudentAccount({
      fullName: input.fullName,
      password: input.password,
      username: input.loginIdentifier.value,
    });
  } catch (error) {
    throw mappedStudentCredentialError(error, 'createLogin') ?? error;
  }
}

async function setStudentCredentialPassword(
  adapter: StudentCredentialAdapter,
  input: Parameters<StudentCredentialAdapter['setPassword']>[0],
): Promise<void> {
  try {
    await adapter.setPassword(input);
  } catch (error) {
    throw mappedStudentCredentialError(error, 'setPassword') ?? error;
  }
}

async function cleanupCreatedStudentCredentialAccount(
  adapter: StudentCredentialAdapter,
  input: { clerkUserId: string },
): Promise<void> {
  await adapter.deleteStudentAccount?.(input);
}

function childIconPhotoBucket(): string {
  return process.env['SUPABASE_CHILD_ICON_PHOTOS_BUCKET'] ?? 'child-icon-photos';
}

function safeOriginalFileName(value: string): string {
  const fileName = value.replaceAll('\\', '/').split('/').pop()?.replace(/\0/gu, '').trim();
  return fileName?.replace(/^\.+/u, '').trim() || 'child-icon-photo';
}

function childIconPhotoExtension(fileName: string): AllowedChildIconPhotoExtension | null {
  const lowerName = fileName.toLowerCase();
  const extension = CHILD_ICON_PHOTO_EXTENSIONS.find((candidate) => lowerName.endsWith(candidate));
  return extension ?? null;
}

function safeStorageFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/-+/gu, '-');
}

function publicStorageObjectUrl(bucket: string, path: string): string {
  const url =
    process.env['SUPABASE_URL']?.trim() ?? process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  if (!url) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'child icon photo storage is not configured',
    });
  }

  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return new URL(
    `/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`,
    url.replace(/\/+$/u, ''),
  ).toString();
}

function validateChildIconPhotoMetadata(
  input: z.infer<typeof childIconPhotoMetadataInput>,
): Pick<UploadedChildIconPhoto, 'fileName' | 'mimeType' | 'sizeBytes'> {
  const fileName = safeOriginalFileName(input.fileName);
  const extension = childIconPhotoExtension(fileName);
  if (!extension) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'unsupported child icon photo type' });
  }

  const mimeType = input.mimeType.toLowerCase();
  if (mimeType !== childIconPhotoMimeByExtension[extension]) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'child icon photo type mismatch' });
  }
  if (input.sizeBytes > MAX_CHILD_ICON_PHOTO_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'child icon photo is too large' });
  }

  return {
    fileName,
    mimeType,
    sizeBytes: input.sizeBytes,
  };
}

function storagePathForChildIconPhoto(userId: string, studentId: string, fileName: string): string {
  return `student-icons/${userId}/${studentId}/${randomUUID()}-${safeStorageFileName(fileName)}`;
}

function assertChildIconPhotoStorageTarget(
  input: Pick<UploadedChildIconPhoto, 'storageBucket' | 'storagePath'>,
  userId: string,
  studentId: string,
): void {
  if (input.storageBucket !== childIconPhotoBucket()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid child icon photo bucket' });
  }
  if (
    !input.storagePath.startsWith(`student-icons/${userId}/${studentId}/`) ||
    input.storagePath.includes('..') ||
    input.storagePath.startsWith('/') ||
    input.storagePath.endsWith('/')
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid child icon photo path' });
  }
}

function prepareChildIconPhoto(
  input: z.infer<typeof childIconPhotoMetadataInput>,
  userId: string,
  studentId: string,
): UploadedChildIconPhoto {
  const metadata = validateChildIconPhotoMetadata(input);
  return {
    ...metadata,
    storageBucket: childIconPhotoBucket(),
    storagePath: storagePathForChildIconPhoto(userId, studentId, metadata.fileName),
  };
}

function validateUploadedChildIconPhoto(
  input: z.infer<typeof childIconPhotoInput>,
  userId: string,
  studentId: string,
): UploadedChildIconPhoto {
  const metadata = validateChildIconPhotoMetadata(input);
  assertChildIconPhotoStorageTarget(input, userId, studentId);
  return {
    ...metadata,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
  };
}

function defaultsFor(settings: SettingsRow | null): SettingsDefaults {
  return {
    loginHandleEnc: settings?.loginHandleEnc ?? null,
    studentCanManagePassword: settings?.studentCanManagePassword ?? false,
    dailyUsageLimitMinutes: settings?.dailyUsageLimitMinutes ?? null,
    offLimitWeekdays: settings?.offLimitWeekdays ?? [],
    parentAccountLocked: settings?.parentAccountLocked ?? false,
    parentLockReasonEnc: settings?.parentLockReasonEnc ?? null,
    headAcademicLocked: settings?.headAcademicLocked ?? false,
    headAcademicLockReasonEnc: settings?.headAcademicLockReasonEnc ?? null,
    parentMeritShopBlocked: settings?.parentMeritShopBlocked ?? false,
    paceStatusVisible: settings?.paceStatusVisible ?? true,
    childIconPhotoUrl: settings?.childIconPhotoUrl ?? null,
  };
}

function countMap(
  rows: readonly { studentId: string; _count: { _all: number } }[],
): Map<string, number> {
  return new Map(rows.map((row) => [row.studentId, row._count._all]));
}

function sumMap(
  rows: readonly { studentId: string; _sum: { delta?: number | null } }[],
): Map<string, number> {
  return new Map(rows.map((row) => [row.studentId, row._sum.delta ?? 0]));
}

function attendanceMap(
  rows: readonly { studentId: string; status: string; _count: { _all: number } }[],
): Map<string, { absent: number; late: number; present: number; recorded: number }> {
  const map = new Map<
    string,
    { absent: number; late: number; present: number; recorded: number }
  >();
  for (const row of rows) {
    const current = map.get(row.studentId) ?? { absent: 0, late: 0, present: 0, recorded: 0 };
    current.recorded += row._count._all;
    if (row.status === 'Present') current.present += row._count._all;
    if (row.status === 'Late') current.late += row._count._all;
    if (row.status === 'Absent') current.absent += row._count._all;
    map.set(row.studentId, current);
  }
  return map;
}

function mapAdminReadinessStudent(
  ctx: AppContext,
  input: {
    attendance: { absent: number; late: number; present: number; recorded: number };
    clubSignupCount: number;
    dayUsageMinutes: number;
    meritsTotal: number;
    paceSubjects: Array<{ currentPaceNumber: number; subjectName: string }>;
    student: AdminReadinessStudentRow;
  },
) {
  const fullName = decryptRequired(ctx, input.student.fullNameEnc, 'student PII');
  const dob = decryptRequired(ctx, input.student.dobEnc, 'student PII');
  const state = defaultsFor(input.student.portalSettings);
  const effectiveLock = effectiveStudentPortalLock(state);
  const currentWeekday = new Date().getUTCDay();
  const offLimitsToday = state.offLimitWeekdays.includes(currentWeekday);
  const hasUsageLimits = Boolean(state.dailyUsageLimitMinutes || state.offLimitWeekdays.length > 0);
  const usageOverLimit =
    (state.dailyUsageLimitMinutes !== null &&
      input.dayUsageMinutes >= state.dailyUsageLimitMinutes) ||
    offLimitsToday;
  const readinessIssues: string[] = [];

  if (!input.student.userId) readinessIssues.push('Student account not linked');
  if (input.student.guardians.length === 0) readinessIssues.push('No parent/carer link');
  if (effectiveLock.locked) {
    readinessIssues.push(
      effectiveLock.primarySource === 'HeadAcademic' ? 'Academic lock' : 'Parent lock',
    );
  }
  if (state.parentMeritShopBlocked) readinessIssues.push('Merit shop blocked');
  if (usageOverLimit) {
    readinessIssues.push(offLimitsToday ? 'Off limits today' : 'Usage limit reached');
  }

  return {
    studentId: input.student.id,
    fullName,
    yearGroup: input.student.yearGroup,
    accountLinked: Boolean(input.student.userId),
    active: input.student.active,
    guardianCount: input.student.guardians.length,
    parentControlAllowed: canParentControlStudent({ dateOfBirth: dob }),
    lock: effectiveLock,
    parentMeritShopBlocked: state.parentMeritShopBlocked,
    usage: {
      hasLimits: hasUsageLimits,
      overLimit: usageOverLimit,
      dailyUsageLimitMinutes: state.dailyUsageLimitMinutes,
      offLimitWeekdays: state.offLimitWeekdays,
      dayMinutes: input.dayUsageMinutes,
    },
    meritsTotal: input.meritsTotal,
    attendance: {
      ...input.attendance,
      attended: input.attendance.present + input.attendance.late,
      attendanceRate: attendanceRate({
        late: input.attendance.late,
        present: input.attendance.present,
        total: input.attendance.recorded,
      }),
    },
    paceSubjects: input.paceSubjects,
    activeClubSignupCount: input.clubSignupCount,
    readinessIssues,
    ready: readinessIssues.length === 0,
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
    accountLinked: Boolean(student.userId),
    parentControlAllowed: canParentControlStudent({ dateOfBirth: dob }),
    loginHandle: state.loginHandleEnc ? ctx.db.$enc.decrypt(state.loginHandleEnc) : null,
    studentCanManagePassword: state.studentCanManagePassword,
    dailyUsageLimitMinutes: state.dailyUsageLimitMinutes,
    offLimitWeekdays: state.offLimitWeekdays,
    parentAccountLocked: state.parentAccountLocked,
    parentLockReason: state.parentLockReasonEnc
      ? ctx.db.$enc.decrypt(state.parentLockReasonEnc)
      : null,
    headAcademicLocked: state.headAcademicLocked,
    headAcademicLockReason: state.headAcademicLockReasonEnc
      ? ctx.db.$enc.decrypt(state.headAcademicLockReasonEnc)
      : null,
    parentMeritShopBlocked: state.parentMeritShopBlocked,
    paceStatusVisible: state.paceStatusVisible,
    childIconPhotoUrl: state.childIconPhotoUrl,
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
    dailyUsageLimitMinutes: state.dailyUsageLimitMinutes,
    offLimitWeekdays: state.offLimitWeekdays,
    parentMeritShopBlocked: state.parentMeritShopBlocked,
    paceStatusVisible: state.paceStatusVisible,
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

async function loadActiveStudentSettings(
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
  return ctx.withRls((tx) =>
    tx.studentPortalSettings.upsert({
      where: { studentId },
      create: {
        studentId,
        ...data,
      },
      update: data,
      select: settingsSelect,
    }),
  );
}

async function assertUniqueStudentLoginIdentifier(
  ctx: AuthedContext,
  input: { loginIdentifier: StudentLoginIdentifier; studentId: string },
): Promise<void> {
  const loginHandleBidx = ctx.db.$enc.blindIndex(input.loginIdentifier.value);
  const existingHandle = await ctx.db.studentPortalSettings.findUnique({
    where: { loginHandleBidx },
    select: { studentId: true },
  });
  if (existingHandle && existingHandle.studentId !== input.studentId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'login handle is already in use',
    });
  }

  if (input.loginIdentifier.kind !== 'Email') return;

  const existingEmailUser = await ctx.db.user.findUnique({
    where: { emailBidx: loginHandleBidx },
    select: { id: true },
  });
  if (existingEmailUser) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'email address is already in use',
    });
  }
}

async function provisionStudentLogin(
  ctx: AuthedContext,
  input: {
    credentials: StudentCredentialAdapter;
    loginIdentifier: StudentLoginIdentifier;
    password: string;
    source: string;
    student: StudentSettingsRow;
  },
) {
  if (input.student.userId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'student account is already linked to a login user',
    });
  }

  await assertUniqueStudentLoginIdentifier(ctx, {
    loginIdentifier: input.loginIdentifier,
    studentId: input.student.id,
  });

  const fullName = decryptRequired(ctx, input.student.fullNameEnc, 'student PII');
  const createdAccount = await createStudentCredentialAccount(input.credentials, {
    fullName,
    loginIdentifier: input.loginIdentifier,
    password: input.password,
  });
  const now = new Date();
  const loginHandleBidx = ctx.db.$enc.blindIndex(input.loginIdentifier.value);
  const emailEnc =
    input.loginIdentifier.kind === 'Email'
      ? ctx.db.$enc.encrypt(input.loginIdentifier.value)
      : null;
  const emailBidx = input.loginIdentifier.kind === 'Email' ? loginHandleBidx : null;
  let result: { settings: SettingsRow; userId: string };

  try {
    result = await ctx.withRls(async (tx) => {
      const user = await tx.user.upsert({
        where: { clerkId: createdAccount.clerkUserId },
        create: {
          clerkId: createdAccount.clerkUserId,
          role: 'Student',
          tags: [],
          fullNameEnc: input.student.fullNameEnc,
          emailEnc,
          emailBidx,
          phoneEnc: null,
          active: true,
        },
        update: {
          role: 'Student',
          tags: [],
          fullNameEnc: input.student.fullNameEnc,
          emailEnc,
          emailBidx,
          phoneEnc: null,
          active: true,
        },
        select: { id: true },
      });
      await tx.student.update({
        where: { id: input.student.id },
        data: { userId: user.id },
        select: { id: true },
      });
      const settings = await tx.studentPortalSettings.upsert({
        where: { studentId: input.student.id },
        create: {
          studentId: input.student.id,
          loginHandleEnc: ctx.db.$enc.encrypt(input.loginIdentifier.value),
          loginHandleBidx,
          settingsUpdatedById: ctx.user.id,
          settingsUpdatedAt: now,
        },
        update: {
          loginHandleEnc: ctx.db.$enc.encrypt(input.loginIdentifier.value),
          loginHandleBidx,
          settingsUpdatedById: ctx.user.id,
          settingsUpdatedAt: now,
        },
        select: settingsSelect,
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'User',
          entityId: user.id,
          meta: { role: 'Student', source: input.source },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'Student',
          entityId: input.student.id,
          meta: { fields: ['userId'], source: input.source },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'StudentPortalSettings',
          entityId: input.student.id,
          meta: {
            fields: ['loginHandle', 'userId'],
            source: input.source,
          },
        },
      });
      return { settings, userId: user.id };
    });
  } catch (error) {
    try {
      await cleanupCreatedStudentCredentialAccount(input.credentials, {
        clerkUserId: createdAccount.clerkUserId,
      });
    } catch (cleanupError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'student login could not be linked and the provider account could not be rolled back; contact an administrator',
        cause: cleanupError,
      });
    }
    throw error;
  }

  return mapParentSettings(ctx, { ...input.student, userId: result.userId }, result.settings);
}

export function createStudentSettingsRouter(deps: StudentSettingsRouterDeps = {}) {
  const credentialAdapter = () => deps.credentialAdapter ?? createDefaultStudentCredentialAdapter();
  const childIconPhotoStorage = deps.childIconPhotoStorage ?? {
    assertUploadedPhoto: assertUploadedChildIconPhoto,
  };
  const linkedChildGuardianProcedure = authedProcedure.use(({ ctx, next }) => {
    if (!canUseLinkedChildStudentSettingsAccess(ctx.user)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'student settings require linked-child guardian access',
      });
    }
    return next();
  });

  return router({
    adminReadinessReport: adminOperationsProcedure
      .input(adminReadinessFilterInput)
      .query(async ({ ctx, input }) => {
        const now = new Date();
        const ageBand = input?.ageBand;
        const students = await ctx.db.student.findMany({
          where: { active: true, ...(ageBand ? { yearGroup: ageBand } : {}) },
          select: adminReadinessStudentSelect,
          orderBy: { createdAt: 'desc' },
        });
        const studentIds = students.map((student) => student.id);

        const [meritRows, attendanceRows, paceSubjects, clubSignupRows, dayUsageRows] =
          await Promise.all([
            studentIds.length > 0
              ? ctx.db.meritLedger.groupBy({
                  by: ['studentId'],
                  where: { studentId: { in: studentIds } },
                  _sum: { delta: true },
                })
              : Promise.resolve([]),
            studentIds.length > 0
              ? ctx.db.attendance.groupBy({
                  by: ['studentId', 'status'],
                  where: { studentId: { in: studentIds } },
                  _count: { _all: true },
                })
              : Promise.resolve([]),
            studentIds.length > 0
              ? ctx.db.studentSubject.findMany({
                  where: { studentId: { in: studentIds } },
                  select: {
                    studentId: true,
                    currentPaceNumber: true,
                    subject: { select: { name: true } },
                  },
                  orderBy: [{ studentId: 'asc' }, { subject: { name: 'asc' } }],
                })
              : Promise.resolve([]),
            studentIds.length > 0
              ? ctx.db.clubSignup.groupBy({
                  by: ['studentId'],
                  where: { studentId: { in: studentIds }, status: 'Active' },
                  _count: { _all: true },
                })
              : Promise.resolve([]),
            studentIds.length > 0
              ? ctx.db.studentPortalUsageMinute.groupBy({
                  by: ['studentId'],
                  where: {
                    studentId: { in: studentIds },
                    minuteStartedAt: { gte: startOfUtcDay(now) },
                  },
                  _count: { _all: true },
                })
              : Promise.resolve([]),
          ]);

        const meritsByStudent = sumMap(meritRows);
        const attendanceByStudent = attendanceMap(attendanceRows);
        const clubSignupCountByStudent = countMap(clubSignupRows);
        const dayUsageByStudent = countMap(dayUsageRows);
        const paceByStudent = new Map<
          string,
          Array<{ currentPaceNumber: number; subjectName: string }>
        >();
        for (const row of paceSubjects) {
          const current = paceByStudent.get(row.studentId) ?? [];
          current.push({
            currentPaceNumber: row.currentPaceNumber,
            subjectName: row.subject.name,
          });
          paceByStudent.set(row.studentId, current);
        }

        const rows = students.map((student) =>
          mapAdminReadinessStudent(ctx, {
            attendance: attendanceByStudent.get(student.id) ?? {
              absent: 0,
              late: 0,
              present: 0,
              recorded: 0,
            },
            clubSignupCount: clubSignupCountByStudent.get(student.id) ?? 0,
            dayUsageMinutes: dayUsageByStudent.get(student.id) ?? 0,
            meritsTotal: meritsByStudent.get(student.id) ?? 0,
            paceSubjects: paceByStudent.get(student.id) ?? [],
            student,
          }),
        );
        const filteredRows = rows.filter((row) => {
          if (input?.status === 'Ready') return row.ready;
          if (input?.status === 'Exceptions') return !row.ready;
          return true;
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'DecryptPii',
            entity: 'StudentPortalReadinessReport',
            meta: {
              source: 'studentSettings.adminReadinessReport',
              status: input?.status ?? 'All',
              ageBand: ageBand ?? null,
              count: filteredRows.length,
            },
          },
        });

        return {
          summary: {
            activeStudents: students.length,
            linkedAccounts: rows.filter((row) => row.accountLinked).length,
            readyAccounts: rows.filter((row) => row.ready).length,
            exceptionAccounts: rows.filter((row) => !row.ready).length,
            lockedAccounts: rows.filter((row) => row.lock.locked).length,
            shopBlockedAccounts: rows.filter((row) => row.parentMeritShopBlocked).length,
            usageLimitedAccounts: rows.filter((row) => row.usage.hasLimits).length,
          },
          rows: filteredRows,
        };
      }),

    listLinkedChildren: linkedChildGuardianProcedure.query(async ({ ctx }) => {
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

    getChildSettings: linkedChildGuardianProcedure
      .input(studentIdInput)
      .query(async ({ ctx, input }) => {
        const student = await loadLinkedStudent(ctx, input.studentId);
        return mapParentSettings(ctx, student);
      }),

    prepareChildIconPhotoUpload: linkedChildGuardianProcedure
      .input(prepareChildIconPhotoUploadInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadParentControlledStudent(ctx, input.studentId);
        const photo = prepareChildIconPhoto(input.photo, ctx.user.id, student.id);
        return {
          ...photo,
          publicUrl: publicStorageObjectUrl(photo.storageBucket, photo.storagePath),
        };
      }),

    updateChildIconPhoto: linkedChildGuardianProcedure
      .input(updateChildIconPhotoInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadParentControlledStudent(ctx, input.studentId);
        const photo = validateUploadedChildIconPhoto(input.photo, ctx.user.id, student.id);
        await childIconPhotoStorage.assertUploadedPhoto(photo);
        const now = new Date();
        const settings = await upsertSettings(ctx, student.id, {
          childIconPhotoUrl: publicStorageObjectUrl(photo.storageBucket, photo.storagePath),
          childIconPhotoBucket: photo.storageBucket,
          childIconPhotoPathEnc: ctx.db.$enc.encrypt(photo.storagePath),
          childIconPhotoMimeType: photo.mimeType,
          childIconPhotoSizeBytes: photo.sizeBytes,
          childIconPhotoUpdatedById: ctx.user.id,
          childIconPhotoUpdatedAt: now,
          settingsUpdatedById: ctx.user.id,
          settingsUpdatedAt: now,
        });
        await auditSettingsUpdate(ctx, {
          studentId: student.id,
          source: 'studentSettings.updateChildIconPhoto',
          fields: ['childIconPhoto'],
        });
        return mapParentSettings(ctx, student, settings);
      }),

    setLoginHandle: linkedChildGuardianProcedure
      .input(loginHandleInput)
      .mutation(async ({ ctx, input }) => {
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

    createChildLogin: linkedChildGuardianProcedure
      .input(childLoginInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadParentControlledStudent(ctx, input.studentId);
        return provisionStudentLogin(ctx, {
          credentials: credentialAdapter(),
          loginIdentifier: usernameLoginIdentifier(input.loginHandle),
          password: input.password,
          source: 'studentSettings.createChildLogin',
          student,
        });
      }),

    adminCreateStudentLogin: adminOperationsProcedure
      .input(adminCreateStudentLoginInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadActiveStudentSettings(ctx, input.studentId);
        return provisionStudentLogin(ctx, {
          credentials: credentialAdapter(),
          loginIdentifier: normaliseAdminLoginIdentifier(input.loginIdentifier),
          password: input.password,
          source: 'studentSettings.adminCreateStudentLogin',
          student,
        });
      }),

    setChildPassword: linkedChildGuardianProcedure
      .input(childPasswordInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadParentControlledStudent(ctx, input.studentId);
        await setStudentCredentialPassword(credentialAdapter(), {
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

    setPasswordControl: linkedChildGuardianProcedure
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

    setUsageLimits: linkedChildGuardianProcedure
      .input(usageLimitsInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadParentControlledStudent(ctx, input.studentId);
        const limits = validateStudentPortalUsageLimits({
          dailyUsageLimitMinutes: input.dailyUsageLimitMinutes ?? null,
          offLimitWeekdays: input.offLimitWeekdays ?? [],
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
          fields: ['dailyUsageLimitMinutes', 'offLimitWeekdays'],
        });
        return mapParentSettings(ctx, student, settings);
      }),

    setParentLock: linkedChildGuardianProcedure
      .input(parentLockInput)
      .mutation(async ({ ctx, input }) => {
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

    setMeritShopBlock: linkedChildGuardianProcedure
      .input(shopBlockInput)
      .mutation(async ({ ctx, input }) => {
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

    setPaceStatusVisibility: linkedChildGuardianProcedure
      .input(paceStatusVisibilityInput)
      .mutation(async ({ ctx, input }) => {
        const student = await loadParentControlledStudent(ctx, input.studentId);
        const now = new Date();
        const settings = await upsertSettings(ctx, student.id, {
          paceStatusVisible: input.paceStatusVisible,
          settingsUpdatedById: ctx.user.id,
          settingsUpdatedAt: now,
        });
        await auditSettingsUpdate(ctx, {
          studentId: student.id,
          source: 'studentSettings.setPaceStatusVisibility',
          fields: ['paceStatusVisible'],
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
        await assertStudentPortalAccess(ctx, {
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
        await setStudentCredentialPassword(credentialAdapter(), {
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
        const student = await loadActiveStudentSettings(ctx, input.studentId);
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
