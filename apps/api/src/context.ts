/**
 * Per-request tRPC context.
 *
 * Resolves a Clerk session to a local `SessionUser`, and exposes `withRls` which
 * runs Prisma calls inside a transaction with `app.user_id` / `app.user_role` /
 * `app.full_admin` / `app.compliance_admin` session vars set so the policies in `packages/db/prisma/rls.sql`
 * fire. When no session is present, RLS denies by default (vars cleared).
 */
import { getReviewPrisma, Prisma, prisma } from '@oasis/db';
import type { PrismaClient } from '@oasis/db';
import { canUseComplianceAdminTag, isFullAdmin, type Role, type SessionUser } from '@oasis/domain';
import { logOperationalEvent } from './lib/observability.js';
import { reconcileClerkUser } from './routers/clerkWebhook.js';

export interface CreateContextArgs {
  headers: Headers;
  clerkUserId?: string | null;
  enforceTwoFactor?: boolean;
  twoFactorSatisfied?: boolean;
  /**
   * Admit app store review accounts. Only the tRPC route sets this: web pages that read the global
   * client after auth would otherwise show a reviewer live data.
   */
  allowReviewTenant?: boolean;
}

/** `live` is the learning centre (`public` schema); `review` is the app store review sandbox. */
export type Tenant = 'live' | 'review';

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
  findReviewUser?: (clerkUserId: string) => Promise<UserLookupRow | null>;
  reconcileUser?: (clerkUserId: string) => Promise<void>;
}

export type AccountAccessState = 'active' | 'deactivated' | 'unavailable';

export interface AccountAccess {
  accountAccessState: AccountAccessState;
  user: SessionUser | null;
  tenant: Tenant;
}

const userLookupSelect = { id: true, role: true, tags: true, active: true } as const;

function findLocalUser(clerkUserId: string): Promise<UserLookupRow | null> {
  return prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: userLookupSelect });
}

async function findReviewTenantUser(clerkUserId: string): Promise<UserLookupRow | null> {
  try {
    const reviewDb = await getReviewPrisma();
    return await reviewDb.user.findUnique({
      where: { clerkId: clerkUserId },
      select: userLookupSelect,
    });
  } catch (error) {
    // No review schema (or a misconfigured one) must never block or reroute a live user.
    logOperationalEvent({
      event: 'auth.review_tenant_lookup_failed',
      level: 'warn',
      message: 'Review tenant lookup failed',
      meta: { errorType: error instanceof Error ? error.name : 'unknown' },
    });
    return null;
  }
}

export async function loadAccountAccess(
  clerkUserId: string,
  enforceTwoFactor: boolean,
  twoFactorSatisfied: boolean,
  deps: LoadSessionUserDeps = {},
): Promise<AccountAccess> {
  const findUser = deps.findUser ?? findLocalUser;
  let user = await findUser(clerkUserId);

  // Live users resolve in public and never touch the review connection. Review accounts have no
  // public row: the Clerk webhook and the repair below both skip users flagged reviewSandbox.
  if (!user) {
    const reviewUser = await (deps.findReviewUser ?? findReviewTenantUser)(clerkUserId);
    if (reviewUser) return accessFor(reviewUser, 'review', false);
  }

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
      return { accountAccessState: 'unavailable', user: null, tenant: 'live' };
    }
  }

  if (!user) return { accountAccessState: 'unavailable', user: null, tenant: 'live' };
  return accessFor(user, 'live', enforceTwoFactor && !twoFactorSatisfied);
}

function accessFor(user: UserLookupRow, tenant: Tenant, requires2fa: boolean): AccountAccess {
  if (!user.active) return { accountAccessState: 'deactivated', user: null, tenant };
  return {
    accountAccessState: 'active',
    // Review accounts are exempt from 2FA so store reviewers can sign in with a password alone.
    user: { id: user.id, role: user.role, tags: user.tags, requires2fa },
    tenant,
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
  const complianceAdmin = user && canUseComplianceAdminTag(user) ? 'true' : 'false';
  return client.$transaction(
    async (tx: RlsTx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.user_role', ${role}, true)`;
      await tx.$executeRaw`SELECT set_config('app.full_admin', ${fullAdmin}, true)`;
      await tx.$executeRaw`SELECT set_config('app.compliance_admin', ${complianceAdmin}, true)`;
      return fn(tx);
    },
    { maxWait: RLS_TRANSACTION_MAX_WAIT_MS },
  );
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
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
  const complianceAdmin = user && canUseComplianceAdminTag(user) ? 'true' : 'false';

  for (let attempt = 1; attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(
        async (tx: RlsTx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
          await tx.$executeRaw`SELECT set_config('app.user_role', ${role}, true)`;
          await tx.$executeRaw`SELECT set_config('app.full_admin', ${fullAdmin}, true)`;
          await tx.$executeRaw`SELECT set_config('app.compliance_admin', ${complianceAdmin}, true)`;
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

/** Review accounts are treated as signed out anywhere that has not opted in to the review tenant. */
export function admitTenant(access: AccountAccess, allowReviewTenant: boolean): AccountAccess {
  if (access.tenant === 'review' && !allowReviewTenant) {
    return { accountAccessState: 'unavailable', user: null, tenant: 'live' };
  }
  return access;
}

export async function createContext(args: CreateContextArgs): Promise<AppContext> {
  const clerkUserId = args.clerkUserId ?? null;
  const resolved: AccountAccess = clerkUserId
    ? await loadAccountAccess(
        clerkUserId,
        args.enforceTwoFactor ?? false,
        args.twoFactorSatisfied ?? false,
      )
    : { accountAccessState: 'unavailable', user: null, tenant: 'live' };
  const accountAccess = admitTenant(resolved, args.allowReviewTenant ?? false);
  const { user, tenant } = accountAccess;
  const db = tenant === 'review' ? await getReviewPrisma() : prisma;
  return {
    db,
    user,
    accountAccessState: accountAccess.accountAccessState,
    requestId: newRequestId(),
    withRls: (fn) => applyRlsTx(db, user, fn),
  };
}
