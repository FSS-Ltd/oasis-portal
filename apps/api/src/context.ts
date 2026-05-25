/**
 * Per-request tRPC context.
 *
 * Resolves a Clerk session to a local `SessionUser`, and exposes `withRls` which
 * runs Prisma calls inside a transaction with `app.user_id` / `app.user_role` /
 * `app.full_admin` session vars set so the policies in `packages/db/prisma/rls.sql`
 * fire. When no session is present, RLS denies by default (vars cleared).
 */
import { prisma } from '@oasis/db';
import type { Prisma, PrismaClient } from '@oasis/db';
import { isFullAdmin, type Role, type SessionUser } from '@oasis/domain';

export interface CreateContextArgs {
  headers: Headers;
  clerkUserId?: string | null;
  twoFactorSatisfied?: boolean;
}

export type RlsTx = Prisma.TransactionClient;

type TxClient = Pick<PrismaClient, '$transaction'>;

export interface AppContext {
  db: typeof prisma;
  user: SessionUser | null;
  requestId: string;
  withRls: <T>(fn: (tx: RlsTx) => Promise<T>) => Promise<T>;
}

function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface UserLookupRow {
  id: string;
  role: Role;
  tags: string[];
  active: boolean;
}

async function loadSessionUser(
  clerkUserId: string,
  twoFactorSatisfied: boolean,
): Promise<SessionUser | null> {
  const user: UserLookupRow | null = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, role: true, tags: true, active: true },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    role: user.role,
    tags: user.tags,
    requires2fa: !twoFactorSatisfied,
  };
}

/**
 * Run `fn` inside a Postgres transaction with `app.*` session variables set
 * for the given `SessionUser`. Exported so integration tests / smokes can
 * exercise the same RLS path against a non-owner runtime Prisma client.
 */
export function applyRlsTx<T>(
  client: TxClient,
  user: SessionUser | null,
  fn: (tx: RlsTx) => Promise<T>,
): Promise<T> {
  const userId = user?.id ?? '';
  const role: string = user?.role ?? '';
  const fullAdmin = user ? (isFullAdmin(user) ? 'true' : 'false') : '';
  return client.$transaction(async (tx: RlsTx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.user_role', ${role}, true)`;
    await tx.$executeRaw`SELECT set_config('app.full_admin', ${fullAdmin}, true)`;
    return fn(tx);
  });
}

export async function createContext(args: CreateContextArgs): Promise<AppContext> {
  const clerkUserId = args.clerkUserId ?? null;
  const user = clerkUserId
    ? await loadSessionUser(clerkUserId, args.twoFactorSatisfied ?? false)
    : null;
  return {
    db: prisma,
    user,
    requestId: newRequestId(),
    withRls: (fn) => applyRlsTx(prisma, user, fn),
  };
}
