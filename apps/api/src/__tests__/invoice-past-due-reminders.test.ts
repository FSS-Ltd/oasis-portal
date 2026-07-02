import { describe, expect, it, vi } from 'vitest';
import { render } from 'react-email';
import type { SchoolFeeInvoiceStatus } from '@oasis/db';
import {
  buildInvoicePastDueReminderEmail,
  INVOICE_PAST_DUE_REMINDER_EMAIL_SUBJECT_PREFIX,
  type EmailClient,
} from '../lib/email.js';
import {
  sendPastDueInvoiceReminders,
  type InvoicePastDueReminderDb,
} from '../services/invoice-past-due-reminders.js';

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('enc:') ? value.slice(4) : value;
}

interface FakeInvoiceRow {
  dueOn: Date | null;
  familyLabelEnc: string | null;
  id: string;
  invoiceNumber: string | null;
  status: SchoolFeeInvoiceStatus;
  studentId: string | null;
  students: Array<{ studentId: string }>;
}

interface FakeGuardianRow {
  studentId: string;
  user: {
    active: boolean;
    emailEnc: string | null;
    fullNameEnc: string;
    id: string;
    role: string;
  };
  userId: string;
}

interface FakeAuditRow {
  action: string;
  entity: string;
  entityId: string | null;
  meta?: unknown;
  userId: string | null;
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function makeFakeDb(input: {
  audits?: FakeAuditRow[];
  guardians: FakeGuardianRow[];
  invoices: FakeInvoiceRow[];
}): InvoicePastDueReminderDb & { audits: FakeAuditRow[] } {
  const audits = [...(input.audits ?? [])];

  return {
    audits,
    $enc: { decrypt },
    auditLog: {
      create: vi.fn(({ data }: { data: FakeAuditRow }) => {
        audits.push(data);
        return Promise.resolve({ id: `audit_${String(audits.length)}`, ...data });
      }),
      findMany: vi.fn(({ where }: { where: { entity: string; entityId: { in: string[] } } }) =>
        Promise.resolve(
          audits
            .filter(
              (audit) =>
                audit.entity === where.entity &&
                audit.entityId !== null &&
                where.entityId.in.includes(audit.entityId),
            )
            .map((audit) => ({ entityId: audit.entityId })),
        ),
      ),
    },
    guardian: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            studentId: { in: string[] };
            user: { active: true; emailEnc: { not: null }; role: 'Parent' };
          };
        }) =>
          Promise.resolve(
            input.guardians.filter(
              (guardian) =>
                where.studentId.in.includes(guardian.studentId) &&
                guardian.user.active === where.user.active &&
                guardian.user.role === where.user.role &&
                guardian.user.emailEnc !== where.user.emailEnc.not,
            ),
          ),
      ),
    },
    schoolFeeInvoice: {
      findMany: vi.fn(({ where }: { where: { dueOn: { in: Date[] }; status: 'Unpaid' } }) =>
        Promise.resolve(
          input.invoices.filter(
            (invoice) =>
              invoice.status === where.status &&
              invoice.dueOn !== null &&
              where.dueOn.in.some((dueOn) => dueOn.getTime() === invoice.dueOn?.getTime()),
          ),
        ),
      ),
    },
  };
}

function makeEmailClient() {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue({ id: 'email_123' });
  const client: EmailClient = { send };
  return { client, send };
}

describe('invoice past-due reminder email', () => {
  it('builds the approved 2-day copy using the family name rather than a parent name', async () => {
    const email = buildInvoicePastDueReminderEmail({
      daysPastDue: 2,
      familyLabel: 'Williams',
      invoiceNumber: 'INV-2026-001',
      invoicePath: '/parent/fees',
      to: 'family@example.com',
    });

    expect(email.to).toBe('family@example.com');
    expect(email.subject).toBe(
      `${INVOICE_PAST_DUE_REMINDER_EMAIL_SUBJECT_PREFIX} INV-2026-001 is 2 days past due`,
    );
    expect(email.text).toContain('Hello Williams family,');
    expect(email.text).toContain(
      'We hope that this message finds you well. This is a gentle reminder that Invoice INV-2026-001 is now 2 days past due.',
    );
    expect(email.text).toContain('please make sure to mark it as paid on the portal');
    expect(email.text).not.toContain('parent');

    if (!('react' in email)) throw new Error('expected react email payload');
    const html = await render(email.react);
    const normalizedHtml = html.replaceAll('<!-- -->', '');
    expect(normalizedHtml).toContain('Hello Williams family');
    expect(normalizedHtml).toContain('Invoice INV-2026-001 is now 2 days past due');
  });

  it('builds the approved 5-day follow-up copy', () => {
    const email = buildInvoicePastDueReminderEmail({
      daysPastDue: 5,
      familyLabel: 'Williams family',
      invoiceNumber: 'INV-2026-001',
      to: 'family@example.com',
    });

    expect(email.subject).toBe(
      `${INVOICE_PAST_DUE_REMINDER_EMAIL_SUBJECT_PREFIX} INV-2026-001 is 5 days past due`,
    );
    expect(email.text).toContain('Hello Williams family,');
    expect(email.text).toContain(
      'This is a gentle follow-up that Invoice INV-2026-001 is now 5 days past due.',
    );
    expect(email.text).toContain(
      'If there is anything you need to discuss, please reply to this email and we will be glad to help.',
    );
  });
});

describe('sendPastDueInvoiceReminders', () => {
  it('sends 2-day and 5-day reminders only to active parent guardians linked to invoice students', async () => {
    const { client, send } = makeEmailClient();
    const db = makeFakeDb({
      guardians: [
        {
          studentId: 'student_a',
          userId: 'parent_a',
          user: {
            active: true,
            emailEnc: encrypt('parent.a@example.com'),
            fullNameEnc: encrypt('Parent A'),
            id: 'parent_a',
            role: 'Parent',
          },
        },
        {
          studentId: 'student_a',
          userId: 'supervisor_a',
          user: {
            active: true,
            emailEnc: encrypt('supervisor@example.com'),
            fullNameEnc: encrypt('Supervisor A'),
            id: 'supervisor_a',
            role: 'Supervisor',
          },
        },
        {
          studentId: 'student_b',
          userId: 'parent_b',
          user: {
            active: true,
            emailEnc: encrypt('parent.b@example.com'),
            fullNameEnc: encrypt('Parent B'),
            id: 'parent_b',
            role: 'Parent',
          },
        },
        {
          studentId: 'student_b',
          userId: 'inactive_parent',
          user: {
            active: false,
            emailEnc: encrypt('inactive@example.com'),
            fullNameEnc: encrypt('Inactive Parent'),
            id: 'inactive_parent',
            role: 'Parent',
          },
        },
        {
          studentId: 'student_c',
          userId: 'unrelated_parent',
          user: {
            active: true,
            emailEnc: encrypt('unrelated@example.com'),
            fullNameEnc: encrypt('Unrelated Parent'),
            id: 'unrelated_parent',
            role: 'Parent',
          },
        },
      ],
      invoices: [
        {
          dueOn: day('2026-06-30'),
          familyLabelEnc: encrypt('Williams'),
          id: 'invoice_two_days',
          invoiceNumber: 'INV-2026-001',
          status: 'Unpaid',
          studentId: 'student_a',
          students: [],
        },
        {
          dueOn: day('2026-06-27'),
          familyLabelEnc: encrypt('Carter family'),
          id: 'invoice_five_days',
          invoiceNumber: 'INV-2026-002',
          status: 'Unpaid',
          studentId: null,
          students: [{ studentId: 'student_b' }],
        },
        {
          dueOn: day('2026-07-01'),
          familyLabelEnc: encrypt('Too Early'),
          id: 'invoice_one_day',
          invoiceNumber: 'INV-2026-003',
          status: 'Unpaid',
          studentId: 'student_c',
          students: [],
        },
      ],
    });

    const summary = await sendPastDueInvoiceReminders({
      asOf: new Date('2026-07-02T09:00:00.000Z'),
      db,
      emailClient: client,
    });

    expect(summary).toEqual({
      candidateInvoiceCount: 2,
      failedCount: 0,
      skippedAlreadySentCount: 0,
      skippedNoRecipientCount: 0,
      sentCount: 2,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([email]) => email.to).sort()).toEqual([
      'parent.a@example.com',
      'parent.b@example.com',
    ]);
    expect(JSON.stringify(send.mock.calls)).not.toContain('supervisor@example.com');
    expect(JSON.stringify(send.mock.calls)).not.toContain('inactive@example.com');
    expect(JSON.stringify(send.mock.calls)).not.toContain('unrelated@example.com');
  });

  it('does not resend a reminder already recorded for the same invoice, recipient, and threshold', async () => {
    const { client, send } = makeEmailClient();
    const db = makeFakeDb({
      audits: [
        {
          action: 'Create',
          entity: 'SchoolFeeInvoicePastDueReminder',
          entityId: 'invoice_two_days:2:parent_a',
          meta: { source: 'invoice.pastDueReminder' },
          userId: null,
        },
      ],
      guardians: [
        {
          studentId: 'student_a',
          userId: 'parent_a',
          user: {
            active: true,
            emailEnc: encrypt('parent.a@example.com'),
            fullNameEnc: encrypt('Parent A'),
            id: 'parent_a',
            role: 'Parent',
          },
        },
      ],
      invoices: [
        {
          dueOn: day('2026-06-30'),
          familyLabelEnc: encrypt('Williams'),
          id: 'invoice_two_days',
          invoiceNumber: 'INV-2026-001',
          status: 'Unpaid',
          studentId: 'student_a',
          students: [],
        },
      ],
    });

    const summary = await sendPastDueInvoiceReminders({
      asOf: new Date('2026-07-02T09:00:00.000Z'),
      db,
      emailClient: client,
    });

    expect(summary.sentCount).toBe(0);
    expect(summary.skippedAlreadySentCount).toBe(1);
    expect(send).not.toHaveBeenCalled();
  });
});
