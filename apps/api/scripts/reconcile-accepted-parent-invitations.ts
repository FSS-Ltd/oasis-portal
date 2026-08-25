import { createClerkClient, type User as ClerkUser } from '@clerk/backend';
import { prisma } from '@oasis/db';
import {
  createPrismaClerkUserStore,
  mapClerkUserProfileToUpsertInput,
  type ClerkUserProfile,
} from '../src/routers/clerkWebhook.js';
import { logOperationalEvent, operationalErrorMessage } from '../src/lib/observability.js';

export interface PendingParentInvitation {
  clerkInvitationId: string;
  emailBidx: string;
  role: 'Parent';
}

export interface AcceptedParentInvitationReconciliationInput {
  apply: boolean;
  findInvitation: (clerkInvitationId: string) => Promise<{
    id: string;
    status: string;
    emailAddress: string;
  } | null>;
  findLocalUserByClerkId: (clerkUserId: string) => Promise<{ active: boolean } | null>;
  findLocalUserByEmailBidx: (emailBidx: string) => Promise<{ active: boolean } | null>;
  findPendingParentInvitations: () => Promise<readonly PendingParentInvitation[]>;
  findUserByEmail: (email: string) => Promise<ClerkUserProfile | null>;
  onLookupFailure?: (error: unknown) => void;
  syncUser: (profile: ClerkUserProfile) => Promise<void>;
}

export interface AcceptedParentInvitationReconciliationSummary {
  accepted: number;
  clerkUserMissing: number;
  eligibleForReconciliation: number;
  failed: number;
  inactiveLocalUser: number;
  invitationMissing: number;
  pending: number;
  reconciled: number;
}

function emptySummary(): AcceptedParentInvitationReconciliationSummary {
  return {
    accepted: 0,
    clerkUserMissing: 0,
    eligibleForReconciliation: 0,
    failed: 0,
    inactiveLocalUser: 0,
    invitationMissing: 0,
    pending: 0,
    reconciled: 0,
  };
}

/**
 * Finds accepted Clerk invitations still pending locally and replays the same
 * local sync used by the webhook. This includes guardian links for spouse
 * invitations because those links are stored on UserInvitation.
 */
export async function reconcileAcceptedParentInvitations(
  input: AcceptedParentInvitationReconciliationInput,
): Promise<AcceptedParentInvitationReconciliationSummary> {
  const summary = emptySummary();
  const invitations = await input.findPendingParentInvitations();

  for (const pendingInvitation of invitations) {
    try {
      const clerkInvitation = await input.findInvitation(pendingInvitation.clerkInvitationId);
      if (!clerkInvitation) {
        summary.invitationMissing += 1;
        continue;
      }
      if (clerkInvitation.status !== 'accepted') {
        summary.pending += 1;
        continue;
      }

      summary.accepted += 1;
      const localUserByEmail = await input.findLocalUserByEmailBidx(pendingInvitation.emailBidx);
      if (localUserByEmail && !localUserByEmail.active) {
        summary.inactiveLocalUser += 1;
        continue;
      }

      const clerkUser = await input.findUserByEmail(clerkInvitation.emailAddress);
      if (!clerkUser) {
        summary.clerkUserMissing += 1;
        continue;
      }

      const localUserByClerkId = await input.findLocalUserByClerkId(clerkUser.id);
      if (localUserByClerkId && !localUserByClerkId.active) {
        summary.inactiveLocalUser += 1;
        continue;
      }

      summary.eligibleForReconciliation += 1;
      if (input.apply) {
        await input.syncUser(clerkUser);
        summary.reconciled += 1;
      }
    } catch (error) {
      summary.failed += 1;
      input.onLookupFailure?.(error);
    }
  }

  return summary;
}

function clerkUserProfile(user: ClerkUser): ClerkUserProfile {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    primaryEmailAddressId: user.primaryEmailAddressId,
    emailAddresses: user.emailAddresses.map((email) => ({
      id: email.id,
      emailAddress: email.emailAddress,
    })),
    primaryPhoneNumberId: user.primaryPhoneNumberId,
    phoneNumbers: user.phoneNumbers.map((phone) => ({
      id: phone.id,
      phoneNumber: phone.phoneNumber,
    })),
    publicMetadata: user.publicMetadata,
  };
}

function matchingUser(users: ClerkUser[], email: string): ClerkUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  return (
    users.find((user) =>
      user.emailAddresses.some(
        (candidate) => candidate.emailAddress.trim().toLowerCase() === normalizedEmail,
      ),
    ) ?? null
  );
}

async function main(): Promise<void> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is required');

  const apply = process.argv.includes('--apply');
  const clerk = createClerkClient({ secretKey });
  const store = createPrismaClerkUserStore();
  const summary = await reconcileAcceptedParentInvitations({
    apply,
    findInvitation: async (clerkInvitationId) => {
      const invitations = await clerk.invitations.getInvitationList({
        limit: 10,
        query: clerkInvitationId,
      });
      const invitation = invitations.data.find((candidate) => candidate.id === clerkInvitationId);
      return invitation
        ? {
            id: invitation.id,
            status: invitation.status,
            emailAddress: invitation.emailAddress,
          }
        : null;
    },
    findLocalUserByClerkId: (clerkUserId) =>
      prisma.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { active: true },
      }),
    findLocalUserByEmailBidx: (emailBidx) =>
      prisma.user.findUnique({
        where: { emailBidx },
        select: { active: true },
      }),
    findPendingParentInvitations: async () => {
      const invitations = await prisma.userInvitation.findMany({
        where: { role: 'Parent', status: 'Pending' },
        select: { clerkInvitationId: true, emailBidx: true, role: true },
      });
      return invitations.map((invitation) => ({
        clerkInvitationId: invitation.clerkInvitationId,
        emailBidx: invitation.emailBidx,
        role: 'Parent' as const,
      }));
    },
    findUserByEmail: async (email) => {
      const users = await clerk.users.getUserList({ emailAddress: [email], limit: 10 });
      const user = matchingUser(users.data, email);
      return user ? clerkUserProfile(user) : null;
    },
    onLookupFailure: (error) => {
      logOperationalEvent({
        event: 'auth.accepted_parent_invitation_reconciliation_failed',
        level: 'error',
        message: 'Accepted parent invitation reconciliation failed',
        meta: { error: operationalErrorMessage(error) },
      });
    },
    syncUser: (profile) => store.upsertUser(mapClerkUserProfileToUpsertInput(profile)),
  });

  logOperationalEvent({
    event: 'auth.accepted_parent_invitation_reconciliation_complete',
    level: 'info',
    message: apply
      ? 'Accepted parent invitation reconciliation completed'
      : 'Accepted parent invitation reconciliation dry run completed',
    meta: { ...summary },
  });
  process.stdout.write(`${JSON.stringify({ apply, ...summary })}\n`);
}

const invokedAsScript =
  process.argv[1]?.replaceAll('\\', '/').endsWith('/reconcile-accepted-parent-invitations.ts') ??
  false;

if (invokedAsScript) {
  main().catch((error: unknown) => {
    logOperationalEvent({
      event: 'auth.accepted_parent_invitation_reconciliation_failed',
      level: 'error',
      message: 'Accepted parent invitation reconciliation could not start',
      meta: { error: operationalErrorMessage(error) },
    });
    process.exitCode = 1;
  });
}
