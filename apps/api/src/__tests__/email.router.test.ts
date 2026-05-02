import { describe, expect, it, vi } from 'vitest';
import { render } from 'react-email';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import {
  DEFAULT_RESEND_FROM,
  HELLO_WORLD_EMAIL_SUBJECT,
  HELLO_WORLD_EMAIL_TO,
  PRODUCTION_RESEND_FROM,
  SMOKE_TEST_EMAIL_SUBJECT,
  SMOKE_TEST_EMAIL_TEXT,
  SMOKE_TEST_EMAIL_TO,
  USER_INVITE_EMAIL_SUBJECT,
  buildHelloWorldEmail,
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

  it('rejects missing API keys before constructing a Resend client', () => {
    expect(() => readEmailConfig({})).toThrow('RESEND_API_KEY is required to send email');
  });
});

describe('email builders', () => {
  it('builds a branded smoke-test email with react markup and text fallback', () => {
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
