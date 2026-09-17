import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@oasis/db';
import {
  AccessDeniedError,
  canAnswerChildRegistrationPrompt,
  canUseAdminOperations,
  isStaff,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  buildNoticeNotificationEmail,
  createResendEmailClient,
  NOTICE_NOTIFICATION_EMAIL_SUBJECT,
  type EmailClient,
} from '../lib/email.js';
import { decryptRequiredText } from '../lib/encrypted-text.js';
import { logOperationalEvent, operationalErrorMessage } from '../lib/observability.js';
import { assertUploadedNoticeAttachments } from '../services/notice-attachment-storage.js';
import {
  shouldSendParentEmailNotification,
  type ParentEmailNotificationRecipient,
} from '../services/parent-email-notifications.js';
import { authedProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

type NoticeAttachmentKind = 'image' | 'pdf' | 'document';

interface StaffNoticeAttachmentRow {
  id: string;
  originalFileNameEnc: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePathEnc: string;
  position: number;
}

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
  attachments?: StaffNoticeAttachmentRow[];
}

const noticeAudienceSchema = z.enum(['Supervisors', 'Parents', 'Both']);
type NoticeAudience = z.infer<typeof noticeAudienceSchema>;
type NoticeRecipientRole = 'Supervisor' | 'ClubsAdmin' | 'Parent';

interface NoticeRecipient extends ParentEmailNotificationRecipient {
  canReceiveParentNotices: boolean;
  emailEnc: string | null;
  id: string;
  role: NoticeRecipientRole;
  fullNameEnc: string;
}

type NoticeEmailRecipient = NoticeRecipient & { emailEnc: string };

export interface NoticeRouterDeps {
  emailClient?: EmailClient;
}

export interface NoticeEmailSummary {
  failedCount: number;
  recipientCount: number;
  sentCount: number;
  skippedOptOutCount: number;
}

const MAX_NOTICE_ATTACHMENTS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const attachmentMetadataInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

const attachmentInput = attachmentMetadataInput.extend({
  storageBucket: z.string().trim().min(1).max(120),
  storagePath: z.string().trim().min(1).max(512),
});

const postNoticeInput = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  audience: noticeAudienceSchema.default('Supervisors'),
  expiresAt: z.coerce.date().optional(),
  attachments: z.array(attachmentInput).max(MAX_NOTICE_ATTACHMENTS).default([]),
});

const prepareAttachmentsInput = z.object({
  attachments: z.array(attachmentMetadataInput).min(1).max(MAX_NOTICE_ATTACHMENTS),
});

const downloadAttachmentInput = z.object({
  attachmentId: z.string().cuid(),
  markRead: z.boolean().optional().default(false),
});

const attachmentMimeByExtension = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
} as const;

type AllowedAttachmentExtension = keyof typeof attachmentMimeByExtension;

const attachmentKindByMime: Record<string, NoticeAttachmentKind> = {
  'application/msword': 'document',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
};

function noticeAttachmentBucket(): string {
  return process.env['SUPABASE_NOTICE_ATTACHMENTS_BUCKET'] ?? 'notice-attachments';
}

function toForbidden(error: AccessDeniedError): TRPCError {
  return new TRPCError({ code: 'FORBIDDEN', message: error.message, cause: error });
}

function requireStaffNoticeReader(user: SessionUser): void {
  if (isStaff(user) || canUseAdminOperations(user)) return;
  throw toForbidden(new AccessDeniedError('staff notices require full-admin or Supervisor'));
}

function requireNoticePoster(user: SessionUser): void {
  if (canUseAdminOperations(user)) return;
  throw toForbidden(new AccessDeniedError('staff notice posting requires admin operations'));
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
): string {
  return decryptRequiredText({ decrypt }, value, 'staff notice');
}

function safeOriginalFileName(value: string): string {
  const fileName = value.replaceAll('\\', '/').split('/').pop()?.replace(/\0/gu, '').trim();
  return fileName?.replace(/^\.+/u, '').trim() || 'attachment';
}

function attachmentExtension(fileName: string): AllowedAttachmentExtension | null {
  const lowerName = fileName.toLowerCase();
  const extension = Object.keys(attachmentMimeByExtension).find((candidate) =>
    lowerName.endsWith(candidate),
  );
  return extension ? (extension as AllowedAttachmentExtension) : null;
}

function attachmentKind(mimeType: string): NoticeAttachmentKind {
  const kind = attachmentKindByMime[mimeType];
  if (!kind) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'unsupported notice attachment type' });
  }
  return kind;
}

function mapAttachment(ctx: AuthedContext, attachment: StaffNoticeAttachmentRow) {
  const mimeType = attachment.mimeType;
  const kind = attachmentKind(mimeType);
  return {
    id: attachment.id,
    fileName: decryptRequired(ctx.db.$enc.decrypt, attachment.originalFileNameEnc),
    mimeType,
    sizeBytes: attachment.sizeBytes,
    kind,
    canPreview: kind === 'image' || kind === 'pdf',
  };
}

function safeStorageFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/-+/gu, '-');
}

function storagePathForAttachment(userId: string, fileName: string): string {
  return `notices/${userId}/${randomUUID()}-${safeStorageFileName(fileName)}`;
}

function validateAttachmentMetadata(input: z.infer<typeof attachmentMetadataInput>) {
  const originalFileName = safeOriginalFileName(input.fileName);
  const extension = attachmentExtension(originalFileName);
  if (!extension) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'unsupported notice attachment type' });
  }

  const expectedMimeType = attachmentMimeByExtension[extension];
  const mimeType = input.mimeType.toLowerCase();
  if (mimeType !== expectedMimeType) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachment type mismatch' });
  }

  const kind = attachmentKind(mimeType);
  const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (input.sizeBytes > maxBytes) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachment is too large' });
  }

  return {
    originalFileName,
    mimeType,
    sizeBytes: input.sizeBytes,
  };
}

function assertStorageTarget(
  input: Pick<z.infer<typeof attachmentInput>, 'storageBucket' | 'storagePath'>,
  userId: string,
): void {
  if (input.storageBucket !== noticeAttachmentBucket()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid notice attachment bucket' });
  }
  if (
    !input.storagePath.startsWith(`notices/${userId}/`) ||
    input.storagePath.includes('..') ||
    input.storagePath.startsWith('/') ||
    input.storagePath.endsWith('/')
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'invalid notice attachment path' });
  }
}

function validateAttachment(
  input: z.infer<typeof attachmentInput>,
  position: number,
  userId: string,
) {
  const metadata = validateAttachmentMetadata(input);
  assertStorageTarget(input, userId);
  return {
    ...metadata,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
    position,
  };
}

function validateAttachments(inputs: readonly z.infer<typeof attachmentInput>[], userId: string) {
  const attachments = inputs.map((attachment, index) =>
    validateAttachment(attachment, index + 1, userId),
  );
  const totalSizeBytes = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
  if (totalSizeBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachments are too large' });
  }
  return { attachments, totalSizeBytes };
}

function prepareStorageAttachments(
  inputs: readonly z.infer<typeof attachmentMetadataInput>[],
  userId: string,
) {
  const bucket = noticeAttachmentBucket();
  const attachments = inputs.map((input) => {
    const metadata = validateAttachmentMetadata(input);
    return {
      ...metadata,
      storageBucket: bucket,
      storagePath: storagePathForAttachment(userId, metadata.originalFileName),
    };
  });
  const totalSizeBytes = attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
  if (totalSizeBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachments are too large' });
  }
  return attachments;
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

async function hasLinkedActiveChild(ctx: AuthedContext): Promise<boolean> {
  if (!canAnswerChildRegistrationPrompt(ctx.user)) return false;
  const count = await ctx.db.guardian.count({
    where: { userId: ctx.user.id, student: { active: true } },
  });
  return count > 0;
}

async function canReadParentNotice(ctx: AuthedContext): Promise<boolean> {
  if (ctx.user.role === 'Parent' || canUseAdminOperations(ctx.user)) return true;
  return hasLinkedActiveChild(ctx);
}

async function requireParentNoticeReader(ctx: AuthedContext): Promise<void> {
  if (await canReadParentNotice(ctx)) return;
  throw toForbidden(new AccessDeniedError('parent notices require Parent or linked-child access'));
}

async function canReadNoticeAudience(
  ctx: AuthedContext,
  audience: NoticeAudience,
): Promise<boolean> {
  if (canUseAdminOperations(ctx.user)) return true;
  if (audience === 'Supervisors') return isStaff(ctx.user);
  if (audience === 'Parents') return canReadParentNotice(ctx);
  return isStaff(ctx.user) || ctx.user.role === 'Parent' || hasLinkedActiveChild(ctx);
}

function isSupervisorAudienceRecipient(recipient: NoticeRecipient): boolean {
  return recipient.role === 'Supervisor' || recipient.role === 'ClubsAdmin';
}

function noticeRecipientsForAudience(
  audience: NoticeAudience,
  recipients: readonly NoticeRecipient[],
): NoticeRecipient[] {
  return recipients.filter((recipient) => {
    if (audience === 'Supervisors') return isSupervisorAudienceRecipient(recipient);
    if (audience === 'Parents') return recipient.canReceiveParentNotices;
    return isSupervisorAudienceRecipient(recipient) || recipient.canReceiveParentNotices;
  });
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
      emailEnc: true,
      fullNameEnc: true,
      parentEmailNotificationsEnabled: true,
      parentEmailNotificationOptOuts: true,
    },
  });
  const supervisorIds = users.filter((user) => user.role === 'Supervisor').map((user) => user.id);
  const linkedSupervisorIds =
    supervisorIds.length > 0
      ? new Set(
          (
            await ctx.db.guardian.findMany({
              where: { userId: { in: supervisorIds }, student: { active: true } },
              select: { userId: true },
            })
          ).map((guardian) => guardian.userId),
        )
      : new Set<string>();

  return users.flatMap((user) =>
    user.role === 'Supervisor' || user.role === 'ClubsAdmin' || user.role === 'Parent'
      ? [
          {
            canReceiveParentNotices:
              user.role === 'Parent' ||
              (user.role === 'Supervisor' && linkedSupervisorIds.has(user.id)),
            emailEnc: user.emailEnc,
            id: user.id,
            role: user.role,
            fullNameEnc: user.fullNameEnc,
            parentEmailNotificationsEnabled: user.parentEmailNotificationsEnabled,
            parentEmailNotificationOptOuts: user.parentEmailNotificationOptOuts,
          },
        ]
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
  const noticeRecipients = noticeRecipientsForAudience(notice.audience, recipients)
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
    attachments: (notice.attachments ?? []).map((attachment) => mapAttachment(ctx, attachment)),
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

function noticePathForRecipient(audience: NoticeAudience, recipient: NoticeRecipient): string {
  if (recipient.role === 'Parent' || audience === 'Parents') return '/parent/noticeboard';
  return '/supervisor/noticeboard';
}

function hasNoticeEmail(recipient: NoticeRecipient): recipient is NoticeEmailRecipient {
  return Boolean(recipient.emailEnc);
}

function shouldSendNoticeEmailToRecipient(
  audience: NoticeAudience,
  recipient: NoticeRecipient,
): boolean {
  if (audience === 'Supervisors') return true;
  if (audience === 'Both' && recipient.role !== 'Parent') return true;
  return shouldSendParentEmailNotification(recipient, 'Notice');
}

async function auditNoticeEmailFailure(
  ctx: AuthedContext,
  input: {
    audience: NoticeAudience;
    noticeId: string;
    reason?: string;
    recipient?: NoticeRecipient;
  },
): Promise<void> {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'StaffNotice',
        entityId: input.noticeId,
        meta: {
          source: 'notice.post.email',
          emailStatus: 'Failed',
          noticeId: input.noticeId,
          audience: input.audience,
          ...(input.reason ? { reason: input.reason } : {}),
          ...(input.recipient
            ? { toUserId: input.recipient.id, toRole: input.recipient.role }
            : {}),
        },
      },
    });
  } catch (auditErr) {
    logOperationalEvent({
      event: 'audit.write_failed',
      level: 'error',
      message: 'Notice email failure audit failed',
      meta: {
        error: operationalErrorMessage(auditErr),
        noticeId: input.noticeId,
        toUserId: input.recipient?.id,
      },
      requestId: ctx.requestId,
      userId: ctx.user.id,
    });
  }
}

async function auditNoticeEmailSent(
  ctx: AuthedContext,
  input: {
    audience: NoticeAudience;
    emailId: string | null;
    noticeId: string;
    recipient: NoticeRecipient;
  },
): Promise<void> {
  try {
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'Email',
        entityId: input.emailId,
        meta: {
          source: 'notice.post.email',
          emailStatus: 'Sent',
          noticeId: input.noticeId,
          audience: input.audience,
          subject: NOTICE_NOTIFICATION_EMAIL_SUBJECT,
          toUserId: input.recipient.id,
          toRole: input.recipient.role,
        },
      },
    });
  } catch (auditErr) {
    logOperationalEvent({
      event: 'audit.write_failed',
      level: 'error',
      message: 'Notice email sent audit failed',
      meta: {
        error: operationalErrorMessage(auditErr),
        noticeId: input.noticeId,
        toUserId: input.recipient.id,
      },
      requestId: ctx.requestId,
      userId: ctx.user.id,
    });
  }
}

async function sendNoticeNotificationEmails({
  audience,
  body,
  ctx,
  getEmailClient,
  noticeId,
  title,
}: {
  audience: NoticeAudience;
  body: string;
  ctx: AuthedContext;
  getEmailClient: () => EmailClient;
  noticeId: string;
  title: string;
}): Promise<NoticeEmailSummary> {
  let recipients: NoticeEmailRecipient[];
  try {
    recipients = noticeRecipientsForAudience(audience, await loadNoticeRecipients(ctx)).filter(
      hasNoticeEmail,
    );
  } catch (err) {
    logOperationalEvent({
      event: 'email.recipient_resolution_failed',
      level: 'error',
      message: 'Notice email recipient resolution failed',
      meta: {
        error: operationalErrorMessage(err),
        noticeId,
      },
      requestId: ctx.requestId,
      userId: ctx.user.id,
    });
    await auditNoticeEmailFailure(ctx, { audience, noticeId, reason: 'recipient-resolution' });
    return { failedCount: 0, recipientCount: 0, sentCount: 0, skippedOptOutCount: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;
  let skippedOptOutCount = 0;
  for (const recipient of recipients) {
    if (!shouldSendNoticeEmailToRecipient(audience, recipient)) {
      skippedOptOutCount += 1;
      continue;
    }

    try {
      const recipientName = decryptRequired(ctx.db.$enc.decrypt, recipient.fullNameEnc);
      const recipientEmail = decryptRequired(ctx.db.$enc.decrypt, recipient.emailEnc);
      const result = await getEmailClient().send(
        buildNoticeNotificationEmail({
          audience,
          body,
          noticePath: noticePathForRecipient(audience, recipient),
          recipientName,
          title,
          to: recipientEmail,
        }),
      );
      sentCount += 1;
      await auditNoticeEmailSent(ctx, {
        audience,
        emailId: result.id,
        noticeId,
        recipient,
      });
    } catch (err) {
      failedCount += 1;
      logOperationalEvent({
        event: 'email.delivery_failed',
        level: 'error',
        message: 'Notice email delivery failed',
        meta: {
          error: operationalErrorMessage(err),
          noticeId,
          toUserId: recipient.id,
        },
        requestId: ctx.requestId,
        userId: ctx.user.id,
      });
      await auditNoticeEmailFailure(ctx, { audience, noticeId, recipient });
    }
  }

  return { failedCount, recipientCount: recipients.length, sentCount, skippedOptOutCount };
}

async function createNoticeReadReceipt(
  ctx: AuthedContext,
  noticeId: string,
  source: 'notice.markRead' | 'notice.viewAttachment',
) {
  const existingRead = await ctx.db.staffNoticeRead.findUnique({
    where: { noticeId_userId: { noticeId, userId: ctx.user.id } },
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
      data: { noticeId, userId: ctx.user.id },
      select: { noticeId: true, userId: true, readAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrentRead = await ctx.db.staffNoticeRead.findUnique({
        where: { noticeId_userId: { noticeId, userId: ctx.user.id } },
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
      entityId: noticeId,
      meta: { source, noticeId },
    },
  });

  return {
    noticeId: read.noticeId,
    readAt: read.readAt,
  };
}

export function createNoticeRouter(deps: NoticeRouterDeps = {}) {
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  return router({
    listForAdmin: authedProcedure.query(async ({ ctx }) => {
      requireNoticePoster(ctx.user);

      const [notices, recipients] = await Promise.all([
        ctx.db.staffNotice.findMany({
          where: audienceWhere(['Supervisors', 'Parents', 'Both']),
          include: {
            reads: {
              select: { userId: true, readAt: true },
            },
            attachments: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                originalFileNameEnc: true,
                mimeType: true,
                sizeBytes: true,
                storageBucket: true,
                storagePathEnc: true,
                position: true,
              },
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
          attachments: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              originalFileNameEnc: true,
              mimeType: true,
              sizeBytes: true,
              storageBucket: true,
              storagePathEnc: true,
              position: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return notices.map((notice) => mapNotice(ctx, notice));
    }),
    listForParents: authedProcedure.query(async ({ ctx }) => {
      await requireParentNoticeReader(ctx);

      const notices = await ctx.db.staffNotice.findMany({
        where: audienceWhere(['Parents', 'Both']),
        include: {
          reads: {
            where: { userId: ctx.user.id },
            select: { readAt: true },
            take: 1,
          },
          attachments: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              originalFileNameEnc: true,
              mimeType: true,
              sizeBytes: true,
              storageBucket: true,
              storagePathEnc: true,
              position: true,
            },
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
      const { attachments, totalSizeBytes } = validateAttachments(input.attachments, ctx.user.id);
      await assertUploadedNoticeAttachments(attachments);

      const notice = await ctx.db.staffNotice.create({
        data: {
          title: input.title,
          bodyEnc: ctx.db.$enc.encrypt(input.body),
          audience: input.audience,
          postedById: ctx.user.id,
          active: true,
          expiresAt: input.expiresAt ?? null,
          ...(attachments.length > 0
            ? {
                attachments: {
                  create: attachments.map((attachment) => ({
                    originalFileNameEnc: ctx.db.$enc.encrypt(attachment.originalFileName),
                    mimeType: attachment.mimeType,
                    sizeBytes: attachment.sizeBytes,
                    storageBucket: attachment.storageBucket,
                    storagePathEnc: ctx.db.$enc.encrypt(attachment.storagePath),
                    position: attachment.position,
                  })),
                },
              }
            : {}),
        },
        include: {
          reads: {
            where: { userId: ctx.user.id },
            select: { readAt: true },
            take: 1,
          },
          attachments: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              originalFileNameEnc: true,
              mimeType: true,
              sizeBytes: true,
              storageBucket: true,
              storagePathEnc: true,
              position: true,
            },
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
            attachmentCount: attachments.length,
            totalAttachmentSizeBytes: totalSizeBytes,
          },
        },
      });

      const emailSummary = await sendNoticeNotificationEmails({
        audience: input.audience,
        body: input.body,
        ctx,
        getEmailClient,
        noticeId: notice.id,
        title: input.title,
      });

      return { ...mapNotice(ctx, notice), emailSummary };
    }),
    prepareAttachments: authedProcedure
      .input(prepareAttachmentsInput)
      .mutation(({ ctx, input }) => {
        requireNoticePoster(ctx.user);
        const attachments = prepareStorageAttachments(input.attachments, ctx.user.id);
        return {
          attachments: attachments.map((attachment) => ({
            fileName: attachment.originalFileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            storageBucket: attachment.storageBucket,
            storagePath: attachment.storagePath,
          })),
        };
      }),
    downloadAttachment: authedProcedure
      .input(downloadAttachmentInput)
      .query(async ({ ctx, input }) => {
        const attachment = await ctx.db.staffNoticeAttachment.findUnique({
          where: { id: input.attachmentId },
          include: {
            notice: {
              select: {
                id: true,
                active: true,
                audience: true,
                expiresAt: true,
              },
            },
          },
        });

        if (
          !attachment ||
          !isAvailableNotice(attachment.notice, new Date()) ||
          !(await canReadNoticeAudience(ctx, attachment.notice.audience))
        ) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'notice attachment not found' });
        }

        const fileName = decryptRequired(ctx.db.$enc.decrypt, attachment.originalFileNameEnc);
        const storagePath = decryptRequired(ctx.db.$enc.decrypt, attachment.storagePathEnc);
        const kind = attachmentKind(attachment.mimeType);

        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'ReadSensitive',
            entity: 'StaffNoticeAttachment',
            entityId: attachment.id,
            meta: {
              source: 'notice.downloadAttachment',
              noticeId: attachment.noticeId,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
            },
          },
        });

        if (input.markRead && ctx.user.role === 'Parent') {
          await createNoticeReadReceipt(ctx, attachment.noticeId, 'notice.viewAttachment');
        }

        return {
          attachmentId: attachment.id,
          noticeId: attachment.noticeId,
          fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          storageBucket: attachment.storageBucket,
          storagePath,
          kind,
          canPreview: kind === 'image' || kind === 'pdf',
        };
      }),
    markRead: authedProcedure
      .input(z.object({ noticeId: z.string().cuid() }))
      .mutation(async ({ ctx, input }) => {
        const notice = await ctx.db.staffNotice.findUnique({
          where: { id: input.noticeId },
          select: { id: true, active: true, audience: true, expiresAt: true, postedById: true },
        });
        if (
          !notice ||
          !isAvailableNotice(notice, new Date()) ||
          !(await canReadNoticeAudience(ctx, notice.audience))
        ) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'notice not found' });
        }
        if (notice.postedById === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'notice authors do not need to mark read',
          });
        }

        return createNoticeReadReceipt(ctx, input.noticeId, 'notice.markRead');
      }),
  });
}

export const noticeRouter = createNoticeRouter();
