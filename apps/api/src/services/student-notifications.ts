import { CLUBS_VISIBLE } from '@oasis/domain/portal-visibility';
import { TRPCError } from '@trpc/server';
import type { Prisma, StudentNotificationKind } from '@oasis/db';
import type { AppContext, RlsTx } from '../context.js';

export interface StudentNotificationDto {
  id: string;
  kind: StudentNotificationKind;
  title: string;
  body: string;
  sourceEntity: string | null;
  sourceId: string | null;
  createdAt: Date;
  readAt: Date | null;
  read: boolean;
}

export interface StudentNotificationPreviewDto {
  count: number;
  unreadCount: number;
  latest: Array<{ id: string; title: string; createdAt: Date; read: boolean }>;
}

export interface CreateStudentNotificationInput {
  studentId: string;
  kind: StudentNotificationKind;
  title: string;
  body: string;
  sourceEntity?: string | null;
  sourceId?: string | null;
  createdById?: string | null;
}

const studentNotificationSelect = {
  id: true,
  kind: true,
  title: true,
  bodyEnc: true,
  sourceEntity: true,
  sourceId: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.StudentNotificationSelect;

const studentNotificationPreviewSelect = {
  id: true,
  title: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.StudentNotificationSelect;

type StudentNotificationRow = Prisma.StudentNotificationGetPayload<{
  select: typeof studentNotificationSelect;
}>;

function notificationData(
  ctx: Pick<AppContext, 'db'>,
  input: CreateStudentNotificationInput,
): Prisma.StudentNotificationUncheckedCreateInput {
  return {
    studentId: input.studentId,
    kind: input.kind,
    title: input.title,
    bodyEnc: ctx.db.$enc.encrypt(input.body),
    sourceEntity: input.sourceEntity ?? null,
    sourceId: input.sourceId ?? null,
    createdById: input.createdById ?? null,
  };
}

export function mapStudentNotification(
  decrypt: (value: string | null | undefined) => string | null,
  row: StudentNotificationRow,
): StudentNotificationDto {
  const body = decrypt(row.bodyEnc);
  if (!body) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'student notification decrypt failed',
    });
  }

  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body,
    sourceEntity: row.sourceEntity,
    sourceId: row.sourceId,
    createdAt: row.createdAt,
    readAt: row.readAt,
    read: row.readAt !== null,
  };
}

export async function loadStudentNotificationPreview(
  db: Pick<RlsTx, 'studentNotification'>,
  studentId: string,
): Promise<StudentNotificationPreviewDto> {
  const [count, unreadCount, latest] = await Promise.all([
    db.studentNotification.count({
      where: { studentId, ...(!CLUBS_VISIBLE ? { kind: { not: 'ClubNotice' } } : {}) },
    }),
    db.studentNotification.count({
      where: {
        studentId,
        readAt: null,
        ...(!CLUBS_VISIBLE ? { kind: { not: 'ClubNotice' } } : {}),
      },
    }),
    db.studentNotification.findMany({
      where: { studentId, ...(!CLUBS_VISIBLE ? { kind: { not: 'ClubNotice' } } : {}) },
      select: studentNotificationPreviewSelect,
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  return {
    count,
    unreadCount,
    latest: latest.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      read: row.readAt !== null,
    })),
  };
}

export async function listStudentNotifications(
  ctx: Pick<AppContext, 'db' | 'user'>,
  db: Pick<RlsTx, 'auditLog' | 'studentNotification'>,
  studentId: string,
): Promise<StudentNotificationDto[]> {
  const rows = await db.studentNotification.findMany({
    where: { studentId, ...(!CLUBS_VISIBLE ? { kind: { not: 'ClubNotice' } } : {}) },
    select: studentNotificationSelect,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (rows.length > 0) {
    await db.auditLog.create({
      data: {
        userId: ctx.user?.id ?? null,
        action: 'DecryptPii',
        entity: 'StudentNotification',
        meta: { source: 'studentNotification.list', studentId, count: rows.length },
      },
    });
  }

  return rows.map((row) => mapStudentNotification(ctx.db.$enc.decrypt, row));
}

export async function createStudentNotification(
  ctx: Pick<AppContext, 'db' | 'user'>,
  db: Pick<RlsTx, 'auditLog' | 'studentNotification'>,
  input: CreateStudentNotificationInput,
): Promise<{ id: string }> {
  const notification = await db.studentNotification.create({
    data: notificationData(ctx, input),
    select: { id: true },
  });

  await db.auditLog.create({
    data: {
      userId: ctx.user?.id ?? input.createdById ?? null,
      action: 'Create',
      entity: 'StudentNotification',
      entityId: notification.id,
      meta: {
        studentId: input.studentId,
        kind: input.kind,
        sourceEntity: input.sourceEntity ?? null,
        sourceId: input.sourceId ?? null,
      },
    },
  });

  return notification;
}

export async function createStudentNotifications(
  ctx: Pick<AppContext, 'db' | 'user'>,
  db: Pick<RlsTx, 'auditLog' | 'studentNotification'>,
  input: {
    notifications: readonly CreateStudentNotificationInput[];
    auditSource: string;
  },
): Promise<{ count: number }> {
  if (input.notifications.length === 0) return { count: 0 };

  await db.studentNotification.createMany({
    data: input.notifications.map((notification) => notificationData(ctx, notification)),
  });

  await db.auditLog.create({
    data: {
      userId: ctx.user?.id ?? input.notifications[0]?.createdById ?? null,
      action: 'Create',
      entity: 'StudentNotification',
      meta: {
        source: input.auditSource,
        count: input.notifications.length,
        kinds: [...new Set(input.notifications.map((notification) => notification.kind))],
      },
    },
  });

  return { count: input.notifications.length };
}
