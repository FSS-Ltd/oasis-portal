import { TRPCError } from '@trpc/server';
import type { ParentNotificationKind, Prisma } from '@oasis/db';
import type { AppContext, RlsTx } from '../context.js';

export interface ParentNotificationDto {
  id: string;
  kind: ParentNotificationKind;
  title: string;
  body: string;
  href: string | null;
  sourceEntity: string | null;
  sourceId: string | null;
  createdAt: Date;
  readAt: Date | null;
  read: boolean;
}

export interface CreateParentNotificationInput {
  userId: string;
  kind: ParentNotificationKind;
  title: string;
  body: string;
  href?: string | null;
  sourceEntity?: string | null;
  sourceId?: string | null;
  createdById?: string | null;
}

const parentNotificationSelect = {
  id: true,
  kind: true,
  title: true,
  bodyEnc: true,
  href: true,
  sourceEntity: true,
  sourceId: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.ParentNotificationSelect;

type ParentNotificationRow = Prisma.ParentNotificationGetPayload<{
  select: typeof parentNotificationSelect;
}>;

function notificationData(
  ctx: Pick<AppContext, 'db'>,
  input: CreateParentNotificationInput,
): Prisma.ParentNotificationUncheckedCreateInput {
  return {
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    bodyEnc: ctx.db.$enc.encrypt(input.body),
    href: input.href ?? null,
    sourceEntity: input.sourceEntity ?? null,
    sourceId: input.sourceId ?? null,
    createdById: input.createdById ?? null,
  };
}

export function mapParentNotification(
  decrypt: (value: string | null | undefined) => string | null,
  row: ParentNotificationRow,
): ParentNotificationDto {
  const body = decrypt(row.bodyEnc);
  if (!body) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'parent notification decrypt failed',
    });
  }

  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body,
    href: row.href,
    sourceEntity: row.sourceEntity,
    sourceId: row.sourceId,
    createdAt: row.createdAt,
    readAt: row.readAt,
    read: row.readAt !== null,
  };
}

export async function listParentNotifications(
  ctx: Pick<AppContext, 'db' | 'user'>,
  db: Pick<RlsTx, 'auditLog' | 'parentNotification'>,
  userId: string,
): Promise<ParentNotificationDto[]> {
  const rows = await db.parentNotification.findMany({
    where: { userId },
    select: parentNotificationSelect,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (rows.length > 0) {
    await db.auditLog.create({
      data: {
        userId: ctx.user?.id ?? null,
        action: 'DecryptPii',
        entity: 'ParentNotification',
        meta: { source: 'parentNotification.list', userId, count: rows.length },
      },
    });
  }

  return rows.map((row) => mapParentNotification(ctx.db.$enc.decrypt, row));
}

export async function createParentNotifications(
  ctx: Pick<AppContext, 'db' | 'user'>,
  db: Pick<RlsTx, 'auditLog' | 'parentNotification'>,
  input: {
    notifications: readonly CreateParentNotificationInput[];
    auditSource: string;
  },
): Promise<{ count: number }> {
  if (input.notifications.length === 0) return { count: 0 };

  await db.parentNotification.createMany({
    data: input.notifications.map((notification) => notificationData(ctx, notification)),
  });

  await db.auditLog.create({
    data: {
      userId: ctx.user?.id ?? input.notifications[0]?.createdById ?? null,
      action: 'Create',
      entity: 'ParentNotification',
      meta: {
        source: input.auditSource,
        count: input.notifications.length,
        kinds: [...new Set(input.notifications.map((notification) => notification.kind))],
      },
    },
  });

  return { count: input.notifications.length };
}
