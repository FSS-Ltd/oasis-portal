import { describe, expect, it, vi } from 'vitest';
import type { WebhookEvent } from '@clerk/backend/webhooks';
import { Webhook } from 'standardwebhooks';
import {
  createPrismaClerkUserStore,
  handleClerkWebhookRequest,
  mapClerkUserToUpsertInput,
  processClerkWebhookEvent,
  type ClerkUserStore,
  type PrismaClerkUserStoreDb,
} from '../routers/clerkWebhook.js';

const userCreatedEvent = {
  type: 'user.created',
  data: {
    id: 'user_123',
    first_name: 'Jean',
    last_name: 'Ntagengwa',
    username: null,
    primary_email_address_id: 'email_1',
    email_addresses: [{ id: 'email_1', email_address: 'Jean@Example.com' }],
    primary_phone_number_id: 'phone_1',
    phone_numbers: [{ id: 'phone_1', phone_number: '+447700900123' }],
  },
} as unknown as WebhookEvent;

function createStore(): ClerkUserStore & {
  upsertUser: ReturnType<typeof vi.fn>;
  deactivateUser: ReturnType<typeof vi.fn>;
} {
  return {
    upsertUser: vi.fn<ClerkUserStore['upsertUser']>().mockResolvedValue(undefined),
    deactivateUser: vi.fn<ClerkUserStore['deactivateUser']>().mockResolvedValue(undefined),
  };
}

function fakeEncrypt(value: string): string;
function fakeEncrypt(value: string | null | undefined): string | null;
function fakeEncrypt(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : `enc:${value}`;
}

describe('mapClerkUserToUpsertInput', () => {
  it('maps Clerk user payloads to the local user sync contract', () => {
    expect(mapClerkUserToUpsertInput(userCreatedEvent.data)).toEqual({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
    });
  });

  it('falls back to email for display name when Clerk name fields are empty', () => {
    const event = {
      ...userCreatedEvent,
      data: {
        ...userCreatedEvent.data,
        first_name: null,
        last_name: null,
        username: null,
      },
    } as unknown as WebhookEvent;

    expect(mapClerkUserToUpsertInput(event.data).fullName).toBe('Jean@Example.com');
  });
});

describe('processClerkWebhookEvent', () => {
  it('upserts created and updated users with default Parent role handled by the store', async () => {
    const store = createStore();

    await processClerkWebhookEvent(userCreatedEvent, store);

    expect(store.upsertUser).toHaveBeenCalledWith({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
    });
    expect(store.deactivateUser).not.toHaveBeenCalled();
  });

  it('deactivates deleted users instead of removing audit history', async () => {
    const store = createStore();
    const deletedEvent = {
      type: 'user.deleted',
      data: { id: 'user_123' },
    } as unknown as WebhookEvent;

    await processClerkWebhookEvent(deletedEvent, store);

    expect(store.deactivateUser).toHaveBeenCalledWith('user_123');
    expect(store.upsertUser).not.toHaveBeenCalled();
  });
});

describe('createPrismaClerkUserStore', () => {
  it('encrypts PII and assigns Parent as the default role on user upsert', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue(undefined);
    const db = {
      $enc: {
        encrypt: fakeEncrypt,
        blindIndex(value: string): string {
          return `bidx:${value.trim().toLowerCase()}`;
        },
      },
      user: { upsert, update },
    } satisfies PrismaClerkUserStoreDb;

    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { clerkId: 'user_123' },
      create: {
        clerkId: 'user_123',
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jean Ntagengwa',
        emailEnc: 'enc:Jean@Example.com',
        emailBidx: 'bidx:jean@example.com',
        phoneEnc: 'enc:+447700900123',
        active: true,
      },
      update: {
        fullNameEnc: 'enc:Jean Ntagengwa',
        emailEnc: 'enc:Jean@Example.com',
        emailBidx: 'bidx:jean@example.com',
        phoneEnc: 'enc:+447700900123',
        active: true,
      },
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('handleClerkWebhookRequest', () => {
  it('accepts a real Svix-compatible signature from Clerk verification', async () => {
    const store = createStore();
    const secret = `whsec_${Buffer.from('oasis-test-webhook-secret-32bytes').toString('base64')}`;
    const webhook = new Webhook(secret);
    const body = JSON.stringify({
      type: 'user.created',
      data: userCreatedEvent.data,
    });
    const messageId = 'msg_test_123';
    const timestamp = new Date();
    const previousSecret = process.env['CLERK_WEBHOOK_SIGNING_SECRET'];
    process.env['CLERK_WEBHOOK_SIGNING_SECRET'] = secret;

    try {
      const response = await handleClerkWebhookRequest(
        new Request('https://oasis.test/webhook', {
          method: 'POST',
          body,
          headers: {
            'svix-id': messageId,
            'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
            'svix-signature': webhook.sign(messageId, timestamp, body),
          },
        }),
        { store },
      );

      expect(response.status).toBe(200);
      expect(store.upsertUser).toHaveBeenCalledOnce();
    } finally {
      if (previousSecret) {
        process.env['CLERK_WEBHOOK_SIGNING_SECRET'] = previousSecret;
      } else {
        delete process.env['CLERK_WEBHOOK_SIGNING_SECRET'];
      }
    }
  });

  it('verifies the webhook before syncing the user', async () => {
    const store = createStore();
    const verifier = {
      verify: vi.fn().mockResolvedValue(userCreatedEvent),
    };

    const response = await handleClerkWebhookRequest(new Request('https://oasis.test/webhook'), {
      verifier,
      store,
    });

    expect(response.status).toBe(200);
    expect(verifier.verify).toHaveBeenCalledOnce();
    expect(store.upsertUser).toHaveBeenCalledOnce();
  });

  it('rejects webhook requests that fail signature verification', async () => {
    const store = createStore();
    const verifier = {
      verify: vi.fn().mockRejectedValue(new Error('bad signature')),
    };

    const response = await handleClerkWebhookRequest(new Request('https://oasis.test/webhook'), {
      verifier,
      store,
    });

    expect(response.status).toBe(400);
    expect(store.upsertUser).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: false, error: 'bad signature' });
  });
});
