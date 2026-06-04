import { describe, expect, it, vi } from 'vitest';
import type { WebhookEvent } from '@clerk/backend/webhooks';
import { Webhook } from 'standardwebhooks';
import type { PermissionTag, Role } from '@oasis/domain';
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
    public_metadata: null,
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

interface PendingInvitationRow {
  role: Role;
  tags: PermissionTag[];
  guardianLinkStudentIds: string[];
  studentSelfRegistrationId: string | null;
  studentParentLinkRequestId: string | null;
}

type FakeInvitationFindMany = (args: {
  select: {
    role: true;
    tags: true;
    guardianLinkStudentIds: true;
    studentSelfRegistrationId: true;
    studentParentLinkRequestId: true;
  };
  where: {
    emailBidx: string;
    status: 'Pending';
  };
}) => Promise<PendingInvitationRow[]>;

type FakeInvitationUpdateMany = (args: {
  data: {
    acceptedAt: Date;
    acceptedUserId: string;
    status: 'Accepted';
  };
  where: {
    emailBidx: string;
    status: 'Pending';
  };
}) => Promise<{ count: number }>;

type FakeParentLinkRequestUpdateMany = (args: {
  data: {
    confirmedAt: Date;
    status: 'Confirmed';
  };
  where: {
    id: { in: string[] };
    status: 'Invited';
  };
}) => Promise<{ count: number }>;

describe('mapClerkUserToUpsertInput', () => {
  it('maps Clerk user payloads to the local user sync contract with default role/tags', () => {
    expect(mapClerkUserToUpsertInput(userCreatedEvent.data)).toEqual({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
      role: 'Parent',
      tags: [],
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

  it('honors pre-stamped role/tags from public_metadata', () => {
    const event = {
      ...userCreatedEvent,
      data: {
        ...userCreatedEvent.data,
        public_metadata: { role: 'Supervisor', tags: ['shopkeeper'] },
      },
    } as unknown as WebhookEvent;

    expect(mapClerkUserToUpsertInput(event.data)).toMatchObject({
      role: 'Supervisor',
      tags: ['shopkeeper'],
    });
  });

  it('falls back to defaults when public_metadata is malformed (does not throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const event = {
        ...userCreatedEvent,
        data: {
          ...userCreatedEvent.data,
          public_metadata: { role: 'Janitor' },
        },
      } as unknown as WebhookEvent;

      expect(mapClerkUserToUpsertInput(event.data)).toMatchObject({
        role: 'Parent',
        tags: [],
      });
    } finally {
      warn.mockRestore();
    }
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
      role: 'Parent',
      tags: [],
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
  interface ExistingUser {
    id: string;
  }

  interface UserFindUniqueArgs {
    where: {
      clerkId?: string;
      emailBidx?: string;
    };
  }

  function makeDb(
    existingByClerkId: ExistingUser | null,
    existingByEmail: ExistingUser | null = null,
  ) {
    const findUnique = vi.fn((args: UserFindUniqueArgs): Promise<ExistingUser | null> => {
      if (args.where.clerkId !== undefined) return Promise.resolve(existingByClerkId);
      if (args.where.emailBidx !== undefined) return Promise.resolve(existingByEmail);
      return Promise.resolve(null);
    });
    const create = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue(undefined);
    const findMany = vi.fn<FakeInvitationFindMany>().mockResolvedValue([]);
    const updateMany = vi.fn<FakeInvitationUpdateMany>().mockResolvedValue({ count: 1 });
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const findStudentSelfRegistrations = vi.fn().mockResolvedValue([]);
    const updateStudents = vi.fn().mockResolvedValue({ count: 0 });
    const updateParentLinkRequests = vi
      .fn<FakeParentLinkRequestUpdateMany>()
      .mockResolvedValue({ count: 0 });
    const db = {
      $enc: {
        encrypt: fakeEncrypt,
        blindIndex(value: string): string {
          return `bidx:${value.trim().toLowerCase()}`;
        },
      },
      user: { findUnique, create, update },
      userInvitation: { findMany, updateMany },
      guardian: { createMany },
      studentSelfRegistration: { findMany: findStudentSelfRegistrations },
      student: { updateMany: updateStudents },
      studentParentLinkRequest: { updateMany: updateParentLinkRequests },
    };
    return {
      db: db as unknown as PrismaClerkUserStoreDb,
      findUnique,
      create,
      update,
      findMany,
      updateMany,
      createMany,
      findStudentSelfRegistrations,
      updateStudents,
      updateParentLinkRequests,
    };
  }

  it('creates a new user with role/tags from input on first sync', async () => {
    const { db, findUnique, create, update, updateMany } = makeDb(null);
    create.mockResolvedValue({ id: 'cuid_new' });
    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
      role: 'Supervisor',
      tags: ['shopkeeper'],
    });

    expect(findUnique).toHaveBeenCalledWith({ where: { clerkId: 'user_123' } });
    expect(findUnique).toHaveBeenCalledWith({ where: { emailBidx: 'bidx:jean@example.com' } });
    expect(create).toHaveBeenCalledWith({
      data: {
        clerkId: 'user_123',
        role: 'Supervisor',
        tags: ['shopkeeper'],
        fullNameEnc: 'enc:Jean Ntagengwa',
        emailEnc: 'enc:Jean@Example.com',
        emailBidx: 'bidx:jean@example.com',
        phoneEnc: 'enc:+447700900123',
        active: true,
      },
      select: { id: true },
    });
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledOnce();
    const updateManyArgs = updateMany.mock.calls[0]?.[0];
    expect(updateManyArgs?.where).toEqual({
      emailBidx: 'bidx:jean@example.com',
      status: 'Pending',
    });
    expect(updateManyArgs?.data.status).toBe('Accepted');
    expect(updateManyArgs?.data.acceptedUserId).toBe('cuid_new');
    expect(updateManyArgs?.data.acceptedAt).toBeInstanceOf(Date);
  });

  it('uses a pending invitation role when Clerk omits invitation metadata on first sync', async () => {
    const { db, create, findMany } = makeDb(null);
    create.mockResolvedValue({ id: 'cuid_new' });
    findMany.mockResolvedValue([
      {
        role: 'Pastor',
        tags: [],
        guardianLinkStudentIds: [],
        studentSelfRegistrationId: null,
        studentParentLinkRequestId: null,
      },
    ]);
    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
      role: 'Parent',
      tags: [],
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { emailBidx: 'bidx:jean@example.com', status: 'Pending' },
      select: {
        role: true,
        tags: true,
        guardianLinkStudentIds: true,
        studentSelfRegistrationId: true,
        studentParentLinkRequestId: true,
      },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        clerkId: 'user_123',
        role: 'Pastor',
        tags: [],
        fullNameEnc: 'enc:Jean Ntagengwa',
        emailEnc: 'enc:Jean@Example.com',
        emailBidx: 'bidx:jean@example.com',
        phoneEnc: 'enc:+447700900123',
        active: true,
      },
      select: { id: true },
    });
  });

  it('creates guardian links when accepting a spouse invitation', async () => {
    const { db, create, findMany, createMany } = makeDb(null);
    create.mockResolvedValue({ id: 'cuid_new' });
    findMany.mockResolvedValue([
      {
        role: 'Parent',
        tags: [],
        guardianLinkStudentIds: ['s_child_1', 's_child_2', 's_child_1'],
        studentSelfRegistrationId: null,
        studentParentLinkRequestId: null,
      },
    ]);
    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
      role: 'Parent',
      tags: [],
    });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'cuid_new', studentId: 's_child_1' },
        { userId: 'cuid_new', studentId: 's_child_2' },
      ],
      skipDuplicates: true,
    });
  });

  it('links accepted student invitations to the activated student profile', async () => {
    const { db, create, findMany, findStudentSelfRegistrations, updateStudents } = makeDb(null);
    create.mockResolvedValue({ id: 'cuid_new' });
    findMany.mockResolvedValue([
      {
        role: 'Student',
        tags: [],
        guardianLinkStudentIds: [],
        studentSelfRegistrationId: 'self_reg_1',
        studentParentLinkRequestId: null,
      },
    ]);
    findStudentSelfRegistrations.mockResolvedValue([{ studentId: 'student_1' }]);
    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Student Learner',
      email: 'student@example.com',
      phone: null,
      role: 'Student',
      tags: [],
    });

    expect(findStudentSelfRegistrations).toHaveBeenCalledWith({
      where: {
        id: { in: ['self_reg_1'] },
        status: 'Activated',
        studentId: { not: null },
      },
      select: { studentId: true },
    });
    expect(updateStudents).toHaveBeenCalledWith({
      where: { id: { in: ['student_1'] }, userId: null },
      data: { userId: 'cuid_new' },
    });
  });

  it('confirms invited student parent link requests after accepted parent invitations', async () => {
    const { db, create, findMany, updateParentLinkRequests } = makeDb(null);
    create.mockResolvedValue({ id: 'cuid_new' });
    findMany.mockResolvedValue([
      {
        role: 'Parent',
        tags: [],
        guardianLinkStudentIds: ['student_1'],
        studentSelfRegistrationId: null,
        studentParentLinkRequestId: 'parent_link_1',
      },
    ]);
    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Parent One',
      email: 'parent@example.com',
      phone: null,
      role: 'Parent',
      tags: [],
    });

    const updateArgs = updateParentLinkRequests.mock.calls[0]?.[0];
    expect(updateArgs?.where).toEqual({ id: { in: ['parent_link_1'] }, status: 'Invited' });
    expect(updateArgs?.data).toMatchObject({ status: 'Confirmed' });
    expect(updateArgs?.data.confirmedAt).toBeInstanceOf(Date);
  });

  it('links an existing email-matched local user without overwriting role or tags', async () => {
    const { db, findUnique, create, update, updateMany } = makeDb(null, {
      id: 'cuid_email_match',
    });
    update.mockResolvedValue({ id: 'cuid_email_match' });
    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
      role: 'Parent',
      tags: [],
    });

    expect(findUnique).toHaveBeenCalledWith({ where: { clerkId: 'user_123' } });
    expect(findUnique).toHaveBeenCalledWith({ where: { emailBidx: 'bidx:jean@example.com' } });
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'cuid_email_match' },
      data: {
        clerkId: 'user_123',
        fullNameEnc: 'enc:Jean Ntagengwa',
        emailEnc: 'enc:Jean@Example.com',
        emailBidx: 'bidx:jean@example.com',
        phoneEnc: 'enc:+447700900123',
        active: true,
      },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledOnce();
    const updateManyArgs = updateMany.mock.calls[0]?.[0];
    expect(updateManyArgs?.where).toEqual({
      emailBidx: 'bidx:jean@example.com',
      status: 'Pending',
    });
    expect(updateManyArgs?.data.acceptedUserId).toBe('cuid_email_match');
  });

  it('updates PII only on existing-user re-sync (does not stomp role/tags)', async () => {
    const { db, findUnique, create, update, updateMany } = makeDb({ id: 'cuid_existing' });
    update.mockResolvedValue({ id: 'cuid_existing' });
    const store = createPrismaClerkUserStore(db);

    await store.upsertUser({
      clerkUserId: 'user_123',
      fullName: 'Jean Ntagengwa',
      email: 'Jean@Example.com',
      phone: '+447700900123',
      role: 'Supervisor',
      tags: ['shopkeeper'],
    });

    expect(findUnique).toHaveBeenCalledWith({ where: { clerkId: 'user_123' } });
    expect(findUnique).not.toHaveBeenCalledWith({ where: { emailBidx: 'bidx:jean@example.com' } });
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { clerkId: 'user_123' },
      data: {
        fullNameEnc: 'enc:Jean Ntagengwa',
        emailEnc: 'enc:Jean@Example.com',
        emailBidx: 'bidx:jean@example.com',
        phoneEnc: 'enc:+447700900123',
        active: true,
      },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledOnce();
    const updateManyArgs = updateMany.mock.calls[0]?.[0];
    expect(updateManyArgs?.where).toEqual({
      emailBidx: 'bidx:jean@example.com',
      status: 'Pending',
    });
    expect(updateManyArgs?.data.status).toBe('Accepted');
    expect(updateManyArgs?.data.acceptedUserId).toBe('cuid_existing');
    expect(updateManyArgs?.data.acceptedAt).toBeInstanceOf(Date);
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
