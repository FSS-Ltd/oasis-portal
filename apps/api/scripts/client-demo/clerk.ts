import { createClerkClient, type ClerkClient, type User as ClerkUser } from '@clerk/backend';
import type { ClientDemoPlan, ClientDemoUserSpec } from './plan.js';
import { requireEnv, type EnvLike } from './env.js';

const CLIENT_DEMO_CLERK_CONFIRMATION = 'isolated-client-demo-clerk';

export async function upsertDemoClerkUsers(
  env: EnvLike,
  plan: ClientDemoPlan,
): Promise<{ clerkIdsByUserId: Map<string, string>; createdCount: number }> {
  requireIsolatedClerkConfirmation(env);

  const clerk = createClerkClient({ secretKey: requireEnv(env, 'CLERK_SECRET_KEY') });
  const clerkIdsByUserId = new Map<string, string>();
  let createdCount = 0;

  for (const user of plan.users) {
    const result = await upsertClerkUser(clerk, user);
    if (result.created) createdCount += 1;
    clerkIdsByUserId.set(user.id, result.clerkUserId);
  }

  return { clerkIdsByUserId, createdCount };
}

export async function verifyDemoClerkUsers(
  env: EnvLike,
  plan: ClientDemoPlan,
): Promise<{ checkedUsers: number }> {
  requireIsolatedClerkConfirmation(env);

  const clerk = createClerkClient({ secretKey: requireEnv(env, 'CLERK_SECRET_KEY') });
  const failures: string[] = [];

  for (const user of plan.users) {
    const existingUsers = await clerk.users.getUserList({ emailAddress: [user.email], limit: 10 });
    const existingUser = findClerkUserByEmail(existingUsers.data, user.email);
    if (!existingUser) {
      failures.push(`Missing Clerk user ${user.email}.`);
      continue;
    }

    failures.push(...validateClerkUserMetadata(existingUser, user));
  }

  if (failures.length > 0) {
    throw new Error(`Client demo Clerk verification failed:\n${failures.join('\n')}`);
  }

  return { checkedUsers: plan.users.length };
}

function requireIsolatedClerkConfirmation(env: EnvLike): void {
  if (env['OASIS_CLIENT_DEMO_CLERK_CONFIRMATION']?.trim() !== CLIENT_DEMO_CLERK_CONFIRMATION) {
    throw new Error(
      `Set OASIS_CLIENT_DEMO_CLERK_CONFIRMATION=${CLIENT_DEMO_CLERK_CONFIRMATION} only when CLERK_SECRET_KEY belongs to a separate demo Clerk application.`,
    );
  }
}

function splitName(
  fullName: string,
): Pick<Parameters<ClerkClient['users']['createUser']>[0], 'firstName' | 'lastName'> {
  const [firstName, ...lastNameParts] = fullName.trim().split(/\s+/u);
  return {
    ...(firstName ? { firstName } : {}),
    ...(lastNameParts.length > 0 ? { lastName: lastNameParts.join(' ') } : {}),
  };
}

function findClerkUserByEmail(users: ClerkUser[], email: string): ClerkUser | undefined {
  const normalisedEmail = email.trim().toLowerCase();
  return users.find((user) =>
    user.emailAddresses.some(
      (candidate) => candidate.emailAddress.trim().toLowerCase() === normalisedEmail,
    ),
  );
}

function validateClerkUserMetadata(clerkUser: ClerkUser, user: ClientDemoUserSpec): string[] {
  const failures: string[] = [];
  const metadata = clerkUser.publicMetadata;

  if (metadata['role'] !== user.role) {
    failures.push(
      `Clerk user ${user.email} has role ${String(metadata['role'])}, expected ${user.role}.`,
    );
  }

  const metadataTags = metadata['tags'];
  if (!Array.isArray(metadataTags) || !metadataTags.every((tag) => typeof tag === 'string')) {
    failures.push(`Clerk user ${user.email} is missing demo tags metadata.`);
    return failures;
  }

  if (!sameStringSet(metadataTags, user.tags)) {
    failures.push(
      `Clerk user ${user.email} has tags ${metadataTags.join(',')}, expected ${user.tags.join(',')}.`,
    );
  }

  return failures;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightValues = new Set(right);
  return left.every((value) => rightValues.has(value));
}

async function upsertClerkUser(
  clerk: ClerkClient,
  user: ClientDemoUserSpec,
): Promise<{ clerkUserId: string; created: boolean }> {
  const existingUsers = await clerk.users.getUserList({ emailAddress: [user.email], limit: 10 });
  const existingUser = findClerkUserByEmail(existingUsers.data, user.email);
  const publicMetadata = { role: user.role, tags: user.tags };

  if (existingUser) {
    await clerk.users.updateUser(existingUser.id, {
      ...splitName(user.fullName),
      password: user.password,
      publicMetadata,
      signOutOfOtherSessions: true,
      skipLegalChecks: true,
    });
    return { clerkUserId: existingUser.id, created: false };
  }

  const createdUser = await clerk.users.createUser({
    ...splitName(user.fullName),
    emailAddress: [user.email],
    password: user.password,
    publicMetadata,
    skipLegalChecks: true,
  });

  return { clerkUserId: createdUser.id, created: true };
}
