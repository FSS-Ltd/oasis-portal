import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { profileRouter } from '../routers/profile.js';
import { router } from '../trpc.js';

const parentUser: SessionUser = {
  id: 'u_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

interface FakeDb {
  $enc: {
    decrypt: ReturnType<typeof vi.fn>;
    encrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function makeFakeDb(): FakeDb {
  return {
    $enc: {
      decrypt: vi.fn((value: string | null | undefined) =>
        value ? value.replace(/^enc:/, '') : null,
      ),
      encrypt: vi.fn((value: string | null | undefined) =>
        value === null || value === undefined ? null : `enc:${value}`,
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: parentUser.id,
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:jane@example.com',
        phoneEnc: 'enc:07700 900123',
        addressEnc: null,
        active: true,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T10:00:00.000Z'),
      }),
      update: vi.fn().mockResolvedValue({ id: parentUser.id }),
    },
  };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ profile: profileRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
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
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'DecryptPii',
        entity: 'User',
        entityId: parentUser.id,
        meta: { source: 'profile.me', fields: ['fullName', 'email', 'phone', 'address'] },
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
});
