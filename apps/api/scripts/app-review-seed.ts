/**
 * Seeds the app store review tenant (`review` schema, same database as live). See
 * docs/app-review-tenant.md.
 *
 * Two production Clerk logins are created, staff and parent, flagged `reviewSandbox` so the webhook
 * keeps them out of `public` and the API routes them to `review`. Every other synthetic person is a
 * row only, with a placeholder Clerk ID, and cannot sign in.
 */
import { fileURLToPath } from 'node:url';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';
import { REVIEW_SCHEMA, reviewDatabaseUrl, withEncryption } from '@oasis/db';
import { requireEnv, type EnvLike } from './client-demo/env.js';
import { currentSchema, resetIsolatedSchema, seedDatabase } from './client-demo/database.js';
import { buildClientDemoPlan, type ClientDemoPlan } from './client-demo/plan.js';
import type { PrismaWithEncryption } from './client-demo/types.js';

export const APP_REVIEW_SEED_CONFIRMATION = 'reset-review-schema';

/** Demo plan user id → the login handed to Apple and Google. */
const REVIEW_LOGINS = {
  clientdemo_user_head_parent: 'staff',
  clientdemo_user_parent: 'parent',
} as const;

export interface AppReviewLogin {
  userId: string;
  email: string;
}

export function buildAppReviewPlan(input: { emailDomain: string; password: string }): {
  plan: ClientDemoPlan;
  logins: AppReviewLogin[];
} {
  const base = buildClientDemoPlan(input);
  const logins: AppReviewLogin[] = [];
  const plan: ClientDemoPlan = {
    ...base,
    users: base.users.map((user) => {
      const login = REVIEW_LOGINS[user.id as keyof typeof REVIEW_LOGINS] as string | undefined;
      if (!login) return user;
      const email = `${login}@${base.emailDomain}`;
      logins.push({ userId: user.id, email });
      return { ...user, email };
    }),
  };
  if (logins.length !== Object.keys(REVIEW_LOGINS).length) {
    throw new Error('Client demo plan no longer contains the staff and parent review users.');
  }
  return { plan, logins };
}

/** Clerk IDs for every plan user: real ones for the two logins, inert placeholders for the rest. */
export function reviewClerkIds(plan: ClientDemoPlan, loginClerkIds: Map<string, string>) {
  return new Map(
    plan.users.map((user) => [user.id, loginClerkIds.get(user.id) ?? `review_noclerk_${user.id}`]),
  );
}

export function validateAppReviewSeedEnvironment(env: EnvLike, schema: string): void {
  if (env['OASIS_APP_REVIEW_SEED_CONFIRMATION']?.trim() !== APP_REVIEW_SEED_CONFIRMATION) {
    throw new Error(
      `Set OASIS_APP_REVIEW_SEED_CONFIRMATION=${APP_REVIEW_SEED_CONFIRMATION} to reset and seed the review schema.`,
    );
  }
  // The reset truncates every table in the current schema. Never run it anywhere but `review`.
  if (schema !== REVIEW_SCHEMA) {
    throw new Error(`Refusing to seed: connection schema is "${schema}", expected "review".`);
  }
}

async function upsertReviewLogin(
  clerk: ClerkClient,
  plan: ClientDemoPlan,
  login: AppReviewLogin,
): Promise<string> {
  const user = plan.users.find((candidate) => candidate.id === login.userId);
  if (!user) throw new Error(`Missing plan user ${login.userId}.`);
  const publicMetadata = { role: user.role, tags: user.tags, reviewSandbox: true };
  const [firstName, ...rest] = user.fullName.split(' ');
  const name = { firstName: firstName ?? 'Review', lastName: rest.join(' ') || 'User' };

  const existing = (await clerk.users.getUserList({ emailAddress: [login.email], limit: 1 }))
    .data[0];
  if (!existing) {
    const created = await clerk.users.createUser({
      ...name,
      emailAddress: [login.email],
      password: user.password,
      publicMetadata,
      skipLegalChecks: true,
    });
    return created.id;
  }

  // Never convert a real account into a sandbox one.
  if (existing.publicMetadata['reviewSandbox'] !== true) {
    throw new Error(`${login.email} is an existing non-review Clerk user. Pick another domain.`);
  }
  await clerk.users.updateUser(existing.id, {
    ...name,
    password: user.password,
    publicMetadata,
    signOutOfOtherSessions: true,
    skipLegalChecks: true,
  });
  // Reviewers sign in with a password alone, so no second factor may be enrolled.
  await clerk.users.disableUserMFA(existing.id);
  return existing.id;
}

async function runAppReviewSeed(): Promise<void> {
  const ownerUrl = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  const db = withEncryption(
    new PrismaClient({ datasources: { db: { url: reviewDatabaseUrl(ownerUrl) } } }),
  ) as unknown as PrismaWithEncryption;
  try {
    validateAppReviewSeedEnvironment(process.env, await currentSchema(db));
    const { plan, logins } = buildAppReviewPlan({
      emailDomain: requireEnv(process.env, 'OASIS_APP_REVIEW_EMAIL_DOMAIN'),
      password: requireEnv(process.env, 'OASIS_APP_REVIEW_PASSWORD'),
    });

    const clerk = createClerkClient({ secretKey: requireEnv(process.env, 'CLERK_SECRET_KEY') });
    const loginClerkIds = new Map<string, string>();
    for (const login of logins) {
      loginClerkIds.set(login.userId, await upsertReviewLogin(clerk, plan, login));
    }

    // Belt and braces: a reviewer with a live row would be routed to live data.
    const leaked = await db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM public."User" WHERE "clerkId" = ANY(${[...loginClerkIds.values()]})
    `;
    if (Number(leaked[0]?.count ?? 0) > 0) {
      throw new Error('A review login has a public."User" row. Deactivate it before seeding.');
    }

    const truncated = await resetIsolatedSchema(db);
    await seedDatabase(db, plan, reviewClerkIds(plan, loginClerkIds));
    console.warn(
      [
        `Seeded review schema (${String(truncated)} tables reset).`,
        `Review logins: ${logins.map((login) => login.email).join(', ')}.`,
      ].join('\n'),
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAppReviewSeed().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
