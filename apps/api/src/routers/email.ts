import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { buildSmokeTestEmail, createResendEmailClient, type EmailClient } from '../lib/email.js';
import { fullAdminProcedure, router } from '../trpc.js';

export interface EmailRouterDeps {
  emailClient?: EmailClient;
}

const sendSmokeTestInput = z
  .object({
    to: z.string().trim().email().optional(),
  })
  .optional();

type SendSmokeTestInput = z.infer<typeof sendSmokeTestInput>;

async function sendAuditedSmokeTestEmail(
  ctx: AppContext,
  input: SendSmokeTestInput,
  emailClient: EmailClient,
  source: 'email.sendSmokeTest' | 'email.sendHelloWorld',
) {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'sign-in required' });
  }

  const email = buildSmokeTestEmail(input?.to);
  let result: Awaited<ReturnType<EmailClient['send']>>;

  try {
    result = await emailClient.send(email);
  } catch (err) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'email send failed',
      cause: err instanceof Error ? err : undefined,
    });
  }

  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'Create',
      entity: 'Email',
      entityId: result.id,
      meta: { to: email.to, subject: email.subject, source },
    },
  });

  return result;
}

export function createEmailRouter(deps: EmailRouterDeps = {}) {
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  return router({
    sendSmokeTest: fullAdminProcedure
      .input(sendSmokeTestInput)
      .mutation(async ({ ctx, input }) =>
        sendAuditedSmokeTestEmail(ctx, input, getEmailClient(), 'email.sendSmokeTest'),
      ),
    sendHelloWorld: fullAdminProcedure
      .input(sendSmokeTestInput)
      .mutation(async ({ ctx, input }) =>
        sendAuditedSmokeTestEmail(ctx, input, getEmailClient(), 'email.sendHelloWorld'),
      ),
  });
}

export const emailRouter = createEmailRouter();
