/**
 * tRPC HTTP handler (Next.js Route Handler, fetch adapter).
 *
 * Resolves the Clerk session via `auth()` and passes the Clerk user id into
 * `createContext`, which hydrates `ctx.user` and configures RLS session vars.
 * In CI / dev without Clerk secrets, `auth()` throws and we fall back to an
 * anonymous context.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { auth } from '@clerk/nextjs/server';
import { appRouter, createContext } from '@oasis/api';

async function resolveClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () =>
      createContext({ headers: req.headers, clerkUserId: await resolveClerkUserId() }),
  });

export { handler as GET, handler as POST };
