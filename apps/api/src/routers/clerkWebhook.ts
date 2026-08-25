import { createClerkClient } from '@clerk/backend';
import { verifyWebhook, type WebhookEvent } from '@clerk/backend/webhooks';
import { Prisma, prisma } from '@oasis/db';
import { resolveInviteMetadata, type PermissionTag, type Role } from '@oasis/domain';
import { logOperationalEvent } from '../lib/observability.js';

type ClerkWebhookEventType = 'user.created' | 'user.updated' | 'user.deleted';

const DEFAULT_ROLE: Role = 'Parent';
const DEFAULT_TAGS: PermissionTag[] = [];

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkPhoneNumber {
  id: string;
  phone_number: string;
}

interface ClerkUserPayload {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  primary_email_address_id: string | null;
  email_addresses: readonly ClerkEmailAddress[];
  primary_phone_number_id: string | null;
  phone_numbers: readonly ClerkPhoneNumber[];
  public_metadata: Record<string, unknown> | null;
}

export interface ClerkUserProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: readonly { id: string; emailAddress: string }[];
  primaryPhoneNumberId: string | null;
  phoneNumbers: readonly { id: string; phoneNumber: string }[];
  publicMetadata: Record<string, unknown> | null;
}

export interface ClerkUserUpsertInput {
  clerkUserId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** Resolved from publicMetadata; applied only on first-time create. */
  role: Role;
  /** Resolved from publicMetadata; applied only on first-time create. */
  tags: PermissionTag[];
}

export interface ClerkUserStore {
  upsertUser(input: ClerkUserUpsertInput): Promise<void>;
  deactivateUser(clerkUserId: string): Promise<void>;
}

export interface ClerkUserLookupClient {
  getUser(clerkUserId: string): Promise<ClerkUserProfile>;
}

type PrismaUserDelegate = Pick<typeof prisma.user, 'create' | 'findUnique' | 'update'>;
type PrismaUserInvitationDelegate = Pick<typeof prisma.userInvitation, 'findMany' | 'updateMany'>;
type PrismaGuardianDelegate = Pick<typeof prisma.guardian, 'createMany'>;
type PrismaStudentSelfRegistrationDelegate = Pick<
  typeof prisma.studentSelfRegistration,
  'findMany'
>;
type PrismaStudentDelegate = Pick<typeof prisma.student, 'updateMany'>;
type PrismaStudentParentLinkRequestDelegate = Pick<
  typeof prisma.studentParentLinkRequest,
  'updateMany'
>;

const pendingInvitationSelect = Prisma.validator<Prisma.UserInvitationSelect>()({
  role: true,
  tags: true,
  guardianLinkStudentIds: true,
  studentId: true,
  studentSelfRegistrationId: true,
  studentParentLinkRequestId: true,
});

type PendingInvitation = Prisma.UserInvitationGetPayload<{
  select: typeof pendingInvitationSelect;
}>;

export interface PrismaClerkUserStoreDb {
  $enc: {
    encrypt(value: string): string;
    encrypt(value: string | null | undefined): string | null;
    blindIndex(value: string): string;
  };
  user: PrismaUserDelegate;
  userInvitation: PrismaUserInvitationDelegate;
  guardian: PrismaGuardianDelegate;
  studentSelfRegistration: PrismaStudentSelfRegistrationDelegate;
  student: PrismaStudentDelegate;
  studentParentLinkRequest: PrismaStudentParentLinkRequestDelegate;
}

export interface ClerkWebhookVerifier {
  verify(request: Request): Promise<WebhookEvent>;
}

export interface ClerkWebhookHandlerDeps {
  verifier?: ClerkWebhookVerifier;
  store?: ClerkUserStore;
}

export interface ClerkUserReconciliationDeps {
  clerk?: ClerkUserLookupClient;
  store?: ClerkUserStore;
}

function isClerkUserEventType(type: string): type is ClerkWebhookEventType {
  return type === 'user.created' || type === 'user.updated' || type === 'user.deleted';
}

function asClerkUserPayload(data: WebhookEvent['data']): ClerkUserPayload {
  const payload = data as Partial<ClerkUserPayload>;
  if (typeof payload.id !== 'string') {
    throw new Error('Clerk webhook user payload missing id');
  }
  return {
    id: payload.id,
    first_name: payload.first_name ?? null,
    last_name: payload.last_name ?? null,
    username: payload.username ?? null,
    primary_email_address_id: payload.primary_email_address_id ?? null,
    email_addresses: payload.email_addresses ?? [],
    primary_phone_number_id: payload.primary_phone_number_id ?? null,
    phone_numbers: payload.phone_numbers ?? [],
    public_metadata: payload.public_metadata ?? null,
  };
}

function clerkUserPayloadFromProfile(profile: ClerkUserProfile): ClerkUserPayload {
  return {
    id: profile.id,
    first_name: profile.firstName,
    last_name: profile.lastName,
    username: profile.username,
    primary_email_address_id: profile.primaryEmailAddressId,
    email_addresses: profile.emailAddresses.map((email) => ({
      id: email.id,
      email_address: email.emailAddress,
    })),
    primary_phone_number_id: profile.primaryPhoneNumberId,
    phone_numbers: profile.phoneNumbers.map((phone) => ({
      id: phone.id,
      phone_number: phone.phoneNumber,
    })),
    public_metadata: profile.publicMetadata,
  };
}

function primaryEmail(user: ClerkUserPayload): string | null {
  const primary = user.email_addresses.find((email) => email.id === user.primary_email_address_id);
  const fallback = user.email_addresses[0];
  return primary?.email_address ?? fallback?.email_address ?? null;
}

function primaryPhone(user: ClerkUserPayload): string | null {
  const primary = user.phone_numbers.find((phone) => phone.id === user.primary_phone_number_id);
  return primary?.phone_number ?? user.phone_numbers[0]?.phone_number ?? null;
}

function displayName(user: ClerkUserPayload, fallback: string): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || user.username || fallback;
}

function isPresentId(id: string | null): id is string {
  return Boolean(id);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniquePresentIds(values: readonly (string | null)[]): string[] {
  return uniqueStrings(values.filter(isPresentId));
}

function mapClerkUserPayloadToUpsertInput(user: ClerkUserPayload): ClerkUserUpsertInput {
  const email = primaryEmail(user);
  const metadata = resolveInviteMetadata(user.public_metadata, {
    role: DEFAULT_ROLE,
    tags: DEFAULT_TAGS,
  });
  return {
    clerkUserId: user.id,
    fullName: displayName(user, email ?? user.id),
    email,
    phone: primaryPhone(user),
    role: metadata.role,
    tags: metadata.tags,
  };
}

export function mapClerkUserToUpsertInput(data: WebhookEvent['data']): ClerkUserUpsertInput {
  return mapClerkUserPayloadToUpsertInput(asClerkUserPayload(data));
}

export function mapClerkUserProfileToUpsertInput(
  profile: ClerkUserProfile,
): ClerkUserUpsertInput {
  return mapClerkUserPayloadToUpsertInput(clerkUserPayloadFromProfile(profile));
}

export function createDefaultClerkUserLookupClient(): ClerkUserLookupClient {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required to reconcile a Clerk user');
  }

  const client = createClerkClient({ secretKey });
  return {
    async getUser(clerkUserId) {
      const user = await client.users.getUser(clerkUserId);
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
    },
  };
}

/** Repairs a missed Clerk webhook after Clerk has verified the session. */
export async function reconcileClerkUser(
  clerkUserId: string,
  deps: ClerkUserReconciliationDeps = {},
): Promise<void> {
  const clerk = deps.clerk ?? createDefaultClerkUserLookupClient();
  const store = deps.store ?? createPrismaClerkUserStore();
  const profile = await clerk.getUser(clerkUserId);
  await store.upsertUser(mapClerkUserProfileToUpsertInput(profile));
}

export function createPrismaClerkUserStore(db: PrismaClerkUserStoreDb = prisma): ClerkUserStore {
  async function loadPendingInvitations(emailBidx: string): Promise<PendingInvitation[]> {
    return db.userInvitation.findMany({
      where: { emailBidx, status: 'Pending' },
      select: pendingInvitationSelect,
    });
  }

  function resolveCreateMetadata(
    input: Pick<ClerkUserUpsertInput, 'role' | 'tags'>,
    pendingInvitations: readonly PendingInvitation[],
  ): Pick<ClerkUserUpsertInput, 'role' | 'tags'> {
    const pendingInvitation = pendingInvitations[0];
    if (!pendingInvitation) return { role: input.role, tags: [...input.tags] };

    return resolveInviteMetadata(
      { role: pendingInvitation.role, tags: pendingInvitation.tags },
      { role: input.role, tags: [...input.tags] },
    );
  }

  async function acceptPendingInvitations(
    emailBidx: string,
    userId: string,
    pendingInvitations?: readonly PendingInvitation[],
  ): Promise<void> {
    const invitations = pendingInvitations ?? (await loadPendingInvitations(emailBidx));
    const studentInvitations = invitations.filter((invitation) => invitation.role === 'Student');
    const guardianLinkStudentIds = uniqueStrings(
      invitations.flatMap((invitation) => invitation.guardianLinkStudentIds),
    );
    const studentSelfRegistrationIds = uniquePresentIds(
      studentInvitations.map((invitation) => invitation.studentSelfRegistrationId),
    );
    const directStudentInvitationIds = uniquePresentIds(
      studentInvitations.map((invitation) => invitation.studentId),
    );
    const studentParentLinkRequestIds = uniquePresentIds(
      invitations.map((invitation) => invitation.studentParentLinkRequestId),
    );

    const accepted = await db.userInvitation.updateMany({
      where: { emailBidx, status: 'Pending' },
      data: { status: 'Accepted', acceptedAt: new Date(), acceptedUserId: userId },
    });

    if (accepted.count === 0) return;

    if (guardianLinkStudentIds.length > 0) {
      await db.guardian.createMany({
        data: guardianLinkStudentIds.map((studentId) => ({ userId, studentId })),
        skipDuplicates: true,
      });
    }

    if (studentSelfRegistrationIds.length > 0) {
      const registrations = await db.studentSelfRegistration.findMany({
        where: {
          id: { in: studentSelfRegistrationIds },
          status: 'Activated',
          studentId: { not: null },
        },
        select: { studentId: true },
      });
      const studentIds = registrations
        .map((registration) => registration.studentId)
        .filter((studentId): studentId is string => Boolean(studentId));
      if (studentIds.length > 0) {
        await db.student.updateMany({
          where: { id: { in: studentIds }, userId: null },
          data: { userId },
        });
      }
    }
    if (directStudentInvitationIds.length > 0) {
      await db.student.updateMany({
        where: { id: { in: directStudentInvitationIds }, userId: null },
        data: { userId },
      });
    }

    if (studentParentLinkRequestIds.length > 0) {
      await db.studentParentLinkRequest.updateMany({
        where: { id: { in: studentParentLinkRequestIds }, status: 'Invited' },
        data: { status: 'Confirmed', confirmedAt: new Date() },
      });
    }
  }

  return {
    async upsertUser(input) {
      const fullNameEnc = db.$enc.encrypt(input.fullName);
      const emailEnc = input.email ? db.$enc.encrypt(input.email) : null;
      const phoneEnc = db.$enc.encrypt(input.phone);
      const emailBidx = input.email ? db.$enc.blindIndex(input.email) : null;

      // Find-then-branch: role/tags are admin-managed, so re-syncs from
      // user.updated must not overwrite them with stale Clerk metadata.
      const existing = await db.user.findUnique({ where: { clerkId: input.clerkUserId } });
      if (existing) {
        const updated = await db.user.update({
          where: { clerkId: input.clerkUserId },
          data: {
            fullNameEnc,
            emailEnc,
            emailBidx,
            phoneEnc,
            active: true,
          },
          select: { id: true },
        });
        if (emailBidx) await acceptPendingInvitations(emailBidx, updated.id);
        return;
      }

      const existingByEmail = emailBidx ? await db.user.findUnique({ where: { emailBidx } }) : null;
      if (existingByEmail) {
        const updated = await db.user.update({
          where: { id: existingByEmail.id },
          data: {
            clerkId: input.clerkUserId,
            fullNameEnc,
            emailEnc,
            emailBidx,
            phoneEnc,
            active: true,
          },
          select: { id: true },
        });
        if (emailBidx) await acceptPendingInvitations(emailBidx, updated.id);
        return;
      }

      const pendingInvitations = emailBidx ? await loadPendingInvitations(emailBidx) : [];
      const createMetadata = resolveCreateMetadata(input, pendingInvitations);
      const created = await db.user.create({
        data: {
          clerkId: input.clerkUserId,
          role: createMetadata.role,
          tags: createMetadata.tags,
          fullNameEnc,
          emailEnc,
          emailBidx,
          phoneEnc,
          active: true,
        },
        select: { id: true },
      });
      if (emailBidx) await acceptPendingInvitations(emailBidx, created.id, pendingInvitations);
    },
    async deactivateUser(clerkUserId) {
      await db.user.update({
        where: { clerkId: clerkUserId },
        data: { active: false },
      });
    },
  };
}

export async function processClerkWebhookEvent(
  event: WebhookEvent,
  store: ClerkUserStore,
): Promise<void> {
  if (!isClerkUserEventType(event.type)) return;

  if (event.type === 'user.deleted') {
    const id = typeof event.data.id === 'string' ? event.data.id : null;
    if (!id) throw new Error('Clerk deleted-user webhook missing id');
    await store.deactivateUser(id);
    return;
  }

  await store.upsertUser(mapClerkUserToUpsertInput(event.data));
}

const defaultVerifier: ClerkWebhookVerifier = {
  async verify(request) {
    return verifyWebhook(request);
  },
};

function jsonResponse(body: { ok: boolean; error?: string }, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export async function handleClerkWebhookRequest(
  request: Request,
  deps: ClerkWebhookHandlerDeps = {},
): Promise<Response> {
  const verifier = deps.verifier ?? defaultVerifier;
  const store = deps.store ?? createPrismaClerkUserStore();

  try {
    const event = await verifier.verify(request);
    await processClerkWebhookEvent(event, store);
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed';
    logOperationalEvent({
      event: 'auth.clerk_webhook_failed',
      level: 'error',
      message: 'Clerk webhook verification or user sync failed',
      meta: { errorType: error instanceof Error ? error.name : 'unknown' },
    });
    return jsonResponse({ ok: false, error: message }, { status: 400 });
  }
}
