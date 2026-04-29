import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { createAdminRouter } from '../routers/admin.js';
import { router } from '../trpc.js';
import type { ClerkInvitationClient, ClerkInvitationResult } from '../lib/clerk.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

interface FakeDb {
  auditLog: { create: ReturnType<typeof vi.fn> };
  $enc: {
    blindIndex: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  yearGroupBand: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  subject: { findMany: ReturnType<typeof vi.fn> };
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  student: { findUnique: ReturnType<typeof vi.fn> };
  guardian: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
}

function makeFakeDb(): FakeDb {
  const yearGroupBands = [
    {
      id: 'band_lower',
      name: 'Lower Primary',
      standardYears: ['Reception', 'Year 1'],
      active: true,
      sortOrder: 10,
      colour: '#5B90C5',
      createdAt: new Date('2026-04-29T09:00:00.000Z'),
      updatedAt: new Date('2026-04-29T09:00:00.000Z'),
    },
  ];

  return {
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    $enc: {
      blindIndex: vi.fn((value: string) => `bidx:${value.toLowerCase()}`),
      decrypt: vi.fn((value: string | null | undefined) =>
        value ? value.replace(/^enc:/, '') : null,
      ),
    },
    yearGroupBand: {
      findMany: vi.fn(() => Promise.resolve([...yearGroupBands])),
      findFirst: vi.fn(
        ({ where }: { where?: { name?: { equals?: string }; NOT?: { id?: string } } }) => {
          const name = where?.name?.equals;
          const exceptId = where?.NOT?.id;
          return Promise.resolve(
            yearGroupBands.find(
              (band) =>
                (name === undefined || band.name.toLowerCase() === name.toLowerCase()) &&
                (exceptId === undefined || band.id !== exceptId),
            ) ?? null,
          );
        },
      ),
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            name: string;
            standardYears: string[];
            colour: string;
            sortOrder: number;
          };
        }) => {
          const band = {
            id: `band_${String(yearGroupBands.length + 1)}`,
            active: true,
            createdAt: new Date('2026-04-29T10:00:00.000Z'),
            updatedAt: new Date('2026-04-29T10:00:00.000Z'),
            ...data,
          };
          yearGroupBands.push(band);
          return Promise.resolve(band);
        },
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const band = yearGroupBands.find((candidate) => candidate.id === where.id);
        if (!band) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Record not found', {
              code: 'P2025',
              clientVersion: 'test',
            }),
          );
        }
        Object.assign(band, data, { updatedAt: new Date('2026-04-29T11:00:00.000Z') });
        return Promise.resolve(band);
      }),
    },
    subject: { findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    student: { findUnique: vi.fn() },
    guardian: { create: vi.fn(), findUnique: vi.fn() },
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

function makeFakeClerk(
  result: ClerkInvitationResult = {
    id: 'inv_xyz',
    emailAddress: 'jane@example.com',
    status: 'pending',
    url: 'https://clerk.example/invite/abc',
  },
) {
  const createInvitation = vi.fn().mockResolvedValue(result);
  const client: ClerkInvitationClient = { createInvitation };
  return { client, createInvitation };
}

function makeCaller(
  user: SessionUser | null,
  deps: { clerk?: ReturnType<typeof makeFakeClerk>; db?: FakeDb } = {},
) {
  const db = deps.db ?? makeFakeDb();
  const clerk = deps.clerk ?? makeFakeClerk();
  const appRouter = router({ admin: createAdminRouter({ clerk: clerk.client }) });
  const ctx = makeCtx(user, db);
  return { caller: appRouter.createCaller(ctx), db, createInvitation: clerk.createInvitation };
}

describe('admin year-group bands', () => {
  it('lists bands for full-admin screens and rejects Supervisors', async () => {
    const { caller, db } = makeCaller(headUser);

    await expect(caller.admin.listYearGroupBands()).resolves.toEqual([
      expect.objectContaining({
        id: 'band_lower',
        name: 'Lower Primary',
        standardYears: ['Reception', 'Year 1'],
        active: true,
        sortOrder: 10,
        colour: '#5B90C5',
      }),
    ]);
    expect(db.yearGroupBand.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        standardYears: true,
        active: true,
        sortOrder: true,
        colour: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const blocked = makeCaller(supervisorUser);
    await expect(blocked.caller.admin.listYearGroupBands()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(blocked.db.yearGroupBand.findMany).not.toHaveBeenCalled();
  });

  it('creates, updates, and deactivates bands with audit rows', async () => {
    const { caller, db } = makeCaller(headUser);

    await expect(
      caller.admin.createYearGroupBand({
        name: ' Secondary Prep ',
        standardYears: ['Year 7', 'Year 8'],
        colour: '#8a5a9e',
        sortOrder: 30,
      }),
    ).resolves.toMatchObject({
      id: 'band_2',
      name: 'Secondary Prep',
      standardYears: ['Year 7', 'Year 8'],
      colour: '#8A5A9E',
      active: true,
    });

    expect(db.yearGroupBand.findFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: 'Secondary Prep', mode: 'insensitive' },
      },
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'YearGroupBand',
        entityId: 'band_2',
        meta: {
          name: 'Secondary Prep',
          standardYears: ['Year 7', 'Year 8'],
          sortOrder: 30,
          colour: '#8A5A9E',
        },
      },
    });

    await expect(
      caller.admin.updateYearGroupBand({
        id: 'band_2',
        name: 'Secondary',
        standardYears: ['Year 7', 'Year 8', 'Year 9'],
        colour: '#8A5A9E',
        sortOrder: 35,
      }),
    ).resolves.toMatchObject({
      id: 'band_2',
      name: 'Secondary',
      standardYears: ['Year 7', 'Year 8', 'Year 9'],
      sortOrder: 35,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'YearGroupBand',
        entityId: 'band_2',
        meta: {
          fields: ['colour', 'name', 'sortOrder', 'standardYears'],
          name: 'Secondary',
          standardYears: ['Year 7', 'Year 8', 'Year 9'],
          sortOrder: 35,
          colour: '#8A5A9E',
        },
      },
    });

    await expect(caller.admin.deactivateYearGroupBand({ id: 'band_2' })).resolves.toMatchObject({
      id: 'band_2',
      name: 'Secondary',
      active: false,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'YearGroupBand',
        entityId: 'band_2',
        meta: {
          name: 'Secondary',
          active: false,
          source: 'admin.deactivateYearGroupBand',
        },
      },
    });
  });

  it('rejects duplicate names, empty names, invalid years, invalid colours, and non-full-admin writes', async () => {
    const { caller, db } = makeCaller(headUser);

    await expect(
      caller.admin.createYearGroupBand({
        name: 'lower primary',
        standardYears: ['Year 2'],
        colour: '#2F8F6B',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'year-group band name already exists',
    });
    await expect(
      caller.admin.createYearGroupBand({
        name: '',
        standardYears: ['Year 2'],
        colour: '#2F8F6B',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.admin.createYearGroupBand({
        name: 'Invalid Year',
        // @ts-expect-error invalid year on purpose
        standardYears: ['Y5'],
        colour: '#2F8F6B',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.admin.createYearGroupBand({
        name: 'Invalid Colour',
        standardYears: ['Year 2'],
        colour: 'green',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const blocked = makeCaller(supervisorUser);
    await expect(
      blocked.caller.admin.createYearGroupBand({
        name: 'Upper Primary',
        standardYears: ['Year 2'],
        colour: '#2F8F6B',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(blocked.db.yearGroupBand.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('admin.listActiveSubjects', () => {
  it('returns active subjects for full-admin screens', async () => {
    const db = makeFakeDb();
    db.subject.findMany.mockResolvedValue([
      { id: 'sub_math', code: 'MATH', name: 'Mathematics' },
      { id: 'sub_eng', code: 'ENG', name: 'English' },
    ]);
    const { caller } = makeCaller(headUser, { db });

    await expect(caller.admin.listActiveSubjects()).resolves.toEqual([
      { id: 'sub_math', code: 'MATH', name: 'Mathematics' },
      { id: 'sub_eng', code: 'ENG', name: 'English' },
    ]);
    expect(db.subject.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ code: 'asc' }],
      select: { id: true, code: true, name: true },
    });
  });
});

describe('admin.searchParents', () => {
  it('decrypts parent display rows and writes one PII audit row', async () => {
    const db = makeFakeDb();
    db.user.findMany.mockResolvedValue([
      { id: 'u_parent', fullNameEnc: 'enc:Jane Parent', emailEnc: 'enc:jane@example.com' },
    ]);
    const { caller } = makeCaller(headUser, { db });

    await expect(caller.admin.searchParents({ search: 'jane@example.com' })).resolves.toEqual([
      { id: 'u_parent', fullName: 'Jane Parent', email: 'jane@example.com' },
    ]);
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: 'Parent', active: true, emailBidx: 'bidx:jane@example.com' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, fullNameEnc: true, emailEnc: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 1, source: 'admin.searchParents' },
      },
    });
  });

  it('rejects non-full-admin parent lookup as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.admin.searchParents()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('admin.listUsers and admin.updateUserTags', () => {
  it('lists active users with decrypted display fields and writes one PII audit row', async () => {
    const db = makeFakeDb();
    db.user.findMany.mockResolvedValue([
      {
        id: 'u_head',
        role: 'Head',
        tags: ['audit-viewer'],
        fullNameEnc: 'enc:Jean Head',
        emailEnc: 'enc:head@example.com',
      },
    ]);
    const { caller } = makeCaller(headUser, { db });

    await expect(caller.admin.listUsers()).resolves.toEqual([
      {
        id: 'u_head',
        role: 'Head',
        tags: ['audit-viewer'],
        fullName: 'Jean Head',
        email: 'head@example.com',
      },
    ]);
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        role: true,
        tags: true,
        fullNameEnc: true,
        emailEnc: true,
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 1, source: 'admin.listUsers' },
      },
    });
  });

  it('updates permission tags and writes an audit row', async () => {
    const db = makeFakeDb();
    db.user.update.mockResolvedValue({
      id: 'u_sup',
      tags: ['attendance-exporter', 'audit-viewer'],
    });
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserTags({
        userId: 'u_sup',
        tags: ['audit-viewer', 'attendance-exporter', 'audit-viewer'],
      }),
    ).resolves.toEqual({
      id: 'u_sup',
      tags: ['attendance-exporter', 'audit-viewer'],
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u_sup' },
      data: { tags: ['attendance-exporter', 'audit-viewer'] },
      select: { id: true, tags: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_sup',
        meta: { tags: ['attendance-exporter', 'audit-viewer'], source: 'admin.updateUserTags' },
      },
    });
  });

  it('rejects tag management for non-full-admin callers', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.admin.listUsers()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.admin.updateUserTags({ userId: 'u_sup', tags: ['audit-viewer'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe('admin.inviteUser', () => {
  it('rejects non-full-admin callers as FORBIDDEN and writes nothing', async () => {
    const { caller, db, createInvitation } = makeCaller(supervisorUser);
    await expect(
      caller.admin.inviteUser({
        email: 'jane@example.com',
        role: 'Supervisor',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(createInvitation).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects unknown role with BAD_REQUEST (zod)', async () => {
    const { caller, createInvitation } = makeCaller(headUser);
    await expect(
      caller.admin.inviteUser({
        email: 'jane@example.com',
        // @ts-expect-error invalid role on purpose
        role: 'Janitor',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('rejects unknown tag with BAD_REQUEST (zod)', async () => {
    const { caller, createInvitation } = makeCaller(headUser);
    await expect(
      caller.admin.inviteUser({
        email: 'jane@example.com',
        role: 'Supervisor',
        // @ts-expect-error invalid tag on purpose
        tags: ['superuser'],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('happy path: calls Clerk with pre-stamped metadata, writes audit row, returns slim result', async () => {
    const clerk = makeFakeClerk({
      id: 'inv_xyz',
      emailAddress: 'jane@example.com',
      status: 'pending',
      url: 'https://clerk.example/invite/abc',
    });
    const { caller, db, createInvitation } = makeCaller(headUser, { clerk });

    const result = await caller.admin.inviteUser({
      email: 'JANE@example.com',
      role: 'Supervisor',
      tags: ['shopkeeper'],
      redirectUrl: 'https://app.example.com/welcome',
    });

    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: 'jane@example.com',
      publicMetadata: { role: 'Supervisor', tags: ['shopkeeper'] },
      redirectUrl: 'https://app.example.com/welcome',
      ignoreExisting: true,
      notify: true,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Invitation',
        entityId: 'inv_xyz',
        meta: {
          role: 'Supervisor',
          tags: ['shopkeeper'],
          invitationStatus: 'pending',
        },
      },
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('jane@example.com');
    expect(result).toEqual({
      invitationId: 'inv_xyz',
      status: 'pending',
      url: 'https://clerk.example/invite/abc',
    });
  });
});

describe('admin.linkGuardian', () => {
  it('rejects non-full-admin callers as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);
    await expect(
      caller.admin.linkGuardian({ userId: 'u_parent', studentId: 's_kid' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.guardian.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('happy path: creates guardian + writes one audit row', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent' });
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    db.guardian.create.mockResolvedValue({ id: 'g_new' });
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.linkGuardian({
      userId: 'u_parent',
      studentId: 's_kid',
    });

    expect(db.guardian.create).toHaveBeenCalledWith({
      data: { userId: 'u_parent', studentId: 's_kid' },
    });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Guardian',
        entityId: 'g_new',
        meta: { parentUserId: 'u_parent', studentId: 's_kid' },
      },
    });
    expect(result).toEqual({ created: true, guardianId: 'g_new' });
  });

  it('idempotent: P2002 unique violation returns existing guardian without an audit row', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent' });
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    db.guardian.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    db.guardian.findUnique.mockResolvedValue({ id: 'g_existing' });
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.linkGuardian({
      userId: 'u_parent',
      studentId: 's_kid',
    });

    expect(db.guardian.findUnique).toHaveBeenCalledWith({
      where: { userId_studentId: { userId: 'u_parent', studentId: 's_kid' } },
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: false, guardianId: 'g_existing' });
  });

  it('rejects with BAD_REQUEST when target user is not a Parent', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_sup', role: 'Supervisor' });
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.linkGuardian({ userId: 'u_sup', studentId: 's_kid' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.guardian.create).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when user or student is missing', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue(null);
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.linkGuardian({ userId: 'u_missing', studentId: 's_kid' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent' });
    db.student.findUnique.mockResolvedValue(null);
    await expect(
      caller.admin.linkGuardian({ userId: 'u_parent', studentId: 's_missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
