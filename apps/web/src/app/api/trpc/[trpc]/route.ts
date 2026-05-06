/**
 * tRPC HTTP handler (Next.js Route Handler, fetch adapter).
 *
 * Resolves the Clerk session via web cookies first, then Clerk Expo bearer
 * tokens for the mobile smoke client. The Clerk user id is passed into
 * `createContext`, which hydrates `ctx.user` and configures RLS session vars.
 * In CI / dev without Clerk secrets, auth resolution falls back to anonymous.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { auth } from '@clerk/nextjs/server';
import { appRouter, createContext, resolveClerkUserIdFromBearerToken } from '@oasis/api';

async function resolveClerkUserId(headers: Headers): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // Continue to bearer-token resolution for mobile requests.
  }

  return resolveClerkUserIdFromBearerToken(headers);
}

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () =>
      createContext({ headers: req.headers, clerkUserId: await resolveClerkUserId(req.headers) }),
  });

export { handler as GET, handler as POST };
