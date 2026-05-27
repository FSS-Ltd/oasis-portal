import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type {
  PermissionSlipCategory,
  Prisma,
} from '@oasis/db';
import {
  AccessDeniedError,
  assertPermissionSlipCanBeParentMarkedPaid,
  assertPermissionSlipPaymentCanBeConfirmed,
  canUseLinkedChildPermissionSlipAccess,
  initialPermissionSlipPaymentStatus,
  permissionSlipCalendarCategory,
  PERMISSION_SLIP_CATEGORIES,
  requireCanManagePermissionSlips,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const categorySchema = z.enum(
  PERMISSION_SLIP_CATEGORIES as unknown as readonly [
    PermissionSlipCategory,
    ...PermissionSlipCategory[],
  ],
);
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Enter a valid date');
const timeKeySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'Enter a valid time');

const questionInput = z.object({
  label: z.string().trim().min(1, 'Enter a question').max(240, 'Question is too long'),
  required: z.boolean().default(true),
});

const permissionSlipInput = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(160, 'Title is too long'),
  category: categorySchema.default('SchoolTrip'),
  description: z.string().trim().max(4000, 'Description is too long').optional(),
  eventDate: dateKeySchema.optional(),
  deadline: dateKeySchema,
  departureTime: timeKeySchema.optional(),
  returnTime: timeKeySchema.optional(),
  location: z.string().trim().max(240, 'Location is too long').optional(),
  transport: z.string().trim().max(160, 'Transport is too long').optional(),
  cost: z.string().trim().max(80, 'Cost is too long').optional(),
  consentText: z.string().trim().min(1, 'Enter the consent text').max(2000, 'Consent text is too long'),
  requireMedical: z.boolean().default(false),
  requireEmergencyContact: z.boolean().default(false),
  requirePayment: z.boolean().default(false),
  recipientLabel: z.string().trim().min(1, 'Enter a recipient label').max(160, 'Recipient label is too long'),
  studentIds: z.array(z.string().min(1)).min(1, 'Choose at least one student').max(500),
  bringItems: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  questions: z.array(questionInput).max(20).default([]),
});

const updatePermissionSlipInput = permissionSlipInput.extend({
  id: z.string().min(1),
});

const recipientInput = z.object({
  slipId: z.string().min(1),
  studentId: z.string().min(1),
});

const parentResponseInput = recipientInput.extend({
  decision: z.enum(['Signed', 'Declined']),
  parentName: z.string().trim().min(1, 'Enter your full name').max(160, 'Name is too long'),
  medicalInfo: z.string().trim().max(2000, 'Medical information is too long').optional(),
  emergencyContact: z.string().trim().max(500, 'Emergency contact is too long').optional(),
  declineReason: z.string().trim().max(1000, 'Reason is too long').optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().trim().max(1000, 'Answer is too long'),
      }),
    )
    .default([]),
});

const slipInclude = {
  bringItems: { orderBy: { position: 'asc' } },
  questions: { orderBy: { position: 'asc' } },
  recipients: {
    orderBy: { position: 'asc' },
    include: {
      answers: true,
      student: {
        select: {
          id: true,
          fullNameEnc: true,
          yearGroup: true,
        },
      },
    },
  },
} satisfies Prisma.PermissionSlipInclude;

type PermissionSlipRow = Prisma.PermissionSlipGetPayload<{ include: typeof slipInclude }>;
type PermissionSlipRecipientRow = PermissionSlipRow['recipients'][number];

interface CalendarEventSyncData {
  title: string;
  descriptionEnc: string | null;
  audience: 'Parents';
  category: 'Trips' | 'OasisDays';
  startDate: Date;
  endDate: Date;
  startTimeMinutes: number | null;
  endTimeMinutes: number | null;
  active: true;
}

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requirePermissionSlipManager(user: SessionUser): void {
  try {
    requireCanManagePermissionSlips(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) throw toForbidden(error);
    throw error;
  }
}

function dateFromKey(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateKey(date) !== value) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter a valid date' });
  }
  return date;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function minutesFromTime(value: string): number {
  const [hoursValue, minutesValue] = value.split(':');
  return Number(hoursValue) * 60 + Number(minutesValue);
}

function timeFromMinutes(value: number | null): string | null {
  if (value === null) return null;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function encryptOptional(ctx: AuthedContext, value: string | undefined): string | null {
  const normalized = optionalText(value);
  return normalized ? ctx.db.$enc.encrypt(normalized) : null;
}

function decryptOptional(
  decrypt: (value: string | null | undefined) => string | null,
  value: string | null,
): string | null {
  if (!value) return null;
  return decrypt(value);
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

function parseTimeRange(input: {
  departureTime?: string | undefined;
  eventDate?: string | undefined;
  returnTime?: string | undefined;
}): { departureTimeMinutes: number | null; returnTimeMinutes: number | null } {
  const hasDeparture = input.departureTime !== undefined && input.departureTime !== '';
  const hasReturn = input.returnTime !== undefined && input.returnTime !== '';
  if (!hasDeparture && !hasReturn) {
    return { departureTimeMinutes: null, returnTimeMinutes: null };
  }
  if (!input.eventDate) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'permission slip times require an event date',
    });
  }
  if (!hasDeparture || !hasReturn || !input.departureTime || !input.returnTime) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'permission slip time range requires departure and return times',
    });
  }
  const departureTimeMinutes = minutesFromTime(input.departureTime);
  const returnTimeMinutes = minutesFromTime(input.returnTime);
  if (returnTimeMinutes <= departureTimeMinutes) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'return time must be after departure time',
    });
  }
  return { departureTimeMinutes, returnTimeMinutes };
}

function uniqueStudentIds(studentIds: readonly string[]): string[] {
  return [...new Set(studentIds)];
}

async function assertActiveStudents(tx: RlsTx, studentIds: readonly string[]) {
  const uniqueIds = uniqueStudentIds(studentIds);
  const students = await tx.student.findMany({
    where: { id: { in: uniqueIds }, active: true },
    select: { id: true },
  });
  if (students.length !== uniqueIds.length) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'one or more students were not found' });
  }
  return uniqueIds;
}

async function linkedChildStudentIds(ctx: AuthedContext): Promise<string[]> {
  const guardians = await ctx.db.guardian.findMany({
    where: { userId: ctx.user.id },
    select: { studentId: true },
  });
  return guardians.map((guardian) => guardian.studentId);
}

async function assertLinkedChildGuardianRecipientAccess(
  ctx: AuthedContext,
  input: { slipId: string; studentId: string },
): Promise<void> {
  if (!canUseLinkedChildPermissionSlipAccess(ctx.user)) {
    throw toForbidden(
      new AccessDeniedError('permission slip response requires linked-child guardian access'),
    );
  }
  const guardian = await ctx.db.guardian.findUnique({
    where: { userId_studentId: { userId: ctx.user.id, studentId: input.studentId } },
    select: { id: true },
  });
  if (!guardian) {
    throw toForbidden(new AccessDeniedError('permission slip response requires linked child'));
  }
  const recipient = await ctx.db.permissionSlipRecipient.findUnique({
    where: { slipId_studentId: input },
    select: { slipId: true },
  });
  if (!recipient) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip recipient not found' });
  }
}

function slipDataFromInput(
  ctx: AuthedContext,
  input: z.infer<typeof permissionSlipInput>,
): Omit<
  Prisma.PermissionSlipCreateInput,
  'bringItems' | 'calendarEvent' | 'createdBy' | 'questions' | 'recipients'
> {
  const deadline = dateFromKey(input.deadline);
  const eventDate = input.eventDate ? dateFromKey(input.eventDate) : null;
  if (eventDate && deadline > eventDate) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'deadline must be on or before the event date',
    });
  }
  const timeRange = parseTimeRange(input);
  return {
    title: input.title,
    category: input.category,
    descriptionEnc: encryptOptional(ctx, input.description),
    eventDate,
    deadline,
    ...timeRange,
    locationEnc: encryptOptional(ctx, input.location),
    transportEnc: encryptOptional(ctx, input.transport),
    costEnc: encryptOptional(ctx, input.cost),
    consentTextEnc: ctx.db.$enc.encrypt(input.consentText),
    requireMedical: input.requireMedical,
    requireEmergencyContact: input.requireEmergencyContact,
    requirePayment: input.requirePayment,
    recipientLabel: input.recipientLabel,
    active: true,
  };
}

function calendarDataFromInput(
  ctx: AuthedContext,
  input: z.infer<typeof permissionSlipInput>,
): CalendarEventSyncData | null {
  if (!input.eventDate) return null;
  const eventDate = dateFromKey(input.eventDate);
  const timeRange = parseTimeRange(input);
  const description = optionalText(input.description);
  return {
    title: input.title,
    descriptionEnc: description ? ctx.db.$enc.encrypt(description) : null,
    audience: 'Parents',
    category: permissionSlipCalendarCategory(input.category),
    startDate: eventDate,
    endDate: eventDate,
    startTimeMinutes: timeRange.departureTimeMinutes,
    endTimeMinutes: timeRange.returnTimeMinutes,
    active: true,
  };
}

function mapRecipient(ctx: AuthedContext, recipient: PermissionSlipRecipientRow) {
  return {
    studentId: recipient.studentId,
    student: {
      id: recipient.student.id,
      fullName: decryptRequired(ctx.db.$enc.decrypt, recipient.student.fullNameEnc, 'student name'),
      yearGroup: recipient.student.yearGroup,
    },
    position: recipient.position,
    responseStatus: recipient.responseStatus,
    signatureSource: recipient.signatureSource,
    parentName: decryptOptional(ctx.db.$enc.decrypt, recipient.parentNameEnc),
    signedAt: recipient.signedAt,
    medicalInfo: decryptOptional(ctx.db.$enc.decrypt, recipient.medicalInfoEnc),
    emergencyContact: decryptOptional(ctx.db.$enc.decrypt, recipient.emergencyContactEnc),
    declineReason: decryptOptional(ctx.db.$enc.decrypt, recipient.declineReasonEnc),
    parentRespondedById: recipient.parentRespondedById,
    physicalSignedById: recipient.physicalSignedById,
    paymentStatus: recipient.paymentStatus,
    parentMarkedPaidAt: recipient.parentMarkedPaidAt,
    parentMarkedPaidById: recipient.parentMarkedPaidById,
    paymentConfirmedAt: recipient.paymentConfirmedAt,
    paymentConfirmedById: recipient.paymentConfirmedById,
    answers: recipient.answers.map((answer) => ({
      questionId: answer.questionId,
      answer: decryptRequired(ctx.db.$enc.decrypt, answer.answerEnc, 'permission slip answer'),
    })),
  };
}

function mapSlip(ctx: AuthedContext, slip: PermissionSlipRow, now = new Date()) {
  const recipients = slip.recipients.map((recipient) => mapRecipient(ctx, recipient));
  const signed = recipients.filter((recipient) => recipient.responseStatus === 'Signed').length;
  const declined = recipients.filter((recipient) => recipient.responseStatus === 'Declined').length;
  const pending = recipients.filter((recipient) => recipient.responseStatus === 'Pending').length;
  const paid = recipients.filter((recipient) => recipient.paymentStatus === 'Paid').length;
  const paymentPending = recipients.filter(
    (recipient) => recipient.paymentStatus === 'PaymentPending',
  ).length;
  const inactive = !slip.active || dateKey(slip.deadline) < todayKey(now);
  return {
    id: slip.id,
    title: slip.title,
    category: slip.category,
    description: decryptOptional(ctx.db.$enc.decrypt, slip.descriptionEnc),
    eventDate: slip.eventDate ? dateKey(slip.eventDate) : null,
    deadline: dateKey(slip.deadline),
    departureTime: timeFromMinutes(slip.departureTimeMinutes),
    returnTime: timeFromMinutes(slip.returnTimeMinutes),
    location: decryptOptional(ctx.db.$enc.decrypt, slip.locationEnc),
    transport: decryptOptional(ctx.db.$enc.decrypt, slip.transportEnc),
    cost: decryptOptional(ctx.db.$enc.decrypt, slip.costEnc),
    consentText: decryptRequired(ctx.db.$enc.decrypt, slip.consentTextEnc, 'consent text'),
    requireMedical: slip.requireMedical,
    requireEmergencyContact: slip.requireEmergencyContact,
    requirePayment: slip.requirePayment,
    recipientLabel: slip.recipientLabel,
    active: slip.active,
    inactive,
    calendarEventId: slip.calendarEventId,
    createdById: slip.createdById,
    createdAt: slip.createdAt,
    updatedAt: slip.updatedAt,
    bringItems: slip.bringItems.map((item) => ({
      id: item.id,
      label: decryptRequired(ctx.db.$enc.decrypt, item.labelEnc, 'permission slip bring item'),
      position: item.position,
    })),
    questions: slip.questions.map((question) => ({
      id: question.id,
      label: decryptRequired(ctx.db.$enc.decrypt, question.labelEnc, 'permission slip question'),
      required: question.required,
      position: question.position,
    })),
    recipients,
    stats: {
      total: recipients.length,
      signed,
      declined,
      pending,
      paid,
      paymentPending,
    },
  };
}

async function loadSlip(tx: RlsTx, slipId: string): Promise<PermissionSlipRow> {
  const slip = await tx.permissionSlip.findUnique({
    where: { id: slipId },
    include: slipInclude,
  });
  if (!slip) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip not found' });
  }
  return slip;
}

async function createCalendarEventForSlip(
  ctx: AuthedContext,
  tx: RlsTx,
  input: z.infer<typeof permissionSlipInput>,
): Promise<string | null> {
  const calendarData = calendarDataFromInput(ctx, input);
  if (!calendarData) return null;
  const event = await tx.calendarEvent.create({
    data: { ...calendarData, createdById: ctx.user.id },
  });
  await tx.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Create',
      entity: 'CalendarEvent',
      entityId: event.id,
      meta: { source: 'permissionSlip.create' },
    },
  });
  return event.id;
}

async function syncCalendarEventForSlip(
  ctx: AuthedContext,
  tx: RlsTx,
  slip: { calendarEventId: string | null; id: string },
  input: z.infer<typeof permissionSlipInput>,
): Promise<string | null> {
  const calendarData = calendarDataFromInput(ctx, input);
  if (!calendarData) {
    if (slip.calendarEventId) {
      await tx.calendarEvent.update({
        where: { id: slip.calendarEventId },
        data: { active: false },
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'CalendarEvent',
          entityId: slip.calendarEventId,
          meta: { source: 'permissionSlip.update.unlink' },
        },
      });
    }
    return null;
  }
  if (!slip.calendarEventId) {
    return createCalendarEventForSlip(ctx, tx, input);
  }
  await tx.calendarEvent.update({
    where: { id: slip.calendarEventId },
    data: {
      title: calendarData.title,
      descriptionEnc: calendarData.descriptionEnc,
      audience: calendarData.audience,
      category: calendarData.category,
      startDate: calendarData.startDate,
      endDate: calendarData.endDate,
      startTimeMinutes: calendarData.startTimeMinutes,
      endTimeMinutes: calendarData.endTimeMinutes,
      active: true,
    },
  });
  await tx.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Update',
      entity: 'CalendarEvent',
      entityId: slip.calendarEventId,
      meta: { source: 'permissionSlip.update' },
    },
  });
  return slip.calendarEventId;
}

async function replaceSlipCollections(
  ctx: AuthedContext,
  tx: RlsTx,
  slipId: string,
  input: z.infer<typeof permissionSlipInput>,
): Promise<void> {
  const studentIds = await assertActiveStudents(tx, input.studentIds);
  await tx.permissionSlipBringItem.deleteMany({ where: { slipId } });
  await tx.permissionSlipQuestion.deleteMany({ where: { slipId } });
  await tx.permissionSlipRecipient.deleteMany({
    where: { slipId, studentId: { notIn: studentIds } },
  });
  await tx.permissionSlipRecipient.createMany({
    data: studentIds.map((studentId, index) => ({
      slipId,
      studentId,
      position: index + 1,
      paymentStatus: initialPermissionSlipPaymentStatus(input.requirePayment),
    })),
    skipDuplicates: true,
  });
  await Promise.all(
    studentIds.map((studentId, index) =>
      tx.permissionSlipRecipient.update({
        where: { slipId_studentId: { slipId, studentId } },
        data: { position: index + 1 },
      }),
    ),
  );
  if (input.bringItems.length > 0) {
    await tx.permissionSlipBringItem.createMany({
      data: input.bringItems.map((label, index) => ({
        slipId,
        position: index + 1,
        labelEnc: ctx.db.$enc.encrypt(label),
      })),
    });
  }
  if (input.questions.length > 0) {
    await tx.permissionSlipQuestion.createMany({
      data: input.questions.map((question, index) => ({
        slipId,
        position: index + 1,
        labelEnc: ctx.db.$enc.encrypt(question.label),
        required: question.required,
      })),
    });
  }
}

function assertParentDeadlineOpen(slip: Pick<PermissionSlipRow, 'deadline'>): void {
  if (dateKey(slip.deadline) < todayKey()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'permission slip deadline has passed' });
  }
}

function validateParentResponse(
  slip: PermissionSlipRow,
  input: z.infer<typeof parentResponseInput>,
): void {
  assertParentDeadlineOpen(slip);
  const recipient = slip.recipients.find((row) => row.studentId === input.studentId);
  if (!recipient) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip recipient not found' });
  }
  if (recipient.responseStatus !== 'Pending') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'permission slip has already been answered',
    });
  }
  if (input.decision === 'Signed') {
    const questionIds = new Set(slip.questions.map((question) => question.id));
    const unexpectedAnswer = input.answers.find((answer) => !questionIds.has(answer.questionId));
    if (unexpectedAnswer) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'permission slip answer does not match this slip',
      });
    }
    if (slip.requireMedical && !optionalText(input.medicalInfo)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'medical information is required' });
    }
    if (slip.requireEmergencyContact && !optionalText(input.emergencyContact)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'emergency contact is required' });
    }
    const answersByQuestionId = new Map(
      input.answers.map((answer) => [answer.questionId, optionalText(answer.answer)]),
    );
    const missingQuestion = slip.questions.find(
      (question) => question.required && !answersByQuestionId.get(question.id),
    );
    if (missingQuestion) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'all required questions need answers' });
    }
  }
}

export const permissionSlipRouter = router({
  listStudentCandidates: authedProcedure.query(async ({ ctx }) => {
    requirePermissionSlipManager(ctx.user);
    const students = await ctx.withRls((tx) =>
      tx.student.findMany({
        where: { active: true },
        orderBy: [{ yearGroup: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, fullNameEnc: true, yearGroup: true },
      }),
    );
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: students.length, source: 'permissionSlip.listStudentCandidates' },
      },
    });
    return students.map((student) => ({
      id: student.id,
      fullName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student name'),
      yearGroup: student.yearGroup,
    }));
  }),

  listAdmin: authedProcedure.query(async ({ ctx }) => {
    requirePermissionSlipManager(ctx.user);
    const rows = await ctx.withRls((tx) =>
      tx.permissionSlip.findMany({
        include: slipInclude,
        orderBy: [{ active: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
      }),
    );
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'PermissionSlip',
        meta: { count: rows.length, source: 'permissionSlip.listAdmin' },
      },
    });
    const slips = rows.map((slip) => mapSlip(ctx, slip));
    const stats = slips.reduce(
      (acc, slip) => ({
        active: acc.active + (slip.inactive ? 0 : 1),
        inactive: acc.inactive + (slip.inactive ? 1 : 0),
        signed: acc.signed + slip.stats.signed,
        pending: acc.pending + slip.stats.pending,
        declined: acc.declined + slip.stats.declined,
        paymentPending: acc.paymentPending + slip.stats.paymentPending,
      }),
      { active: 0, inactive: 0, signed: 0, pending: 0, declined: 0, paymentPending: 0 },
    );
    return { slips, stats };
  }),

  listParent: authedProcedure.query(async ({ ctx }) => {
    if (!canUseLinkedChildPermissionSlipAccess(ctx.user)) {
      throw toForbidden(
        new AccessDeniedError('permission slip list requires linked-child guardian access'),
      );
    }
    const studentIds = await linkedChildStudentIds(ctx);
    if (studentIds.length === 0) return { slips: [] };
    const rows = await ctx.withRls((tx) =>
      tx.permissionSlip.findMany({
        where: {
          active: true,
          recipients: { some: { studentId: { in: studentIds } } },
        },
        include: slipInclude,
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      }),
    );
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'PermissionSlip',
        meta: { count: rows.length, source: 'permissionSlip.listParent' },
      },
    });
    return {
      slips: rows.map((slip) => ({
        ...mapSlip(ctx, {
          ...slip,
          recipients: slip.recipients.filter((recipient) =>
            studentIds.includes(recipient.studentId),
          ),
        }),
      })),
    };
  }),

  create: authedProcedure.input(permissionSlipInput).mutation(async ({ ctx, input }) => {
    requirePermissionSlipManager(ctx.user);
    const slip = await ctx.withRls(async (tx) => {
      const calendarEventId = await createCalendarEventForSlip(ctx, tx, input);
      const data: Prisma.PermissionSlipCreateInput = {
        ...slipDataFromInput(ctx, input),
        createdBy: { connect: { id: ctx.user.id } },
      };
      if (calendarEventId) {
        data.calendarEvent = { connect: { id: calendarEventId } };
      }
      const created = await tx.permissionSlip.create({
        data,
      });
      await replaceSlipCollections(ctx, tx, created.id, input);
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'PermissionSlip',
          entityId: created.id,
          meta: {
            source: 'permissionSlip.create',
            studentCount: input.studentIds.length,
            calendarEventId,
          },
        },
      });
      return loadSlip(tx, created.id);
    });
    return mapSlip(ctx, slip);
  }),

  update: authedProcedure.input(updatePermissionSlipInput).mutation(async ({ ctx, input }) => {
    requirePermissionSlipManager(ctx.user);
    const slip = await ctx.withRls(async (tx) => {
      const existing = await tx.permissionSlip.findUnique({
        where: { id: input.id },
        select: { id: true, calendarEventId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip not found' });
      }
      const calendarEventId = await syncCalendarEventForSlip(ctx, tx, existing, input);
      const updated = await tx.permissionSlip.update({
        where: { id: input.id },
        data: {
          ...slipDataFromInput(ctx, input),
          calendarEventId,
        },
      });
      await replaceSlipCollections(ctx, tx, updated.id, input);
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'PermissionSlip',
          entityId: updated.id,
          meta: { source: 'permissionSlip.update', calendarEventId },
        },
      });
      return loadSlip(tx, updated.id);
    });
    return mapSlip(ctx, slip);
  }),

  archive: authedProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    requirePermissionSlipManager(ctx.user);
    const slip = await ctx.withRls(async (tx) => {
      const existing = await tx.permissionSlip.findUnique({
        where: { id: input.id },
        select: { id: true, calendarEventId: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip not found' });
      }
      if (existing.calendarEventId) {
        await tx.calendarEvent.update({
          where: { id: existing.calendarEventId },
          data: { active: false },
        });
      }
      const updated = await tx.permissionSlip.update({
        where: { id: input.id },
        data: { active: false },
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'PermissionSlip',
          entityId: updated.id,
          meta: { source: 'permissionSlip.archive', calendarEventId: existing.calendarEventId },
        },
      });
      return loadSlip(tx, updated.id);
    });
    return mapSlip(ctx, slip);
  }),

  submitParentResponse: authedProcedure.input(parentResponseInput).mutation(async ({ ctx, input }) => {
    await assertLinkedChildGuardianRecipientAccess(ctx, input);
    const slip = await ctx.withRls(async (tx) => {
      const current = await loadSlip(tx, input.slipId);
      validateParentResponse(current, input);
      const paymentStatus = current.requirePayment && input.decision === 'Signed' ? 'Unpaid' : 'NotRequired';
      await tx.permissionSlipRecipient.update({
        where: { slipId_studentId: { slipId: input.slipId, studentId: input.studentId } },
        data: {
          responseStatus: input.decision,
          signatureSource: input.decision === 'Signed' ? 'ParentPortal' : null,
          parentNameEnc: ctx.db.$enc.encrypt(input.parentName),
          signedAt: new Date(),
          medicalInfoEnc: input.decision === 'Signed' ? encryptOptional(ctx, input.medicalInfo) : null,
          emergencyContactEnc:
            input.decision === 'Signed' ? encryptOptional(ctx, input.emergencyContact) : null,
          declineReasonEnc:
            input.decision === 'Declined' ? encryptOptional(ctx, input.declineReason) : null,
          parentRespondedById: ctx.user.id,
          paymentStatus,
        },
      });
      if (input.decision === 'Signed' && input.answers.length > 0) {
        await tx.permissionSlipAnswer.createMany({
          data: input.answers
            .filter((answer) => optionalText(answer.answer))
            .map((answer) => ({
              questionId: answer.questionId,
              slipId: input.slipId,
              studentId: input.studentId,
              answerEnc: ctx.db.$enc.encrypt(answer.answer),
            })),
        });
      }
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'PermissionSlipRecipient',
          entityId: `${input.slipId}:${input.studentId}`,
          meta: { source: 'permissionSlip.submitParentResponse', decision: input.decision },
        },
      });
      return loadSlip(tx, input.slipId);
    });
    return mapSlip(ctx, slip);
  }),

  parentMarkPaid: authedProcedure.input(recipientInput).mutation(async ({ ctx, input }) => {
    await assertLinkedChildGuardianRecipientAccess(ctx, input);
    const slip = await ctx.withRls(async (tx) => {
      const recipient = await tx.permissionSlipRecipient.findUnique({
        where: { slipId_studentId: input },
        select: { paymentStatus: true, responseStatus: true },
      });
      if (!recipient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip recipient not found' });
      }
      try {
        assertPermissionSlipCanBeParentMarkedPaid({
          paymentStatus: recipient.paymentStatus,
          responseStatus: recipient.responseStatus,
        });
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'payment cannot be marked paid',
        });
      }
      await tx.permissionSlipRecipient.update({
        where: { slipId_studentId: input },
        data: {
          paymentStatus: 'PaymentPending',
          parentMarkedPaidAt: new Date(),
          parentMarkedPaidById: ctx.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'PermissionSlipRecipient',
          entityId: `${input.slipId}:${input.studentId}`,
          meta: { source: 'permissionSlip.parentMarkPaid' },
        },
      });
      return loadSlip(tx, input.slipId);
    });
    return mapSlip(ctx, slip);
  }),

  markPhysicalSigned: authedProcedure
    .input(
      recipientInput.extend({
        parentName: z.string().trim().min(1, 'Enter the signer name').max(160),
        medicalInfo: z.string().trim().max(2000).optional(),
        emergencyContact: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requirePermissionSlipManager(ctx.user);
      const slip = await ctx.withRls(async (tx) => {
        const current = await loadSlip(tx, input.slipId);
        const recipient = current.recipients.find((row) => row.studentId === input.studentId);
        if (!recipient) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip recipient not found' });
        }
        if (recipient.responseStatus !== 'Pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'permission slip has already been answered' });
        }
        await tx.permissionSlipRecipient.update({
          where: { slipId_studentId: { slipId: input.slipId, studentId: input.studentId } },
          data: {
            responseStatus: 'Signed',
            signatureSource: 'Physical',
            parentNameEnc: ctx.db.$enc.encrypt(input.parentName),
            signedAt: new Date(),
            medicalInfoEnc: encryptOptional(ctx, input.medicalInfo),
            emergencyContactEnc: encryptOptional(ctx, input.emergencyContact),
            physicalSignedById: ctx.user.id,
            paymentStatus: current.requirePayment ? 'Unpaid' : 'NotRequired',
          },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'PermissionSlipRecipient',
            entityId: `${input.slipId}:${input.studentId}`,
            meta: { source: 'permissionSlip.markPhysicalSigned' },
          },
        });
        return loadSlip(tx, input.slipId);
      });
      return mapSlip(ctx, slip);
    }),

  confirmPayment: authedProcedure.input(recipientInput).mutation(async ({ ctx, input }) => {
    requirePermissionSlipManager(ctx.user);
    const slip = await ctx.withRls(async (tx) => {
      const recipient = await tx.permissionSlipRecipient.findUnique({
        where: { slipId_studentId: input },
        select: { paymentStatus: true },
      });
      if (!recipient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip recipient not found' });
      }
      try {
        assertPermissionSlipPaymentCanBeConfirmed(recipient.paymentStatus);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'payment cannot be confirmed',
        });
      }
      const now = new Date();
      await tx.permissionSlipRecipient.update({
        where: { slipId_studentId: input },
        data: {
          paymentStatus: 'Paid',
          paymentConfirmedAt: now,
          paymentConfirmedById: ctx.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'PermissionSlipRecipient',
          entityId: `${input.slipId}:${input.studentId}`,
          meta: { source: 'permissionSlip.confirmPayment' },
        },
      });
      return loadSlip(tx, input.slipId);
    });
    return mapSlip(ctx, slip);
  }),

  rejectPayment: authedProcedure.input(recipientInput).mutation(async ({ ctx, input }) => {
    requirePermissionSlipManager(ctx.user);
    const slip = await ctx.withRls(async (tx) => {
      const recipient = await tx.permissionSlipRecipient.findUnique({
        where: { slipId_studentId: input },
        select: { paymentStatus: true },
      });
      if (!recipient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'permission slip recipient not found' });
      }
      if (recipient.paymentStatus !== 'PaymentPending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'only pending payments can be rejected' });
      }
      await tx.permissionSlipRecipient.update({
        where: { slipId_studentId: input },
        data: {
          paymentStatus: 'Unpaid',
          parentMarkedPaidAt: null,
          parentMarkedPaidById: null,
          paymentConfirmedAt: null,
          paymentConfirmedById: null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'PermissionSlipRecipient',
          entityId: `${input.slipId}:${input.studentId}`,
          meta: { source: 'permissionSlip.rejectPayment' },
        },
      });
      return loadSlip(tx, input.slipId);
    });
    return mapSlip(ctx, slip);
  }),
});
