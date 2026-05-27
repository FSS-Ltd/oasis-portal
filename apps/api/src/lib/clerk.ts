/**
 * Clerk Backend SDK adapter — slim, injectable surface for the admin router.
 *
 * Mirrors the `ClerkUserStore` pattern in `routers/clerkWebhook.ts`: a narrow
 * interface so router tests can pass a fake without needing CLERK_SECRET_KEY.
 */
import { createClerkClient, verifyToken as verifyClerkToken } from '@clerk/backend';
import { hasCompletedTwoFactor, type PermissionTag, type Role } from '@oasis/domain';

export interface ClerkInvitationCreateInput {
  emailAddress: string;
  publicMetadata: { role: Role; tags: PermissionTag[] };
  redirectUrl?: string;
  ignoreExisting?: boolean;
  notify?: boolean;
}

export interface ClerkInvitationResult {
  id: string;
  emailAddress: string;
  status: string;
  url?: string | undefined;
}

export interface ClerkInvitationClient {
  createInvitation(input: ClerkInvitationCreateInput): Promise<ClerkInvitationResult>;
  findInvitation(invitationId: string): Promise<ClerkInvitationResult | null>;
  revokeInvitation(invitationId: string): Promise<ClerkInvitationResult>;
}

export interface ClerkUserEmailUpdateInput {
  clerkUserId: string;
  email: string;
}

export interface ClerkUserEmailUpdateResult {
  emailAddress: string;
  emailAddressId: string;
}

export interface ClerkUserEmailClient {
  updatePrimaryEmail(input: ClerkUserEmailUpdateInput): Promise<ClerkUserEmailUpdateResult>;
}

interface ClerkTokenPayload {
  sub?: unknown;
  fva?: unknown;
}

type ClerkBearerTokenVerifier = (token: string) => Promise<ClerkTokenPayload>;

export interface ResolveClerkBearerTokenDeps {
  secretKey?: string | undefined;
  verifyToken?: ClerkBearerTokenVerifier | undefined;
}

export interface ClerkSessionAuthResult {
  clerkUserId: string;
  twoFactorSatisfied: boolean;
}

function bearerTokenFrom(headers: Headers): string | null {
  const authorization = headers.get('authorization');
  if (!authorization) return null;

  const [scheme, token] = authorization.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function resolveClerkSessionFromBearerToken(
  headers: Headers,
  deps: ResolveClerkBearerTokenDeps = {},
): Promise<ClerkSessionAuthResult | null> {
  const token = bearerTokenFrom(headers);
  if (!token) return null;

  try {
    const verifier = deps.verifyToken;
    let payload: ClerkTokenPayload;
    if (verifier) {
      payload = await verifier(token);
    } else {
      const secretKey = deps.secretKey ?? process.env.CLERK_SECRET_KEY;
      if (!secretKey) return null;
      payload = await verifyClerkToken(token, { secretKey });
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;

    return {
      clerkUserId: payload.sub,
      twoFactorSatisfied: hasCompletedTwoFactor(payload.fva),
    };
  } catch {
    return null;
  }
}

export async function resolveClerkUserIdFromBearerToken(
  headers: Headers,
  deps: ResolveClerkBearerTokenDeps = {},
): Promise<string | null> {
  const session = await resolveClerkSessionFromBearerToken(headers, deps);
  return session?.clerkUserId ?? null;
}

function mapInvitation(invitation: {
  emailAddress: string;
  id: string;
  status: string;
  url?: string | undefined;
}): ClerkInvitationResult {
  const result: ClerkInvitationResult = {
    id: invitation.id,
    emailAddress: invitation.emailAddress,
    status: invitation.status,
  };
  if (invitation.url !== undefined) result.url = invitation.url;
  return result;
}

export function createDefaultClerkInvitationClient(): ClerkInvitationClient {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to create the default Clerk invitation client');
  }
  const client = createClerkClient({ secretKey });
  return {
    async createInvitation(input) {
      const params: Parameters<typeof client.invitations.createInvitation>[0] = {
        emailAddress: input.emailAddress,
        publicMetadata: input.publicMetadata,
      };
      if (input.redirectUrl !== undefined) params.redirectUrl = input.redirectUrl;
      if (input.ignoreExisting !== undefined) params.ignoreExisting = input.ignoreExisting;
      if (input.notify !== undefined) params.notify = input.notify;

      const invitation = await client.invitations.createInvitation(params);
      return mapInvitation(invitation);
    },
    async findInvitation(invitationId) {
      const invitations = await client.invitations.getInvitationList({
        limit: 10,
        query: invitationId,
      });
      const invitation = invitations.data.find((candidate) => candidate.id === invitationId);
      return invitation ? mapInvitation(invitation) : null;
    },
    async revokeInvitation(invitationId) {
      const invitation = await client.invitations.revokeInvitation(invitationId);
      return mapInvitation(invitation);
    },
  };
}

export function createDefaultClerkUserEmailClient(): ClerkUserEmailClient {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to create the default Clerk user email client');
  }
  const client = createClerkClient({ secretKey });

  return {
    async updatePrimaryEmail(input) {
      const email = input.email.trim().toLowerCase();
      const user = await client.users.getUser(input.clerkUserId);
      const existingEmailAddress = user.emailAddresses.find(
        (candidate) => candidate.emailAddress.trim().toLowerCase() === email,
      );
      const emailAddress =
        existingEmailAddress ??
        (await client.emailAddresses.createEmailAddress({
          userId: input.clerkUserId,
          emailAddress: email,
          verified: true,
        }));

      const verifiedEmailAddress =
        emailAddress.verification?.status === 'verified'
          ? emailAddress
          : await client.emailAddresses.updateEmailAddress(emailAddress.id, { verified: true });

      if (user.primaryEmailAddressId !== verifiedEmailAddress.id) {
        await client.users.updateUser(input.clerkUserId, {
          primaryEmailAddressID: verifiedEmailAddress.id,
          notifyPrimaryEmailAddressChanged: true,
        });
      }

      return {
        emailAddress: verifiedEmailAddress.emailAddress,
        emailAddressId: verifiedEmailAddress.id,
      };
    },
  };
}
