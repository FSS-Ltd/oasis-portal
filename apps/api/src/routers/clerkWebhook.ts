import { verifyWebhook, type WebhookEvent } from '@clerk/backend/webhooks';
import { prisma } from '@oasis/db';

type ClerkWebhookEventType = 'user.created' | 'user.updated' | 'user.deleted';

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
}

export interface ClerkUserUpsertInput {
  clerkUserId: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export interface ClerkUserStore {
  upsertUser(input: ClerkUserUpsertInput): Promise<void>;
  deactivateUser(clerkUserId: string): Promise<void>;
}

interface PrismaUserUpsertArgs {
  where: { clerkId: string };
  create: {
    clerkId: string;
    role: 'Parent';
    tags: string[];
    fullNameEnc: string;
    emailEnc: string;
    emailBidx: string;
    phoneEnc: string | null;
    active: true;
  };
  update: {
    fullNameEnc: string;
    emailEnc: string;
    emailBidx: string;
    phoneEnc: string | null;
    active: true;
  };
}

interface PrismaUserUpdateArgs {
  where: { clerkId: string };
  data: { active: false };
}

export interface PrismaClerkUserStoreDb {
  $enc: {
    encrypt(value: string): string;
    encrypt(value: string | null | undefined): string | null;
    blindIndex(value: string): string;
  };
  user: {
    upsert(args: PrismaUserUpsertArgs): Promise<unknown>;
    update(args: PrismaUserUpdateArgs): Promise<unknown>;
  };
}

export interface ClerkWebhookVerifier {
  verify(request: Request): Promise<WebhookEvent>;
}

export interface ClerkWebhookHandlerDeps {
  verifier?: ClerkWebhookVerifier;
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
  };
}

function primaryEmail(user: ClerkUserPayload): string {
  const primary = user.email_addresses.find((email) => email.id === user.primary_email_address_id);
  const fallback = user.email_addresses[0];
  const email = primary?.email_address ?? fallback?.email_address;
  if (!email) {
    throw new Error(`Clerk user ${user.id} has no email address`);
  }
  return email;
}

function primaryPhone(user: ClerkUserPayload): string | null {
  const primary = user.phone_numbers.find((phone) => phone.id === user.primary_phone_number_id);
  return primary?.phone_number ?? user.phone_numbers[0]?.phone_number ?? null;
}

function displayName(user: ClerkUserPayload, email: string): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || user.username || email;
}

export function mapClerkUserToUpsertInput(data: WebhookEvent['data']): ClerkUserUpsertInput {
  const user = asClerkUserPayload(data);
  const email = primaryEmail(user);
  return {
    clerkUserId: user.id,
    fullName: displayName(user, email),
    email,
    phone: primaryPhone(user),
  };
}

export function createPrismaClerkUserStore(db: PrismaClerkUserStoreDb = prisma): ClerkUserStore {
  return {
    async upsertUser(input) {
      const fullNameEnc = db.$enc.encrypt(input.fullName);
      const emailEnc = db.$enc.encrypt(input.email);
      const phoneEnc = db.$enc.encrypt(input.phone);
      const emailBidx = db.$enc.blindIndex(input.email);

      await db.user.upsert({
        where: { clerkId: input.clerkUserId },
        create: {
          clerkId: input.clerkUserId,
          role: 'Parent',
          tags: [],
          fullNameEnc,
          emailEnc,
          emailBidx,
          phoneEnc,
          active: true,
        },
        update: {
          fullNameEnc,
          emailEnc,
          emailBidx,
          phoneEnc,
          active: true,
        },
      });
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
    return jsonResponse({ ok: false, error: message }, { status: 400 });
  }
}
