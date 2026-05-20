import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  assertCanManageClub,
  canManageClubs,
  canSignUpForClub,
  canUseClubsLeadPortal,
  canUseLinkedChildClubSignup,
  formatClubSchedule,
  type ClubScheduleDraft,
  type SessionUser,
  validateClubDraft,
  validateClubScheduleDraft,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  buildClubNotificationEmail,
  CLUB_NOTIFICATION_EMAIL_SUBJECT,
  createResendEmailClient,
  type EmailClient,
} from '../lib/email.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

export interface ClubRouterDeps {
  emailClient?: EmailClient;
}

interface ClubSignupSummary {
  studentId: string;
}

interface ClubRow {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  scheduleStartDate: Date | null;
  scheduleStartMinute: number | null;
  scheduleEndMinute: number | null;
  scheduleFrequency: 'Weekly' | null;
  capacity: number | null;
  iconKey: string | null;
  accentColor: string | null;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  signups: ClubSignupSummary[];
}

interface LinkedStudentRow {
  student: {
    id: string;
    fullNameEnc: string;
    yearGroup: string;
  };
}

interface ClubNotificationRecipient {
  childNameEncs: string[];
  role: string;
  userId: string;
  userEmailEnc: string;
  userNameEnc: string;
}

const clubScheduleInput = z
  .object({
    startDate: z.coerce.date(),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    frequency: z.literal('Weekly'),
  })
  .refine((input) => input.startMinute < input.endMinute, {
    message: 'startMinute must be before endMinute',
    path: ['endMinute'],
  });

const stringIdInput = z.string().trim().min(1);
const clubIconKeyInput = z.enum([
  'achievement',
  'art',
  'book',
  'chess',
  'coding',
  'drama',
  'games',
  'general',
  'music',
  'scripture',
  'sports',
  'stem',
]);
const clubAccentColorInput = z.enum([
  '#7D3C98',
  '#1B2B5E',
  '#B45309',
  '#0E7490',
  '#0E5C3A',
  '#BE185D',
  '#4338CA',
  '#7D1C2C',
  '#9A3412',
  '#0F766E',
  '#2563EB',
  '#64748B',
]);

const clubCreateInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  schedule: z.union([clubScheduleInput, z.string().trim()]).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  iconKey: clubIconKeyInput.nullable().optional(),
  accentColor: clubAccentColorInput.nullable().optional(),
});

const clubUpdateInput = z.object({
  id: stringIdInput,
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  schedule: z.union([clubScheduleInput, z.string().trim()]).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  iconKey: clubIconKeyInput.nullable().optional(),
  accentColor: clubAccentColorInput.nullable().optional(),
  active: z.boolean().optional(),
});

const clubStudentInput = z.object({
  clubId: stringIdInput,
  studentId: stringIdInput,
});

const clubIdInput = z.object({ clubId: stringIdInput });

const dateRangeFields = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

const dateRangeInput = dateRangeFields.refine(
  (input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(),
  {
    message: 'from must be on or before to',
    path: ['to'],
  },
);

const clubSessionInput = z.object({
  clubId: stringIdInput,
  date: z.coerce.date(),
});

const clubAttendanceStatusInput = z.enum(['Present', 'Absent', 'Late']);

const clubAttendanceMarkInput = clubSessionInput.extend({
  studentId: stringIdInput,
  status: clubAttendanceStatusInput,
});

const rotaParticipantsInput = z.object({
  clubId: stringIdInput,
  userIds: z.array(z.string().min(1)).max(100),
});

const clubLeadAssignmentsInput = z.object({
  clubId: stringIdInput,
  userIds: z.array(z.string().min(1)).max(100),
});

const availabilityWindowInput = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((input) => input.startMinute < input.endMinute, {
    message: 'startMinute must be before endMinute',
    path: ['endMinute'],
  });

const setClubAvailabilityInput = z.object({
  clubId: stringIdInput,
  windows: z.array(availabilityWindowInput).max(42).default([]),
});

const clubRotaScheduleInput = dateRangeFields
  .extend({
    clubId: stringIdInput,
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

const clubRotaShiftBaseInput = z.object({
  clubId: stringIdInput,
  participantUserId: z.string().min(1),
  date: z.coerce.date(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

const clubRotaShiftInput = clubRotaShiftBaseInput.refine(
  (input) => input.startsAt.getTime() < input.endsAt.getTime(),
  {
    message: 'startsAt must be before endsAt',
    path: ['endsAt'],
  },
);

const updateClubRotaShiftInput = clubRotaShiftBaseInput
  .partial()
  .extend({ id: stringIdInput })
  .refine(
    (input) =>
      input.clubId !== undefined ||
      input.participantUserId !== undefined ||
      input.date !== undefined ||
      input.startsAt !== undefined ||
      input.endsAt !== undefined ||
      input.notes !== undefined,
    { message: 'at least one field must be provided' },
  );

const deleteClubRotaShiftInput = z.object({ id: stringIdInput });

const clubNotifyInput = z.object({
  clubId: stringIdInput,
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

const clubListInclude = Prisma.validator<Prisma.ClubInclude>()({
  signups: {
    where: { status: 'Active', student: { active: true } },
    select: { studentId: true },
  },
});

const clubManagementInclude = Prisma.validator<Prisma.ClubInclude>()({
  signups: {
    where: { status: 'Active', student: { active: true } },
    select: { studentId: true },
  },
  leadAssignments: {
    orderBy: { createdAt: 'asc' },
    select: {
      user: {
        select: {
          id: true,
          active: true,
          fullNameEnc: true,
          emailEnc: true,
        },
      },
    },
  },
});

const clubListOrderBy = [
  { active: 'desc' },
  { name: 'asc' },
  { createdAt: 'desc' },
] as const satisfies Prisma.ClubOrderByWithRelationInput[];

const clubNotificationSelect = Prisma.validator<Prisma.ClubSelect>()({
  id: true,
  name: true,
  active: true,
  signups: {
    where: { status: 'Active', student: { active: true } },
    select: {
      student: {
        select: {
          id: true,
          fullNameEnc: true,
          guardians: {
            where: { user: { active: true } },
            select: {
              user: {
                select: {
                  id: true,
                  role: true,
                  fullNameEnc: true,
                  emailEnc: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
});

type ClubForNotification = Prisma.ClubGetPayload<{ select: typeof clubNotificationSelect }>;

const clubNotificationHistorySelect = Prisma.validator<Prisma.ClubNotificationSelect>()({
  id: true,
  clubId: true,
  title: true,
  sentAt: true,
  sentBy: {
    select: {
      fullNameEnc: true,
    },
  },
});

type ClubNotificationHistoryRow = Prisma.ClubNotificationGetPayload<{
  select: typeof clubNotificationHistorySelect;
}>;

interface ClubNotificationNoticeRow {
  id: string;
  clubId: string;
  title: string;
  bodyEnc: string;
  sentAt: Date;
  club: {
    name: string;
    signups: {
      student: {
        fullNameEnc: string;
      };
    }[];
  };
  sentBy: {
    fullNameEnc: string;
  };
}

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireClubManager(user: SessionUser): void {
  try {
    assertCanManageClub(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

async function requireClubManagerOrAssignedLead(
  ctx: AuthedContext,
  clubId: string,
): Promise<'manager' | 'lead'> {
  if (canManageClubs(ctx.user)) return 'manager';
  if (!canUseClubsLeadPortal(ctx.user)) {
    throw toForbidden(new AccessDeniedError('club access requires club manager or assigned lead'));
  }

  const assignment = await ctx.db.clubLeadAssignment.findUnique({
    where: { clubId_userId: { clubId, userId: ctx.user.id } },
    select: { club: { select: { active: true } } },
  });
  if (!assignment || !assignment.club.active) {
    throw toForbidden(new AccessDeniedError('user is not assigned to this active club'));
  }

  return 'lead';
}

function requireClubListAccess(user: SessionUser): void {
  if (canManageClubs(user) || user.role === 'Parent') return;
  throw toForbidden(new AccessDeniedError('clubs require Parent, ClubsAdmin, or full-admin'));
}

function requireLinkedChildSignupAccess(user: SessionUser): void {
  if (canUseLinkedChildClubSignup(user)) return;
  throw toForbidden(
    new AccessDeniedError('linked-child club signups require a linked guardian role'),
  );
}

function requireSignupActor(user: SessionUser): 'club-manager' | 'linked-child-guardian' {
  if (canManageClubs(user)) return 'club-manager';
  if (canUseLinkedChildClubSignup(user)) return 'linked-child-guardian';
  throw toForbidden(
    new AccessDeniedError(
      'club signups require Parent, linked staff/admin guardian, or full-admin',
    ),
  );
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function scheduleFromRow(row: {
  scheduleStartDate?: Date | null;
  scheduleStartMinute?: number | null;
  scheduleEndMinute?: number | null;
  scheduleFrequency?: 'Weekly' | null;
}): ClubScheduleDraft | null {
  if (
    row.scheduleStartDate === null ||
    row.scheduleStartDate === undefined ||
    row.scheduleStartMinute === null ||
    row.scheduleStartMinute === undefined ||
    row.scheduleEndMinute === null ||
    row.scheduleEndMinute === undefined ||
    row.scheduleFrequency === null ||
    row.scheduleFrequency === undefined
  ) {
    return null;
  }
  return {
    startDate: row.scheduleStartDate,
    startMinute: row.scheduleStartMinute,
    endMinute: row.scheduleEndMinute,
    frequency: row.scheduleFrequency,
  };
}

function normalizeScheduleInput(value: z.infer<typeof clubCreateInput>['schedule']): {
  display: string | null;
  schedule: ClubScheduleDraft | null;
} {
  if (typeof value === 'string') {
    return { display: normalizeOptionalText(value), schedule: null };
  }
  const schedule = validateClubScheduleDraft(value);
  return { display: formatClubSchedule(schedule), schedule };
}

function scheduleData(value: z.infer<typeof clubCreateInput>['schedule']): {
  schedule: string | null;
  scheduleStartDate: Date | null;
  scheduleStartMinute: number | null;
  scheduleEndMinute: number | null;
  scheduleFrequency: 'Weekly' | null;
} {
  const normalized = normalizeScheduleInput(value);
  return {
    schedule: normalized.display,
    scheduleStartDate: normalized.schedule ? normalizeDate(normalized.schedule.startDate) : null,
    scheduleStartMinute: normalized.schedule?.startMinute ?? null,
    scheduleEndMinute: normalized.schedule?.endMinute ?? null,
    scheduleFrequency: normalized.schedule?.frequency ?? null,
  };
}

function assertNoAvailabilityOverlap(windows: z.infer<typeof availabilityWindowInput>[]): void {
  const sorted = [...windows].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous &&
      current &&
      previous.dayOfWeek === current.dayOfWeek &&
      current.startMinute < previous.endMinute
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'availability windows must not overlap',
      });
    }
  }
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

function mapClub(
  user: SessionUser,
  club: ClubRow,
  linkedStudentIds: ReadonlySet<string> = new Set(),
) {
  const structuredSchedule = scheduleFromRow(club);
  const scheduleLabel = formatClubSchedule(structuredSchedule) ?? club.schedule;
  const signedUpStudentIds =
    linkedStudentIds.size > 0
      ? club.signups
          .filter((signup) => linkedStudentIds.has(signup.studentId))
          .map((signup) => signup.studentId)
      : [];

  return {
    id: club.id,
    name: club.name,
    description: club.description,
    schedule: structuredSchedule
      ? {
          startDate: dateKey(structuredSchedule.startDate),
          startMinute: structuredSchedule.startMinute,
          endMinute: structuredSchedule.endMinute,
          frequency: structuredSchedule.frequency,
        }
      : null,
    scheduleLabel,
    legacySchedule: club.schedule,
    capacity: club.capacity,
    iconKey: club.iconKey,
    accentColor: club.accentColor,
    active: club.active,
    createdById: club.createdById,
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
    activeSignupCount: club.signups.length,
    signedUpStudentIds,
  };
}

function mapClubManagementRow(
  decrypt: (value: string | null | undefined) => string | null,
  user: SessionUser,
  club: Prisma.ClubGetPayload<{ include: typeof clubManagementInclude }>,
) {
  return {
    ...mapClub(user, club),
    assignedLeads: club.leadAssignments.map((assignment) => ({
      id: assignment.user.id,
      active: assignment.user.active,
      fullName: decryptRequired(decrypt, assignment.user.fullNameEnc, 'user PII'),
      email: decryptRequired(decrypt, assignment.user.emailEnc, 'user PII'),
    })),
  };
}

function mapLinkedStudent(
  decrypt: (value: string | null | undefined) => string | null,
  row: LinkedStudentRow,
) {
  return {
    id: row.student.id,
    fullName: decryptRequired(decrypt, row.student.fullNameEnc, 'student PII'),
    yearGroup: row.student.yearGroup,
  };
}

function mapClubNotificationHistoryRow(
  decrypt: (value: string | null | undefined) => string | null,
  row: ClubNotificationHistoryRow,
) {
  return {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    sentAt: row.sentAt,
    sentByName: decryptRequired(decrypt, row.sentBy.fullNameEnc, 'user PII'),
  };
}

function mapClubNoticeRow(
  decrypt: (value: string | null | undefined) => string | null,
  row: ClubNotificationNoticeRow,
) {
  const studentNames = row.club.signups.map((signup) =>
    decryptRequired(decrypt, signup.student.fullNameEnc, 'student PII'),
  );
  return {
    id: row.id,
    clubId: row.clubId,
    clubName: row.club.name,
    studentName: studentNames.join(', '),
    title: row.title,
    body: decryptRequired(decrypt, row.bodyEnc, 'club notification'),
    sentAt: row.sentAt,
    sentByName: decryptRequired(decrypt, row.sentBy.fullNameEnc, 'user PII'),
  };
}

function mapClubUser(
  decrypt: (value: string | null | undefined) => string | null,
  user: {
    id: string;
    role: SessionUser['role'];
    fullNameEnc: string;
    emailEnc: string;
  },
) {
  return {
    id: user.id,
    role: user.role,
    fullName: decryptRequired(decrypt, user.fullNameEnc, 'user PII'),
    email: decryptRequired(decrypt, user.emailEnc, 'user PII'),
  };
}

function mapClubRotaShift(
  decrypt: (value: string | null | undefined) => string | null,
  shift: {
    id: string;
    clubId: string;
    participantUserId: string;
    date: Date;
    startsAt: Date;
    endsAt: Date;
    notes: string | null;
    club?: { name: string } | null;
    participantUser?: {
      id: string;
      role: SessionUser['role'];
      fullNameEnc: string;
      emailEnc: string;
    } | null;
  },
) {
  return {
    id: shift.id,
    clubId: shift.clubId,
    clubName: shift.club?.name ?? null,
    participantUserId: shift.participantUserId,
    participant: shift.participantUser ? mapClubUser(decrypt, shift.participantUser) : null,
    date: dateKey(shift.date),
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    notes: shift.notes,
  };
}

async function assertActiveClub(ctx: AuthedContext, clubId: string) {
  const club = await ctx.db.club.findUnique({
    where: { id: clubId },
    select: { id: true, active: true },
  });
  if (!club) throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
  if (!club.active) throw new TRPCError({ code: 'BAD_REQUEST', message: 'club is inactive' });
  return club;
}

async function assertClubRotaParticipant(
  ctx: AuthedContext,
  clubId: string,
  userId: string,
): Promise<void> {
  const participant = await ctx.db.clubRotaParticipant.findUnique({
    where: { clubId_userId: { clubId, userId } },
    select: { id: true },
  });
  if (!participant) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'user is not selected for this club rota' });
  }
}

async function assertNoClubShiftOverlap(
  ctx: AuthedContext,
  input: {
    participantUserId: string;
    date: Date;
    startsAt: Date;
    endsAt: Date;
    exceptShiftId?: string;
  },
): Promise<void> {
  const overlap = await ctx.db.clubRotaShift.findFirst({
    where: {
      participantUserId: input.participantUserId,
      date: normalizeDate(input.date),
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.exceptShiftId ? { NOT: { id: input.exceptShiftId } } : {}),
    },
    select: { id: true },
  });
  if (overlap) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'club cover shift overlaps an existing club cover shift',
    });
  }
}

async function loadEligibleClubRotaUsers(ctx: AuthedContext, userIds?: readonly string[]) {
  const rows = await ctx.db.user.findMany({
    where: {
      active: true,
      role: { in: ['Supervisor', 'Parent'] },
      ...(userIds ? { id: { in: [...userIds] } } : {}),
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      role: true,
      fullNameEnc: true,
      emailEnc: true,
      guardianOf: {
        where: { student: { active: true } },
        select: { studentId: true },
        take: 1,
      },
    },
  });

  return rows.filter((row) => row.role === 'Supervisor' || row.guardianOf.length > 0);
}

async function loadLinkedActiveStudentIds(ctx: AuthedContext): Promise<Set<string>> {
  const guardians = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id, student: { active: true } },
    select: { studentId: true },
  });
  return new Set(guardians.map((guardian) => guardian.studentId));
}

async function loadLinkedActiveStudents(ctx: AuthedContext) {
  const guardians = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id, student: { active: true } },
    select: {
      student: {
        select: { id: true, fullNameEnc: true, yearGroup: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'DecryptPii',
      entity: 'Student',
      meta: { source: 'club.linkedChildSignupContext', count: guardians.length },
    },
  });

  return guardians.map((guardian) => mapLinkedStudent(ctx.db.$enc.decrypt, guardian));
}

async function assertLinkedChildStudent(
  db: Pick<AuthedContext['db'], 'guardian'>,
  user: SessionUser,
  studentId: string,
  options: { requireActive: boolean },
): Promise<void> {
  const guardian = await db.guardian.findUnique({
    where: { userId_studentId: { userId: user.id, studentId } },
    select: { student: { select: { id: true, active: true } } },
  });

  if (!guardian) {
    throw toForbidden(new AccessDeniedError('user is not linked to this student'));
  }
  if (options.requireActive && !guardian.student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
}

async function assertFullAdminActiveStudent(
  db: Pick<AuthedContext['db'], 'student'>,
  studentId: string,
): Promise<void> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, active: true },
  });
  if (!student) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
  }
  if (!student.active) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
  }
}

function handleSignupCreateError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'student is already signed up for this club',
      cause: error,
    });
  }
  throw error;
}

function notificationRecipientsFor(club: ClubForNotification): ClubNotificationRecipient[] {
  const recipients = new Map<string, ClubNotificationRecipient>();

  for (const signup of club.signups) {
    for (const guardian of signup.student.guardians) {
      const existing = recipients.get(guardian.user.id);
      if (existing) {
        if (!existing.childNameEncs.includes(signup.student.fullNameEnc)) {
          existing.childNameEncs.push(signup.student.fullNameEnc);
        }
        continue;
      }

      recipients.set(guardian.user.id, {
        childNameEncs: [signup.student.fullNameEnc],
        role: guardian.user.role,
        userId: guardian.user.id,
        userEmailEnc: guardian.user.emailEnc,
        userNameEnc: guardian.user.fullNameEnc,
      });
    }
  }

  return [...recipients.values()];
}

async function auditClubNotificationFailure(
  ctx: AuthedContext,
  input: {
    clubId: string;
    notificationId: string;
    recipient: ClubNotificationRecipient;
  },
): Promise<void> {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'ClubNotification',
        entityId: input.notificationId,
        meta: {
          source: 'club.notify.email',
          emailStatus: 'Failed',
          clubId: input.clubId,
          toUserId: input.recipient.userId,
          toRole: input.recipient.role,
        },
      },
    });
  } catch (auditErr) {
    console.error('Club notification failure audit failed', {
      clubId: input.clubId,
      error: auditErr instanceof Error ? auditErr.message : 'unknown error',
      notificationId: input.notificationId,
      toUserId: input.recipient.userId,
    });
  }
}

async function sendClubNotificationEmails({
  body,
  club,
  ctx,
  getEmailClient,
  notificationId,
  recipients,
  title,
}: {
  body: string;
  club: ClubForNotification;
  ctx: AuthedContext;
  getEmailClient: () => EmailClient;
  notificationId: string;
  recipients: ClubNotificationRecipient[];
  title: string;
}): Promise<{ failedCount: number; sentCount: number }> {
  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    try {
      const recipientName = decryptRequired(
        ctx.db.$enc.decrypt,
        recipient.userNameEnc,
        'guardian name',
      );
      const recipientEmail = decryptRequired(
        ctx.db.$enc.decrypt,
        recipient.userEmailEnc,
        'guardian email',
      );
      const childNames = recipient.childNameEncs.map((childNameEnc) =>
        decryptRequired(ctx.db.$enc.decrypt, childNameEnc, 'student PII'),
      );
      const result = await getEmailClient().send(
        buildClubNotificationEmail({
          body,
          childNames,
          clubName: club.name,
          recipientName,
          title,
          to: recipientEmail,
        }),
      );

      sentCount += 1;
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'Email',
          entityId: result.id,
          meta: {
            source: 'club.notify.email',
            emailStatus: 'Sent',
            clubId: club.id,
            notificationId,
            subject: CLUB_NOTIFICATION_EMAIL_SUBJECT,
            toUserId: recipient.userId,
            toRole: recipient.role,
          },
        },
      });
    } catch (err) {
      failedCount += 1;
      console.error('Club notification email delivery failed', {
        clubId: club.id,
        error: err instanceof Error ? err.message : 'unknown error',
        notificationId,
        toUserId: recipient.userId,
      });
      await auditClubNotificationFailure(ctx, {
        clubId: club.id,
        notificationId,
        recipient,
      });
    }
  }

  return { failedCount, sentCount };
}

export function createClubRouter(deps: ClubRouterDeps = {}) {
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  return router({
    list: authedProcedure.query(async ({ ctx }) => {
      requireClubListAccess(ctx.user);

      const linkedStudentIds =
        ctx.user.role === 'Parent' ? await loadLinkedActiveStudentIds(ctx) : new Set<string>();
      const clubs =
        ctx.user.role === 'Parent'
          ? await ctx.db.club.findMany({
              where: { active: true },
              include: clubListInclude,
              orderBy: clubListOrderBy,
            })
          : await ctx.db.club.findMany({
              include: clubListInclude,
              orderBy: clubListOrderBy,
            });

      return clubs.map((club) => mapClub(ctx.user, club, linkedStudentIds));
    }),

    managementList: authedProcedure.query(async ({ ctx }) => {
      requireClubManager(ctx.user);

      const clubs = await ctx.db.club.findMany({
        include: clubManagementInclude,
        orderBy: clubListOrderBy,
      });
      const leadCount = clubs.reduce((total, club) => total + club.leadAssignments.length, 0);

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { source: 'club.managementList', count: leadCount },
        },
      });

      return clubs.map((club) => mapClubManagementRow(ctx.db.$enc.decrypt, ctx.user, club));
    }),

    linkedChildSignupContext: authedProcedure.query(async ({ ctx }) => {
      requireLinkedChildSignupAccess(ctx.user);

      const [children, clubs] = await Promise.all([
        loadLinkedActiveStudents(ctx),
        ctx.db.club.findMany({
          where: { active: true },
          include: clubListInclude,
          orderBy: clubListOrderBy,
        }),
      ]);
      const linkedStudentIds = new Set(children.map((child) => child.id));

      return {
        children,
        clubs: clubs.map((club) => mapClub(ctx.user, club, linkedStudentIds)),
      };
    }),

    leadClubs: authedProcedure.query(async ({ ctx }) => {
      if (!canUseClubsLeadPortal(ctx.user)) {
        throw toForbidden(new AccessDeniedError('club lead portal requires ClubsLead'));
      }

      const rows = await ctx.db.clubLeadAssignment.findMany({
        where: { userId: ctx.user.id, club: { active: true } },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          club: {
            select: {
              id: true,
              name: true,
              description: true,
              schedule: true,
              scheduleStartDate: true,
              scheduleStartMinute: true,
              scheduleEndMinute: true,
              scheduleFrequency: true,
              capacity: true,
              iconKey: true,
              accentColor: true,
              active: true,
              createdById: true,
              createdAt: true,
              updatedAt: true,
              signups: {
                where: { status: 'Active', student: { active: true } },
                select: { studentId: true },
              },
            },
          },
        },
      });

      return rows.map((row) => mapClub(ctx.user, row.club));
    }),

    create: authedProcedure.input(clubCreateInput).mutation(async ({ ctx, input }) => {
      requireClubManager(ctx.user);

      const draft = validateClubDraft({
        name: input.name,
        schedule: input.schedule ?? null,
        ...(input.capacity !== null && input.capacity !== undefined
          ? { capacity: input.capacity }
          : {}),
      });
      const nextSchedule = scheduleData(input.schedule ?? null);
      const club = await ctx.db.club.create({
        data: {
          name: draft.name,
          description: normalizeOptionalText(input.description),
          ...nextSchedule,
          capacity: input.capacity ?? null,
          iconKey: input.iconKey ?? null,
          accentColor: input.accentColor ?? null,
          active: true,
          createdById: ctx.user.id,
        },
        include: {
          signups: {
            where: { status: 'Active', student: { active: true } },
            select: { studentId: true },
          },
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'Club',
          entityId: club.id,
          meta: { source: 'club.create', capacity: club.capacity },
        },
      });

      return mapClub(ctx.user, { ...club, signups: [] });
    }),

    update: authedProcedure.input(clubUpdateInput).mutation(async ({ ctx, input }) => {
      requireClubManager(ctx.user);

      const existing = await ctx.db.club.findUnique({
        where: { id: input.id },
        include: {
          signups: {
            where: { status: 'Active', student: { active: true } },
            select: { studentId: true },
          },
        },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
      }
      if (input.capacity !== undefined && input.capacity !== null) {
        validateClubDraft({ name: input.name ?? existing.name, capacity: input.capacity });
        if (input.capacity < existing.signups.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'capacity cannot be below active signup count',
          });
        }
      }

      const data: Prisma.ClubUpdateInput = {};
      if (input.name !== undefined) {
        data.name = validateClubDraft({ name: input.name }).name;
      }
      if (input.description !== undefined) {
        data.description = normalizeOptionalText(input.description);
      }
      if (input.schedule !== undefined) {
        Object.assign(data, scheduleData(input.schedule));
      }
      if (input.capacity !== undefined) {
        data.capacity = input.capacity;
      }
      if (input.iconKey !== undefined) {
        data.iconKey = input.iconKey;
      }
      if (input.accentColor !== undefined) {
        data.accentColor = input.accentColor;
      }
      if (input.active !== undefined) {
        data.active = input.active;
      }

      const club = await ctx.db.club.update({
        where: { id: input.id },
        data,
        include: {
          signups: {
            where: { status: 'Active', student: { active: true } },
            select: { studentId: true },
          },
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'Club',
          entityId: club.id,
          meta: {
            source: input.active === false ? 'club.deactivate' : 'club.update',
            fields: Object.keys(data).sort(),
          },
        },
      });

      return mapClub(ctx.user, club);
    }),

    roster: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
      await requireClubManagerOrAssignedLead(ctx, input.clubId);

      const club = await ctx.db.club.findUnique({
        where: { id: input.clubId },
        include: {
          signups: {
            where: { status: 'Active', student: { active: true } },
            include: {
              student: { select: { id: true, fullNameEnc: true, yearGroup: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!club) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
      }

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: { source: 'club.roster', clubId: club.id, count: club.signups.length },
        },
      });

      return {
        clubId: club.id,
        signups: club.signups.map((signup) => ({
          id: signup.id,
          studentId: signup.studentId,
          studentName: decryptRequired(
            ctx.db.$enc.decrypt,
            signup.student.fullNameEnc,
            'student PII',
          ),
          yearGroup: signup.student.yearGroup,
          signedUpAt: signup.createdAt,
        })),
      };
    }),

    studentCandidates: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
      requireClubManager(ctx.user);

      const club = await ctx.db.club.findUnique({
        where: { id: input.clubId },
        select: {
          id: true,
          signups: {
            where: { status: 'Active', student: { active: true } },
            select: { studentId: true },
          },
        },
      });
      if (!club) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
      }

      const signedUpStudentIds = new Set(club.signups.map((signup) => signup.studentId));
      const students = await ctx.db.student.findMany({
        where: { active: true },
        orderBy: [{ yearGroup: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, fullNameEnc: true, yearGroup: true },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: { source: 'club.studentCandidates', clubId: club.id, count: students.length },
        },
      });

      return students.map((student) => ({
        id: student.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student PII'),
        yearGroup: student.yearGroup,
        signedUp: signedUpStudentIds.has(student.id),
      }));
    }),

    leadCandidates: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
      requireClubManager(ctx.user);

      const club = await ctx.db.club.findUnique({
        where: { id: input.clubId },
        select: {
          id: true,
          leadAssignments: { select: { userId: true } },
        },
      });
      if (!club) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
      }

      const selectedUserIds = new Set(club.leadAssignments.map((assignment) => assignment.userId));
      const users = await ctx.db.user.findMany({
        where: { active: true, role: 'ClubsLead' },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          role: true,
          fullNameEnc: true,
          emailEnc: true,
          clubLeadAssignments: {
            select: {
              club: {
                select: {
                  id: true,
                  active: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      const rows = users.map((user) => ({
        ...mapClubUser(ctx.db.$enc.decrypt, user),
        assignedClubNames: user.clubLeadAssignments
          .filter((assignment) => assignment.club.active && assignment.club.id !== club.id)
          .map((assignment) => assignment.club.name)
          .sort((a, b) => a.localeCompare(b)),
        selected: selectedUserIds.has(user.id),
      }));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { source: 'club.leadCandidates', clubId: club.id, count: rows.length },
        },
      });

      return rows;
    }),

    setLeadAssignments: authedProcedure
      .input(clubLeadAssignmentsInput)
      .mutation(async ({ ctx, input }) => {
        requireClubManager(ctx.user);
        await assertActiveClub(ctx, input.clubId);

        const uniqueUserIds = [...new Set(input.userIds)];
        const eligibleUsers =
          uniqueUserIds.length === 0
            ? []
            : await ctx.db.user.findMany({
                where: { id: { in: uniqueUserIds }, active: true, role: 'ClubsLead' },
                select: { id: true },
              });
        const eligibleUserIds = new Set(eligibleUsers.map((user) => user.id));
        const invalidUserId = uniqueUserIds.find((userId) => !eligibleUserIds.has(userId));
        if (invalidUserId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'club leads must be active ClubsLead users',
          });
        }

        await ctx.db.$transaction(async (tx) => {
          await tx.clubLeadAssignment.deleteMany({
            where: { clubId: input.clubId, userId: { notIn: uniqueUserIds } },
          });
          if (uniqueUserIds.length > 0) {
            await tx.clubLeadAssignment.createMany({
              data: uniqueUserIds.map((userId) => ({
                clubId: input.clubId,
                userId,
                assignedById: ctx.user.id,
              })),
              skipDuplicates: true,
            });
          }
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ClubLeadAssignment',
            entityId: input.clubId,
            meta: {
              source: 'club.setLeadAssignments',
              clubId: input.clubId,
              leadCount: uniqueUserIds.length,
            },
          },
        });

        return { clubId: input.clubId, userIds: uniqueUserIds };
      }),

    attendanceForSession: authedProcedure.input(clubSessionInput).query(async ({ ctx, input }) => {
      await requireClubManagerOrAssignedLead(ctx, input.clubId);
      const sessionDate = normalizeDate(input.date);

      const club = await ctx.db.club.findUnique({
        where: { id: input.clubId },
        include: {
          signups: {
            where: { status: 'Active', student: { active: true } },
            include: { student: { select: { id: true, fullNameEnc: true, yearGroup: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!club) throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });

      const attendanceRows = await ctx.db.clubAttendance.findMany({
        where: { clubId: input.clubId, sessionDate },
        select: {
          id: true,
          studentId: true,
          status: true,
          recordedById: true,
          updatedAt: true,
        },
      });
      const attendanceByStudentId = new Map(
        attendanceRows.map((row) => [row.studentId, row] as const),
      );

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'ClubAttendance',
          meta: {
            source: 'club.attendanceForSession',
            clubId: club.id,
            count: club.signups.length,
          },
        },
      });

      return {
        clubId: club.id,
        date: dateKey(sessionDate),
        students: club.signups.map((signup) => {
          const attendance = attendanceByStudentId.get(signup.studentId) ?? null;
          return {
            signupId: signup.id,
            studentId: signup.studentId,
            studentName: decryptRequired(
              ctx.db.$enc.decrypt,
              signup.student.fullNameEnc,
              'student PII',
            ),
            yearGroup: signup.student.yearGroup,
            attendanceId: attendance?.id ?? null,
            status: attendance?.status ?? null,
            recordedById: attendance?.recordedById ?? null,
            recordedAt: attendance?.updatedAt ?? null,
          };
        }),
      };
    }),

    markAttendance: authedProcedure
      .input(clubAttendanceMarkInput)
      .mutation(async ({ ctx, input }) => {
        await requireClubManagerOrAssignedLead(ctx, input.clubId);
        await assertActiveClub(ctx, input.clubId);
        const sessionDate = normalizeDate(input.date);

        const signup = await ctx.db.clubSignup.findFirst({
          where: {
            clubId: input.clubId,
            studentId: input.studentId,
            status: 'Active',
            student: { active: true },
          },
          select: { id: true },
        });
        if (!signup) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'student is not actively signed up for this club',
          });
        }

        const attendance = await ctx.db.clubAttendance.upsert({
          where: {
            clubId_studentId_sessionDate: {
              clubId: input.clubId,
              studentId: input.studentId,
              sessionDate,
            },
          },
          update: { status: input.status, recordedById: ctx.user.id },
          create: {
            clubId: input.clubId,
            studentId: input.studentId,
            sessionDate,
            status: input.status,
            recordedById: ctx.user.id,
          },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ClubAttendance',
            entityId: attendance.id,
            meta: {
              source: 'club.markAttendance',
              clubId: input.clubId,
              studentId: input.studentId,
              sessionDate: dateKey(sessionDate),
              status: input.status,
            },
          },
        });

        return {
          id: attendance.id,
          clubId: attendance.clubId,
          studentId: attendance.studentId,
          date: dateKey(attendance.sessionDate),
          status: attendance.status,
          recordedById: attendance.recordedById,
          recordedAt: attendance.updatedAt,
        };
      }),

    rotaCandidates: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
      requireClubManager(ctx.user);
      const club = await ctx.db.club.findUnique({
        where: { id: input.clubId },
        select: { id: true },
      });
      if (!club) throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });

      const [candidates, participants] = await Promise.all([
        loadEligibleClubRotaUsers(ctx),
        ctx.db.clubRotaParticipant.findMany({
          where: { clubId: input.clubId },
          select: { userId: true },
        }),
      ]);
      const selectedUserIds = new Set(participants.map((participant) => participant.userId));
      const users = candidates.map((candidate) => ({
        ...mapClubUser(ctx.db.$enc.decrypt, candidate),
        selected: selectedUserIds.has(candidate.id),
      }));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { source: 'club.rotaCandidates', clubId: club.id, count: users.length },
        },
      });

      return users;
    }),

    clubRotaAvailability: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
      requireClubManager(ctx.user);
      const participants = await ctx.db.clubRotaParticipant.findMany({
        where: { clubId: input.clubId, club: { active: true } },
        orderBy: [{ createdAt: 'asc' }],
        include: {
          user: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        },
      });
      const userIds = participants.map((participant) => participant.userId);
      const windows = await ctx.db.clubAvailabilityWindow.findMany({
        where: { clubId: input.clubId, userId: { in: userIds } },
        orderBy: [{ userId: 'asc' }, { dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        select: {
          id: true,
          userId: true,
          dayOfWeek: true,
          startMinute: true,
          endMinute: true,
        },
      });

      const rows = participants.map((participant) => ({
        ...mapClubUser(ctx.db.$enc.decrypt, participant.user),
        availability: windows
          .filter((window) => window.userId === participant.userId)
          .map((window) => ({
            id: window.id,
            dayOfWeek: window.dayOfWeek,
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          })),
      }));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'ClubAvailabilityWindow',
          meta: { source: 'club.clubRotaAvailability', clubId: input.clubId, count: rows.length },
        },
      });

      return rows;
    }),

    setRotaParticipants: authedProcedure
      .input(rotaParticipantsInput)
      .mutation(async ({ ctx, input }) => {
        requireClubManager(ctx.user);
        await assertActiveClub(ctx, input.clubId);

        const uniqueUserIds = [...new Set(input.userIds)];
        const eligibleUsers = await loadEligibleClubRotaUsers(ctx, uniqueUserIds);
        const eligibleUserIds = new Set(eligibleUsers.map((user) => user.id));
        const invalidUserId = uniqueUserIds.find((userId) => !eligibleUserIds.has(userId));
        if (invalidUserId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'club rota participants must be active supervisors or linked parents',
          });
        }

        await ctx.db.$transaction(async (tx) => {
          await tx.clubRotaParticipant.deleteMany({
            where: { clubId: input.clubId, userId: { notIn: uniqueUserIds } },
          });
          if (uniqueUserIds.length > 0) {
            await tx.clubRotaParticipant.createMany({
              data: uniqueUserIds.map((userId) => ({
                clubId: input.clubId,
                userId,
                selectedById: ctx.user.id,
              })),
              skipDuplicates: true,
            });
          }
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ClubRotaParticipant',
            entityId: input.clubId,
            meta: {
              source: 'club.setRotaParticipants',
              clubId: input.clubId,
              participantCount: uniqueUserIds.length,
            },
          },
        });

        return { clubId: input.clubId, userIds: uniqueUserIds };
      }),

    clubRotaSchedule: authedProcedure.input(clubRotaScheduleInput).query(async ({ ctx, input }) => {
      requireClubManager(ctx.user);
      const from = normalizeDate(input.from);
      const to = normalizeDate(input.to);
      const shifts = await ctx.db.clubRotaShift.findMany({
        where: { clubId: input.clubId, date: { gte: from, lte: to } },
        orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
        include: {
          participantUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'ClubRotaShift',
          meta: { source: 'club.clubRotaSchedule', clubId: input.clubId, count: shifts.length },
        },
      });

      return shifts.map((shift) => mapClubRotaShift(ctx.db.$enc.decrypt, shift));
    }),

    createClubRotaShift: authedProcedure
      .input(clubRotaShiftInput)
      .mutation(async ({ ctx, input }) => {
        requireClubManager(ctx.user);
        const date = normalizeDate(input.date);
        await assertActiveClub(ctx, input.clubId);
        await assertClubRotaParticipant(ctx, input.clubId, input.participantUserId);
        await assertNoClubShiftOverlap(ctx, { ...input, date });

        const shift = await ctx.db.clubRotaShift.create({
          data: {
            clubId: input.clubId,
            participantUserId: input.participantUserId,
            date,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            notes: input.notes ?? null,
          },
          include: {
            participantUser: {
              select: { id: true, role: true, fullNameEnc: true, emailEnc: true },
            },
          },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'ClubRotaShift',
            entityId: shift.id,
            meta: {
              source: 'club.createClubRotaShift',
              clubId: shift.clubId,
              participantUserId: shift.participantUserId,
              date: dateKey(shift.date),
            },
          },
        });

        return mapClubRotaShift(ctx.db.$enc.decrypt, shift);
      }),

    updateClubRotaShift: authedProcedure
      .input(updateClubRotaShiftInput)
      .mutation(async ({ ctx, input }) => {
        requireClubManager(ctx.user);
        const existing = await ctx.db.clubRotaShift.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            clubId: true,
            participantUserId: true,
            date: true,
            startsAt: true,
            endsAt: true,
          },
        });
        if (!existing)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'club rota shift not found' });

        const next = {
          clubId: input.clubId ?? existing.clubId,
          participantUserId: input.participantUserId ?? existing.participantUserId,
          date: normalizeDate(input.date ?? existing.date),
          startsAt: input.startsAt ?? existing.startsAt,
          endsAt: input.endsAt ?? existing.endsAt,
        };
        if (next.startsAt.getTime() >= next.endsAt.getTime()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'startsAt must be before endsAt' });
        }

        await assertActiveClub(ctx, next.clubId);
        await assertClubRotaParticipant(ctx, next.clubId, next.participantUserId);
        await assertNoClubShiftOverlap(ctx, { ...next, exceptShiftId: existing.id });

        const data = {
          ...(input.clubId !== undefined ? { clubId: next.clubId } : {}),
          ...(input.participantUserId !== undefined
            ? { participantUserId: next.participantUserId }
            : {}),
          ...(input.date !== undefined ? { date: next.date } : {}),
          ...(input.startsAt !== undefined ? { startsAt: next.startsAt } : {}),
          ...(input.endsAt !== undefined ? { endsAt: next.endsAt } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        };

        const shift = await ctx.db.clubRotaShift.update({
          where: { id: input.id },
          data,
          include: {
            participantUser: {
              select: { id: true, role: true, fullNameEnc: true, emailEnc: true },
            },
          },
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ClubRotaShift',
            entityId: shift.id,
            meta: { source: 'club.updateClubRotaShift', fields: Object.keys(data).sort() },
          },
        });

        return mapClubRotaShift(ctx.db.$enc.decrypt, shift);
      }),

    deleteClubRotaShift: authedProcedure
      .input(deleteClubRotaShiftInput)
      .mutation(async ({ ctx, input }) => {
        requireClubManager(ctx.user);
        const shift = await ctx.db.clubRotaShift.findUnique({
          where: { id: input.id },
          select: { id: true, clubId: true },
        });
        if (!shift)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'club rota shift not found' });

        await ctx.db.clubRotaShift.delete({ where: { id: input.id } });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Delete',
            entity: 'ClubRotaShift',
            entityId: shift.id,
            meta: { source: 'club.deleteClubRotaShift', clubId: shift.clubId },
          },
        });

        return { id: shift.id };
      }),

    myClubRota: authedProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
      const from = normalizeDate(input.from);
      const to = normalizeDate(input.to);
      const shifts = await ctx.db.clubRotaShift.findMany({
        where: {
          participantUserId: ctx.user.id,
          date: { gte: from, lte: to },
          club: { active: true, rotaParticipants: { some: { userId: ctx.user.id } } },
        },
        orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
        include: {
          club: { select: { name: true } },
          participantUser: { select: { id: true, role: true, fullNameEnc: true, emailEnc: true } },
        },
      });

      return shifts.map((shift) => mapClubRotaShift(ctx.db.$enc.decrypt, shift));
    }),

    myClubRotaAccess: authedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db.clubRotaParticipant.findMany({
        where: { userId: ctx.user.id, club: { active: true } },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          club: {
            select: {
              id: true,
              name: true,
              schedule: true,
              scheduleStartDate: true,
              scheduleStartMinute: true,
              scheduleEndMinute: true,
              scheduleFrequency: true,
            },
          },
        },
      });

      return rows.map((row) => {
        const schedule = scheduleFromRow(row.club);
        return {
          id: row.club.id,
          name: row.club.name,
          schedule: schedule
            ? {
                startDate: dateKey(schedule.startDate),
                startMinute: schedule.startMinute,
                endMinute: schedule.endMinute,
                frequency: schedule.frequency,
              }
            : null,
          scheduleLabel: formatClubSchedule(schedule) ?? row.club.schedule,
        };
      });
    }),

    myClubAvailability: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
      await assertClubRotaParticipant(ctx, input.clubId, ctx.user.id);
      return ctx.db.clubAvailabilityWindow.findMany({
        where: { clubId: input.clubId, userId: ctx.user.id },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        select: {
          id: true,
          clubId: true,
          userId: true,
          dayOfWeek: true,
          startMinute: true,
          endMinute: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }),

    setMyClubAvailability: authedProcedure
      .input(setClubAvailabilityInput)
      .mutation(async ({ ctx, input }) => {
        await assertClubRotaParticipant(ctx, input.clubId, ctx.user.id);
        assertNoAvailabilityOverlap(input.windows);

        const windows = input.windows
          .map((window) => ({
            clubId: input.clubId,
            userId: ctx.user.id,
            dayOfWeek: window.dayOfWeek,
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          }))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);

        const rows = await ctx.db.$transaction(async (tx) => {
          await tx.clubAvailabilityWindow.deleteMany({
            where: { clubId: input.clubId, userId: ctx.user.id },
          });
          if (windows.length > 0) {
            await tx.clubAvailabilityWindow.createMany({ data: windows });
          }
          return tx.clubAvailabilityWindow.findMany({
            where: { clubId: input.clubId, userId: ctx.user.id },
            orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
            select: {
              id: true,
              clubId: true,
              userId: true,
              dayOfWeek: true,
              startMinute: true,
              endMinute: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        });

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ClubAvailabilityWindow',
            entityId: input.clubId,
            meta: {
              source: 'club.setMyClubAvailability',
              clubId: input.clubId,
              windowCount: rows.length,
            },
          },
        });

        return rows;
      }),

    notifications: authedProcedure.input(clubIdInput).query(async ({ ctx, input }) => {
      await requireClubManagerOrAssignedLead(ctx, input.clubId);

      const club = await ctx.db.club.findUnique({
        where: { id: input.clubId },
        select: { id: true },
      });
      if (!club) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
      }

      const notifications = await ctx.db.clubNotification.findMany({
        where: { clubId: input.clubId },
        select: clubNotificationHistorySelect,
        orderBy: { sentAt: 'desc' },
        take: 20,
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { source: 'club.notifications', clubId: club.id, count: notifications.length },
        },
      });

      return notifications.map((notification) =>
        mapClubNotificationHistoryRow(ctx.db.$enc.decrypt, notification),
      );
    }),

    myClubNotices: authedProcedure.query(async ({ ctx }) => {
      requireLinkedChildSignupAccess(ctx.user);

      const linkedStudentIds = await loadLinkedActiveStudentIds(ctx);
      if (linkedStudentIds.size === 0) return [];

      const notifications = await ctx.db.clubNotification.findMany({
        where: {
          club: {
            active: true,
            signups: {
              some: {
                status: 'Active',
                studentId: { in: [...linkedStudentIds] },
                student: { active: true },
              },
            },
          },
        },
        select: {
          id: true,
          clubId: true,
          title: true,
          bodyEnc: true,
          sentAt: true,
          club: {
            select: {
              name: true,
              signups: {
                where: {
                  status: 'Active',
                  studentId: { in: [...linkedStudentIds] },
                  student: { active: true },
                },
                select: {
                  student: {
                    select: { fullNameEnc: true },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          sentBy: {
            select: { fullNameEnc: true },
          },
        },
        orderBy: { sentAt: 'desc' },
        take: 30,
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'ClubNotification',
          meta: { source: 'club.myClubNotices', count: notifications.length },
        },
      });

      return notifications.map((notification) =>
        mapClubNoticeRow(ctx.db.$enc.decrypt, notification),
      );
    }),

    signUp: authedProcedure.input(clubStudentInput).mutation(async ({ ctx, input }) => {
      const actor = requireSignupActor(ctx.user);

      try {
        return await ctx.db.$transaction(
          async (tx) => {
            const club = await tx.club.findUnique({
              where: { id: input.clubId },
              include: {
                signups: {
                  where: { status: 'Active', student: { active: true } },
                  select: { studentId: true },
                },
              },
            });
            if (!club) {
              throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
            }
            if (!club.active) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'club is inactive' });
            }

            if (actor === 'linked-child-guardian') {
              await assertLinkedChildStudent(tx, ctx.user, input.studentId, {
                requireActive: true,
              });
            } else {
              await assertFullAdminActiveStudent(tx, input.studentId);
            }

            const signupCheckInput = {
              currentActiveSignups: club.signups.length,
              alreadySignedUp: club.signups.some((signup) => signup.studentId === input.studentId),
              ...(club.capacity !== null ? { capacity: club.capacity } : {}),
            };
            const signupCheck = canSignUpForClub(signupCheckInput);
            if (signupCheck !== true) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: signupCheck });
            }

            const signup = await tx.clubSignup.create({
              data: {
                clubId: input.clubId,
                studentId: input.studentId,
                signedUpByUserId: ctx.user.id,
                status: 'Active',
              },
              select: {
                id: true,
                clubId: true,
                studentId: true,
                signedUpByUserId: true,
                status: true,
                createdAt: true,
                withdrawnAt: true,
              },
            });

            await tx.auditLog.create({
              data: {
                userId: ctx.user.id,
                action: 'Create',
                entity: 'ClubSignup',
                entityId: signup.id,
                meta: { source: 'club.signUp', clubId: input.clubId, studentId: input.studentId },
              },
            });

            return signup;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        handleSignupCreateError(error);
      }
    }),

    withdraw: authedProcedure.input(clubStudentInput).mutation(async ({ ctx, input }) => {
      const actor = requireSignupActor(ctx.user);

      return ctx.db.$transaction(async (tx) => {
        const club = await tx.club.findUnique({
          where: { id: input.clubId },
          select: { id: true },
        });
        if (!club) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
        }

        if (actor === 'linked-child-guardian') {
          await assertLinkedChildStudent(tx, ctx.user, input.studentId, { requireActive: false });
        }

        const activeSignup = await tx.clubSignup.findFirst({
          where: { clubId: input.clubId, studentId: input.studentId, status: 'Active' },
          select: { id: true },
        });
        if (!activeSignup) {
          return {
            id: null,
            clubId: input.clubId,
            studentId: input.studentId,
            status: 'Withdrawn' as const,
            withdrawn: false,
            withdrawnAt: null,
          };
        }

        const signup = await tx.clubSignup.update({
          where: { id: activeSignup.id },
          data: { status: 'Withdrawn', withdrawnAt: new Date() },
          select: {
            id: true,
            clubId: true,
            studentId: true,
            signedUpByUserId: true,
            status: true,
            createdAt: true,
            withdrawnAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'ClubSignup',
            entityId: signup.id,
            meta: { source: 'club.withdraw', clubId: input.clubId, studentId: input.studentId },
          },
        });

        return { ...signup, withdrawn: true };
      });
    }),

    notify: authedProcedure.input(clubNotifyInput).mutation(async ({ ctx, input }) => {
      await requireClubManagerOrAssignedLead(ctx, input.clubId);

      const club = await ctx.db.club.findUnique({
        where: { id: input.clubId },
        select: clubNotificationSelect,
      });
      if (!club) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'club not found' });
      }
      if (!club.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'club is inactive' });
      }

      const recipients = notificationRecipientsFor(club);
      const notification = await ctx.db.clubNotification.create({
        data: {
          clubId: club.id,
          title: input.title,
          bodyEnc: ctx.db.$enc.encrypt(input.body),
          sentById: ctx.user.id,
        },
        select: {
          id: true,
          clubId: true,
          title: true,
          sentAt: true,
        },
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'ClubNotification',
          entityId: notification.id,
          meta: {
            source: 'club.notify',
            clubId: club.id,
            recipientCount: recipients.length,
          },
        },
      });

      const { failedCount, sentCount } =
        recipients.length === 0
          ? { failedCount: 0, sentCount: 0 }
          : await sendClubNotificationEmails({
              body: input.body,
              club,
              ctx,
              getEmailClient,
              notificationId: notification.id,
              recipients,
              title: input.title,
            });

      return {
        ...notification,
        recipientCount: recipients.length,
        sentCount,
        failedCount,
      };
    }),
  });
}

export const clubRouter = createClubRouter();
