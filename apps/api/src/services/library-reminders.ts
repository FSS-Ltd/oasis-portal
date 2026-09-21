import type { prisma } from '@oasis/db';
import { libraryReminderStageFor } from '@oasis/domain';
import { buildLibraryReminderEmail, type EmailClient } from '../lib/email.js';
import { logOperationalEvent, operationalErrorMessage } from '../lib/observability.js';

export interface LibraryReminderSummary {
  candidateCount: number;
  failedCount: number;
  sentCount: number;
  skippedCount: number;
}

function formatDueOn(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(value);
}

export async function sendLibraryReminders({
  asOf = new Date(),
  db,
  emailClient,
}: {
  asOf?: Date;
  db: typeof prisma;
  emailClient: EmailClient;
}): Promise<LibraryReminderSummary> {
  const loans = await db.libraryLoan.findMany({
    where: { returnedAt: null },
    include: {
      book: { select: { title: true } },
      student: {
        select: {
          fullNameEnc: true,
          guardians: {
            where: { user: { active: true } },
            include: { user: { select: { id: true, emailEnc: true } } },
          },
        },
      },
    },
  });
  const summary: LibraryReminderSummary = {
    candidateCount: 0,
    failedCount: 0,
    sentCount: 0,
    skippedCount: 0,
  };
  for (const loan of loans) {
    const stage = libraryReminderStageFor(loan.dueOn, asOf);
    if (!stage) continue;
    const childName = db.$enc.decrypt(loan.student.fullNameEnc);
    for (const guardian of loan.student.guardians) {
      summary.candidateCount += 1;
      const key = {
        loanId_recipientUserId_stage: { loanId: loan.id, recipientUserId: guardian.user.id, stage },
      };
      const existing = await db.libraryEmailReminder.findUnique({ where: key });
      if (existing?.status === 'Sent' || existing?.status === 'NoEmail') {
        summary.skippedCount += 1;
        continue;
      }
      const current = await db.libraryLoan.findUnique({
        where: { id: loan.id },
        select: { returnedAt: true },
      });
      if (current?.returnedAt) {
        summary.skippedCount += 1;
        continue;
      }
      const recipientEmail = db.$enc.decrypt(guardian.user.emailEnc);
      if (!recipientEmail) {
        await db.libraryEmailReminder.upsert({
          where: key,
          create: {
            loanId: loan.id,
            recipientUserId: guardian.user.id,
            stage,
            status: 'NoEmail',
            attempts: 1,
          },
          update: { status: 'NoEmail', attempts: { increment: 1 } },
        });
        summary.skippedCount += 1;
        continue;
      }
      try {
        const delivery = await emailClient.send(
          buildLibraryReminderEmail({
            to: recipientEmail,
            childName,
            bookTitle: loan.book.title,
            dueOn: formatDueOn(loan.dueOn),
            stage,
          }),
        );
        await db.libraryEmailReminder.upsert({
          where: key,
          create: {
            loanId: loan.id,
            recipientUserId: guardian.user.id,
            stage,
            status: 'Sent',
            attempts: 1,
            emailSentAt: new Date(),
            emailMessageId: delivery.id,
          },
          update: {
            status: 'Sent',
            attempts: { increment: 1 },
            emailSentAt: new Date(),
            emailMessageId: delivery.id,
            lastError: null,
          },
        });
        summary.sentCount += 1;
      } catch (error) {
        const lastError = operationalErrorMessage(error).slice(0, 500);
        await db.libraryEmailReminder.upsert({
          where: key,
          create: {
            loanId: loan.id,
            recipientUserId: guardian.user.id,
            stage,
            status: 'Failed',
            attempts: 1,
            lastError,
          },
          update: { status: 'Failed', attempts: { increment: 1 }, lastError },
        });
        logOperationalEvent({
          event: 'library.reminder_delivery_failed',
          level: 'error',
          message: 'Library reminder delivery failed',
          meta: { loanId: loan.id, recipientUserId: guardian.user.id, stage, error: lastError },
        });
        summary.failedCount += 1;
      }
    }
  }
  return summary;
}
