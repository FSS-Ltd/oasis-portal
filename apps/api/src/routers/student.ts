import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  academicYearStart,
  attendanceRate as calculateAttendanceRate,
  canUseAdminOperations,
  deriveEnglandWalesSchoolYear,
  displaySchoolYearLabel,
  resolveAgeBand,
  type PermissionTag,
  standardSchoolYearSchema,
} from '@oasis/domain';
import {
  createDefaultClerkInvitationClient,
  type ClerkInvitationClient,
  type ClerkInvitationResult,
} from '../lib/clerk.js';
import { loadDailyYearBandScope, studentWhereForDailyScope } from '../lib/daily-year-band-scope.js';
import { canUseStudentAcademicScreens } from '../lib/student-academic-screens.js';
import { buildUserInviteEmail, createResendEmailClient, type EmailClient } from '../lib/email.js';
import {
  assertStudentPortalAccess,
  loadAllowedStudentPortalUsageStatus,
  recordStudentPortalUsageHeartbeat,
} from '../lib/student-portal-access.js';
import { addUtcDays, startOfUtcDay } from '../lib/utc-date.js';
import { loadCurrentFaithCornerContent } from '../services/faith-corner.js';
import { loadStudentNotificationPreview } from '../services/student-notifications.js';
import type { AppContext } from '../context.js';
import { adminOperationsProcedure, roleProcedure, router } from '../trpc.js';
import { deleteArchivedStudent } from '../students/delete-archived-student.js';

const STUDENT_READ_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'TechnicalSupport',
  'ClubsAdmin',
  'Supervisor',
] as const;

const DEFAULT_CURRENT_PACE_NUMBER = 1001;
const DASHBOARD_ATTENDANCE_DAYS = 30;
const STUDENT_WALLET_HISTORY_LIMIT = 30;
const POST_SIGN_IN_PATH = '/post-sign-in';
const STUDENT_INVITATION_TAGS: PermissionTag[] = [];

const MERIT_ACCOUNTS = [
  'Spend',
  'Saving',
  'Investment',
  'ShopReserved',
  'TithePaid',
  'Given',
] as const;

export interface MeritBalances {
  Spend: number;
  Saving: number;
  Investment: number;
  ShopReserved: number;
  TithePaid: number;
  Given: number;
}

export interface AttendanceSummary {
  total: number;
  Present: number;
  Late: number;
  Absent: number;
}

const studentInclude = Prisma.validator<Prisma.StudentInclude>()({
  subjects: {
    include: { subject: true },
  },
  registrationProfile: {
    select: {
      registration: {
        select: { homeAddressEnc: true },
      },
    },
  },
});

const createInput = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  dob: z.coerce.date(),
  yearGroup: standardSchoolYearSchema.optional(),
  enrolmentDate: z.coerce.date(),
  address: z.string().trim().min(1).optional(),
});

const updateInput = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(1).optional(),
  dob: z.coerce.date().optional(),
  yearGroup: standardSchoolYearSchema.optional(),
  enrolmentDate: z.coerce.date().optional(),
  address: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional(),
});

const listInput = z
  .object({
    search: z.string().trim().min(1).optional(),
    includeInactive: z.boolean().optional(),
    date: z.coerce.date().optional(),
  })
  .optional();

const byIdInput = z.object({ id: z.string().min(1) });
const deleteArchivedInput = byIdInput;

const assignSubjectInput = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  currentPaceNumber: z.number().int().positive().optional(),
});

const setCurrentPaceInput = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  currentPaceNumber: z.number().int().positive(),
});

const portalHeartbeatInput = z
  .object({
    sessionKey: z.string().trim().min(1).max(128).optional(),
  })
  .optional();

const unassignSubjectInput = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
});

type StudentWithSubjects = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

type StudentCreateEmailStatus = 'Sent' | 'Failed';
type StudentInvitationWithUrl = ClerkInvitationResult & { url: string };

export interface StudentRouterDeps {
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

function firstNameFrom(fullName: string): string {
  return fullName.trim().split(/\s+/u).find(Boolean) ?? 'Student';
}

function studentIconInitials(firstName: string): string {
  return firstName.slice(0, 2).toUpperCase();
}

function emptyMeritBalances(): MeritBalances {
  return {
    Spend: 0,
    Saving: 0,
    Investment: 0,
    ShopReserved: 0,
    TithePaid: 0,
    Given: 0,
  };
}

function emptyAttendanceSummary(): AttendanceSummary {
  return {
    total: 0,
    Present: 0,
    Late: 0,
    Absent: 0,
  };
}

function attendanceRate(summary: AttendanceSummary): number | null {
  return calculateAttendanceRate({
    late: summary.Late,
    present: summary.Present,
    total: summary.total,
  });
}

function totalMeritBalance(balances: MeritBalances): number {
  return balances.Spend + balances.Saving + balances.Investment + balances.ShopReserved;
}

function decryptStudent(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  student: StudentWithSubjects,
) {
  const fullName = ctx.db.$enc.decrypt(student.fullNameEnc);
  const dob = ctx.db.$enc.decrypt(student.dobEnc);
  if (!fullName || !dob) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student PII decrypt failed' });
  }

  return {
    id: student.id,
    userId: student.userId,
    fullName,
    dob,
    address:
      ctx.db.$enc.decrypt(student.addressEnc) ??
      ctx.db.$enc.decrypt(student.registrationProfile?.registration.homeAddressEnc),
    yearGroup: student.yearGroup,
    enrolmentDate: student.enrolmentDate,
    active: student.active,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    subjects: student.subjects.map((assignment) => ({
      subjectId: assignment.subjectId,
      code: assignment.subject.code,
      name: assignment.subject.name,
      currentPaceNumber: assignment.currentPaceNumber,
    })),
  };
}

async function auditDecryptPii(
  ctx: {
    db: { auditLog: { create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown> } };
    user: { id: string };
  },
  meta: {
    count: number;
    source: 'student.list' | 'student.byId' | 'student.me' | 'student.dashboard';
  },
  entityId?: string,
) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    userId: ctx.user.id,
    action: 'DecryptPii',
    entity: 'Student',
    meta,
  };
  if (entityId !== undefined) data.entityId = entityId;

  await ctx.db.auditLog.create({
    data,
  });
}

async function loadOwnActiveStudent(ctx: {
  db: AppContext['db'];
  user: NonNullable<AppContext['user']>;
}): Promise<{ id: string; active: boolean; userId: string | null }> {
  const student = await ctx.db.student.findUnique({
    where: { userId: ctx.user.id },
    select: { id: true, active: true, userId: true },
  });

  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }

  return student;
}

async function loadMeritBalances(ctx: AppContext, studentId: string): Promise<MeritBalances> {
  const rows = await Promise.all(
    MERIT_ACCOUNTS.map(async (account) => ({
      account,
      total: (
        await ctx.db.meritLedger.aggregate({
          where: { studentId, account },
          _sum: { delta: true },
        })
      )._sum.delta,
    })),
  );
  return rows.reduce<MeritBalances>((balances, row) => {
    balances[row.account] = row.total ?? 0;
    return balances;
  }, emptyMeritBalances());
}

async function loadPaceDashboard(ctx: AppContext, studentId: string) {
  const yearStart = academicYearStart();
  const [assignments, policy, completedPaceRecords] = await Promise.all([
    ctx.db.studentSubject.findMany({
      where: { studentId, subject: { active: true } },
      include: { subject: true },
      orderBy: { subject: { code: 'asc' } },
    }),
    ctx.db.pacePolicy.findUnique({ where: { id: 'default' }, select: { passThreshold: true } }),
    ctx.db.paceRecord.findMany({
      where: {
        studentId,
        completedAt: { gte: yearStart },
        paceTestScore: { not: null },
      },
      select: { paceTestScore: true },
    }),
  ]);

  const passThreshold = policy?.passThreshold ?? 80;
  const completedPaceCount = completedPaceRecords.filter(
    (r) => r.paceTestScore !== null && r.paceTestScore >= passThreshold,
  ).length;

  return {
    assignedSubjectCount: assignments.length,
    completedPaceCount,
    currentPaces: assignments.slice(0, 4).map((assignment) => ({
      subjectCode: assignment.subject.code,
      subjectName: assignment.subject.name,
      currentPaceNumber: assignment.currentPaceNumber,
    })),
  };
}

async function loadAttendanceDashboard(ctx: AppContext, studentId: string) {
  const to = addUtcDays(startOfUtcDay(new Date()), 1);
  const from = addUtcDays(to, -DASHBOARD_ATTENDANCE_DAYS);
  const rows = await ctx.db.attendance.findMany({
    where: { studentId, date: { gte: from, lt: to } },
    select: { status: true },
  });
  const summary = rows.reduce<AttendanceSummary>((current, row) => {
    current.total += 1;
    current[row.status] += 1;
    return current;
  }, emptyAttendanceSummary());

  return {
    days: DASHBOARD_ATTENDANCE_DAYS,
    ...summary,
    attended: summary.Present + summary.Late,
    attendanceRate: attendanceRate(summary),
  };
}

async function loadShortcutDashboard(ctx: AppContext, studentId: string) {
  const [activeClubCount, activeShopItemCount] = await Promise.all([
    ctx.db.clubSignup.count({
      where: { studentId, status: 'Active', club: { active: true } },
    }),
    ctx.db.shopItem.count({ where: { active: true } }),
  ]);

  return {
    activeClubCount,
    activeShopItemCount,
  };
}

export function createStudentRouter(deps: StudentRouterDeps = {}) {
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

  const createStudentInvitation = async (email: string): Promise<StudentInvitationWithUrl> => {
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
    return { ...invitation, url: invitation.url };
  };

  return router({
  me: roleProcedure('Student').query(async ({ ctx }) => {
    const ownStudent = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, { entity: 'student.me', studentId: ownStudent.id });

    const student = await ctx.db.student.findUnique({
      where: { id: ownStudent.id },
      select: {
        id: true,
        userId: true,
        fullNameEnc: true,
        yearGroup: true,
        enrolmentDate: true,
        active: true,
      },
    });
    if (!student) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student profile missing' });
    }

    const fullName = ctx.db.$enc.decrypt(student.fullNameEnc);
    if (!fullName) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student PII decrypt failed' });
    }

    await auditDecryptPii(ctx, { count: 1, source: 'student.me' }, ownStudent.id);

    return {
      id: ownStudent.id,
      userId: ownStudent.userId,
      fullName,
      yearGroup: student.yearGroup,
      enrolmentDate: student.enrolmentDate,
      active: ownStudent.active,
      academicScreensEnabled: await canUseStudentAcademicScreens(ctx.db, student.yearGroup),
    };
  }),

  portalUsage: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    return {
      studentId: student.id,
      usage: await loadAllowedStudentPortalUsageStatus(ctx, {
        entity: 'student.portalUsage',
        studentId: student.id,
      }),
    };
  }),

  dashboard: roleProcedure('Student').query(async ({ ctx }) => {
    const ownStudent = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, { entity: 'student.dashboard', studentId: ownStudent.id });

    const student = await ctx.db.student.findUnique({
      where: { id: ownStudent.id },
      select: {
        id: true,
        fullNameEnc: true,
        dobEnc: true,
        yearGroup: true,
        portalSettings: { select: { childIconPhotoUrl: true } },
      },
    });
    if (!student) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student profile missing' });
    }

    const fullName = ctx.db.$enc.decrypt(student.fullNameEnc);
    const dob = ctx.db.$enc.decrypt(student.dobEnc);
    if (!fullName || !dob) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student PII decrypt failed' });
    }
    const firstName = firstNameFrom(fullName);
    const [
      balances,
      pace,
      attendance,
      notifications,
      shortcuts,
      faithCorner,
      academicScreensEnabled,
      ageBands,
    ] = await Promise.all([
      loadMeritBalances(ctx, ownStudent.id),
      loadPaceDashboard(ctx, ownStudent.id),
      loadAttendanceDashboard(ctx, ownStudent.id),
      ctx.withRls((tx) => loadStudentNotificationPreview(tx, ownStudent.id)),
      loadShortcutDashboard(ctx, ownStudent.id),
      loadCurrentFaithCornerContent(ctx),
      canUseStudentAcademicScreens(ctx.db, student.yearGroup),
      ctx.db.yearGroupBand.findMany({
        where: { active: true },
        select: { id: true, name: true, standardYears: true, colour: true, active: true },
      }),
    ]);
    const totalMerits = totalMeritBalance(balances);

    await auditDecryptPii(ctx, { count: 1, source: 'student.dashboard' }, ownStudent.id);

    return {
      profile: {
        studentId: ownStudent.id,
        firstName,
        iconInitials: studentIconInitials(firstName),
        childIconPhotoUrl: student.portalSettings?.childIconPhotoUrl ?? null,
        yearGroup: student.yearGroup,
        yearGroupLabel: displaySchoolYearLabel(student.yearGroup),
        ageBand: resolveAgeBand(student.yearGroup, ageBands),
        academicScreensEnabled,
      },
      merits: {
        balances,
        totalMerits,
        hasActivity: totalMerits !== 0,
      },
      pace,
      attendance,
      notifications,
      shortcuts,
      faithCorner,
    };
  }),

  wallet: roleProcedure('Student').query(async ({ ctx }) => {
    const ownStudent = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, { entity: 'student.wallet', studentId: ownStudent.id });

    const [balances, history] = await Promise.all([
      loadMeritBalances(ctx, ownStudent.id),
      ctx.db.meritLedger.findMany({
        where: { studentId: ownStudent.id },
        select: {
          id: true,
          createdAt: true,
          account: true,
          delta: true,
          reason: true,
        },
        orderBy: { createdAt: 'desc' },
        take: STUDENT_WALLET_HISTORY_LIMIT,
      }),
    ]);
    const totalMerits = totalMeritBalance(balances);

    return {
      studentId: ownStudent.id,
      balances,
      totalMerits,
      history: history.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        account: entry.account,
        amount: entry.delta,
        reason: entry.reason,
      })),
    };
  }),

  heartbeat: roleProcedure('Student')
    .input(portalHeartbeatInput)
    .mutation(async ({ ctx, input }) => {
      const student = await loadOwnActiveStudent(ctx);
      const heartbeatInput = {
        entity: 'student.heartbeat',
        studentId: student.id,
        ...(input?.sessionKey ? { sessionKey: input.sessionKey } : {}),
      };
      return {
        studentId: student.id,
        usage: await recordStudentPortalUsageHeartbeat(ctx, heartbeatInput),
      };
    }),

  list: roleProcedure(...STUDENT_READ_ROLES)
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const scope = await loadDailyYearBandScope(ctx, input?.date ?? new Date());
      const where: Prisma.StudentWhereInput = {};
      if (!canUseAdminOperations(ctx.user) || !input?.includeInactive) {
        where.active = true;
      }
      if (input?.search) where.nameBidx = ctx.db.$enc.blindIndex(input.search);
      Object.assign(where, studentWhereForDailyScope(scope));

      const students = await ctx.db.student.findMany({
        where,
        include: studentInclude,
        orderBy: { createdAt: 'desc' },
      });

      const rows = students.map((student) => decryptStudent(ctx, student));
      await auditDecryptPii(ctx, { count: rows.length, source: 'student.list' });
      return rows;
    }),

  byId: roleProcedure(...STUDENT_READ_ROLES)
    .input(byIdInput)
    .query(async ({ ctx, input }) => {
      const student = await ctx.db.student.findUnique({
        where: { id: input.id },
        include: studentInclude,
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }

      const row = decryptStudent(ctx, student);
      await auditDecryptPii(ctx, { count: 1, source: 'student.byId' }, student.id);
      return row;
    }),

  create: adminOperationsProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const yearGroup = input.yearGroup ?? deriveEnglandWalesSchoolYear(input.dob);
    const emailBidx = ctx.db.$enc.blindIndex(input.email);
    const [existingUser, existingPendingInvite] = await Promise.all([
      ctx.db.user.findUnique({ where: { emailBidx }, select: { id: true } }),
      ctx.db.userInvitation.findFirst({
        where: { emailBidx, status: 'Pending' },
        select: { id: true },
      }),
    ]);

    if (existingUser) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'a user account already exists for this email',
      });
    }
    if (existingPendingInvite) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'a pending invitation already exists for this email',
      });
    }

    const clerkInvitation = await createStudentInvitation(input.email);
    const student = await ctx.db.student.create({
      data: {
        fullNameEnc: ctx.db.$enc.encrypt(input.fullName),
        nameBidx: ctx.db.$enc.blindIndex(input.fullName),
        dobEnc: ctx.db.$enc.encrypt(dateOnly(input.dob)),
        addressEnc: ctx.db.$enc.encrypt(input.address),
        yearGroup,
        enrolmentDate: input.enrolmentDate,
      },
      select: { id: true },
    });

    const storedInvitation = await ctx.db.userInvitation.create({
      data: {
        clerkInvitationId: clerkInvitation.id,
        role: 'Student',
        tags: STUDENT_INVITATION_TAGS,
        emailEnc: ctx.db.$enc.encrypt(input.email),
        emailBidx,
        status: 'Pending',
        emailStatus: 'NotSent',
        invitedById: ctx.user.id,
        studentId: student.id,
      },
      select: { id: true },
    });

    let invitationEmailStatus: StudentCreateEmailStatus = 'Sent';
    let emailMessageId: string | null = null;
    try {
      const email = buildUserInviteEmail({
        to: input.email,
        role: 'Student',
        inviteUrl: clerkInvitation.url,
      });
      const emailResult = await getEmailClient().send(email);
      emailMessageId = emailResult.id;
      await ctx.db.userInvitation.update({
        where: { id: storedInvitation.id },
        data: { emailStatus: 'Sent', emailMessageId },
        select: { id: true },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'Email',
          entityId: emailMessageId,
          meta: {
            invitationId: clerkInvitation.id,
            subject: email.subject,
            source: 'student.create',
          },
        },
      });
    } catch {
      invitationEmailStatus = 'Failed';
      await ctx.db.userInvitation.update({
        where: { id: storedInvitation.id },
        data: { emailStatus: 'Failed', emailMessageId: null },
        select: { id: true },
      });
    }

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'Student',
        entityId: student.id,
        meta: { yearGroup, invitationEmailStatus },
      },
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'UserInvitation',
        entityId: storedInvitation.id,
        meta: {
          role: 'Student',
          invitationStatus: clerkInvitation.status,
          emailStatus: invitationEmailStatus,
          source: 'student.create',
        },
      },
    });

    return { id: student.id, invitationEmailStatus };
  }),

  update: adminOperationsProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const data: Prisma.StudentUpdateInput = {};
    if (input.fullName !== undefined) {
      data.fullNameEnc = ctx.db.$enc.encrypt(input.fullName);
      data.nameBidx = ctx.db.$enc.blindIndex(input.fullName);
    }
    if (input.dob !== undefined) data.dobEnc = ctx.db.$enc.encrypt(dateOnly(input.dob));
    if (input.address !== undefined) data.addressEnc = ctx.db.$enc.encrypt(input.address);
    if (input.yearGroup !== undefined) data.yearGroup = input.yearGroup;
    if (input.enrolmentDate !== undefined) data.enrolmentDate = input.enrolmentDate;
    if (input.active !== undefined) data.active = input.active;

    try {
      const student = await ctx.db.student.update({
        where: { id: input.id },
        data,
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'Student',
          entityId: student.id,
          meta: { fields: Object.keys(data).sort() },
        },
      });
      return { id: student.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      throw err;
    }
  }),

  assignSubject: adminOperationsProcedure
    .input(assignSubjectInput)
    .mutation(async ({ ctx, input }) => {
      const [student, subject] = await Promise.all([
        ctx.db.student.findUnique({ where: { id: input.studentId }, select: { id: true } }),
        ctx.db.subject.findUnique({
          where: { id: input.subjectId },
          select: { id: true, active: true },
        }),
      ]);
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!subject) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'subject not found' });
      }
      if (!subject.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'subject is inactive' });
      }

      const currentPaceNumber = input.currentPaceNumber ?? DEFAULT_CURRENT_PACE_NUMBER;
      try {
        const assignment = await ctx.db.studentSubject.create({
          data: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            currentPaceNumber,
          },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'StudentSubject',
            entityId: assignment.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              currentPaceNumber,
            },
          },
        });
        return { created: true, assignmentId: assignment.id, currentPaceNumber };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await ctx.db.studentSubject.findUnique({
            where: {
              studentId_subjectId: {
                studentId: input.studentId,
                subjectId: input.subjectId,
              },
            },
          });
          if (existing) {
            return {
              created: false,
              assignmentId: existing.id,
              currentPaceNumber: existing.currentPaceNumber,
            };
          }
        }
        throw err;
      }
    }),

  setCurrentPace: adminOperationsProcedure
    .input(setCurrentPaceInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const assignment = await ctx.db.studentSubject.update({
          where: {
            studentId_subjectId: {
              studentId: input.studentId,
              subjectId: input.subjectId,
            },
          },
          data: { currentPaceNumber: input.currentPaceNumber },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'StudentSubject',
            entityId: assignment.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              currentPaceNumber: input.currentPaceNumber,
            },
          },
        });
        return { assignmentId: assignment.id, currentPaceNumber: assignment.currentPaceNumber };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student subject not found' });
        }
        throw err;
      }
    }),

  unassignSubject: adminOperationsProcedure
    .input(unassignSubjectInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const assignment = await ctx.db.studentSubject.delete({
          where: {
            studentId_subjectId: {
              studentId: input.studentId,
              subjectId: input.subjectId,
            },
          },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Delete',
            entity: 'StudentSubject',
            entityId: assignment.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              previousPaceNumber: assignment.currentPaceNumber,
              historicalPaceRecordsPreserved: true,
            },
          },
        });
        return {
          assignmentId: assignment.id,
          studentId: input.studentId,
          subjectId: input.subjectId,
        };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student subject not found' });
        }
        throw err;
      }
    }),

  deleteArchived: adminOperationsProcedure
    .input(deleteArchivedInput)
    .mutation(async ({ ctx, input }) =>
      deleteArchivedStudent(
        {
          $transaction: (callback) => ctx.db.$transaction((tx) => callback(tx)),
        },
        { actorUserId: ctx.user.id, studentId: input.id },
      ),
    ),
  });
}

export const studentRouter = createStudentRouter();
