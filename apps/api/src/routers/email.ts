import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { buildHelloWorldEmail, createResendEmailClient, type EmailClient } from '../lib/email.js';
import { fullAdminProcedure, router } from '../trpc.js';

export interface EmailRouterDeps {
  emailClient?: EmailClient;
}

const sendHelloWorldInput = z
  .object({
    to: z.string().trim().email().optional(),
  })
  .optional();

export function createEmailRouter(deps: EmailRouterDeps = {}) {
  let cachedEmailClient: EmailClient | null = deps.emailClient ?? null;
  const getEmailClient = (): EmailClient => {
    if (cachedEmailClient) return cachedEmailClient;
    cachedEmailClient = createResendEmailClient();
    return cachedEmailClient;
  };

  return router({
    sendHelloWorld: fullAdminProcedure
      .input(sendHelloWorldInput)
      .mutation(async ({ ctx, input }) => {
        const email = buildHelloWorldEmail(input?.to);
        let result: Awaited<ReturnType<EmailClient['send']>>;

        try {
          result = await getEmailClient().send(email);
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
            meta: { to: email.to, subject: email.subject },
          },
        });

        return result;
      }),
  });
}

export const emailRouter = createEmailRouter();
