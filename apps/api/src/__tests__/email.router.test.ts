import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import {
  DEFAULT_RESEND_FROM,
  HELLO_WORLD_EMAIL_HTML,
  HELLO_WORLD_EMAIL_SUBJECT,
  HELLO_WORLD_EMAIL_TO,
  buildHelloWorldEmail,
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

  it('rejects missing API keys before constructing a Resend client', () => {
    expect(() => readEmailConfig({})).toThrow('RESEND_API_KEY is required to send email');
  });
});

describe('email router', () => {
  it('sends the hello-world email for full admins and audits the send', async () => {
    const email = makeFakeEmailClient();
    const { caller, db } = makeCaller(headUser, { emailClient: email.client });

    await expect(caller.email.sendHelloWorld()).resolves.toEqual({ id: 'email_123' });

    expect(email.send).toHaveBeenCalledWith({
      to: HELLO_WORLD_EMAIL_TO,
      subject: HELLO_WORLD_EMAIL_SUBJECT,
      html: HELLO_WORLD_EMAIL_HTML,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Email',
        entityId: 'email_123',
        meta: { to: HELLO_WORLD_EMAIL_TO, subject: HELLO_WORLD_EMAIL_SUBJECT },
      },
    });
  });

  it('accepts a trimmed override recipient', async () => {
    const email = makeFakeEmailClient();
    const { caller } = makeCaller(headUser, { emailClient: email.client });

    await caller.email.sendHelloWorld({ to: ' jean@example.com ' });

    expect(email.send).toHaveBeenCalledWith(buildHelloWorldEmail('jean@example.com'));
  });

  it('rejects non-full-admin callers without sending email', async () => {
    const email = makeFakeEmailClient();
    const { caller, db } = makeCaller(supervisorUser, { emailClient: email.client });

    await expect(caller.email.sendHelloWorld()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(email.send).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
