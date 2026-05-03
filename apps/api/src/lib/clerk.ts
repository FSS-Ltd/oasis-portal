/**
 * Clerk Backend SDK adapter — slim, injectable surface for the admin router.
 *
 * Mirrors the `ClerkUserStore` pattern in `routers/clerkWebhook.ts`: a narrow
 * interface so router tests can pass a fake without needing CLERK_SECRET_KEY.
 */
import { createClerkClient } from '@clerk/backend';
import type { PermissionTag, Role } from '@oasis/domain';

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
}

export interface ClerkUserDeletionClient {
  deleteUser(userId: string): Promise<void>;
}

export interface ClerkAdminClient extends ClerkInvitationClient, ClerkUserDeletionClient {}

export function createDefaultClerkAdminClient(): ClerkAdminClient {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to create the default Clerk admin client');
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
      const result: ClerkInvitationResult = {
        id: invitation.id,
        emailAddress: invitation.emailAddress,
        status: invitation.status,
      };
      if (invitation.url !== undefined) result.url = invitation.url;
      return result;
    },
    async deleteUser(userId) {
      await client.users.deleteUser(userId);
    },
  };
}

export function createDefaultClerkInvitationClient(): ClerkInvitationClient {
  return createDefaultClerkAdminClient();
}

export function createDefaultClerkUserDeletionClient(): ClerkUserDeletionClient {
  return createDefaultClerkAdminClient();
}
