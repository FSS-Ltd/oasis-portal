import { describe, expect, it, vi } from 'vitest';
import { render } from 'react-email';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import {
  BEHAVIOUR_NOTIFICATION_EMAIL_SUBJECT,
  CLUB_NOTIFICATION_EMAIL_SUBJECT,
  DEFAULT_RESEND_FROM,
  HELLO_WORLD_EMAIL_SUBJECT,
  HELLO_WORLD_EMAIL_TO,
  INVOICE_PAYMENT_NOTIFICATION_EMAIL_SUBJECT,
  MESSAGE_NOTIFICATION_EMAIL_SUBJECT,
  NOTICE_NOTIFICATION_EMAIL_SUBJECT,
  PRODUCTION_RESEND_FROM,
  REPORT_NOTIFICATION_EMAIL_SUBJECT,
  SMOKE_TEST_EMAIL_SUBJECT,
  SMOKE_TEST_EMAIL_TEXT,
  SMOKE_TEST_EMAIL_TO,
  USER_INVITE_EMAIL_SUBJECT,
  buildBehaviourNotificationEmail,
  buildClubNotificationEmail,
  buildHelloWorldEmail,
  buildInvoicePaymentNotificationEmail,
  buildMessageNotificationEmail,
  buildNoticeNotificationEmail,
  buildReportNotificationEmail,
  buildSmokeTestEmail,
  buildUserInviteEmail,
  readEmailConfig,
  type EmailClient,
} from '../lib/email.js';
import { createEmailRouter } from '../routers/email.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const supervisorUser: SessionUser = {
  id: 'u_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

interface FakeDb {
  auditLog: { create: ReturnType<typeof vi.fn> };
}

function makeFakeDb(): FakeDb {
  return {
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    accountAccessState: user ? 'active' : 'unavailable',
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeFakeEmailClient(result = { id: 'email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

function makeCaller(
  user: SessionUser | null,
  deps: { db?: FakeDb; emailClient?: EmailClient } = {},
) {
  const db = deps.db ?? makeFakeDb();
  const email = deps.emailClient ?? makeFakeEmailClient().client;
  const appRouter = router({ email: createEmailRouter({ emailClient: email }) });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

async function withAppUrl<T>(appUrl: string, fn: () => Promise<T>): Promise<T> {
  const originalAppUrl = process.env.APP_URL;
  process.env.APP_URL = appUrl;

  try {
    return await fn();
  } finally {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }
  }
}

describe('email config', () => {
  it('reads the Resend API key from the environment', () => {
    expect(
      readEmailConfig({
        RESEND_API_KEY: ' re_test_123 ',
        RESEND_FROM: ' Oasis <hello@example.com> ',
      }),
    ).toEqual({
      apiKey: 're_test_123',
      defaultFrom: 'Oasis <hello@example.com>',
    });
  });

  it('defaults the sender to the Resend onboarding address for quickstart sends', () => {
    expect(readEmailConfig({ RESEND_API_KEY: 're_test_123' })).toEqual({
      apiKey: 're_test_123',
      defaultFrom: DEFAULT_RESEND_FROM,
    });
  });

  it('requires an explicit sender in production', () => {
    expect(() =>
      readEmailConfig({ NODE_ENV: 'production', RESEND_API_KEY: 're_test_123' }),
    ).toThrow('RESEND_FROM is required to send email in production');
  });

  it('normalises the production no-reply address to the branded sender', () => {
    expect(
      readEmailConfig({
        APP_URL: ' https://portal.example.com/ ',
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_test_123',
        RESEND_FROM: ' no-reply@oasisportal.space ',
      }),
    ).toEqual({
      apiKey: 're_test_123',
      appUrl: 'https://portal.example.com',
      defaultFrom: PRODUCTION_RESEND_FROM,
    });
  });

  it.each([
    ['"Oasis Portal <no-reply@oasisportal.space>"'],
    ["'Oasis Portal <no-reply@oasisportal.space>'"],
  ])('strips wrapping shell quotes from sender env values', (sender) => {
    expect(
      readEmailConfig({
        NODE_ENV: 'production',
        RESEND_API_KEY: 're_test_123',
        RESEND_FROM: sender,
      }),
    ).toEqual({
      apiKey: 're_test_123',
      defaultFrom: PRODUCTION_RESEND_FROM,
    });
  });

  it('rejects missing API keys before constructing a Resend client', () => {
    expect(() => readEmailConfig({})).toThrow('RESEND_API_KEY is required to send email');
  });
});

describe('email builders', () => {
  it('builds a branded smoke-test email with react markup and text fallback', async () => {
    const email = buildSmokeTestEmail('ops@example.com');

    expect(email).toMatchObject({
      to: 'ops@example.com',
      subject: SMOKE_TEST_EMAIL_SUBJECT,
      text: SMOKE_TEST_EMAIL_TEXT,
    });
    expect('react' in email).toBe(true);
    expect('html' in email).toBe(false);

    const alias = buildHelloWorldEmail('ops@example.com');
    expect(alias).toMatchObject({
      to: 'ops@example.com',
      subject: SMOKE_TEST_EMAIL_SUBJECT,
      text: SMOKE_TEST_EMAIL_TEXT,
    });
    expect('react' in alias).toBe(true);

    if (!('react' in email)) throw new Error('expected react email payload');
    const html = await render(email.react);
    expect(html).toContain('Email deliverability check');
    expect(html).toContain('transactional smoke test');
  });

  it('builds a user invite email with react markup and text fallback', async () => {
    const email = buildUserInviteEmail({
      to: 'parent@example.com',
      role: 'Parent',
      inviteUrl: 'https://clerk.example/invite/abc?x=1&y=2',
    });

    expect(email.to).toBe('parent@example.com');
    expect(email.subject).toBe(USER_INVITE_EMAIL_SUBJECT);
    expect(email.text).toContain('https://clerk.example/invite/abc?x=1&y=2');
    expect(email.text).toContain('Parent / Guardian');
    expect(email.text).toContain('set up your Oasis Portal account');
    expect('react' in email).toBe(true);
    expect('html' in email).toBe(false);

    if (!('react' in email)) throw new Error('expected react email payload');
    const html = await render(email.react);
    expect(html).toContain('Accept invitation');
    expect(html).toContain('Parent / Guardian');
    expect(html).toContain('Parent Portal');
    expect(html).toContain('x=1&amp;y=2');
    expect(html).not.toContain('create your Clerk account');
  });

  it('builds a message notification email without leaking the message body', async () => {
    const email = buildMessageNotificationEmail({
      to: 'parent@example.com',
      recipientName: 'Jane Parent',
      senderName: 'Mrs Thompson',
      threadSubject: 'Attendance question',
      messagePath: '/parent/messages?threadId=cthread1',
    });

    expect(email.to).toBe('parent@example.com');
    expect(email.subject).toBe(MESSAGE_NOTIFICATION_EMAIL_SUBJECT);
    expect(email.text).toContain('Mrs Thompson');
    expect(email.text).toContain('Attendance question');
    expect(email.text).not.toContain('Please call me back');
    expect('react' in email).toBe(true);
    expect('html' in email).toBe(false);

    if (!('react' in email)) throw new Error('expected react email payload');
    const html = await render(email.react);
    expect(html).toContain('New portal message');
    expect(html).toContain('Attendance question');
    expect(html).not.toContain('Please call me back');
  });

  it('builds a notice notification email with notice contents and portal link', async () => {
    await withAppUrl('https://portal.example.com', async () => {
      const email = buildNoticeNotificationEmail({
        to: 'parent@example.com',
        recipientName: 'Jane Parent',
        title: 'Trip forms',
        body: 'Please return the signed trip form tomorrow.',
        audience: 'Parents',
        noticePath: '/parent/noticeboard',
      });

      expect(email.to).toBe('parent@example.com');
      expect(email.subject).toBe(NOTICE_NOTIFICATION_EMAIL_SUBJECT);
      expect(email.text).toContain('Trip forms');
      expect(email.text).toContain('Please return the signed trip form tomorrow.');
      expect(email.text).toContain('Audience: Parents');
      expect(email.text).toContain('https://portal.example.com/parent/noticeboard');
      expect('react' in email).toBe(true);
      expect('html' in email).toBe(false);

      if (!('react' in email)) throw new Error('expected react email payload');
      const html = await render(email.react);
      expect(html).toContain('Noticeboard update');
      expect(html).toContain('Trip forms');
      expect(html).toContain('Please return the signed trip form tomorrow.');
      expect(html).toContain('https://portal.example.com/parent/noticeboard');
    });
  });

  it('builds a behaviour notification email with category, type, and optional note', async () => {
    const email = buildBehaviourNotificationEmail({
      to: 'parent@example.com',
      recipientName: 'Jane Parent',
      childName: 'Jane Learner',
      type: 'Merit',
      category: 'Kindness',
      recordedByName: 'Supervisor User',
      note: 'Helped a younger student',
    });

    expect(email.to).toBe('parent@example.com');
    expect(email.subject).toBe(BEHAVIOUR_NOTIFICATION_EMAIL_SUBJECT);
    expect(email.text).toContain('Jane Learner');
    expect(email.text).toContain('Type: Merit');
    expect(email.text).toContain('Category: Kindness');
    expect(email.text).toContain('Recorded by: Supervisor User');
    expect(email.text).toContain('Note: Helped a younger student');
    expect('react' in email).toBe(true);
    expect('html' in email).toBe(false);

    if (!('react' in email)) throw new Error('expected react email payload');
    const html = await render(email.react);
    expect(html).toContain('Merit recorded');
    expect(html).toContain('Jane Learner');
    expect(html).toContain('Kindness');
    expect(html).toContain('Supervisor User');
    expect(html).toContain('Helped a younger student');
  });

  it('builds a club notification email with guardian and child context', async () => {
    const email = buildClubNotificationEmail({
      to: 'parent@example.com',
      recipientName: 'Jane Parent',
      childNames: ['Jane Learner', 'John Learner'],
      clubName: 'Choir',
      title: 'Bring water',
      body: 'Please bring a labelled water bottle.',
    });

    expect(email.to).toBe('parent@example.com');
    expect(email.subject).toBe(CLUB_NOTIFICATION_EMAIL_SUBJECT);
    expect(email.text).toContain('Choir');
    expect(email.text).toContain('Bring water');
    expect(email.text).toContain('Jane Learner, John Learner');
    expect(email.text).toContain('Please bring a labelled water bottle.');
    expect('react' in email).toBe(true);
    expect('html' in email).toBe(false);

    if (!('react' in email)) throw new Error('expected react email payload');
    const html = await render(email.react);
    expect(html).toContain('Club notification');
    expect(html).toContain('Choir');
    expect(html).toContain('Jane Learner, John Learner');
    expect(html).toContain('Please bring a labelled water bottle.');
  });

  it('builds a report notification email without embedding report contents', async () => {
    const email = buildReportNotificationEmail({
      to: 'parent@example.com',
      recipientName: 'Jane Parent',
      childName: 'Jane Learner',
      term: '2026-Summer',
      reportPath: '/parent/reports?studentId=student1&reportId=report1',
    });

    expect(email.to).toBe('parent@example.com');
    expect(email.subject).toBe(REPORT_NOTIFICATION_EMAIL_SUBJECT);
    expect(email.text).toContain('Jane Learner');
    expect(email.text).toContain('2026-Summer');
    expect(email.text).not.toContain('attendance');
    expect(email.text).not.toContain('Head summary');
    expect('react' in email).toBe(true);
    expect('html' in email).toBe(false);

    if (!('react' in email)) throw new Error('expected react email payload');
    const html = await render(email.react);
    expect(html).toContain('Term report ready');
    expect(html).toContain('Jane Learner');
    expect(html).toContain('2026-Summer');
    expect(html).not.toContain('Head summary');
  });

  it('builds an invoice payment notification email without embedding invoice contents', async () => {
    await withAppUrl('https://portal.example.com', async () => {
      const email = buildInvoicePaymentNotificationEmail({
        to: 'pastor@example.com',
        recipientName: 'Pastor User',
        familyLabel: 'Parent family',
        invoiceNumber: 'INV-2026-001',
        invoicePath: '/admin/invoices',
      });

      expect(email.to).toBe('pastor@example.com');
      expect(email.subject).toBe(INVOICE_PAYMENT_NOTIFICATION_EMAIL_SUBJECT);
      expect(email.text).toContain('The Parent family has marked Invoice INV-2026-001 as paid.');
      expect(email.text).toContain('It is awaiting your confirmation in Oasis Portal.');
      expect(email.text).toContain('https://portal.example.com/admin/invoices');
      expect(email.text).not.toContain('Talia Parent');
      expect(email.text).not.toContain('Tuition');
      expect(email.text).not.toContain('420.00');
      expect('react' in email).toBe(true);
      expect('html' in email).toBe(false);

      if (!('react' in email)) throw new Error('expected react email payload');
      const html = await render(email.react);
      expect(html).toContain('Invoice payment awaiting confirmation');
      expect(html).toContain('Parent family');
      expect(html).toContain('INV-2026-001');
      expect(html).toContain('https://portal.example.com/admin/invoices');
      expect(html).not.toContain('Talia Parent');
      expect(html).not.toContain('Tuition');
    });
  });
});

describe('email router', () => {
  it('sends the smoke-test email for full admins and audits the send', async () => {
    const email = makeFakeEmailClient();
    const { caller, db } = makeCaller(headUser, { emailClient: email.client });

    await expect(caller.email.sendSmokeTest()).resolves.toEqual({ id: 'email_123' });

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: SMOKE_TEST_EMAIL_TO,
        subject: SMOKE_TEST_EMAIL_SUBJECT,
        text: SMOKE_TEST_EMAIL_TEXT,
      }),
    );
    const sentEmail = email.send.mock.calls[0]?.[0];
    expect(sentEmail && 'react' in sentEmail).toBe(true);
    expect(sentEmail && 'html' in sentEmail).toBe(false);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Email',
        entityId: 'email_123',
        meta: {
          to: SMOKE_TEST_EMAIL_TO,
          subject: SMOKE_TEST_EMAIL_SUBJECT,
          source: 'email.sendSmokeTest',
        },
      },
    });
  });

  it('keeps the hello-world procedure as a compatibility alias', async () => {
    const email = makeFakeEmailClient();
    const { caller, db } = makeCaller(headUser, { emailClient: email.client });

    await expect(caller.email.sendHelloWorld()).resolves.toEqual({ id: 'email_123' });

    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: HELLO_WORLD_EMAIL_TO,
        subject: HELLO_WORLD_EMAIL_SUBJECT,
        text: SMOKE_TEST_EMAIL_TEXT,
      }),
    );
    const sentEmail = email.send.mock.calls[0]?.[0];
    expect(sentEmail && 'react' in sentEmail).toBe(true);
    expect(sentEmail && 'html' in sentEmail).toBe(false);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Email',
        entityId: 'email_123',
        meta: {
          to: HELLO_WORLD_EMAIL_TO,
          subject: HELLO_WORLD_EMAIL_SUBJECT,
          source: 'email.sendHelloWorld',
        },
      },
    });
  });

  it('accepts a trimmed override recipient', async () => {
    const email = makeFakeEmailClient();
    const { caller } = makeCaller(headUser, { emailClient: email.client });

    await caller.email.sendSmokeTest({ to: ' jean@example.com ' });

    expect(email.send).toHaveBeenCalledWith(buildSmokeTestEmail('jean@example.com'));
  });

  it('rejects non-full-admin callers without sending email', async () => {
    const email = makeFakeEmailClient();
    const { caller, db } = makeCaller(supervisorUser, { emailClient: email.client });

    await expect(caller.email.sendHelloWorld()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(email.send).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
