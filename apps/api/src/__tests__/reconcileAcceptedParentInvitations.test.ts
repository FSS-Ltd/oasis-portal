import { describe, expect, it } from 'vitest';
import type { Role } from '@oasis/domain';

type ClerkUserProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: readonly { id: string; emailAddress: string }[];
  primaryPhoneNumberId: string | null;
  phoneNumbers: readonly { id: string; phoneNumber: string }[];
  publicMetadata: Record<string, unknown> | null;
};

type DesiredReconciler = (input: {
  apply: boolean;
  findInvitation: (clerkInvitationId: string) => Promise<{
    id: string;
    status: string;
    emailAddress: string;
  } | null>;
  findLocalUserByClerkId: (clerkUserId: string) => Promise<{ active: boolean } | null>;
  findLocalUserByEmailBidx: (emailBidx: string) => Promise<{ active: boolean } | null>;
  findPendingParentInvitations: () => Promise<
    readonly { clerkInvitationId: string; emailBidx: string; role: Role }[]
  >;
  findUserByEmail: (email: string) => Promise<ClerkUserProfile | null>;
  syncUser: (profile: ClerkUserProfile) => Promise<void>;
}) => Promise<{
  accepted: number;
  inactiveLocalUser: number;
  pending: number;
  reconciled: number;
}>;

const modulePromise = import('../../scripts/reconcile-accepted-parent-invitations.js').catch(
  (error: unknown) => error,
);

describe('reconcileAcceptedParentInvitations', () => {
  it('repairs an accepted spouse invitation with no local account', async () => {
    const moduleOrError = await modulePromise;
    expect(moduleOrError).not.toBeInstanceOf(Error);
    if (moduleOrError instanceof Error) return;

    const reconcileAcceptedParentInvitations = (
      moduleOrError as { reconcileAcceptedParentInvitations?: DesiredReconciler }
    ).reconcileAcceptedParentInvitations;
    expect(reconcileAcceptedParentInvitations).toBeTypeOf('function');
    if (typeof reconcileAcceptedParentInvitations !== 'function') return;

    const profile: ClerkUserProfile = {
      id: 'user_spouse_accepted',
      firstName: 'Parent',
      lastName: 'Two',
      username: null,
      primaryEmailAddressId: 'email_spouse',
      emailAddresses: [{ id: 'email_spouse', emailAddress: 'spouse@example.com' }],
      primaryPhoneNumberId: null,
      phoneNumbers: [],
      publicMetadata: { role: 'Parent', tags: [] },
    };
    const syncedProfiles: ClerkUserProfile[] = [];

    await expect(
      reconcileAcceptedParentInvitations({
        apply: true,
        findInvitation: () =>
          Promise.resolve({
            id: 'inv_spouse_accepted',
            status: 'accepted',
            emailAddress: 'spouse@example.com',
          }),
        findLocalUserByClerkId: () => Promise.resolve(null),
        findLocalUserByEmailBidx: () => Promise.resolve(null),
        findPendingParentInvitations: () =>
          Promise.resolve([
            { clerkInvitationId: 'inv_spouse_accepted', emailBidx: 'bidx_spouse', role: 'Parent' },
          ]),
        findUserByEmail: () => Promise.resolve(profile),
        syncUser: (user) => {
          syncedProfiles.push(user);
          return Promise.resolve();
        },
      }),
    ).resolves.toMatchObject({
      accepted: 1,
      inactiveLocalUser: 0,
      pending: 0,
      reconciled: 1,
    });
    expect(syncedProfiles).toEqual([profile]);
  });

  it('does not reactivate an intentionally inactive parent account', async () => {
    const moduleOrError = await modulePromise;
    expect(moduleOrError).not.toBeInstanceOf(Error);
    if (moduleOrError instanceof Error) return;

    const reconcileAcceptedParentInvitations = (
      moduleOrError as { reconcileAcceptedParentInvitations?: DesiredReconciler }
    ).reconcileAcceptedParentInvitations;
    expect(reconcileAcceptedParentInvitations).toBeTypeOf('function');
    if (typeof reconcileAcceptedParentInvitations !== 'function') return;

    await expect(
      reconcileAcceptedParentInvitations({
        apply: true,
        findInvitation: () =>
          Promise.resolve({
            id: 'inv_inactive',
            status: 'accepted',
            emailAddress: 'disabled@example.com',
          }),
        findLocalUserByClerkId: () => {
          throw new Error('must not look up a Clerk id before resolving the Clerk user');
        },
        findLocalUserByEmailBidx: () => Promise.resolve({ active: false }),
        findPendingParentInvitations: () =>
          Promise.resolve([
            { clerkInvitationId: 'inv_inactive', emailBidx: 'bidx_inactive', role: 'Parent' },
          ]),
        findUserByEmail: () => {
          throw new Error('must not look up a Clerk user for inactive local accounts');
        },
        syncUser: () => {
          throw new Error('must not sync inactive local accounts');
        },
      }),
    ).resolves.toMatchObject({
      accepted: 1,
      inactiveLocalUser: 1,
      pending: 0,
      reconciled: 0,
    });
  });
});
