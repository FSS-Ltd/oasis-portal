/**
 * tRPC HTTP handler (Next.js Route Handler, fetch adapter).
 *
 * Phase 0 wires the transport so clients can hit /api/trpc/* and get typed
 * `notImplemented` errors from every procedure. Clerk session extraction is
 * added in Phase 1 — for now `createContext` returns `user: null` and any
 * authed procedure returns UNAUTHORIZED.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@oasis/api';

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ headers: req.headers }),
  });

export { handler as GET, handler as POST };
