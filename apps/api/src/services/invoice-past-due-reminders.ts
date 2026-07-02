import {
  buildInvoicePastDueReminderEmail,
  INVOICE_PAST_DUE_REMINDER_EMAIL_SUBJECT_PREFIX,
  type EmailClient,
} from '../lib/email.js';
import { logOperationalEvent, operationalErrorMessage } from '../lib/observability.js';
import type { InvoicePastDueReminderDays } from '../emails/invoice-past-due-reminder-email.js';

export const INVOICE_PAST_DUE_REMINDER_AUDIT_ENTITY = 'SchoolFeeInvoicePastDueReminder';
export const INVOICE_PAST_DUE_REMINDER_SOURCE = 'invoice.pastDueReminder';
const PARENT_FEES_PATH = '/parent/fees';
const REMINDER_DAYS: readonly InvoicePastDueReminderDays[] = [2, 5] as const;

interface ReminderInvoiceStudentLinkRow {
  studentId: string;
}

interface ReminderInvoiceRow {
  dueOn: Date | null;
  familyLabelEnc: string | null;
  id: string;
  invoiceNumber: string | null;
  studentId: string | null;
  students: ReminderInvoiceStudentLinkRow[];
}

interface ReminderGuardianRow {
  studentId: string;
  user: {
    active: boolean;
    emailEnc: string | null;
    id: string;
    role: string;
  };
  userId: string;
}

interface ReminderAuditRow {
  entityId: string | null;
}

interface ReminderAuditCreateInput {
  data: {
    action: 'Create';
    entity: string;
    entityId: string;
    meta: {
      daysPastDue: InvoicePastDueReminderDays;
      dueOn: string;
      emailStatus: 'Sent';
      invoiceId: string;
      invoiceNumber: string;
      recipientUserId: string;
      source: typeof INVOICE_PAST_DUE_REMINDER_SOURCE;
      subject: string;
    };
    userId: null;
  };
}

export interface InvoicePastDueReminderDb {
  $enc: {
    decrypt(value: string | null | undefined): string | null;
  };
  auditLog: {
    create(input: ReminderAuditCreateInput): Promise<unknown>;
    findMany(input: {
      select: { entityId: true };
      where: { entity: string; entityId: { in: string[] } };
    }): Promise<ReminderAuditRow[]>;
  };
  guardian: {
    findMany(input: {
      select: {
        studentId: true;
        user: {
          select: {
            active: true;
            emailEnc: true;
            id: true;
            role: true;
          };
        };
        userId: true;
      };
      where: {
        studentId: { in: string[] };
        user: { active: true; emailEnc: { not: null }; role: 'Parent' };
      };
    }): Promise<ReminderGuardianRow[]>;
  };
  schoolFeeInvoice: {
    findMany(input: {
      orderBy: Array<{ dueOn: 'asc' } | { createdAt: 'asc' }>;
      select: {
        dueOn: true;
        familyLabelEnc: true;
        id: true;
        invoiceNumber: true;
        studentId: true;
        students: { select: { studentId: true } };
      };
      where: { dueOn: { in: Date[] }; status: 'Unpaid' };
    }): Promise<ReminderInvoiceRow[]>;
  };
}

export interface PastDueInvoiceReminderSummary {
  candidateInvoiceCount: number;
  failedCount: number;
  sentCount: number;
  skippedAlreadySentCount: number;
  skippedNoRecipientCount: number;
}

export interface SendPastDueInvoiceRemindersInput {
  asOf?: Date;
  db: InvoicePastDueReminderDb;
  emailClient: EmailClient;
}

function utcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  const next = utcDay(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(value: Date): string {
  return utcDay(value).toISOString().slice(0, 10);
}

function daysPastDue(dueOn: Date, asOf: Date): InvoicePastDueReminderDays | null {
  const diffMs = utcDay(asOf).getTime() - utcDay(dueOn).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return diffDays === 2 || diffDays === 5 ? diffDays : null;
}

function invoiceStudentIds(invoice: ReminderInvoiceRow): string[] {
  return [
    ...new Set([
      ...(invoice.studentId ? [invoice.studentId] : []),
      ...invoice.students.map((student) => student.studentId),
    ]),
  ];
}

function reminderAuditKey(
  invoiceId: string,
  days: InvoicePastDueReminderDays,
  recipientUserId: string,
): string {
  return `${invoiceId}:${String(days)}:${recipientUserId}`;
}

function reminderSubject(
  invoiceNumber: string,
  daysPastDueValue: InvoicePastDueReminderDays,
): string {
  return `${INVOICE_PAST_DUE_REMINDER_EMAIL_SUBJECT_PREFIX} ${invoiceNumber} is ${String(
    daysPastDueValue,
  )} days past due`;
}

async function loadReminderRecipients(
  db: InvoicePastDueReminderDb,
  studentIds: readonly string[],
): Promise<ReminderGuardianRow[]> {
  if (studentIds.length === 0) return [];

  const guardians = await db.guardian.findMany({
    where: {
      studentId: { in: [...studentIds] },
      user: { active: true, emailEnc: { not: null }, role: 'Parent' },
    },
    select: {
      studentId: true,
      userId: true,
      user: {
        select: {
          active: true,
          emailEnc: true,
          id: true,
          role: true,
        },
      },
    },
  });

  return [...new Map(guardians.map((guardian) => [guardian.user.id, guardian])).values()];
}

export async function sendPastDueInvoiceReminders({
  asOf = new Date(),
  db,
  emailClient,
}: SendPastDueInvoiceRemindersInput): Promise<PastDueInvoiceReminderSummary> {
  const dueDates = REMINDER_DAYS.map((days) => addUtcDays(asOf, -days));
  const invoices = await db.schoolFeeInvoice.findMany({
    where: { status: 'Unpaid', dueOn: { in: dueDates } },
    select: {
      id: true,
      invoiceNumber: true,
      studentId: true,
      familyLabelEnc: true,
      dueOn: true,
      students: { select: { studentId: true } },
    },
    orderBy: [{ dueOn: 'asc' }, { createdAt: 'asc' }],
  });

  const summary: PastDueInvoiceReminderSummary = {
    candidateInvoiceCount: invoices.length,
    failedCount: 0,
    sentCount: 0,
    skippedAlreadySentCount: 0,
    skippedNoRecipientCount: 0,
  };

  for (const invoice of invoices) {
    if (!invoice.dueOn) continue;
    const reminderDays = daysPastDue(invoice.dueOn, asOf);
    if (!reminderDays) continue;

    const recipients = await loadReminderRecipients(db, invoiceStudentIds(invoice));
    if (recipients.length === 0) {
      summary.skippedNoRecipientCount += 1;
      continue;
    }

    const invoiceNumber = invoice.invoiceNumber ?? 'un-numbered invoice';
    const familyLabel = db.$enc.decrypt(invoice.familyLabelEnc) ?? 'Oasis';
    const existingAuditKeys = new Set(
      (
        await db.auditLog.findMany({
          where: {
            entity: INVOICE_PAST_DUE_REMINDER_AUDIT_ENTITY,
            entityId: {
              in: recipients.map((recipient) =>
                reminderAuditKey(invoice.id, reminderDays, recipient.user.id),
              ),
            },
          },
          select: { entityId: true },
        })
      )
        .map((audit) => audit.entityId)
        .filter((entityId): entityId is string => Boolean(entityId)),
    );

    for (const recipient of recipients) {
      const auditKey = reminderAuditKey(invoice.id, reminderDays, recipient.user.id);
      if (existingAuditKeys.has(auditKey)) {
        summary.skippedAlreadySentCount += 1;
        continue;
      }

      const recipientEmail = db.$enc.decrypt(recipient.user.emailEnc);
      if (!recipientEmail) {
        summary.skippedNoRecipientCount += 1;
        continue;
      }

      const subject = reminderSubject(invoiceNumber, reminderDays);
      try {
        await emailClient.send(
          buildInvoicePastDueReminderEmail({
            to: recipientEmail,
            daysPastDue: reminderDays,
            familyLabel,
            invoiceNumber,
            invoicePath: PARENT_FEES_PATH,
          }),
        );
        await db.auditLog.create({
          data: {
            userId: null,
            action: 'Create',
            entity: INVOICE_PAST_DUE_REMINDER_AUDIT_ENTITY,
            entityId: auditKey,
            meta: {
              source: INVOICE_PAST_DUE_REMINDER_SOURCE,
              invoiceId: invoice.id,
              invoiceNumber,
              recipientUserId: recipient.user.id,
              daysPastDue: reminderDays,
              dueOn: dateKey(invoice.dueOn),
              subject,
              emailStatus: 'Sent',
            },
          },
        });
        summary.sentCount += 1;
      } catch (err) {
        summary.failedCount += 1;
        logOperationalEvent({
          event: 'email.delivery_failed',
          level: 'error',
          message: 'Invoice past-due reminder email delivery failed',
          meta: {
            daysPastDue: reminderDays,
            error: operationalErrorMessage(err),
            invoiceId: invoice.id,
            recipientUserId: recipient.user.id,
          },
        });
      }
    }
  }

  return summary;
}
