import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { ClerkInvitationClient, ClerkUserEmailClient } from '../lib/clerk.js';
import type { EmailClient } from '../lib/email.js';
import type { AppContext, RlsTx } from '../context.js';
import { createProfileRouter } from '../routers/profile.js';
import { router } from '../trpc.js';

const parentUser: SessionUser = {
  id: 'u_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const TEST_APP_URL = 'https://portal.example.com';
const SPOUSE_INVITATION_REDIRECT_URL = `${TEST_APP_URL}/sign-up`;

interface FakeDb {
  $enc: {
    blindIndex: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
    encrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  guardian: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userInvitation: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function makeFakeDb(): FakeDb {
  const profileRow = {
    id: parentUser.id,
    clerkId: 'clerk_parent',
    role: 'Parent',
    tags: [],
    fullNameEnc: 'enc:Jane Parent',
    emailEnc: 'enc:jane@example.com',
    phoneEnc: 'enc:07700 900123',
    addressEnc: null,
    active: true,
    createdAt: new Date('2026-04-29T09:00:00.000Z'),
    updatedAt: new Date('2026-04-29T10:00:00.000Z'),
    guardianOf: [
      {
        student: {
          id: 's_child',
          fullNameEnc: 'enc:Child One',
          yearGroup: 'Year 6',
          active: true,
        },
      },
    ],
    acceptedInvitations: [],
  };

  return {
    $enc: {
      blindIndex: vi.fn((value: string) => `bidx:${value.toLowerCase()}`),
      decrypt: vi.fn((value: string | null | undefined) =>
        value ? value.replace(/^enc:/, '') : null,
      ),
      encrypt: vi.fn((value: string | null | undefined) =>
        value === null || value === undefined ? null : `enc:${value}`,
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    guardian: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([{ studentId: 's_child' }]),
    },
    user: {
      findUnique: vi.fn((args: { where: { emailBidx?: string; id?: string } }) => {
        if (args.where.emailBidx) return Promise.resolve(null);
        return Promise.resolve(profileRow);
      }),
      update: vi.fn().mockResolvedValue({ id: parentUser.id }),
    },
    userInvitation: {
      create: vi.fn().mockResolvedValue({
        id: 'invite_row_1',
        clerkInvitationId: 'inv_spouse',
        emailEnc: 'enc:spouse@example.com',
        emailStatus: 'NotSent',
        guardianLinkInviterId: parentUser.id,
        guardianLinkStudentIds: ['s_child'],
        createdAt: new Date('2026-05-11T09:00:00.000Z'),
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'invite_row_1' }),
    },
  };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    accountAccessState: user ? 'active' : 'unavailable',
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeFakeUserEmailClient() {
  const updatePrimaryEmail = vi.fn<ClerkUserEmailClient['updatePrimaryEmail']>((input) =>
    Promise.resolve({ emailAddress: input.email, emailAddressId: 'email_new' }),
  );
  const client: ClerkUserEmailClient = { updatePrimaryEmail };
  return { client, updatePrimaryEmail };
}

function makeFakeClerkInvitationClient() {
  const createInvitation = vi.fn<ClerkInvitationClient['createInvitation']>().mockResolvedValue({
    id: 'inv_spouse',
    emailAddress: 'spouse@example.com',
    status: 'pending',
    url: 'https://clerk.example/invite/spouse',
  });
  const client: ClerkInvitationClient = {
    createInvitation,
    findInvitation: vi.fn<ClerkInvitationClient['findInvitation']>().mockResolvedValue(null),
    revokeInvitation: vi.fn<ClerkInvitationClient['revokeInvitation']>().mockResolvedValue({
      id: 'inv_spouse',
      emailAddress: 'spouse@example.com',
      status: 'revoked',
    }),
  };
  return { client, createInvitation };
}

function makeFakeEmailClient() {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue({ id: 'email_spouse' });
  const client: EmailClient = { send };
  return { client, send };
}

function makeCaller(
  user: SessionUser | null,
  deps: {
    clerk?: ReturnType<typeof makeFakeClerkInvitationClient>;
    db?: FakeDb;
    email?: ReturnType<typeof makeFakeEmailClient>;
    userEmail?: ReturnType<typeof makeFakeUserEmailClient>;
  } = {},
) {
  const db = deps.db ?? makeFakeDb();
  const clerk = deps.clerk ?? makeFakeClerkInvitationClient();
  const email = deps.email ?? makeFakeEmailClient();
  const userEmail = deps.userEmail ?? makeFakeUserEmailClient();
  const appRouter = router({
    profile: createProfileRouter({
      appUrl: TEST_APP_URL,
      clerk: clerk.client,
      emailClient: email.client,
      userEmailClient: userEmail.client,
    }),
  });
  return {
    caller: appRouter.createCaller(makeCtx(user, db)),
    createInvitation: clerk.createInvitation,
    db,
    sendEmail: email.send,
    updatePrimaryEmail: userEmail.updatePrimaryEmail,
  };
}

describe('profile.me', () => {
  it('returns the current user profile with decrypted PII and writes an audit row', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(caller.profile.me()).resolves.toEqual({
      id: 'u_parent',
      role: 'Parent',
      tags: [],
      fullName: 'Jane Parent',
      email: 'jane@example.com',
      phone: '07700 900123',
      address: null,
      active: true,
      requires2fa: false,
      createdAt: new Date('2026-04-29T09:00:00.000Z'),
      updatedAt: new Date('2026-04-29T10:00:00.000Z'),
      children: [
        {
          id: 's_child',
          fullName: 'Child One',
          yearGroup: 'Year 6',
          active: true,
        },
      ],
      invitedBy: null,
    });
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: parentUser.id },
      select: {
        id: true,
        role: true,
        tags: true,
        fullNameEnc: true,
        emailEnc: true,
        phoneEnc: true,
        addressEnc: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        guardianOf: {
          orderBy: { createdAt: 'desc' },
          select: {
            student: {
              select: {
                id: true,
                fullNameEnc: true,
                yearGroup: true,
                active: true,
              },
            },
          },
        },
        acceptedInvitations: {
          where: { status: 'Accepted', guardianLinkInviterId: { not: null } },
          orderBy: { acceptedAt: 'desc' },
          take: 1,
          select: {
            guardianLinkInviter: {
              select: {
                id: true,
                fullNameEnc: true,
                emailEnc: true,
              },
            },
          },
        },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'DecryptPii',
        entity: 'User',
        entityId: parentUser.id,
        meta: {
          source: 'profile.me',
          fields: ['fullName', 'email', 'phone', 'address'],
          linkedChildCount: 1,
        },
      },
    });
  });

  it('returns the spouse invitation inviter after acceptance', async () => {
    const spouseUser: SessionUser = {
      id: 'u_spouse',
      role: 'Parent',
      tags: [],
      requires2fa: false,
    };
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValueOnce({
      id: spouseUser.id,
      clerkId: 'clerk_spouse',
      role: 'Parent',
      tags: [],
      fullNameEnc: 'enc:Alex Spouse',
      emailEnc: 'enc:alex@example.com',
      phoneEnc: null,
      addressEnc: null,
      active: true,
      createdAt: new Date('2026-05-12T09:00:00.000Z'),
      updatedAt: new Date('2026-05-12T10:00:00.000Z'),
      guardianOf: [],
      acceptedInvitations: [
        {
          guardianLinkInviter: {
            id: parentUser.id,
            fullNameEnc: 'enc:Jane Parent',
            emailEnc: 'enc:jane@example.com',
          },
        },
      ],
    });
    const { caller } = makeCaller(spouseUser, { db });

    await expect(caller.profile.me()).resolves.toMatchObject({
      id: spouseUser.id,
      invitedBy: {
        id: parentUser.id,
        fullName: 'Jane Parent',
        email: 'jane@example.com',
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: spouseUser.id,
        action: 'DecryptPii',
        entity: 'User',
        entityId: parentUser.id,
        meta: {
          source: 'profile.me.invitedBy',
          fields: ['fullName', 'email'],
        },
      },
    });
  });

  it('rejects unauthenticated callers', async () => {
    const { caller, db } = makeCaller(null);

    await expect(caller.profile.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('profile.updateMe', () => {
  it('updates allowed self-profile fields and writes an audit row', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(
      caller.profile.updateMe({
        fullName: 'Jane Parent',
        phone: ' 07700 900999 ',
        address: '',
      }),
    ).resolves.toMatchObject({
      id: parentUser.id,
      fullName: 'Jane Parent',
      phone: '07700 900123',
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: parentUser.id },
      data: {
        fullNameEnc: 'enc:Jane Parent',
        phoneEnc: 'enc:07700 900999',
        addressEnc: null,
      },
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Update',
        entity: 'User',
        entityId: parentUser.id,
        meta: {
          fields: ['addressEnc', 'fullNameEnc', 'phoneEnc'],
          source: 'profile.updateMe',
        },
      },
    });
  });

  it('updates the current user email in Clerk and the local encrypted profile', async () => {
    const db = makeFakeDb();
    db.user.findUnique
      .mockResolvedValueOnce({
        id: parentUser.id,
        clerkId: 'clerk_parent',
        emailEnc: 'enc:jane@example.com',
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: parentUser.id,
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:jane.new@example.com',
        phoneEnc: 'enc:07700 900123',
        addressEnc: null,
        active: true,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T10:00:00.000Z'),
        guardianOf: [],
        acceptedInvitations: [],
      });
    const { caller, updatePrimaryEmail } = makeCaller(parentUser, { db });

    await expect(
      caller.profile.updateMe({
        email: ' Jane.New@Example.com ',
      }),
    ).resolves.toMatchObject({
      id: parentUser.id,
      email: 'jane.new@example.com',
    });
    expect(updatePrimaryEmail).toHaveBeenCalledWith({
      clerkUserId: 'clerk_parent',
      email: 'jane.new@example.com',
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: parentUser.id },
      data: {
        emailEnc: 'enc:jane.new@example.com',
        emailBidx: 'bidx:jane.new@example.com',
      },
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'Update',
        entity: 'User',
        entityId: parentUser.id,
        meta: {
          fields: ['emailBidx', 'emailEnc'],
          source: 'profile.updateMe',
        },
      },
    });
  });

  it('rejects self email updates when another user already has the address', async () => {
    const db = makeFakeDb();
    db.user.findUnique
      .mockResolvedValueOnce({
        id: parentUser.id,
        clerkId: 'clerk_parent',
        emailEnc: 'enc:jane@example.com',
      })
      .mockResolvedValueOnce({
        id: 'u_other',
        clerkId: 'clerk_other',
        emailEnc: 'enc:other@example.com',
      });
    const { caller, updatePrimaryEmail } = makeCaller(parentUser, { db });

    await expect(caller.profile.updateMe({ email: 'other@example.com' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'email address is already in use',
    });
    expect(updatePrimaryEmail).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe('profile spouse invites', () => {
  it('returns spouse invite availability for linked-child guardians', async () => {
    const { caller } = makeCaller(parentUser);

    await expect(caller.profile.spouseInviteStatus()).resolves.toEqual({
      canInvite: true,
      linkedChildCount: 1,
      pendingInvitation: null,
      spouseLinked: false,
    });
  });

  it('creates a parent spouse invitation linked to the current family children', async () => {
    const { caller, createInvitation, db, sendEmail } = makeCaller(parentUser);

    await expect(caller.profile.inviteSpouse({ email: ' Spouse@Example.com ' })).resolves.toEqual({
      invitationId: 'inv_spouse',
      emailStatus: 'Sent',
      status: 'pending',
    });

    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: 'spouse@example.com',
      publicMetadata: { role: 'Parent', tags: [] },
      redirectUrl: SPOUSE_INVITATION_REDIRECT_URL,
      ignoreExisting: true,
      notify: false,
    });
    expect(db.userInvitation.create).toHaveBeenCalledWith({
      data: {
        clerkInvitationId: 'inv_spouse',
        role: 'Parent',
        tags: [],
        emailEnc: 'enc:spouse@example.com',
        emailBidx: 'bidx:spouse@example.com',
        status: 'Pending',
        emailStatus: 'NotSent',
        invitedById: parentUser.id,
        guardianLinkInviterId: parentUser.id,
        guardianLinkStudentIds: ['s_child'],
      },
      select: {
        id: true,
        clerkInvitationId: true,
        emailEnc: true,
        emailStatus: true,
        guardianLinkInviterId: true,
        guardianLinkStudentIds: true,
        createdAt: true,
      },
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(db.userInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invite_row_1' },
      data: { emailStatus: 'Sent', emailMessageId: 'email_spouse' },
      select: { id: true },
    });
  });

  it('rejects spouse invites when a parent is already linked to the family', async () => {
    const db = makeFakeDb();
    db.guardian.findFirst.mockResolvedValueOnce({ id: 'guardian_spouse' });
    const { caller, createInvitation } = makeCaller(parentUser, { db });

    await expect(
      caller.profile.inviteSpouse({ email: 'spouse@example.com' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'a spouse or second parent is already linked to this family',
    });
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('rejects spouse invites when a family invite is already pending', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValueOnce({
      id: 'invite_pending',
      clerkInvitationId: 'inv_pending',
      emailEnc: 'enc:spouse@example.com',
      emailStatus: 'Sent',
      guardianLinkInviterId: parentUser.id,
      guardianLinkStudentIds: ['s_child'],
      createdAt: new Date('2026-05-11T09:00:00.000Z'),
    });
    const { caller, createInvitation } = makeCaller(parentUser, { db });

    await expect(caller.profile.inviteSpouse({ email: 'other@example.com' })).rejects.toMatchObject(
      {
        code: 'BAD_REQUEST',
        message: 'a spouse invitation is already pending for this family',
      },
    );
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('rejects spouse invites when a user already exists for the email', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValueOnce({ id: 'u_existing' });
    const { caller, createInvitation } = makeCaller(parentUser, { db });

    await expect(
      caller.profile.inviteSpouse({ email: 'existing@example.com' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'a user account already exists for this email',
    });
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
