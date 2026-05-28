import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import {
  appRouter,
  createContext,
  logOperationalEvent,
  operationalErrorMessage,
  resolveClerkSessionFromBearerToken,
} from '@oasis/api';
import {
  isTwoFactorEnforcementEnabled,
  twoFactorSatisfiedFromClerkAuth,
} from '@/lib/clerk-two-factor';

type AppRouterCaller = ReturnType<typeof appRouter.createCaller>;

interface ResolvedAuthSession {
  clerkUserId: string | null;
  twoFactorSatisfied: boolean;
}

export async function resolveClerkSession(headers: Headers): Promise<ResolvedAuthSession> {
  try {
    const clerkAuth = await auth();
    if (clerkAuth.userId) {
      return {
        clerkUserId: clerkAuth.userId,
        twoFactorSatisfied: twoFactorSatisfiedFromClerkAuth(clerkAuth),
      };
    }
  } catch (err) {
    logOperationalEvent({
      event: 'auth.handoff_failed',
      level: 'warn',
      message: 'Clerk auth handoff failed',
      meta: { error: operationalErrorMessage(err) },
    });
    Sentry.withScope((scope) => {
      scope.setTag('auth.source', 'clerk-cookie');
      Sentry.captureException(err);
    });
  }

  const bearerSession = await resolveClerkSessionFromBearerToken(headers);
  return {
    clerkUserId: bearerSession?.clerkUserId ?? null,
    twoFactorSatisfied: bearerSession?.twoFactorSatisfied ?? false,
  };
}

export async function createCallerForRequest(req: Request): Promise<AppRouterCaller> {
  const session = await resolveClerkSession(req.headers);
  const ctx = await createContext({
    headers: req.headers,
    clerkUserId: session.clerkUserId,
    enforceTwoFactor: isTwoFactorEnforcementEnabled(),
    twoFactorSatisfied: session.twoFactorSatisfied,
  });
  return appRouter.createCaller(ctx);
}
