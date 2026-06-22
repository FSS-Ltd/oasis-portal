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

const PWA_ALLOWED_ORIGINS = new Set(['https://app.oasisportal.space']);
const CORS_ALLOWED_HEADERS = 'Authorization, Content-Type';
const CORS_ALLOWED_METHODS = 'GET, POST, OPTIONS';

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');

  if (!origin || !PWA_ALLOWED_ORIGINS.has(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

function withCors(req: Request, response: Response): Response {
  const corsHeaders = corsHeadersFor(req);

  for (const [header, value] of Object.entries(corsHeaders)) {
    response.headers.set(header, value);
  }

  return response;
}

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
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
  }).then((response) => withCors(req, response));

function OPTIONS(req: Request): Response {
  return new Response(null, {
    headers: corsHeadersFor(req),
    status: 204,
  });
}

export { handler as GET, OPTIONS, handler as POST };
