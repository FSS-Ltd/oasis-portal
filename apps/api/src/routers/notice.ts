import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  isFullAdmin,
  isStaff,
  requireFullAdmin,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

interface StaffNoticeRow {
  id: string;
  title: string;
  bodyEnc: string;
  audience: NoticeAudience;
  postedById: string;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  reads: { userId?: string; readAt: Date }[];
}

const noticeAudienceSchema = z.enum(['Supervisors', 'Parents', 'Both']);
type NoticeAudience = z.infer<typeof noticeAudienceSchema>;
type NoticeRecipientRole = 'Supervisor' | 'ClubsAdmin' | 'Parent';

interface NoticeRecipient {
  id: string;
  role: NoticeRecipientRole;
  fullNameEnc: string;
}

const postNoticeInput = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  audience: noticeAudienceSchema.default('Supervisors'),
  expiresAt: z.coerce.date().optional(),
});

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireStaffNoticeReader(user: SessionUser): void {
  if (isStaff(user)) return;
  throw toForbidden(new AccessDeniedError('staff notices require full-admin or Supervisor'));
}

function requireParentNoticeReader(user: SessionUser): void {
  if (user.role === 'Parent' || isFullAdmin(user)) return;
  throw toForbidden(new AccessDeniedError('parent notices require Parent or full-admin'));
}

function requireAnyNoticeReader(user: SessionUser): void {
  if (isStaff(user) || user.role === 'Parent') return;
  throw toForbidden(new AccessDeniedError('notices require staff or Parent'));
}

function requireNoticePoster(user: SessionUser): void {
  try {
    requireFullAdmin(user);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      throw toForbidden(error);
    }
    throw error;
  }
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'staff notice decrypt failed' });
  }
  return decrypted;
}

function assertFutureExpiry(expiresAt: Date | undefined, now: Date): void {
  if (expiresAt && expiresAt <= now) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice expiry must be in the future' });
  }
}

function isAvailableNotice(
  notice: { active: boolean; expiresAt: Date | null },
  now: Date,
): boolean {
  return notice.active && (!notice.expiresAt || notice.expiresAt > now);
}

function canReadNoticeAudience(user: SessionUser, audience: NoticeAudience): boolean {
  if (isFullAdmin(user)) return true;
  if (audience === 'Both') return isStaff(user) || user.role === 'Parent';
  if (audience === 'Supervisors') return isStaff(user);
  return user.role === 'Parent';
}

function recipientRolesForAudience(audience: NoticeAudience): NoticeRecipientRole[] {
  if (audience === 'Both') return ['Supervisor', 'ClubsAdmin', 'Parent'];
  if (audience === 'Parents') return ['Parent'];
  return ['Supervisor', 'ClubsAdmin'];
}

function audienceWhere(audiences: readonly NoticeAudience[]) {
  return {
    active: true,
    audience: { in: [...audiences] },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

async function loadNoticeRecipients(ctx: AuthedContext): Promise<NoticeRecipient[]> {
  const users = await ctx.db.user.findMany({
    where: {
      active: true,
      role: { in: ['Supervisor', 'ClubsAdmin', 'Parent'] },
    },
    select: {
      id: true,
      role: true,
      fullNameEnc: true,
    },
  });

  return users.flatMap((user) =>
    user.role === 'Supervisor' || user.role === 'ClubsAdmin' || user.role === 'Parent'
      ? [{ id: user.id, role: user.role, fullNameEnc: user.fullNameEnc }]
      : [],
  );
}

function mapNotice(
  ctx: AuthedContext,
  notice: StaffNoticeRow,
  recipients: readonly NoticeRecipient[] = [],
) {
  const ownNotice = notice.postedById === ctx.user.id;
  const readAt =
    notice.reads.find((read) => read.userId === ctx.user.id)?.readAt ??
    notice.reads[0]?.readAt ??
    null;
  const recipientRoles = new Set(recipientRolesForAudience(notice.audience));
  const noticeRecipients = recipients
    .filter((recipient) => recipientRoles.has(recipient.role))
    .map((recipient) => {
      const recipientReadAt =
        notice.reads.find((read) => read.userId === recipient.id)?.readAt ?? null;
      return {
        userId: recipient.id,
        fullName: decryptRequired(ctx.db.$enc.decrypt, recipient.fullNameEnc),
        role: recipient.role,
        read: Boolean(recipientReadAt),
        readAt: recipientReadAt,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    id: notice.id,
    title: notice.title,
    body: decryptRequired(ctx.db.$enc.decrypt, notice.bodyEnc),
    audience: notice.audience,
    postedById: notice.postedById,
    createdAt: notice.createdAt,
    expiresAt: notice.expiresAt,
    active: notice.active,
    read: ownNotice || Boolean(readAt),
    readAt: ownNotice ? null : readAt,
    readSummary:
      ownNotice && noticeRecipients.length > 0
        ? {
            read: noticeRecipients.filter((recipient) => recipient.read).length,
            total: noticeRecipients.length,
            recipients: noticeRecipients,
          }
        : null,
  };
}

export const noticeRouter = router({
  listForAdmin: authedProcedure.query(async ({ ctx }) => {
    requireNoticePoster(ctx.user);

    const [notices, recipients] = await Promise.all([
      ctx.db.staffNotice.findMany({
        where: audienceWhere(['Supervisors', 'Parents', 'Both']),
        include: {
          reads: {
            select: { userId: true, readAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      loadNoticeRecipients(ctx),
    ]);

    return notices.map((notice) => mapNotice(ctx, notice, recipients));
  }),
  listForStaff: authedProcedure.query(async ({ ctx }) => {
    requireStaffNoticeReader(ctx.user);

    const notices = await ctx.db.staffNotice.findMany({
      where: audienceWhere(['Supervisors', 'Both']),
      include: {
        reads: {
          where: { userId: ctx.user.id },
          select: { readAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notices.map((notice) => mapNotice(ctx, notice));
  }),
  listForParents: authedProcedure.query(async ({ ctx }) => {
    requireParentNoticeReader(ctx.user);

    const notices = await ctx.db.staffNotice.findMany({
      where: audienceWhere(['Parents', 'Both']),
      include: {
        reads: {
          where: { userId: ctx.user.id },
          select: { readAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notices.map((notice) => mapNotice(ctx, notice));
  }),
  post: authedProcedure.input(postNoticeInput).mutation(async ({ ctx, input }) => {
    requireNoticePoster(ctx.user);

    const now = new Date();
    assertFutureExpiry(input.expiresAt, now);

    const notice = await ctx.db.staffNotice.create({
      data: {
        title: input.title,
        bodyEnc: ctx.db.$enc.encrypt(input.body),
        audience: input.audience,
        postedById: ctx.user.id,
        active: true,
        expiresAt: input.expiresAt ?? null,
      },
      include: {
        reads: {
          where: { userId: ctx.user.id },
          select: { readAt: true },
          take: 1,
        },
      },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'StaffNotice',
        entityId: notice.id,
        meta: {
          source: 'notice.post',
          audience: input.audience,
          expiresAt: input.expiresAt?.toISOString() ?? null,
        },
      },
    });

    return mapNotice(ctx, notice);
  }),
  markRead: authedProcedure
    .input(z.object({ noticeId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      requireAnyNoticeReader(ctx.user);

      const notice = await ctx.db.staffNotice.findUnique({
        where: { id: input.noticeId },
        select: { id: true, active: true, audience: true, expiresAt: true, postedById: true },
      });
      if (
        !notice ||
        !isAvailableNotice(notice, new Date()) ||
        !canReadNoticeAudience(ctx.user, notice.audience)
      ) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'notice not found' });
      }
      if (notice.postedById === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'notice authors do not need to mark read',
        });
      }

      const existingRead = await ctx.db.staffNoticeRead.findUnique({
        where: { noticeId_userId: { noticeId: input.noticeId, userId: ctx.user.id } },
        select: { noticeId: true, userId: true, readAt: true },
      });
      if (existingRead) {
        return {
          noticeId: existingRead.noticeId,
          readAt: existingRead.readAt,
        };
      }

      let read: { noticeId: string; readAt: Date };
      try {
        read = await ctx.db.staffNoticeRead.create({
          data: { noticeId: input.noticeId, userId: ctx.user.id },
          select: { noticeId: true, userId: true, readAt: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const concurrentRead = await ctx.db.staffNoticeRead.findUnique({
            where: { noticeId_userId: { noticeId: input.noticeId, userId: ctx.user.id } },
            select: { noticeId: true, userId: true, readAt: true },
          });
          if (concurrentRead) {
            return {
              noticeId: concurrentRead.noticeId,
              readAt: concurrentRead.readAt,
            };
          }
        }
        throw error;
      }

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'StaffNoticeRead',
          entityId: input.noticeId,
          meta: { source: 'notice.markRead', noticeId: input.noticeId },
        },
      });

      return {
        noticeId: read.noticeId,
        readAt: read.readAt,
      };
    }),
});
