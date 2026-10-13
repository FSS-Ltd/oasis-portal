import { prisma, type Prisma } from '@oasis/db';
import { createResendEmailClient, type EmailClient } from '../lib/email.js';
import { logOperationalEvent } from '../lib/observability.js';

const MAX_ATTEMPTS = 8;
const REVIEW_AFTER_MS = 23 * 60 * 60 * 1000;

type DeliveryDb = Pick<typeof prisma, '$transaction' | '$enc'>;

async function withDeliveryAccess<T>(
  db: DeliveryDb,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.agreement_delivery_worker', 'true', true)`;
    return run(tx);
  });
}

export async function deliverUserAgreementRequests(
  requestIds?: readonly string[],
  db: DeliveryDb = prisma,
  emailClient: EmailClient = createResendEmailClient(),
): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = new Date();
  const due = await withDeliveryAccess(db, (tx) =>
    tx.userAgreementDelivery.findMany({
      where: {
        ...(requestIds ? { requestId: { in: [...requestIds] } } : {}),
        status: { in: ['Queued', 'Failed'] },
        attempts: { lt: MAX_ATTEMPTS },
        nextAttemptAt: { lte: now },
        OR: [{ claimUntil: null }, { claimUntil: { lt: now } }],
        request: { status: 'NeedsSigning', recipient: { active: true } },
      },
      select: { requestId: true },
      take: requestIds ? requestIds.length : 100,
    }),
  );
  const summary = { sent: 0, failed: 0, skipped: 0 };
  for (const item of due) {
    const claimed = await withDeliveryAccess(db, async (tx) => {
      const updated = await tx.userAgreementDelivery.updateMany({
        where: {
          requestId: item.requestId,
          status: { in: ['Queued', 'Failed'] },
          attempts: { lt: MAX_ATTEMPTS },
          OR: [{ claimUntil: null }, { claimUntil: { lt: new Date() } }],
          request: { status: 'NeedsSigning', recipient: { active: true } },
        },
        data: { claimUntil: new Date(Date.now() + 5 * 60 * 1000), attempts: { increment: 1 } },
      });
      if (updated.count === 0) return null;
      return tx.userAgreementDelivery.findUnique({
        where: { requestId: item.requestId },
        include: { request: { include: { recipient: true } } },
      });
    });
    if (!claimed) {
      summary.skipped++;
      continue;
    }
    const requestId = claimed.requestId;
    if (Date.now() - claimed.createdAt.getTime() >= REVIEW_AFTER_MS) {
      await withDeliveryAccess(db, (tx) =>
        tx.userAgreementDelivery.update({
          where: { requestId },
          data: {
            status: 'NeedsReview',
            claimUntil: null,
            lastError: 'Delivery needs review after 23 hours.',
          },
        }),
      );
      summary.skipped++;
      continue;
    }
    const email = db.$enc.decrypt(claimed.request.recipient.emailEnc);
    if (!email) {
      await withDeliveryAccess(db, (tx) =>
        tx.userAgreementDelivery.update({
          where: { requestId },
          data: {
            status: 'MissingEmail',
            claimUntil: null,
            lastError: 'Recipient has no email address.',
          },
        }),
      );
      summary.skipped++;
      continue;
    }
    const stillPending = await withDeliveryAccess(db, (tx) =>
      tx.userAgreementRequest.findFirst({
        where: { id: requestId, status: 'NeedsSigning', recipient: { active: true } },
        select: { id: true },
      }),
    );
    if (!stillPending) {
      await withDeliveryAccess(db, (tx) =>
        tx.userAgreementDelivery.update({ where: { requestId }, data: { claimUntil: null } }),
      );
      summary.skipped++;
      continue;
    }
    try {
      const appUrl = process.env['APP_URL'];
      if (!appUrl) throw new Error('Application URL is not configured.');
      const link = new URL('/user-agreements', appUrl);
      link.searchParams.set('requestId', requestId);
      const url = link.toString();
      const delivered = await emailClient.send({
        to: email,
        subject: 'Oasis Portal: agreement needs your signature',
        text: `An agreement needs your signature. Sign in to Oasis Portal to open the form: ${url}`,
        html: `<p>An agreement needs your signature.</p><p><a href="${url}">Sign in to Oasis Portal to open the form</a>.</p>`,
        idempotencyKey: `user-agreement/${requestId}`,
      });
      await withDeliveryAccess(db, (tx) =>
        tx.userAgreementDelivery.update({
          where: { requestId },
          data: {
            status: 'Sent',
            claimUntil: null,
            sentAt: new Date(),
            emailMessageId: delivered.id,
            lastError: null,
          },
        }),
      );
      summary.sent++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 200) : 'Email delivery failed.';
      const nextAttemptAt = new Date(Date.now() + 15 * 60 * 1000);
      await withDeliveryAccess(db, (tx) =>
        tx.userAgreementDelivery.update({
          where: { requestId },
          data: { status: 'Failed', claimUntil: null, nextAttemptAt, lastError: message },
        }),
      );
      logOperationalEvent({
        event: 'user_agreement.email_failed',
        level: 'error',
        message: 'Agreement request email failed',
        meta: { requestId, errorType: error instanceof Error ? error.name : 'unknown' },
      });
      summary.failed++;
    }
  }
  return summary;
}
