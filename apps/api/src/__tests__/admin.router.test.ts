import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { createAdminRouter } from '../routers/admin.js';
import { router } from '../trpc.js';
import type {
  ClerkInvitationClient,
  ClerkInvitationResult,
  ClerkUserEmailClient,
} from '../lib/clerk.js';
import type { EmailClient } from '../lib/email.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const principalUser: SessionUser = {
  id: 'u_principal',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};
const technicalSupportUser: SessionUser = {
  id: 'u_support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'u_parent_session',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const TEST_APP_URL = 'https://portal.example.com';
const INVITATION_REDIRECT_URL = `${TEST_APP_URL}/post-sign-in`;

function makeInvitationRow(
  overrides: Partial<{
    clerkInvitationId: string;
    createdAt: Date;
    emailEnc: string;
    emailStatus: 'Failed' | 'NotSent' | 'Sent';
    id: string;
    role: SessionUser['role'];
    status: 'Accepted' | 'Pending';
    tags: string[];
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'invite_row_1',
    clerkInvitationId: 'inv_xyz',
    role: 'Parent',
    tags: [],
    emailEnc: 'enc:jane@example.com',
    status: 'Pending',
    emailStatus: 'NotSent',
    createdAt: new Date('2026-05-02T09:00:00.000Z'),
    updatedAt: new Date('2026-05-02T09:00:00.000Z'),
    ...overrides,
  };
}

function makeAdminUserRow(
  overrides: Partial<{
    active: boolean;
    addressEnc: string | null;
    createdAt: Date;
    dobEnc: string | null;
    emailEnc: string;
    fullNameEnc: string;
    guardianOf: {
      student: { id: string; fullNameEnc: string; yearGroup: string; active: boolean };
    }[];
    id: string;
    phoneEnc: string | null;
    role: SessionUser['role'];
    tags: string[];
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'u_sup',
    role: 'Supervisor',
    tags: ['attendance-exporter'],
    fullNameEnc: 'enc:Sam Supervisor',
    emailEnc: 'enc:sam@example.com',
    dobEnc: null,
    phoneEnc: null,
    addressEnc: null,
    active: true,
    createdAt: new Date('2026-04-29T09:00:00.000Z'),
    updatedAt: new Date('2026-04-29T10:00:00.000Z'),
    guardianOf: [],
    ...overrides,
  };
}

interface FakeDb {
  auditLog: { create: ReturnType<typeof vi.fn> };
  $enc: {
    blindIndex: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
    encrypt: ReturnType<typeof vi.fn>;
  };
  yearGroupBand: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  subject: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  pacePolicy: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userInvitation: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
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
      encrypt: vi.fn((value: string | null | undefined) =>
        value === null || value === undefined ? null : `enc:${value}`,
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
    subject: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    pacePolicy: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    userInvitation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            clerkInvitationId: string;
            emailEnc: string;
            emailStatus: 'Failed' | 'NotSent' | 'Sent';
            role: SessionUser['role'];
            status: 'Accepted' | 'Pending';
            tags: string[];
          };
        }) =>
          Promise.resolve(
            makeInvitationRow({
              clerkInvitationId: data.clerkInvitationId,
              emailEnc: data.emailEnc,
              emailStatus: data.emailStatus,
              role: data.role,
              status: data.status,
              tags: data.tags,
            }),
          ),
      ),
      update: vi.fn().mockResolvedValue({ id: 'invite_row_1' }),
      delete: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(makeInvitationRow({ id: where.id })),
      ),
    },
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
  options: {
    findResult?: ClerkInvitationResult | null;
    revokeResult?: ClerkInvitationResult;
  } = {},
) {
  const createInvitation = vi.fn().mockResolvedValue(result);
  const findResult = Object.prototype.hasOwnProperty.call(options, 'findResult')
    ? options.findResult
    : result;
  const findInvitation = vi.fn().mockResolvedValue(findResult);
  const revokeInvitation = vi.fn().mockResolvedValue(
    options.revokeResult ?? {
      ...(findResult ?? result),
      status: 'revoked',
    },
  );
  const client: ClerkInvitationClient = { createInvitation, findInvitation, revokeInvitation };
  return { client, createInvitation, findInvitation, revokeInvitation };
}

function makeFakeEmailClient(result = { id: 'email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

function makeFakeUserEmailClient() {
  const updatePrimaryEmail = vi.fn<ClerkUserEmailClient['updatePrimaryEmail']>((input) =>
    Promise.resolve({ emailAddress: input.email, emailAddressId: 'email_new' }),
  );
  const client: ClerkUserEmailClient = { updatePrimaryEmail };
  return { client, updatePrimaryEmail };
}

function makeCaller(
  user: SessionUser | null,
  deps: {
    appUrl?: string;
    clerk?: ReturnType<typeof makeFakeClerk>;
    db?: FakeDb;
    email?: ReturnType<typeof makeFakeEmailClient>;
    userEmail?: ReturnType<typeof makeFakeUserEmailClient>;
  } = {},
) {
  const db = deps.db ?? makeFakeDb();
  const clerk = deps.clerk ?? makeFakeClerk();
  const email = deps.email ?? makeFakeEmailClient();
  const userEmail = deps.userEmail ?? makeFakeUserEmailClient();
  const appRouter = router({
    admin: createAdminRouter({
      appUrl: deps.appUrl ?? TEST_APP_URL,
      clerk: clerk.client,
      emailClient: email.client,
      userEmailClient: userEmail.client,
    }),
  });
  const ctx = makeCtx(user, db);
  return {
    caller: appRouter.createCaller(ctx),
    db,
    createInvitation: clerk.createInvitation,
    findInvitation: clerk.findInvitation,
    revokeInvitation: clerk.revokeInvitation,
    sendEmail: email.send,
    updatePrimaryEmail: userEmail.updatePrimaryEmail,
  };
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

  it('rejects unsupported parent lookup and allows Technical Support operations', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.admin.searchParents()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();

    const supportDb = makeFakeDb();
    supportDb.user.findMany.mockResolvedValue([
      { id: 'u_parent', fullNameEnc: 'enc:Jane Parent', emailEnc: 'enc:jane@example.com' },
    ]);
    const support = makeCaller(technicalSupportUser, { db: supportDb });
    await expect(support.caller.admin.searchParents()).resolves.toEqual([
      { id: 'u_parent', fullName: 'Jane Parent', email: 'jane@example.com' },
    ]);
    expect(supportDb.user.findMany).toHaveBeenCalledWith({
      where: { role: 'Parent', active: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, fullNameEnc: true, emailEnc: true },
    });
  });
});

describe('admin.searchGuardianAccounts', () => {
  it('decrypts active account display rows across roles and writes one PII audit row', async () => {
    const db = makeFakeDb();
    db.user.findMany.mockResolvedValue([
      {
        id: 'u_sup',
        role: 'Supervisor',
        fullNameEnc: 'enc:Sam Supervisor',
        emailEnc: 'enc:sam@example.com',
      },
    ]);
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.searchGuardianAccounts({ search: 'sam@example.com' }),
    ).resolves.toEqual([
      {
        id: 'u_sup',
        role: 'Supervisor',
        fullName: 'Sam Supervisor',
        email: 'sam@example.com',
      },
    ]);
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        role: {
          in: [
            'Parent',
            'Head',
            'Principal',
            'Pastor',
            'HeadOfDiscipline',
            'TechnicalSupport',
            'ClubsAdmin',
            'Supervisor',
          ],
        },
        emailBidx: 'bidx:sam@example.com',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, role: true, fullNameEnc: true, emailEnc: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 1, source: 'admin.searchGuardianAccounts' },
      },
    });
  });

  it('rejects non-full-admin account lookup as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.admin.searchGuardianAccounts()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});

describe('admin.listUsers and admin.updateUserTags', () => {
  it('lists users with decrypted display fields and writes one PII audit row', async () => {
    const db = makeFakeDb();
    db.user.findMany.mockResolvedValue([
      {
        id: 'u_head',
        role: 'Head',
        tags: ['audit-viewer'],
        fullNameEnc: 'enc:Jean Head',
        emailEnc: 'enc:head@example.com',
        dobEnc: null,
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
              yearGroup: 'Year 7',
              active: true,
            },
          },
        ],
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
        dob: null,
        phone: '07700 900123',
        address: null,
        active: true,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T10:00:00.000Z'),
        children: [
          {
            id: 's_child',
            fullName: 'Child One',
            yearGroup: 'Year 7',
            active: true,
          },
        ],
      },
    ]);
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: { not: 'Student' } },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        role: true,
        tags: true,
        fullNameEnc: true,
        emailEnc: true,
        dobEnc: true,
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
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 1, linkedChildCount: 1, source: 'admin.listUsers' },
      },
    });
  });

  it('updates a user profile for full-admin callers and writes an audit row', async () => {
    const db = makeFakeDb();
    db.user.update.mockResolvedValue({
      id: 'u_parent',
      role: 'Parent',
      tags: [],
      fullNameEnc: 'enc:Jane Parent',
      emailEnc: 'enc:jane@example.com',
      dobEnc: null,
      phoneEnc: 'enc:07700 900456',
      addressEnc: null,
      active: true,
      createdAt: new Date('2026-04-29T09:00:00.000Z'),
      updatedAt: new Date('2026-04-29T11:00:00.000Z'),
      guardianOf: [],
    });
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserProfile({
        userId: 'u_parent',
        fullName: 'Jane Parent',
        phone: ' 07700 900456 ',
        address: '',
      }),
    ).resolves.toMatchObject({
      id: 'u_parent',
      fullName: 'Jane Parent',
      email: 'jane@example.com',
      phone: '07700 900456',
      address: null,
      children: [],
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u_parent' },
      data: {
        fullNameEnc: 'enc:Jane Parent',
        phoneEnc: 'enc:07700 900456',
        addressEnc: null,
      },
      select: {
        id: true,
        role: true,
        tags: true,
        fullNameEnc: true,
        emailEnc: true,
        dobEnc: true,
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
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_parent',
        meta: {
          fields: ['addressEnc', 'fullNameEnc', 'phoneEnc'],
          source: 'admin.updateUserProfile',
        },
      },
    });
  });

  it('updates encrypted staff date of birth for full-admin callers', async () => {
    const db = makeFakeDb();
    db.user.update.mockResolvedValue(
      makeAdminUserRow({ dobEnc: 'enc:1984-06-01', role: 'Supervisor' }),
    );
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserProfile({
        userId: 'u_sup',
        dob: '1984-06-01',
      }),
    ).resolves.toMatchObject({
      id: 'u_sup',
      dob: '1984-06-01',
    });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u_sup' },
        data: { dobEnc: 'enc:1984-06-01' },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_sup',
        meta: { fields: ['dobEnc'], source: 'admin.updateUserProfile' },
      },
    });
  });

  it('lets Head update a user email in Clerk and the local encrypted profile', async () => {
    const db = makeFakeDb();
    db.user.findUnique
      .mockResolvedValueOnce({
        id: 'u_parent',
        clerkId: 'clerk_parent',
        emailEnc: 'enc:jane@example.com',
      })
      .mockResolvedValueOnce(null);
    db.user.update.mockResolvedValue(
      makeAdminUserRow({
        id: 'u_parent',
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:jane.new@example.com',
      }),
    );
    const { caller, updatePrimaryEmail } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserProfile({
        userId: 'u_parent',
        email: ' Jane.New@Example.com ',
      }),
    ).resolves.toMatchObject({
      id: 'u_parent',
      email: 'jane.new@example.com',
    });
    expect(updatePrimaryEmail).toHaveBeenCalledWith({
      clerkUserId: 'clerk_parent',
      email: 'jane.new@example.com',
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u_parent' },
      data: {
        emailEnc: 'enc:jane.new@example.com',
        emailBidx: 'bidx:jane.new@example.com',
      },
      select: {
        id: true,
        role: true,
        tags: true,
        fullNameEnc: true,
        emailEnc: true,
        dobEnc: true,
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
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_parent',
        meta: {
          fields: ['emailBidx', 'emailEnc'],
          source: 'admin.updateUserProfile',
        },
      },
    });
  });

  it('lets Principal update a user email in Clerk and the local encrypted profile', async () => {
    const db = makeFakeDb();
    db.user.findUnique
      .mockResolvedValueOnce({
        id: 'u_parent',
        clerkId: 'clerk_parent',
        emailEnc: 'enc:jane@example.com',
      })
      .mockResolvedValueOnce(null);
    db.user.update.mockResolvedValue(
      makeAdminUserRow({
        id: 'u_parent',
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:new@example.com',
      }),
    );
    const { caller, updatePrimaryEmail } = makeCaller(principalUser, { db });

    await expect(
      caller.admin.updateUserProfile({ userId: 'u_parent', email: 'new@example.com' }),
    ).resolves.toMatchObject({
      id: 'u_parent',
      email: 'new@example.com',
    });
    expect(updatePrimaryEmail).toHaveBeenCalledWith({
      clerkUserId: 'clerk_parent',
      email: 'new@example.com',
    });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          emailEnc: 'enc:new@example.com',
          emailBidx: 'bidx:new@example.com',
        },
      }),
    );
  });

  it('rejects Head email updates when another user already has the address', async () => {
    const db = makeFakeDb();
    db.user.findUnique
      .mockResolvedValueOnce({
        id: 'u_parent',
        clerkId: 'clerk_parent',
        emailEnc: 'enc:jane@example.com',
      })
      .mockResolvedValueOnce({
        id: 'u_other',
        clerkId: 'clerk_other',
        emailEnc: 'enc:other@example.com',
      });
    const { caller, updatePrimaryEmail } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserProfile({ userId: 'u_parent', email: 'other@example.com' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'email address is already in use',
    });
    expect(updatePrimaryEmail).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('updates permission tags and writes an audit row', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({
      id: 'u_sup',
      role: 'Supervisor',
      tags: [],
      active: true,
    });
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

  it('lets Head change another adult user role and preserves staff tags', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({
      id: 'u_sup',
      role: 'Supervisor',
      tags: ['attendance-exporter'],
    });
    db.user.update.mockResolvedValue(
      makeAdminUserRow({
        role: 'ClubsAdmin',
        tags: ['attendance-exporter'],
      }),
    );
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserRole({ userId: 'u_sup', role: 'ClubsAdmin' }),
    ).resolves.toMatchObject({
      id: 'u_sup',
      role: 'ClubsAdmin',
      tags: ['attendance-exporter'],
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u_sup' },
      data: { role: 'ClubsAdmin', tags: ['attendance-exporter'] },
      select: {
        id: true,
        role: true,
        tags: true,
        fullNameEnc: true,
        emailEnc: true,
        dobEnc: true,
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
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_sup',
        meta: {
          previousRole: 'Supervisor',
          nextRole: 'ClubsAdmin',
          clearedTags: [],
          source: 'admin.updateUserRole',
        },
      },
    });
  });

  it('clears permission tags when Head changes a user to Parent', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({
      id: 'u_sup',
      role: 'Supervisor',
      tags: ['attendance-exporter', 'audit-viewer'],
    });
    db.user.update.mockResolvedValue(makeAdminUserRow({ role: 'Parent', tags: [] }));
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserRole({ userId: 'u_sup', role: 'Parent' }),
    ).resolves.toMatchObject({ id: 'u_sup', role: 'Parent', tags: [] });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { role: 'Parent', tags: [] },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_sup',
        meta: {
          previousRole: 'Supervisor',
          nextRole: 'Parent',
          clearedTags: ['attendance-exporter', 'audit-viewer'],
          source: 'admin.updateUserRole',
        },
      },
    });
  });

  it('blocks self role changes before account lookup', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserRole({ userId: headUser.id, role: 'Principal' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'cannot change your own role',
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('lets Principal change another adult user role', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({
      id: 'u_sup',
      role: 'Supervisor',
      tags: ['attendance-exporter'],
    });
    db.user.update.mockResolvedValue(
      makeAdminUserRow({
        role: 'Parent',
        tags: [],
      }),
    );
    const { caller } = makeCaller(principalUser, { db });

    await expect(
      caller.admin.updateUserRole({ userId: 'u_sup', role: 'Parent' }),
    ).resolves.toMatchObject({ id: 'u_sup', role: 'Parent', tags: [] });
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { role: 'Parent', tags: [] },
      }),
    );
  });

  it('rejects Student as a role change target', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, { db });
    // Network callers can still send invalid roles even though typed callers cannot.
    const updateUserRoleFromNetwork = caller.admin.updateUserRole as unknown as (input: {
      userId: string;
      role: string;
    }) => Promise<unknown>;

    await expect(
      updateUserRoleFromNetwork({ userId: 'u_sup', role: 'Student' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when changing a missing user role', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue(null);
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserRole({ userId: 'u_missing', role: 'Parent' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'user not found',
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('limits Head-only permission tag changes to Head', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({
      id: 'u_sup',
      role: 'Supervisor',
      tags: [],
      active: true,
    });
    const blocked = makeCaller(principalUser, { db });

    await expect(
      blocked.caller.admin.updateUserTags({
        userId: 'u_sup',
        tags: ['student-drillthrough-viewer'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.update).not.toHaveBeenCalled();

    await expect(
      blocked.caller.admin.updateUserTags({
        userId: 'u_sup',
        tags: ['parent-message-responder'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.update).not.toHaveBeenCalled();

    await expect(
      blocked.caller.admin.updateUserTags({
        userId: 'u_sup',
        tags: ['supervisor-all-students'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.update).not.toHaveBeenCalled();

    await expect(
      blocked.caller.admin.updateUserTags({
        userId: 'u_sup',
        tags: ['calendar-manager'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.update).not.toHaveBeenCalled();

    db.user.findUnique.mockResolvedValue({
      id: 'u_sup',
      role: 'Supervisor',
      tags: ['calendar-manager'],
      active: true,
    });
    await expect(
      blocked.caller.admin.updateUserTags({
        userId: 'u_sup',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.update).not.toHaveBeenCalled();

    db.user.update.mockResolvedValue({
      id: 'u_sup',
      tags: ['student-drillthrough-viewer', 'supervisor-all-students'],
    });
    const allowed = makeCaller(headUser, { db });
    await expect(
      allowed.caller.admin.updateUserTags({
        userId: 'u_sup',
        tags: ['student-drillthrough-viewer', 'supervisor-all-students'],
      }),
    ).resolves.toEqual({
      id: 'u_sup',
      tags: ['student-drillthrough-viewer', 'supervisor-all-students'],
    });
  });

  it('limits Technical Support tag management to the club lead tag', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(caller.admin.listUsers()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.admin.updateUserTags({ userId: 'u_sup', tags: ['audit-viewer'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.admin.updateUserProfile({ userId: 'u_sup', phone: '07700 900000' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();

    const supportDb = makeFakeDb();
    supportDb.user.findMany.mockResolvedValue([
      makeAdminUserRow({ id: 'u_parent', role: 'Parent', tags: [] }),
    ]);
    supportDb.user.update.mockResolvedValue(
      makeAdminUserRow({ id: 'u_sup', phoneEnc: 'enc:07700 900000' }),
    );
    const support = makeCaller(technicalSupportUser, { db: supportDb });
    await expect(support.caller.admin.listUsers()).resolves.toHaveLength(1);
    supportDb.user.findUnique.mockResolvedValueOnce({
      id: 'u_sup',
      role: 'Supervisor',
      tags: [],
      active: true,
    });
    await expect(
      support.caller.admin.updateUserTags({ userId: 'u_sup', tags: ['audit-viewer'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    supportDb.user.findUnique.mockResolvedValueOnce({
      id: 'u_parent',
      role: 'Parent',
      tags: [],
      active: true,
    });
    supportDb.user.update.mockResolvedValueOnce({
      id: 'u_parent',
      tags: ['club-lead'],
    });
    await expect(
      support.caller.admin.updateUserTags({ userId: 'u_parent', tags: ['club-lead'] }),
    ).resolves.toEqual({ id: 'u_parent', tags: ['club-lead'] });
    await expect(
      support.caller.admin.updateUserProfile({ userId: 'u_sup', phone: '07700 900000' }),
    ).resolves.toMatchObject({ id: 'u_sup', phone: '07700 900000' });
    expect(supportDb.user.findMany).toHaveBeenCalled();
    expect(supportDb.user.update).toHaveBeenCalled();

    const parent = makeCaller(parentUser);
    await expect(parent.caller.admin.listUsers()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(parent.db.user.findMany).not.toHaveBeenCalled();
  });

  it('lets Technical Support change any permission tag on their own active account', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({
      id: technicalSupportUser.id,
      role: 'TechnicalSupport',
      tags: [],
      active: true,
    });
    db.user.update.mockResolvedValue({
      id: technicalSupportUser.id,
      tags: ['audit-viewer', 'calendar-manager', 'student-drillthrough-viewer'],
    });
    const { caller } = makeCaller(technicalSupportUser, { db });

    await expect(
      caller.admin.updateUserTags({
        userId: technicalSupportUser.id,
        tags: ['student-drillthrough-viewer', 'audit-viewer', 'calendar-manager'],
      }),
    ).resolves.toEqual({
      id: technicalSupportUser.id,
      tags: ['audit-viewer', 'calendar-manager', 'student-drillthrough-viewer'],
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: technicalSupportUser.id },
      data: { tags: ['audit-viewer', 'student-drillthrough-viewer', 'calendar-manager'] },
      select: { id: true, tags: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: technicalSupportUser.id,
        action: 'Update',
        entity: 'User',
        entityId: technicalSupportUser.id,
        meta: {
          tags: ['audit-viewer', 'calendar-manager', 'student-drillthrough-viewer'],
          source: 'admin.updateUserTags',
        },
      },
    });
  });

  it('blocks Technical Support permission tag changes for inactive accounts', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({
      id: technicalSupportUser.id,
      role: 'TechnicalSupport',
      tags: [],
      active: false,
    });
    const { caller } = makeCaller(technicalSupportUser, { db });

    await expect(
      caller.admin.updateUserTags({
        userId: technicalSupportUser.id,
        tags: ['audit-viewer'],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'permission tags can only be changed for active users',
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

describe('admin.listUserAccounts and account support updates', () => {
  it('lists safe account rows for Technical Support with tags but without child links', async () => {
    const db = makeFakeDb();
    db.user.findMany.mockResolvedValue([
      {
        id: 'u_parent',
        role: 'Parent',
        tags: ['club-lead'],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:jane@example.com',
        phoneEnc: 'enc:07700 900456',
        addressEnc: 'enc:12 High Street',
        active: true,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T10:00:00.000Z'),
      },
      {
        id: 'u_support',
        role: 'TechnicalSupport',
        tags: [],
        fullNameEnc: 'enc:Tech Support',
        emailEnc: 'enc:support@example.com',
        phoneEnc: null,
        addressEnc: null,
        active: false,
        createdAt: new Date('2026-04-30T09:00:00.000Z'),
        updatedAt: new Date('2026-04-30T10:00:00.000Z'),
      },
    ]);
    const { caller } = makeCaller(technicalSupportUser, { db });

    const result = await caller.admin.listUserAccounts();

    expect(result).toEqual([
      {
        id: 'u_parent',
        role: 'Parent',
        tags: ['club-lead'],
        fullName: 'Jane Parent',
        email: 'jane@example.com',
        phone: '07700 900456',
        address: '12 High Street',
        active: true,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T10:00:00.000Z'),
      },
      {
        id: 'u_support',
        role: 'TechnicalSupport',
        tags: [],
        fullName: 'Tech Support',
        email: 'support@example.com',
        phone: null,
        address: null,
        active: false,
        createdAt: new Date('2026-04-30T09:00:00.000Z'),
        updatedAt: new Date('2026-04-30T10:00:00.000Z'),
      },
    ]);
    expect(result[0]).not.toHaveProperty('children');
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['Parent', 'TechnicalSupport'] } },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      take: 100,
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
        userId: technicalSupportUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 2, source: 'admin.listUserAccounts' },
      },
    });
  });

  it('lists pending invitation rows scoped to manageable roles', async () => {
    const db = makeFakeDb();
    db.userInvitation.findMany.mockResolvedValue([
      {
        id: 'invite_parent',
        clerkInvitationId: 'inv_parent',
        role: 'Parent',
        tags: [],
        emailEnc: 'enc:parent@example.com',
        status: 'Pending',
        emailStatus: 'Sent',
        createdAt: new Date('2026-05-02T09:00:00.000Z'),
        updatedAt: new Date('2026-05-02T09:01:00.000Z'),
      },
    ]);
    const { caller } = makeCaller(technicalSupportUser, { db });

    await expect(caller.admin.listUserInvitations()).resolves.toEqual([
      {
        id: 'invite_parent',
        invitationId: 'inv_parent',
        role: 'Parent',
        tags: [],
        email: 'parent@example.com',
        status: 'Pending',
        emailStatus: 'Sent',
        createdAt: new Date('2026-05-02T09:00:00.000Z'),
        updatedAt: new Date('2026-05-02T09:01:00.000Z'),
      },
    ]);
    expect(db.userInvitation.findMany).toHaveBeenCalledWith({
      where: { role: { in: ['Parent', 'TechnicalSupport'] }, status: 'Pending' },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        clerkInvitationId: true,
        role: true,
        tags: true,
        emailEnc: true,
        status: true,
        emailStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: technicalSupportUser.id,
        action: 'DecryptPii',
        entity: 'UserInvitation',
        meta: { count: 1, source: 'admin.listUserInvitations' },
      },
    });
  });

  it('updates safe profile fields and account status for manageable roles', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent' });
    db.user.update
      .mockResolvedValueOnce({
        id: 'u_parent',
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:jane@example.com',
        phoneEnc: 'enc:07700 900456',
        addressEnc: null,
        active: true,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T11:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'u_parent',
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:jane@example.com',
        phoneEnc: 'enc:07700 900456',
        addressEnc: null,
        active: false,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'u_parent',
        role: 'Parent',
        tags: [],
        fullNameEnc: 'enc:Jane Parent',
        emailEnc: 'enc:jane@example.com',
        phoneEnc: 'enc:07700 900456',
        addressEnc: null,
        active: true,
        createdAt: new Date('2026-04-29T09:00:00.000Z'),
        updatedAt: new Date('2026-04-29T13:00:00.000Z'),
      });
    const { caller } = makeCaller(technicalSupportUser, { db });

    await expect(
      caller.admin.updateUserAccountProfile({
        userId: 'u_parent',
        fullName: 'Jane Parent',
        phone: ' 07700 900456 ',
        address: '',
      }),
    ).resolves.toMatchObject({
      id: 'u_parent',
      fullName: 'Jane Parent',
      phone: '07700 900456',
      address: null,
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u_parent' },
      data: {
        fullNameEnc: 'enc:Jane Parent',
        phoneEnc: 'enc:07700 900456',
        addressEnc: null,
      },
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

    await expect(
      caller.admin.updateUserAccountStatus({ userId: 'u_parent', active: false }),
    ).resolves.toMatchObject({ id: 'u_parent', active: false });
    await expect(
      caller.admin.updateUserAccountStatus({ userId: 'u_parent', active: true }),
    ).resolves.toMatchObject({ id: 'u_parent', active: true });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u_parent' },
      data: { active: false },
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
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u_parent' },
      data: { active: true },
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
        userId: technicalSupportUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_parent',
        meta: {
          fields: ['addressEnc', 'fullNameEnc', 'phoneEnc'],
          source: 'admin.updateUserAccountProfile',
        },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: technicalSupportUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_parent',
        meta: { active: false, source: 'admin.updateUserAccountStatus' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: technicalSupportUser.id,
        action: 'Update',
        entity: 'User',
        entityId: 'u_parent',
        meta: { active: true, source: 'admin.updateUserAccountStatus' },
      },
    });
  });

  it('blocks Technical Support from unsafe account targets and self-deactivation', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_sup', role: 'Supervisor' });
    const { caller } = makeCaller(technicalSupportUser, { db });

    await expect(
      caller.admin.updateUserAccountProfile({ userId: 'u_sup', phone: '07700 900000' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.admin.updateUserAccountStatus({ userId: technicalSupportUser.id, active: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('blocks full-admin callers from Technical Support account status endpoints', async () => {
    const db = makeFakeDb();
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateUserAccountStatus({ userId: headUser.id, active: false }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Access denied: role Head cannot manage user accounts',
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('admin.inviteUser', () => {
  it('rejects non-account-admin callers as FORBIDDEN and writes nothing', async () => {
    const { caller, db, createInvitation, sendEmail } = makeCaller(supervisorUser);
    await expect(
      caller.admin.inviteUser({
        email: 'jane@example.com',
        role: 'Supervisor',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(createInvitation).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.userInvitation.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('allows Technical Support to invite Parent and TechnicalSupport accounts without tags', async () => {
    const { caller, db, createInvitation, sendEmail } = makeCaller(technicalSupportUser);

    await expect(
      caller.admin.inviteUser({
        email: 'parent@example.com',
        role: 'Parent',
        tags: [],
      }),
    ).resolves.toMatchObject({ invitationId: 'inv_xyz', status: 'pending', emailStatus: 'Sent' });
    await expect(
      caller.admin.inviteUser({
        email: 'support@example.com',
        role: 'TechnicalSupport',
        tags: [],
      }),
    ).resolves.toMatchObject({ invitationId: 'inv_xyz', status: 'pending', emailStatus: 'Sent' });

    expect(createInvitation).toHaveBeenNthCalledWith(1, {
      emailAddress: 'parent@example.com',
      publicMetadata: { role: 'Parent', tags: [] },
      redirectUrl: INVITATION_REDIRECT_URL,
      ignoreExisting: true,
      notify: false,
    });
    expect(createInvitation).toHaveBeenNthCalledWith(2, {
      emailAddress: 'support@example.com',
      publicMetadata: { role: 'TechnicalSupport', tags: [] },
      redirectUrl: INVITATION_REDIRECT_URL,
      ignoreExisting: true,
      notify: false,
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(db.userInvitation.create).toHaveBeenCalledWith({
      data: {
        clerkInvitationId: 'inv_xyz',
        role: 'Parent',
        tags: [],
        emailEnc: 'enc:parent@example.com',
        emailBidx: 'bidx:parent@example.com',
        status: 'Pending',
        emailStatus: 'NotSent',
        invitedById: technicalSupportUser.id,
      },
      select: {
        id: true,
        clerkInvitationId: true,
        role: true,
        tags: true,
        emailEnc: true,
        status: true,
        emailStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: technicalSupportUser.id,
        action: 'Create',
        entity: 'Invitation',
        entityId: 'inv_xyz',
        meta: {
          role: 'Parent',
          tags: [],
          invitationStatus: 'pending',
          emailStatus: 'Sent',
          source: 'admin.inviteUser',
        },
      },
    });
  });

  it('blocks Technical Support from student-data roles and permission tags', async () => {
    const { caller, createInvitation, sendEmail } = makeCaller(technicalSupportUser);

    await expect(
      caller.admin.inviteUser({
        email: 'supervisor@example.com',
        role: 'Supervisor',
        tags: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.admin.inviteUser({
        email: 'parent@example.com',
        role: 'Parent',
        tags: ['shopkeeper'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(createInvitation).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
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

  it('rejects existing users and already-sent pending invitations before calling Clerk', async () => {
    const existingUserDb = makeFakeDb();
    existingUserDb.user.findUnique.mockResolvedValue({ id: 'u_existing' });
    const existingUser = makeCaller(headUser, { db: existingUserDb });

    await expect(
      existingUser.caller.admin.inviteUser({
        email: 'jane@example.com',
        role: 'Parent',
        tags: [],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'a user account already exists for this email',
    });
    expect(existingUser.createInvitation).not.toHaveBeenCalled();
    expect(existingUser.sendEmail).not.toHaveBeenCalled();

    const pendingInviteDb = makeFakeDb();
    pendingInviteDb.userInvitation.findFirst.mockResolvedValue(
      makeInvitationRow({ emailStatus: 'Sent' }),
    );
    const pendingInvite = makeCaller(headUser, { db: pendingInviteDb });

    await expect(
      pendingInvite.caller.admin.inviteUser({
        email: 'jane@example.com',
        role: 'Parent',
        tags: [],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message:
        'a pending invitation already exists for this email; use resend on the pending invite if needed',
    });
    expect(pendingInvite.createInvitation).not.toHaveBeenCalled();
    expect(pendingInvite.sendEmail).not.toHaveBeenCalled();
  });

  it.each(['Failed', 'NotSent'] as const)(
    'retries a %s pending invitation from the invite form',
    async (emailStatus) => {
      const db = makeFakeDb();
      db.userInvitation.findFirst.mockResolvedValue(makeInvitationRow({ emailStatus }));
      const {
        caller,
        createInvitation,
        db: usedDb,
        findInvitation,
        revokeInvitation,
        sendEmail,
      } = makeCaller(headUser, { db });

      await expect(
        caller.admin.inviteUser({
          email: 'JANE@example.com',
          role: 'Parent',
          tags: [],
        }),
      ).resolves.toEqual({
        invitationId: 'inv_xyz',
        status: 'pending',
        emailStatus: 'Sent',
      });

      expect(findInvitation).toHaveBeenCalledWith('inv_xyz');
      expect(revokeInvitation).toHaveBeenCalledWith('inv_xyz');
      expect(createInvitation).toHaveBeenCalledWith({
        emailAddress: 'jane@example.com',
        publicMetadata: { role: 'Parent', tags: [] },
        redirectUrl: INVITATION_REDIRECT_URL,
        ignoreExisting: true,
        notify: false,
      });
      expect(usedDb.userInvitation.create).not.toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalledOnce();
      expect(usedDb.userInvitation.update).toHaveBeenCalledWith({
        where: { id: 'invite_row_1' },
        data: { emailStatus: 'NotSent', emailMessageId: null },
        select: { id: true },
      });
      expect(usedDb.userInvitation.update).toHaveBeenCalledWith({
        where: { id: 'invite_row_1' },
        data: { emailStatus: 'Sent', emailMessageId: 'email_123' },
        select: { id: true },
      });
      expect(usedDb.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: headUser.id,
          action: 'Update',
          entity: 'Invitation',
          entityId: 'inv_xyz',
          meta: {
            role: 'Parent',
            tags: [],
            invitationStatus: 'pending',
            emailStatus: 'Sent',
            source: 'admin.inviteUser',
          },
        },
      });
    },
  );

  it('blocks invite-form retry when the pending invitation role or tags differ', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(
      makeInvitationRow({ emailStatus: 'Failed', role: 'Supervisor', tags: ['shopkeeper'] }),
    );
    const { caller, createInvitation, findInvitation, sendEmail } = makeCaller(headUser, { db });

    await expect(
      caller.admin.inviteUser({
        email: 'jane@example.com',
        role: 'Parent',
        tags: [],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'a pending invitation already exists for this email with a different role or tags',
    });
    expect(findInvitation).not.toHaveBeenCalled();
    expect(createInvitation).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('marks the pending invitation email as failed when Resend rejects the send', async () => {
    const email = makeFakeEmailClient();
    email.send.mockRejectedValueOnce(new Error('resend unavailable'));
    const { caller, db } = makeCaller(headUser, { email });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(
        caller.admin.inviteUser({
          email: 'jane@example.com',
          role: 'Parent',
          tags: [],
        }),
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'invitation email send failed',
      });
      expect(consoleError).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(String(consoleError.mock.calls[0]?.[0])) as {
        meta?: Record<string, unknown>;
      };
      expect(logEntry).toMatchObject({
        event: 'email.delivery_failed',
        level: 'error',
        message: 'Invitation email delivery failed',
        meta: {
          error: { name: 'Error', message: 'resend unavailable' },
          invitationId: 'inv_xyz',
          role: 'Parent',
          source: 'admin.inviteUser',
          status: 'pending',
        },
      });
      expect(logEntry.meta).not.toHaveProperty('email');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('jane@example.com');
    } finally {
      consoleError.mockRestore();
    }

    expect(db.userInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invite_row_1' },
      data: { emailStatus: 'Failed', emailMessageId: null },
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'Invitation',
        entityId: 'inv_xyz',
        meta: {
          role: 'Parent',
          tags: [],
          invitationStatus: 'pending',
          emailStatus: 'Failed',
          source: 'admin.inviteUser',
        },
      },
    });
  });

  it('happy path: calls Clerk with pre-stamped metadata, sends Resend email, writes audit rows, returns slim result', async () => {
    const clerk = makeFakeClerk({
      id: 'inv_xyz',
      emailAddress: 'jane@example.com',
      status: 'pending',
      url: 'https://clerk.example/invite/abc',
    });
    const { caller, db, createInvitation, sendEmail } = makeCaller(headUser, { clerk });

    const result = await caller.admin.inviteUser({
      email: 'JANE@example.com',
      role: 'Supervisor',
      tags: ['shopkeeper'],
    });

    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: 'jane@example.com',
      publicMetadata: { role: 'Supervisor', tags: ['shopkeeper'] },
      redirectUrl: INVITATION_REDIRECT_URL,
      ignoreExisting: true,
      notify: false,
    });
    expect(db.userInvitation.create).toHaveBeenCalledWith({
      data: {
        clerkInvitationId: 'inv_xyz',
        role: 'Supervisor',
        tags: ['shopkeeper'],
        emailEnc: 'enc:jane@example.com',
        emailBidx: 'bidx:jane@example.com',
        status: 'Pending',
        emailStatus: 'NotSent',
        invitedById: headUser.id,
      },
      select: {
        id: true,
        clerkInvitationId: true,
        role: true,
        tags: true,
        emailEnc: true,
        status: true,
        emailStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    const sentEmail = sendEmail.mock.calls[0]?.[0];
    expect(sentEmail).toMatchObject({
      to: 'jane@example.com',
      subject: 'Your Oasis Portal invitation',
    });
    expect(sentEmail?.text).toContain('https://clerk.example/invite/abc');
    expect(sentEmail && 'react' in sentEmail).toBe(true);
    expect(sentEmail && 'html' in sentEmail).toBe(false);
    expect(db.userInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invite_row_1' },
      data: { emailStatus: 'Sent', emailMessageId: 'email_123' },
      select: { id: true },
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
          emailStatus: 'Sent',
          source: 'admin.inviteUser',
        },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Email',
        entityId: 'email_123',
        meta: {
          invitationId: 'inv_xyz',
          subject: 'Your Oasis Portal invitation',
          source: 'admin.inviteUser',
        },
      },
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('jane@example.com');
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('clerk.example/invite');
    expect(result).toEqual({
      invitationId: 'inv_xyz',
      status: 'pending',
      emailStatus: 'Sent',
    });
  });

  it('limits broad supervisor workflow invite tags to Head', async () => {
    const { caller, createInvitation } = makeCaller(principalUser);

    await expect(
      caller.admin.inviteUser({
        email: 'viewer@example.com',
        role: 'Supervisor',
        tags: ['student-drillthrough-viewer'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(createInvitation).not.toHaveBeenCalled();

    await expect(
      caller.admin.inviteUser({
        email: 'all-students@example.com',
        role: 'Supervisor',
        tags: ['supervisor-all-students'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(createInvitation).not.toHaveBeenCalled();
  });
});

describe('admin.resendUserInvitation', () => {
  it.each(['Failed', 'NotSent', 'Sent'] as const)(
    'resends a %s pending invitation with a fresh canonical redirect',
    async (emailStatus) => {
      const db = makeFakeDb();
      db.userInvitation.findFirst.mockResolvedValue(
        makeInvitationRow({ clerkInvitationId: 'inv_old', emailStatus }),
      );
      const clerk = makeFakeClerk(
        {
          id: 'inv_new',
          emailAddress: 'jane@example.com',
          status: 'pending',
          url: 'https://clerk.example/invite/new',
        },
        {
          findResult: {
            id: 'inv_old',
            emailAddress: 'jane@example.com',
            status: 'pending',
            url: 'https://clerk.example/invite/old',
          },
        },
      );
      const {
        caller,
        createInvitation,
        db: usedDb,
        findInvitation,
        revokeInvitation,
        sendEmail,
      } = makeCaller(headUser, { clerk, db });

      await expect(caller.admin.resendUserInvitation({ id: 'invite_row_1' })).resolves.toEqual({
        invitationId: 'inv_new',
        status: 'pending',
        emailStatus: 'Sent',
      });

      expect(usedDb.userInvitation.findFirst).toHaveBeenCalledWith({
        where: { id: 'invite_row_1', status: 'Pending' },
        select: {
          id: true,
          clerkInvitationId: true,
          role: true,
          tags: true,
          emailEnc: true,
          status: true,
          emailStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(findInvitation).toHaveBeenCalledWith('inv_old');
      expect(revokeInvitation).toHaveBeenCalledWith('inv_old');
      expect(createInvitation).toHaveBeenCalledWith({
        emailAddress: 'jane@example.com',
        publicMetadata: { role: 'Parent', tags: [] },
        redirectUrl: INVITATION_REDIRECT_URL,
        ignoreExisting: true,
        notify: false,
      });
      expect(sendEmail).toHaveBeenCalledOnce();
      expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
        to: 'jane@example.com',
        subject: 'Your Oasis Portal invitation',
      });
      expect(usedDb.userInvitation.update).toHaveBeenCalledWith({
        where: { id: 'invite_row_1' },
        data: { emailStatus: 'Sent', emailMessageId: 'email_123' },
        select: { id: true },
      });
      expect(usedDb.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: headUser.id,
          action: 'Update',
          entity: 'Invitation',
          entityId: 'inv_new',
          meta: {
            role: 'Parent',
            tags: [],
            invitationStatus: 'pending',
            emailStatus: 'Sent',
            source: 'admin.resendUserInvitation',
          },
        },
      });
    },
  );

  it('creates a replacement when the Clerk invitation expired', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(
      makeInvitationRow({ clerkInvitationId: 'inv_old', emailStatus: 'Failed' }),
    );
    const clerk = makeFakeClerk(
      {
        id: 'inv_new',
        emailAddress: 'jane@example.com',
        status: 'pending',
        url: 'https://clerk.example/invite/new',
      },
      {
        findResult: {
          id: 'inv_old',
          emailAddress: 'jane@example.com',
          status: 'expired',
        },
      },
    );
    const {
      caller,
      createInvitation,
      db: usedDb,
      revokeInvitation,
    } = makeCaller(headUser, {
      clerk,
      db,
    });

    await expect(caller.admin.resendUserInvitation({ id: 'invite_row_1' })).resolves.toEqual({
      invitationId: 'inv_new',
      status: 'pending',
      emailStatus: 'Sent',
    });

    expect(revokeInvitation).not.toHaveBeenCalled();
    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: 'jane@example.com',
      publicMetadata: { role: 'Parent', tags: [] },
      redirectUrl: INVITATION_REDIRECT_URL,
      ignoreExisting: true,
      notify: false,
    });
    expect(usedDb.userInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invite_row_1' },
      data: {
        clerkInvitationId: 'inv_new',
        emailStatus: 'NotSent',
        emailMessageId: null,
      },
      select: { id: true },
    });
  });

  it('revokes and replaces a pending Clerk invitation that has no URL', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(makeInvitationRow({ emailStatus: 'Failed' }));
    const clerk = makeFakeClerk(
      {
        id: 'inv_new',
        emailAddress: 'jane@example.com',
        status: 'pending',
        url: 'https://clerk.example/invite/new',
      },
      {
        findResult: {
          id: 'inv_xyz',
          emailAddress: 'jane@example.com',
          status: 'pending',
        },
      },
    );
    const { caller, createInvitation, revokeInvitation } = makeCaller(headUser, { clerk, db });

    await expect(caller.admin.resendUserInvitation({ id: 'invite_row_1' })).resolves.toMatchObject({
      invitationId: 'inv_new',
      emailStatus: 'Sent',
    });
    expect(revokeInvitation).toHaveBeenCalledWith('inv_xyz');
    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: 'jane@example.com',
      publicMetadata: { role: 'Parent', tags: [] },
      redirectUrl: INVITATION_REDIRECT_URL,
      ignoreExisting: true,
      notify: false,
    });
  });

  it('creates a replacement when the Clerk invitation cannot be found', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(makeInvitationRow({ emailStatus: 'Failed' }));
    const clerk = makeFakeClerk(
      {
        id: 'inv_new',
        emailAddress: 'jane@example.com',
        status: 'pending',
        url: 'https://clerk.example/invite/new',
      },
      { findResult: null },
    );
    const { caller, createInvitation, db: usedDb } = makeCaller(headUser, { clerk, db });

    await expect(caller.admin.resendUserInvitation({ id: 'invite_row_1' })).resolves.toMatchObject({
      invitationId: 'inv_new',
      emailStatus: 'Sent',
    });
    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: 'jane@example.com',
      publicMetadata: { role: 'Parent', tags: [] },
      redirectUrl: INVITATION_REDIRECT_URL,
      ignoreExisting: true,
      notify: false,
    });
    expect(usedDb.userInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invite_row_1' },
      data: {
        clerkInvitationId: 'inv_new',
        emailStatus: 'NotSent',
        emailMessageId: null,
      },
      select: { id: true },
    });
  });

  it('marks the pending invitation as failed when resend email delivery fails', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(makeInvitationRow({ emailStatus: 'Sent' }));
    const email = makeFakeEmailClient();
    email.send.mockRejectedValueOnce(new Error('resend unavailable'));
    const { caller, db: usedDb } = makeCaller(headUser, { db, email });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(caller.admin.resendUserInvitation({ id: 'invite_row_1' })).rejects.toMatchObject(
        {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'invitation email send failed',
        },
      );
      expect(consoleError).toHaveBeenCalledTimes(1);
      const logEntry = JSON.parse(String(consoleError.mock.calls[0]?.[0])) as {
        meta?: Record<string, unknown>;
      };
      expect(logEntry).toMatchObject({
        event: 'email.delivery_failed',
        level: 'error',
        message: 'Invitation email delivery failed',
        meta: {
          error: { name: 'Error', message: 'resend unavailable' },
          invitationId: 'inv_xyz',
          role: 'Parent',
          source: 'admin.resendUserInvitation',
          status: 'pending',
        },
      });
      expect(logEntry.meta).not.toHaveProperty('email');
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain('jane@example.com');
    } finally {
      consoleError.mockRestore();
    }

    expect(usedDb.userInvitation.update).toHaveBeenCalledWith({
      where: { id: 'invite_row_1' },
      data: { emailStatus: 'Failed', emailMessageId: null },
      select: { id: true },
    });
    expect(usedDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'Invitation',
        entityId: 'inv_xyz',
        meta: {
          role: 'Parent',
          tags: [],
          invitationStatus: 'pending',
          emailStatus: 'Failed',
          source: 'admin.resendUserInvitation',
        },
      },
    });
  });

  it('scopes Technical Support resend lookups to manageable invitation roles', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(null);
    const {
      caller,
      createInvitation,
      db: usedDb,
      findInvitation,
      sendEmail,
    } = makeCaller(technicalSupportUser, { db });

    await expect(
      caller.admin.resendUserInvitation({ id: 'invite_supervisor' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'pending invitation not found',
    });
    expect(usedDb.userInvitation.findFirst).toHaveBeenCalledWith({
      where: {
        role: { in: ['Parent', 'TechnicalSupport'] },
        id: 'invite_supervisor',
        status: 'Pending',
      },
      select: {
        id: true,
        clerkInvitationId: true,
        role: true,
        tags: true,
        emailEnc: true,
        status: true,
        emailStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(findInvitation).not.toHaveBeenCalled();
    expect(createInvitation).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('admin.deleteUserInvitation', () => {
  it('lets Technical Support revoke and delete a scoped pending invitation', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(makeInvitationRow());
    const clerk = makeFakeClerk(undefined, {
      findResult: {
        id: 'inv_xyz',
        emailAddress: 'jane@example.com',
        status: 'pending',
        url: 'https://clerk.example/invite/abc',
      },
    });
    const {
      caller,
      db: usedDb,
      revokeInvitation,
    } = makeCaller(technicalSupportUser, {
      clerk,
      db,
    });

    await expect(caller.admin.deleteUserInvitation({ id: 'invite_row_1' })).resolves.toEqual({
      id: 'invite_row_1',
      deleted: true,
    });

    expect(usedDb.userInvitation.findFirst).toHaveBeenCalledWith({
      where: {
        role: { in: ['Parent', 'TechnicalSupport'] },
        id: 'invite_row_1',
        status: 'Pending',
      },
      select: {
        id: true,
        clerkInvitationId: true,
        role: true,
        tags: true,
        emailEnc: true,
        status: true,
        emailStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(revokeInvitation).toHaveBeenCalledWith('inv_xyz');
    expect(usedDb.userInvitation.delete).toHaveBeenCalledWith({
      where: { id: 'invite_row_1' },
    });
    expect(usedDb.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: technicalSupportUser.id,
        action: 'Delete',
        entity: 'UserInvitation',
        entityId: 'invite_row_1',
        meta: {
          role: 'Parent',
          tags: [],
          clerkInvitationId: 'inv_xyz',
          clerkInvitationStatus: 'revoked',
          source: 'admin.deleteUserInvitation',
        },
      },
    });
  });

  it('does not allow full admins to delete User Access pending invitations', async () => {
    const db = makeFakeDb();
    db.userInvitation.findFirst.mockResolvedValue(makeInvitationRow());
    const { caller, db: usedDb, revokeInvitation } = makeCaller(headUser, { db });

    await expect(caller.admin.deleteUserInvitation({ id: 'invite_row_1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(usedDb.userInvitation.findFirst).not.toHaveBeenCalled();
    expect(revokeInvitation).not.toHaveBeenCalled();
    expect(usedDb.userInvitation.delete).not.toHaveBeenCalled();
  });
});

describe('admin.linkGuardian', () => {
  it('rejects unsupported callers as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);
    await expect(
      caller.admin.linkGuardian({ userId: 'u_parent', studentId: 's_kid' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.guardian.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('happy path: creates guardian + writes one audit row', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent', active: true });
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
        meta: { guardianUserId: 'u_parent', studentId: 's_kid', targetRole: 'Parent' },
      },
    });
    expect(result).toEqual({ created: true, guardianId: 'g_new' });
  });

  it('allows Technical Support to link guardians for troubleshooting', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent', active: true });
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    db.guardian.create.mockResolvedValue({ id: 'g_support' });
    const { caller } = makeCaller(technicalSupportUser, { db });

    await expect(
      caller.admin.linkGuardian({ userId: 'u_parent', studentId: 's_kid' }),
    ).resolves.toEqual({ created: true, guardianId: 'g_support' });
  });

  it('allows active non-parent accounts to be linked as guardians', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_sup', role: 'Supervisor', active: true });
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    db.guardian.create.mockResolvedValue({ id: 'g_new' });
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.linkGuardian({ userId: 'u_sup', studentId: 's_kid' }),
    ).resolves.toEqual({ created: true, guardianId: 'g_new' });
    expect(db.guardian.create).toHaveBeenCalledWith({
      data: { userId: 'u_sup', studentId: 's_kid' },
    });
  });

  it('idempotent: P2002 unique violation returns existing guardian without an audit row', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent', active: true });
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

  it('rejects with BAD_REQUEST when target user is inactive', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_sup', role: 'Supervisor', active: false });
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.linkGuardian({ userId: 'u_sup', studentId: 's_kid' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.guardian.create).not.toHaveBeenCalled();
  });

  it('rejects with BAD_REQUEST when target user is a Student account', async () => {
    const db = makeFakeDb();
    db.user.findUnique.mockResolvedValue({ id: 'u_student', role: 'Student', active: true });
    db.student.findUnique.mockResolvedValue({ id: 's_kid' });
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.linkGuardian({ userId: 'u_student', studentId: 's_kid' }),
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

    db.user.findUnique.mockResolvedValue({ id: 'u_parent', role: 'Parent', active: true });
    db.student.findUnique.mockResolvedValue(null);
    await expect(
      caller.admin.linkGuardian({ userId: 'u_parent', studentId: 's_missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// Subject management
// ---------------------------------------------------------------------------

describe('admin subject management', () => {
  it('listSubjects returns all subjects (active and inactive) for full-admin', async () => {
    const db = makeFakeDb();
    db.subject.findMany.mockResolvedValue([
      { id: 'sub_math', code: 'MATH', name: 'Mathematics', active: true },
      { id: 'sub_eng', code: 'ENG', name: 'English', active: false },
    ]);
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.listSubjects();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ code: 'MATH', active: true });
    expect(result[1]).toMatchObject({ code: 'ENG', active: false });
  });

  it('listSubjects rejects Supervisors as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);
    await expect(caller.admin.listSubjects()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.subject.findMany).not.toHaveBeenCalled();
  });

  it('createSubject normalises code to uppercase and writes audit row', async () => {
    const db = makeFakeDb();
    const created = { id: 'sub_1', code: 'SOC', name: 'Social Studies', active: true };
    db.subject.create.mockResolvedValue(created);
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.createSubject({ code: 'soc', name: 'Social Studies' });
    expect(result).toMatchObject({ code: 'SOC', name: 'Social Studies', active: true });
    expect(db.subject.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { code: 'SOC', name: 'Social Studies' } }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Subject',
        entityId: 'sub_1',
        meta: { code: 'SOC', name: 'Social Studies' },
      },
    });
  });

  it('createSubject rejects duplicate codes with BAD_REQUEST', async () => {
    const db = makeFakeDb();
    db.subject.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const { caller } = makeCaller(headUser, { db });

    await expect(caller.admin.createSubject({ code: 'MATH', name: 'Maths' })).rejects.toMatchObject(
      { code: 'BAD_REQUEST' },
    );
  });

  it('createSubject rejects Supervisors as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);
    await expect(caller.admin.createSubject({ code: 'MATH', name: 'Maths' })).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
    expect(db.subject.create).not.toHaveBeenCalled();
  });

  it('updateSubject updates name and writes audit row', async () => {
    const db = makeFakeDb();
    const subId = 'cksubject00000000000000001';
    db.subject.update.mockResolvedValue({
      id: subId,
      code: 'MATH',
      name: 'Maths Revised',
      active: true,
    });
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.updateSubject({ id: subId, name: 'Maths Revised' });
    expect(result).toMatchObject({ name: 'Maths Revised' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'Subject',
        entityId: subId,
        meta: { name: 'Maths Revised', source: 'admin.updateSubject' },
      },
    });
  });

  it('updateSubject returns NOT_FOUND for missing id', async () => {
    const db = makeFakeDb();
    db.subject.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.updateSubject({ id: 'cksubjectmissing0000000001', name: 'X' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updateSubject rejects Supervisors as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(
      caller.admin.updateSubject({ id: 'cksubject00000000000000001', name: 'Maths Revised' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.subject.update).not.toHaveBeenCalled();
  });

  it('deactivateSubject soft-deletes and writes audit row', async () => {
    const db = makeFakeDb();
    const subId = 'cksubject00000000000000001';
    db.subject.update.mockResolvedValue({ id: subId, code: 'MATH', name: 'Maths', active: false });
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.deactivateSubject({ id: subId });
    expect(result.active).toBe(false);
    expect(db.subject.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: subId }, data: { active: false } }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'Subject',
        entityId: subId,
        meta: { code: 'MATH', active: false, source: 'admin.deactivateSubject' },
      },
    });
  });

  it('deactivateSubject returns NOT_FOUND for missing id', async () => {
    const db = makeFakeDb();
    db.subject.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );
    const { caller } = makeCaller(headUser, { db });

    await expect(
      caller.admin.deactivateSubject({ id: 'cksubjectmissing0000000001' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deactivateSubject rejects Supervisors as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    await expect(
      caller.admin.deactivateSubject({ id: 'cksubject00000000000000001' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.subject.update).not.toHaveBeenCalled();
  });

  it('listActiveSubjects returns only active subjects', async () => {
    const db = makeFakeDb();
    db.subject.findMany.mockResolvedValue([{ id: 'sub_math', code: 'MATH', name: 'Mathematics' }]);
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.listActiveSubjects();
    expect(result).toEqual([{ id: 'sub_math', code: 'MATH', name: 'Mathematics' }]);
    expect(db.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });
});

// ---------------------------------------------------------------------------
// PACE policy
// ---------------------------------------------------------------------------

describe('admin PACE policy', () => {
  it('getPacePolicy returns defaults when no row exists', async () => {
    const { caller, db } = makeCaller(headUser);
    db.pacePolicy.findUnique.mockResolvedValue(null);

    const policy = await caller.admin.getPacePolicy();
    expect(policy).toEqual({
      id: 'default',
      dailyTestLimitEnabled: false,
      maxTestsPerStudentPerDay: 2,
      samePaceSameDayBlockEnabled: true,
      passThreshold: 80,
    });
  });

  it('getPacePolicy returns stored row when it exists', async () => {
    const db = makeFakeDb();
    const stored = {
      id: 'default',
      dailyTestLimitEnabled: true,
      maxTestsPerStudentPerDay: 3,
      samePaceSameDayBlockEnabled: false,
      passThreshold: 75,
      updatedAt: new Date(),
    };
    db.pacePolicy.findUnique.mockResolvedValue(stored);
    const { caller } = makeCaller(headUser, { db });

    const policy = await caller.admin.getPacePolicy();
    expect(policy).toMatchObject({ dailyTestLimitEnabled: true, passThreshold: 75 });
  });

  it('getPacePolicy rejects Supervisors as FORBIDDEN', async () => {
    const { caller } = makeCaller(supervisorUser);
    await expect(caller.admin.getPacePolicy()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('updatePacePolicy upserts and writes audit row', async () => {
    const db = makeFakeDb();
    db.pacePolicy.upsert.mockResolvedValue({
      id: 'default',
      dailyTestLimitEnabled: true,
      maxTestsPerStudentPerDay: 5,
      samePaceSameDayBlockEnabled: true,
      passThreshold: 80,
    });
    const { caller } = makeCaller(headUser, { db });

    const result = await caller.admin.updatePacePolicy({
      dailyTestLimitEnabled: true,
      maxTestsPerStudentPerDay: 5,
    });
    expect(result).toMatchObject({ dailyTestLimitEnabled: true, maxTestsPerStudentPerDay: 5 });
    expect(db.pacePolicy.upsert).toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'PacePolicy',
        entityId: 'default',
        meta: {
          fields: ['dailyTestLimitEnabled', 'maxTestsPerStudentPerDay'].sort(),
          dailyTestLimitEnabled: true,
          maxTestsPerStudentPerDay: 5,
        },
      },
    });
  });

  it('updatePacePolicy rejects invalid passThreshold (0)', async () => {
    const { caller } = makeCaller(headUser);
    await expect(caller.admin.updatePacePolicy({ passThreshold: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('updatePacePolicy rejects invalid maxTestsPerStudentPerDay (0)', async () => {
    const { caller } = makeCaller(headUser);
    await expect(
      caller.admin.updatePacePolicy({ maxTestsPerStudentPerDay: 0 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('updatePacePolicy rejects Supervisors as FORBIDDEN', async () => {
    const { caller, db } = makeCaller(supervisorUser);
    await expect(
      caller.admin.updatePacePolicy({ dailyTestLimitEnabled: true }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.pacePolicy.upsert).not.toHaveBeenCalled();
  });
});
