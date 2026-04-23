/**
 * Per-request tRPC context.
 *
 * Phase 1 will plug Clerk in here: verify the session JWT, hydrate `SessionUser`,
 * and set Postgres session vars so RLS policies (rls.sql) fire. For now we expose
 * the shape so routers can be written against it immediately.
 */
import { prisma, type PrismaClient } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';

export interface CreateContextArgs {
  headers: Headers;
  // Clerk auth payload will be passed in at Phase 1.
  clerkUserId?: string;
}

export interface AppContext {
  db: ReturnType<typeof prisma extends PrismaClient ? () => PrismaClient : never> extends never
    ? typeof prisma
    : typeof prisma;
  user: SessionUser | null;
  requestId: string;
}

function newRequestId(): string {
  // Non-crypto, just for log correlation. Replace with crypto.randomUUID() in Node.
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createContext(args: CreateContextArgs): AppContext {
  // Phase 1: lookup User by args.clerkUserId, load role + tags, set PG session vars.
  void args;
  return {
    db: prisma,
    user: null,
    requestId: newRequestId(),
  };
}
