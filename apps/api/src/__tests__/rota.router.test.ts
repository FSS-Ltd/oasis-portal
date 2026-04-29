import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { rotaRouter } from '../routers/rota.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const secondSupervisorUser: SessionUser = {
  id: 'u_sup2',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const clubsUser: SessionUser = {
  id: 'u_clubs',
  role: 'ClubsAdmin',
  tags: [],
  requires2fa: false,
};

interface StoredUser {
  id: string;
  role: SessionUser['role'];
  active: boolean;
  fullNameEnc: string;
  emailEnc: string;
  createdAt: Date;
}

interface StoredBand {
  id: string;
  name: string;
  colour: string;
  active: boolean;
}

interface StoredAvailability {
  id: string;
  staffUserId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredShift {
  id: string;
  staffUserId: string;
  yearGroupBandId: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSwap {
  id: string;
  requesterUserId: string;
  targetUserId: string;
  fromShiftId: string;
  toShiftId: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeDb {
  $enc: { decrypt: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  yearGroupBand: { findUnique: ReturnType<typeof vi.fn> };
  staffAvailabilityWindow: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  staffShift: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  shiftSwapRequest: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function at(value: string): Date {
  return new Date(value);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}

function makeFakeDb() {
  const users: StoredUser[] = [
    {
      id: headUser.id,
      role: 'Head',
      active: true,
      fullNameEnc: 'enc:Head User',
      emailEnc: 'enc:head@example.test',
      createdAt: at('2026-04-20T09:00:00.000Z'),
    },
    {
      id: supervisorUser.id,
      role: 'Supervisor',
      active: true,
      fullNameEnc: 'enc:Supervisor One',
      emailEnc: 'enc:sup@example.test',
      createdAt: at('2026-04-21T09:00:00.000Z'),
    },
    {
      id: secondSupervisorUser.id,
      role: 'Supervisor',
      active: true,
      fullNameEnc: 'enc:Supervisor Two',
      emailEnc: 'enc:sup2@example.test',
      createdAt: at('2026-04-22T09:00:00.000Z'),
    },
    {
      id: parentUser.id,
      role: 'Parent',
      active: true,
      fullNameEnc: 'enc:Parent User',
      emailEnc: 'enc:parent@example.test',
      createdAt: at('2026-04-23T09:00:00.000Z'),
    },
    {
      id: clubsUser.id,
      role: 'ClubsAdmin',
      active: true,
      fullNameEnc: 'enc:Clubs User',
      emailEnc: 'enc:clubs@example.test',
      createdAt: at('2026-04-24T09:00:00.000Z'),
    },
  ];
  const bands: StoredBand[] = [
    { id: 'band_lower', name: 'Lower Primary', colour: '#5B90C5', active: true },
    { id: 'band_inactive', name: 'Old Band', colour: '#999999', active: false },
  ];
  const availability: StoredAvailability[] = [];
  const shifts: StoredShift[] = [];
  const swaps: StoredSwap[] = [];

  const withBand = (shift: StoredShift) => ({
    ...shift,
    yearGroupBand: bands.find((band) => band.id === shift.yearGroupBandId) ?? null,
  });
  const withStaffAndBand = (shift: StoredShift) => ({
    ...withBand(shift),
    staffUser: users.find((user) => user.id === shift.staffUserId) ?? null,
  });
  const withSwapRelations = (swap: StoredSwap) => {
    const fromShift = shifts.find((candidate) => candidate.id === swap.fromShiftId);
    const toShift = shifts.find((candidate) => candidate.id === swap.toShiftId);
    return {
      ...swap,
      requester: users.find((user) => user.id === swap.requesterUserId),
      targetUser: users.find((user) => user.id === swap.targetUserId),
      fromShift: fromShift ? withStaffAndBand(fromShift) : null,
      toShift: toShift ? withStaffAndBand(toShift) : null,
    };
  };

  const db: FakeDb = {
    $enc: { decrypt: vi.fn(decrypt) },
    $transaction: vi.fn(async (fn: (tx: FakeDb) => Promise<unknown>) => fn(db)),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    user: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: { active?: boolean; role?: { in?: string[] }; id?: { in?: string[] } };
        }) =>
        Promise.resolve(
          users
            .filter((user) => where?.active === undefined || user.active === where.active)
            .filter((user) => where?.role?.in === undefined || where.role.in.includes(user.role))
            .filter((user) => where?.id?.in === undefined || where.id.in.includes(user.id))
            .sort((a, b) => a.role.localeCompare(b.role) || b.createdAt.getTime() - a.createdAt.getTime()),
        ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const user = users.find((candidate) => candidate.id === where.id);
        return Promise.resolve(user ?? null);
      }),
    },
    yearGroupBand: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const band = bands.find((candidate) => candidate.id === where.id);
        return Promise.resolve(band ?? null);
      }),
    },
    staffAvailabilityWindow: {
      findMany: vi.fn(({ where }: { where: { staffUserId: string | { in: string[] } } }) =>
        Promise.resolve(
          availability
            .filter((row) =>
              typeof where.staffUserId === 'string'
                ? row.staffUserId === where.staffUserId
                : where.staffUserId.in.includes(row.staffUserId),
            )
            .sort(
              (a, b) =>
                a.staffUserId.localeCompare(b.staffUserId) ||
                a.dayOfWeek - b.dayOfWeek ||
                a.startMinute - b.startMinute,
            ),
        ),
      ),
      deleteMany: vi.fn(({ where }: { where: { staffUserId: string } }) => {
        const before = availability.length;
        for (let index = availability.length - 1; index >= 0; index -= 1) {
          if (availability[index]?.staffUserId === where.staffUserId) {
            availability.splice(index, 1);
          }
        }
        return Promise.resolve({ count: before - availability.length });
      }),
      createMany: vi.fn(
        ({
          data,
        }: {
          data: { staffUserId: string; dayOfWeek: number; startMinute: number; endMinute: number }[];
        }) => {
          for (const row of data) {
            availability.push({
              id: `avail_${String(availability.length + 1)}`,
              createdAt: at('2026-04-29T09:00:00.000Z'),
              updatedAt: at('2026-04-29T09:00:00.000Z'),
              ...row,
            });
          }
          return Promise.resolve({ count: data.length });
        },
      ),
    },
    staffShift: {
      findMany: vi.fn(({ where }: { where: { staffUserId?: string; date?: { gte: Date; lte: Date } } }) =>
        Promise.resolve(
          shifts
            .filter((shift) => where.staffUserId === undefined || shift.staffUserId === where.staffUserId)
            .filter(
              (shift) =>
                where.date === undefined ||
                (shift.date.getTime() >= where.date.gte.getTime() &&
                  shift.date.getTime() <= where.date.lte.getTime()),
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime() || a.startsAt.getTime() - b.startsAt.getTime())
            .map(withStaffAndBand),
        ),
      ),
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: {
            staffUserId: string;
            date: Date;
            startsAt: { lt: Date };
            endsAt: { gt: Date };
            NOT?: { id: string };
          };
        }) =>
          Promise.resolve(
            shifts.find(
              (shift) =>
                shift.staffUserId === where.staffUserId &&
                dateKey(shift.date) === dateKey(where.date) &&
                shift.startsAt.getTime() < where.startsAt.lt.getTime() &&
                shift.endsAt.getTime() > where.endsAt.gt.getTime() &&
                shift.id !== where.NOT?.id,
            ) ?? null,
          ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const shift = shifts.find((candidate) => candidate.id === where.id);
        return Promise.resolve(shift ? withStaffAndBand(shift) : null);
      }),
      create: vi.fn(({ data }: { data: Omit<StoredShift, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const shift: StoredShift = {
          id: `shift_${String(shifts.length + 1)}`,
          createdAt: at('2026-04-29T10:00:00.000Z'),
          updatedAt: at('2026-04-29T10:00:00.000Z'),
          ...data,
          notes: data.notes ?? null,
        };
        shifts.push(shift);
        return Promise.resolve(withStaffAndBand(shift));
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<StoredShift> }) => {
        const shift = shifts.find((candidate) => candidate.id === where.id);
        if (!shift) throw new Error('shift missing');
        Object.assign(shift, data, { updatedAt: at('2026-04-29T11:00:00.000Z') });
        return Promise.resolve(withStaffAndBand(shift));
      }),
    },
    shiftSwapRequest: {
      findFirst: vi.fn(
        ({ where }: { where: { status: StoredSwap['status']; OR: { fromShiftId?: string; toShiftId?: string }[] } }) =>
          Promise.resolve(
            swaps.find(
              (swap) =>
                swap.status === where.status &&
                where.OR.some(
                  (condition) =>
                    condition.fromShiftId === swap.fromShiftId || condition.toShiftId === swap.toShiftId,
                ),
            ) ?? null,
          ),
      ),
      findMany: vi.fn(({ where }: { where: { status: StoredSwap['status'] } }) =>
        Promise.resolve(
          swaps
            .filter((swap) => swap.status === where.status)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(withSwapRelations),
        ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const swap = swaps.find((candidate) => candidate.id === where.id);
        if (!swap) return Promise.resolve(null);
        const fromShift = shifts.find((candidate) => candidate.id === swap.fromShiftId);
        const toShift = shifts.find((candidate) => candidate.id === swap.toShiftId);
        return Promise.resolve({ ...swap, fromShift, toShift });
      }),
      create: vi.fn(
        ({
          data,
        }: {
          data: {
            requesterUserId: string;
            targetUserId: string;
            fromShiftId: string;
            toShiftId: string;
          };
        }) => {
          const swap: StoredSwap = {
            id: `swap_${String(swaps.length + 1)}`,
            status: 'Pending',
            approvedById: null,
            reviewedAt: null,
            createdAt: at('2026-04-29T12:00:00.000Z'),
            updatedAt: at('2026-04-29T12:00:00.000Z'),
            ...data,
          };
          swaps.push(swap);
          return Promise.resolve(swap);
        },
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<StoredSwap> }) => {
        const swap = swaps.find((candidate) => candidate.id === where.id);
        if (!swap) throw new Error('swap missing');
        Object.assign(swap, data, { updatedAt: at('2026-04-29T13:00:00.000Z') });
        return Promise.resolve(swap);
      }),
    },
  };

  return { db, users, availability, shifts, swaps };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  const appRouter = router({ rota: rotaRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('rota availability', () => {
  it('lets staff replace their own weekly availability and rejects overlapping windows', async () => {
    const { db, availability } = makeFakeDb();
    const caller = makeCaller(supervisorUser, db);

    await expect(
      caller.rota.setMyAvailability({
        windows: [
          { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
          { dayOfWeek: 1, startMinute: 780, endMinute: 960 },
        ],
      }),
    ).resolves.toMatchObject([
      { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
      { dayOfWeek: 1, startMinute: 780, endMinute: 960 },
    ]);
    expect(availability).toHaveLength(2);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'Update',
        entity: 'StaffAvailability',
        entityId: supervisorUser.id,
        meta: { windowCount: 2, source: 'rota.setMyAvailability' },
      },
    });

    await expect(
      caller.rota.setMyAvailability({
        windows: [
          { dayOfWeek: 2, startMinute: 540, endMinute: 720 },
          { dayOfWeek: 2, startMinute: 700, endMinute: 840 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'availability windows must not overlap' });
  });

  it('denies non-staff roles from staff self-service workflows', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(parentUser, db).rota.myAvailability()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(clubsUser, db).rota.myRota({ from: day('2026-04-29'), to: day('2026-04-29') })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('rota scheduling', () => {
  it('lists active staff candidates with decrypted display fields for full-admin users', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(headUser, db).rota.listStaff()).resolves.toEqual([
      { id: headUser.id, role: 'Head', fullName: 'Head User', email: 'head@example.test' },
      { id: secondSupervisorUser.id, role: 'Supervisor', fullName: 'Supervisor Two', email: 'sup2@example.test' },
      { id: supervisorUser.id, role: 'Supervisor', fullName: 'Supervisor One', email: 'sup@example.test' },
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 3, source: 'rota.listStaff' },
      },
    });

    await expect(makeCaller(supervisorUser, db).rota.listStaff()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets full-admin read weekly schedule with staff and band metadata', async () => {
    const { db } = makeFakeDb();
    const head = makeCaller(headUser, db);

    await head.rota.createShift({
      staffUserId: supervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T09:00:00.000Z'),
      endsAt: at('2026-04-29T12:00:00.000Z'),
      notes: 'Morning group',
    });

    await expect(
      head.rota.weekSchedule({ from: day('2026-04-27'), to: day('2026-05-03') }),
    ).resolves.toMatchObject([
      {
        id: 'shift_1',
        staffUserId: supervisorUser.id,
        date: '2026-04-29',
        notes: 'Morning group',
        bandName: 'Lower Primary',
        bandColour: '#5B90C5',
        staff: {
          id: supervisorUser.id,
          role: 'Supervisor',
          fullName: 'Supervisor One',
          email: 'sup@example.test',
        },
      },
    ]);
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'StaffShift',
        meta: { count: 1, source: 'rota.weekSchedule' },
      },
    });

    await expect(
      makeCaller(supervisorUser, db).rota.weekSchedule({ from: day('2026-04-27'), to: day('2026-05-03') }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets full-admin read active staff availability and excludes inactive or non-staff users', async () => {
    const { db, users, availability } = makeFakeDb();
    users.push({
      id: 'u_inactive_sup',
      role: 'Supervisor',
      active: false,
      fullNameEnc: 'enc:Inactive Supervisor',
      emailEnc: 'enc:inactive@example.test',
      createdAt: at('2026-04-25T09:00:00.000Z'),
    });
    availability.push(
      {
        id: 'avail_1',
        staffUserId: supervisorUser.id,
        dayOfWeek: 1,
        startMinute: 540,
        endMinute: 720,
        createdAt: at('2026-04-29T09:00:00.000Z'),
        updatedAt: at('2026-04-29T09:00:00.000Z'),
      },
      {
        id: 'avail_2',
        staffUserId: parentUser.id,
        dayOfWeek: 2,
        startMinute: 540,
        endMinute: 720,
        createdAt: at('2026-04-29T09:00:00.000Z'),
        updatedAt: at('2026-04-29T09:00:00.000Z'),
      },
      {
        id: 'avail_3',
        staffUserId: 'u_inactive_sup',
        dayOfWeek: 3,
        startMinute: 540,
        endMinute: 720,
        createdAt: at('2026-04-29T09:00:00.000Z'),
        updatedAt: at('2026-04-29T09:00:00.000Z'),
      },
    );

    const rows = await makeCaller(headUser, db).rota.staffAvailability();
    expect(rows.map((row) => row.id)).toEqual([headUser.id, secondSupervisorUser.id, supervisorUser.id]);
    expect(rows.find((row) => row.id === supervisorUser.id)).toMatchObject({
      fullName: 'Supervisor One',
      availability: [{ dayOfWeek: 1, startMinute: 540, endMinute: 720 }],
    });
    expect(rows.some((row) => row.id === parentUser.id || row.id === 'u_inactive_sup')).toBe(false);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'StaffAvailability',
        meta: { count: 3, source: 'rota.staffAvailability' },
      },
    });

    await expect(makeCaller(supervisorUser, db).rota.staffAvailability()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets full-admin create and update shifts, while supervisors can only read their own rota', async () => {
    const { db, shifts } = makeFakeDb();
    const head = makeCaller(headUser, db);

    await expect(
      head.rota.createShift({
        staffUserId: supervisorUser.id,
        yearGroupBandId: 'band_lower',
        date: day('2026-04-29'),
        startsAt: at('2026-04-29T09:00:00.000Z'),
        endsAt: at('2026-04-29T12:00:00.000Z'),
        notes: 'Morning',
      }),
    ).resolves.toMatchObject({
      id: 'shift_1',
      staffUserId: supervisorUser.id,
      date: '2026-04-29',
      bandName: 'Lower Primary',
      bandColour: '#5B90C5',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'StaffShift',
        entityId: 'shift_1',
        meta: {
          staffUserId: supervisorUser.id,
          yearGroupBandId: 'band_lower',
          date: '2026-04-29',
          startsAt: '2026-04-29T09:00:00.000Z',
          endsAt: '2026-04-29T12:00:00.000Z',
        },
      },
    });

    await expect(
      head.rota.createShift({
        staffUserId: supervisorUser.id,
        yearGroupBandId: 'band_lower',
        date: day('2026-04-29'),
        startsAt: at('2026-04-29T11:00:00.000Z'),
        endsAt: at('2026-04-29T13:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'staff shift overlaps an existing shift' });

    await expect(
      head.rota.updateShift({
        id: 'shift_1',
        startsAt: at('2026-04-29T10:00:00.000Z'),
        endsAt: at('2026-04-29T13:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ startsAt: at('2026-04-29T10:00:00.000Z') });
    expect(shifts[0]).toMatchObject({ startsAt: at('2026-04-29T10:00:00.000Z') });

    await expect(
      makeCaller(supervisorUser, db).rota.createShift({
        staffUserId: supervisorUser.id,
        yearGroupBandId: 'band_lower',
        date: day('2026-04-30'),
        startsAt: at('2026-04-30T09:00:00.000Z'),
        endsAt: at('2026-04-30T12:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(supervisorUser, db).rota.myRota({ from: day('2026-04-29'), to: day('2026-04-29') }),
    ).resolves.toHaveLength(1);
  });
});

describe('rota shift swaps', () => {
  it('lets full-admin list pending shift swaps with shift context only', async () => {
    const { db, swaps } = makeFakeDb();
    const head = makeCaller(headUser, db);
    await head.rota.createShift({
      staffUserId: supervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T09:00:00.000Z'),
      endsAt: at('2026-04-29T12:00:00.000Z'),
    });
    await head.rota.createShift({
      staffUserId: secondSupervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T13:00:00.000Z'),
      endsAt: at('2026-04-29T16:00:00.000Z'),
    });
    await makeCaller(supervisorUser, db).rota.requestSwap({
      fromShiftId: 'shift_1',
      toShiftId: 'shift_2',
    });
    swaps.push({
      id: 'swap_reviewed',
      requesterUserId: supervisorUser.id,
      targetUserId: secondSupervisorUser.id,
      fromShiftId: 'shift_1',
      toShiftId: 'shift_2',
      status: 'Approved',
      approvedById: headUser.id,
      reviewedAt: at('2026-04-29T13:00:00.000Z'),
      createdAt: at('2026-04-29T12:30:00.000Z'),
      updatedAt: at('2026-04-29T13:00:00.000Z'),
    });

    await expect(head.rota.pendingSwapRequests()).resolves.toMatchObject([
      {
        id: 'swap_1',
        status: 'Pending',
        requester: { fullName: 'Supervisor One' },
        targetUser: { fullName: 'Supervisor Two' },
        fromShift: { id: 'shift_1', staff: { fullName: 'Supervisor One' } },
        toShift: { id: 'shift_2', staff: { fullName: 'Supervisor Two' } },
      },
    ]);
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'ShiftSwapRequest',
        meta: { count: 1, source: 'rota.pendingSwapRequests' },
      },
    });

    await expect(makeCaller(supervisorUser, db).rota.pendingSwapRequests()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('keeps requested swaps pending until full-admin approval atomically swaps shifts', async () => {
    const { db, shifts } = makeFakeDb();
    const head = makeCaller(headUser, db);
    await head.rota.createShift({
      staffUserId: supervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T09:00:00.000Z'),
      endsAt: at('2026-04-29T12:00:00.000Z'),
    });
    await head.rota.createShift({
      staffUserId: secondSupervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T13:00:00.000Z'),
      endsAt: at('2026-04-29T16:00:00.000Z'),
    });

    const request = await makeCaller(supervisorUser, db).rota.requestSwap({
      fromShiftId: 'shift_1',
      toShiftId: 'shift_2',
    });

    expect(request).toMatchObject({
      id: 'swap_1',
      status: 'Pending',
      requesterUserId: supervisorUser.id,
      targetUserId: secondSupervisorUser.id,
    });
    expect(shifts.find((shift) => shift.id === 'shift_1')).toMatchObject({ staffUserId: supervisorUser.id });
    expect(shifts.find((shift) => shift.id === 'shift_2')).toMatchObject({ staffUserId: secondSupervisorUser.id });

    await expect(head.rota.approveSwap({ id: 'swap_1' })).resolves.toMatchObject({
      id: 'swap_1',
      status: 'Approved',
      approvedById: headUser.id,
    });
    expect(shifts.find((shift) => shift.id === 'shift_1')).toMatchObject({ staffUserId: secondSupervisorUser.id });
    expect(shifts.find((shift) => shift.id === 'shift_2')).toMatchObject({ staffUserId: supervisorUser.id });
  });

  it('rejects swaps without changing shift assignments', async () => {
    const { db, shifts } = makeFakeDb();
    const head = makeCaller(headUser, db);
    await head.rota.createShift({
      staffUserId: supervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T09:00:00.000Z'),
      endsAt: at('2026-04-29T12:00:00.000Z'),
    });
    await head.rota.createShift({
      staffUserId: secondSupervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T13:00:00.000Z'),
      endsAt: at('2026-04-29T16:00:00.000Z'),
    });
    await makeCaller(supervisorUser, db).rota.requestSwap({
      fromShiftId: 'shift_1',
      toShiftId: 'shift_2',
    });

    await expect(head.rota.rejectSwap({ id: 'swap_1' })).resolves.toMatchObject({
      id: 'swap_1',
      status: 'Rejected',
      approvedById: headUser.id,
    });
    expect(shifts.find((shift) => shift.id === 'shift_1')).toMatchObject({ staffUserId: supervisorUser.id });
    expect(shifts.find((shift) => shift.id === 'shift_2')).toMatchObject({ staffUserId: secondSupervisorUser.id });
  });
});
