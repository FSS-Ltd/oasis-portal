/**
 * Per-request tRPC context.
 *
 * Resolves a Clerk session to a local `SessionUser`, and exposes `withRls` which
 * runs Prisma calls inside a transaction with `app.user_id` / `app.user_role` /
 * `app.full_admin` session vars set so the policies in `packages/db/prisma/rls.sql`
 * fire. When no session is present, RLS denies by default (vars cleared).
 */
import { Prisma, prisma } from '@oasis/db';
import type { PrismaClient } from '@oasis/db';
import { isFullAdmin, type Role, type SessionUser } from '@oasis/domain';
import { logOperationalEvent } from './lib/observability.js';
import { reconcileClerkUser } from './routers/clerkWebhook.js';

export interface CreateContextArgs {
  headers: Headers;
  clerkUserId?: string | null;
  enforceTwoFactor?: boolean;
  twoFactorSatisfied?: boolean;
}

export type RlsTx = Prisma.TransactionClient;

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;
const RLS_TRANSACTION_MAX_WAIT_MS = 10_000;

export class RlsSerializationConflictError extends Error {
  constructor() {
    super('The inventory changed while your request was being processed. Please retry.');
    this.name = 'RlsSerializationConflictError';
  }
}

type TxClient = Pick<PrismaClient, '$transaction'>;

export interface AppContext {
  db: typeof prisma;
  user: SessionUser | null;
  accountAccessState: AccountAccessState;
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

export interface LoadSessionUserDeps {
  findUser?: (clerkUserId: string) => Promise<UserLookupRow | null>;
  reconcileUser?: (clerkUserId: string) => Promise<void>;
}

export type AccountAccessState = 'active' | 'deactivated' | 'unavailable';

export interface AccountAccess {
  accountAccessState: AccountAccessState;
  user: SessionUser | null;
}

function findLocalUser(clerkUserId: string): Promise<UserLookupRow | null> {
  return prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true, role: true, tags: true, active: true },
  });
}

export async function loadAccountAccess(
  clerkUserId: string,
  enforceTwoFactor: boolean,
  twoFactorSatisfied: boolean,
  deps: LoadSessionUserDeps = {},
): Promise<AccountAccess> {
  const findUser = deps.findUser ?? findLocalUser;
  let user = await findUser(clerkUserId);

  // A valid Clerk session can outlive a missed asynchronous webhook delivery.
  // Never reconcile an existing inactive user; that state is admin-controlled.
  if (!user) {
    try {
      await (deps.reconcileUser ?? reconcileClerkUser)(clerkUserId);
      user = await findUser(clerkUserId);
    } catch (error) {
      logOperationalEvent({
        event: 'auth.clerk_user_reconciliation_failed',
        level: 'error',
        message: 'Unable to reconcile a signed-in Clerk user',
        meta: { errorType: error instanceof Error ? error.name : 'unknown' },
      });
      return { accountAccessState: 'unavailable', user: null };
    }
  }

  if (!user) return { accountAccessState: 'unavailable', user: null };
  if (!user.active) return { accountAccessState: 'deactivated', user: null };
  return {
    accountAccessState: 'active',
    user: {
      id: user.id,
      role: user.role,
      tags: user.tags,
      requires2fa: enforceTwoFactor && !twoFactorSatisfied,
    },
  };
}

export async function loadSessionUser(
  clerkUserId: string,
  enforceTwoFactor: boolean,
  twoFactorSatisfied: boolean,
  deps: LoadSessionUserDeps = {},
): Promise<SessionUser | null> {
  return (await loadAccountAccess(clerkUserId, enforceTwoFactor, twoFactorSatisfied, deps)).user;
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
  return client.$transaction(
    async (tx: RlsTx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_role', ${role}, true)`;
      await tx.$executeRaw`SELECT set_config('app.full_admin', ${fullAdmin}, true)`;
      return fn(tx);
    },
    { maxWait: RLS_TRANSACTION_MAX_WAIT_MS },
  );
}

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  );
}

/**
 * Run an RLS-scoped serializable transaction with bounded retries for Postgres
 * serialization conflicts. The RLS session variables are set on every retry.
 */
export async function applySerializableRlsTx<T>(
  client: TxClient,
  user: SessionUser | null,
  fn: (tx: RlsTx) => Promise<T>,
): Promise<T> {
  const userId = user?.id ?? '';
  const role: string = user?.role ?? '';
  const fullAdmin = user ? (isFullAdmin(user) ? 'true' : 'false') : '';

  for (let attempt = 1; attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(
        async (tx: RlsTx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.user_role', ${role}, true)`;
          await tx.$executeRaw`SELECT set_config('app.full_admin', ${fullAdmin}, true)`;
          return fn(tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      if (attempt === SERIALIZABLE_TRANSACTION_ATTEMPTS) {
        throw new RlsSerializationConflictError();
      }
    }
  }

  throw new RlsSerializationConflictError();
}

export async function createContext(args: CreateContextArgs): Promise<AppContext> {
  const clerkUserId = args.clerkUserId ?? null;
  const accountAccess = clerkUserId
    ? await loadAccountAccess(
        clerkUserId,
        args.enforceTwoFactor ?? false,
        args.twoFactorSatisfied ?? false,
      )
    : { accountAccessState: 'unavailable' as const, user: null };
  const { user } = accountAccess;
  return {
    db: prisma,
    user,
    accountAccessState: accountAccess.accountAccessState,
    requestId: newRequestId(),
    withRls: (fn) => applyRlsTx(prisma, user, fn),
  };
}
