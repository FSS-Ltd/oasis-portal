/**
 * tRPC HTTP handler (Next.js Route Handler, fetch adapter).
 *
 * Resolves the Clerk session via web cookies first, then Clerk Expo bearer
 * tokens for the mobile smoke client. The Clerk user id is passed into
 * `createContext`, which hydrates `ctx.user` and configures RLS session vars.
 * In CI / dev without Clerk secrets, auth resolution falls back to anonymous.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import * as Sentry from '@sentry/nextjs';
import { appRouter, createContext, logOperationalEvent, operationalErrorMessage } from '@oasis/api';
import { isTwoFactorEnforcementEnabled } from '@/lib/clerk-two-factor';
import { resolveClerkSession } from '../../auth-context';

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    allowMethodOverride: true,
    createContext: async () => {
      const session = await resolveClerkSession(req.headers);
      return createContext({
        headers: req.headers,
        clerkUserId: session.clerkUserId,
        enforceTwoFactor: isTwoFactorEnforcementEnabled(),
        twoFactorSatisfied: session.twoFactorSatisfied,
      });
    },
    onError({ error, path, type }) {
      logOperationalEvent({
        event: 'trpc.request_failed',
        level: error.code === 'INTERNAL_SERVER_ERROR' ? 'error' : 'warn',
        message: 'tRPC request failed',
        meta: {
          code: error.code,
          error: operationalErrorMessage(error),
          path: path ?? 'unknown',
          type,
        },
      });

      if (error.code === 'INTERNAL_SERVER_ERROR') {
        Sentry.withScope((scope) => {
          scope.setTag('trpc.path', path ?? 'unknown');
          scope.setTag('trpc.type', type);
          Sentry.captureException(error);
        });
      }
    },
  });

export { handler as GET, handler as POST };
