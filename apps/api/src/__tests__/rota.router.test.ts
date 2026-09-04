import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import { rotaRouter } from '../routers/rota.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const principalUser: SessionUser = {
  id: 'u_principal',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const clubsLeadUser: SessionUser = {
  id: 'u_clubs_lead',
  role: 'ClubsLead',
  tags: [],
  requires2fa: false,
};
const inactiveSupervisorUser: SessionUser = {
  id: 'u_inactive_supervisor',
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
const secondParentUser: SessionUser = {
  id: 'u_parent2',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const thirdParentUser: SessionUser = {
  id: 'u_parent3',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = { id: 'u_student', role: 'Student', tags: [], requires2fa: false };
const clubsUser: SessionUser = {
  id: 'u_clubs',
  role: 'ClubsAdmin',
  tags: [],
  requires2fa: false,
};
const technicalSupportUser: SessionUser = {
  id: 'u_technical_support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};

interface StoredUser {
  id: string;
  role: SessionUser['role'];
  active: boolean;
  staffParentVolunteerAccess: boolean;
  activeChildCount: number;
  fullNameEnc: string;
  emailEnc: string;
  createdAt: Date;
  updatedAt: Date;
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

interface StoredMonthlyAvailability {
  id: string;
  staffUserId: string;
  date: Date;
  startMinute: number;
  endMinute: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredShift {
  id: string;
  staffUserId: string;
  kind: 'Cover' | 'Meeting';
  yearGroupBandId: string | null;
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

interface StoredParentVolunteerDay {
  id: string;
  parentUserId: string;
  date: Date;
  placement: 'Centre' | 'LunchAndClubsPrimary' | 'LunchAndClubsSecondary';
  slot: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeDb {
  $enc: { decrypt: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  yearGroupBand: { findUnique: ReturnType<typeof vi.fn> };
  staffAvailabilityWindow: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  staffMonthlyAvailabilityWindow: {
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
    delete: ReturnType<typeof vi.fn>;
  };
  parentVolunteerDay: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
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
      staffParentVolunteerAccess: false,
      activeChildCount: 0,
      fullNameEnc: 'enc:Head User',
      emailEnc: 'enc:head@example.test',
      createdAt: at('2026-04-20T09:00:00.000Z'),
      updatedAt: at('2026-04-20T09:00:00.000Z'),
    },
    {
      id: supervisorUser.id,
      role: 'Supervisor',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 1,
      fullNameEnc: 'enc:Supervisor One',
      emailEnc: 'enc:sup@example.test',
      createdAt: at('2026-04-21T09:00:00.000Z'),
      updatedAt: at('2026-04-21T09:00:00.000Z'),
    },
    {
      id: secondSupervisorUser.id,
      role: 'Supervisor',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 0,
      fullNameEnc: 'enc:Supervisor Two',
      emailEnc: 'enc:sup2@example.test',
      createdAt: at('2026-04-22T09:00:00.000Z'),
      updatedAt: at('2026-04-22T09:00:00.000Z'),
    },
    {
      id: clubsLeadUser.id,
      role: 'ClubsLead',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 1,
      fullNameEnc: 'enc:Clubs Lead User',
      emailEnc: 'enc:clubs-lead@example.test',
      createdAt: at('2026-04-22T10:00:00.000Z'),
      updatedAt: at('2026-04-22T10:00:00.000Z'),
    },
    {
      id: inactiveSupervisorUser.id,
      role: 'Supervisor',
      active: false,
      staffParentVolunteerAccess: true,
      activeChildCount: 1,
      fullNameEnc: 'enc:Inactive Supervisor User',
      emailEnc: 'enc:inactive-supervisor@example.test',
      createdAt: at('2026-04-22T11:00:00.000Z'),
      updatedAt: at('2026-04-22T11:00:00.000Z'),
    },
    {
      id: parentUser.id,
      role: 'Parent',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 1,
      fullNameEnc: 'enc:Parent User',
      emailEnc: 'enc:parent@example.test',
      createdAt: at('2026-04-23T09:00:00.000Z'),
      updatedAt: at('2026-04-23T09:00:00.000Z'),
    },
    {
      id: secondParentUser.id,
      role: 'Parent',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 1,
      fullNameEnc: 'enc:Second Parent',
      emailEnc: 'enc:parent2@example.test',
      createdAt: at('2026-04-24T09:00:00.000Z'),
      updatedAt: at('2026-04-24T09:00:00.000Z'),
    },
    {
      id: thirdParentUser.id,
      role: 'Parent',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 1,
      fullNameEnc: 'enc:Third Parent',
      emailEnc: 'enc:parent3@example.test',
      createdAt: at('2026-04-25T09:00:00.000Z'),
      updatedAt: at('2026-04-25T09:00:00.000Z'),
    },
    {
      id: clubsUser.id,
      role: 'ClubsAdmin',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 0,
      fullNameEnc: 'enc:Clubs User',
      emailEnc: 'enc:clubs@example.test',
      createdAt: at('2026-04-24T09:00:00.000Z'),
      updatedAt: at('2026-04-24T09:00:00.000Z'),
    },
    {
      id: technicalSupportUser.id,
      role: 'TechnicalSupport',
      active: true,
      staffParentVolunteerAccess: false,
      activeChildCount: 0,
      fullNameEnc: 'enc:Technical Support',
      emailEnc: 'enc:technical@example.test',
      createdAt: at('2026-04-26T09:00:00.000Z'),
      updatedAt: at('2026-04-26T09:00:00.000Z'),
    },
  ];
  const bands: StoredBand[] = [
    { id: 'band_lower', name: 'Lower Primary', colour: '#5B90C5', active: true },
    { id: 'band_inactive', name: 'Old Band', colour: '#999999', active: false },
  ];
  const availability: StoredAvailability[] = [];
  const monthlyAvailability: StoredMonthlyAvailability[] = [];
  const shifts: StoredShift[] = [];
  const swaps: StoredSwap[] = [];
  const parentVolunteerDays: StoredParentVolunteerDay[] = [];
  let nextParentVolunteerDayId = 1;

  const withBand = (shift: StoredShift) => ({
    ...shift,
    yearGroupBand: shift.yearGroupBandId
      ? (bands.find((band) => band.id === shift.yearGroupBandId) ?? null)
      : null,
  });
  const withStaffAndBand = (shift: StoredShift) => ({
    ...withBand(shift),
    staffUser: users.find((user) => user.id === shift.staffUserId) ?? null,
  });
  const withActiveGuardians = (user: StoredUser) => ({
    ...user,
    guardianOf: Array.from({ length: user.activeChildCount }, (_, index) => ({
      student: { id: `student_${user.id}_${String(index)}`, active: true },
    })),
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
    $queryRaw: vi.fn(
      (_query: TemplateStringsArray, userId: string, requireEnabledAccess: boolean) => {
        const user = users.find((candidate) => candidate.id === userId);
        const eligible =
          user?.active === true &&
          user.role !== 'Parent' &&
          user.role !== 'Student' &&
          (!requireEnabledAccess || user.staffParentVolunteerAccess) &&
          user.activeChildCount > 0;
        return Promise.resolve(eligible ? [{ id: user.id }] : []);
      },
    ),
    $transaction: vi.fn(
      async (input: ((tx: FakeDb) => Promise<unknown>) | Promise<unknown>[]) =>
        Array.isArray(input) ? Promise.all(input) : input(db),
    ),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    user: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            active?: boolean;
            role?: { in?: string[]; notIn?: string[] };
            id?: { in?: string[] };
            guardianOf?: { some: { student: { active: boolean } } };
          };
        }) =>
          Promise.resolve(
            users
              .filter((user) => where?.active === undefined || user.active === where.active)
              .filter((user) => where?.role?.in === undefined || where.role.in.includes(user.role))
              .filter(
                (user) => where?.role?.notIn === undefined || !where.role.notIn.includes(user.role),
              )
              .filter((user) => where?.id?.in === undefined || where.id.in.includes(user.id))
              .filter(
                (user) =>
                  where?.guardianOf === undefined ||
                  !where.guardianOf.some.student.active ||
                  user.activeChildCount > 0,
              )
              .sort(
                (a, b) =>
                  a.role.localeCompare(b.role) || b.createdAt.getTime() - a.createdAt.getTime(),
              )
              .map(withActiveGuardians),
          ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const user = users.find((candidate) => candidate.id === where.id);
        return Promise.resolve(user ? withActiveGuardians(user) : null);
      }),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Pick<StoredUser, 'staffParentVolunteerAccess'>;
        }) => {
          const user = users.find((candidate) => candidate.id === where.id);
          if (!user) throw new Error('user missing');
          Object.assign(user, data, { updatedAt: new Date() });
          return Promise.resolve(withActiveGuardians(user));
        },
      ),
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
          data: {
            staffUserId: string;
            dayOfWeek: number;
            startMinute: number;
            endMinute: number;
          }[];
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
    staffMonthlyAvailabilityWindow: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            staffUserId: string | { in: string[] };
            date?: { gte: Date; lte: Date };
          };
        }) =>
          Promise.resolve(
            monthlyAvailability
              .filter((row) =>
                typeof where.staffUserId === 'string'
                  ? row.staffUserId === where.staffUserId
                  : where.staffUserId.in.includes(row.staffUserId),
              )
              .filter(
                (row) =>
                  where.date === undefined ||
                  (row.date.getTime() >= where.date.gte.getTime() &&
                    row.date.getTime() <= where.date.lte.getTime()),
              )
              .sort(
                (a, b) =>
                  a.staffUserId.localeCompare(b.staffUserId) ||
                  a.date.getTime() - b.date.getTime() ||
                  a.startMinute - b.startMinute,
              ),
          ),
      ),
      deleteMany: vi.fn(
        ({ where }: { where: { staffUserId: string; date: { gte: Date; lte: Date } } }) => {
          const before = monthlyAvailability.length;
          for (let index = monthlyAvailability.length - 1; index >= 0; index -= 1) {
            const row = monthlyAvailability[index];
            if (
              row &&
              row.staffUserId === where.staffUserId &&
              row.date.getTime() >= where.date.gte.getTime() &&
              row.date.getTime() <= where.date.lte.getTime()
            ) {
              monthlyAvailability.splice(index, 1);
            }
          }
          return Promise.resolve({ count: before - monthlyAvailability.length });
        },
      ),
      createMany: vi.fn(
        ({
          data,
        }: {
          data: {
            staffUserId: string;
            date: Date;
            startMinute: number;
            endMinute: number;
          }[];
        }) => {
          for (const row of data) {
            monthlyAvailability.push({
              id: `monthly_${String(monthlyAvailability.length + 1)}`,
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
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            staffUserId?: string;
            date?: { gte: Date; lte: Date };
            staffUser?: { active?: boolean; role?: { in?: string[] } };
          };
        }) =>
          Promise.resolve(
            shifts
              .filter(
                (shift) =>
                  where.staffUserId === undefined || shift.staffUserId === where.staffUserId,
              )
              .filter((shift) => {
                const staffUser = users.find((user) => user.id === shift.staffUserId);
                return (
                  where.staffUser === undefined ||
                  (staffUser !== undefined &&
                    (where.staffUser.active === undefined ||
                      staffUser.active === where.staffUser.active) &&
                    (where.staffUser.role?.in === undefined ||
                      where.staffUser.role.in.includes(staffUser.role)))
                );
              })
              .filter(
                (shift) =>
                  where.date === undefined ||
                  (shift.date.getTime() >= where.date.gte.getTime() &&
                    shift.date.getTime() <= where.date.lte.getTime()),
              )
              .sort(
                (a, b) =>
                  a.date.getTime() - b.date.getTime() ||
                  a.startsAt.getTime() - b.startsAt.getTime(),
              )
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
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const index = shifts.findIndex((candidate) => candidate.id === where.id);
        if (index === -1) throw new Error('shift missing');
        const [shift] = shifts.splice(index, 1);
        if (!shift) throw new Error('shift missing');
        return Promise.resolve(withStaffAndBand(shift));
      }),
    },
    parentVolunteerDay: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            parentUserId?: string;
            date?: Date | { gte: Date; lte: Date };
            placement?:
              | StoredParentVolunteerDay['placement']
              | { in: StoredParentVolunteerDay['placement'][] };
            OR?: { date: Date; placement: StoredParentVolunteerDay['placement'] }[];
          };
        }) =>
          Promise.resolve(
            parentVolunteerDays
              .filter(
                (row) =>
                  where.parentUserId === undefined || row.parentUserId === where.parentUserId,
              )
              .filter((row) => {
                if (where.date === undefined) return true;
                if (where.date instanceof Date) return dateKey(row.date) === dateKey(where.date);
                return (
                  row.date.getTime() >= where.date.gte.getTime() &&
                  row.date.getTime() <= where.date.lte.getTime()
                );
              })
              .filter(
                (row) =>
                  where.placement === undefined ||
                  (typeof where.placement === 'string'
                    ? row.placement === where.placement
                    : where.placement.in.includes(row.placement)),
              )
              .filter(
                (row) =>
                  where.OR === undefined ||
                  where.OR.some(
                    (condition) =>
                      dateKey(row.date) === dateKey(condition.date) &&
                      row.placement === condition.placement,
                  ),
              )
              .sort((a, b) => a.date.getTime() - b.date.getTime() || a.slot - b.slot)
              .map((row) => ({
                ...row,
                parentUser: users.find((user) => user.id === row.parentUserId),
              })),
          ),
      ),
      deleteMany: vi.fn(
        ({
          where,
        }: {
          where:
            | { id: { in: string[] } }
            | {
                parentUserId: string;
                date: { gt: Date };
                placement: { in: StoredParentVolunteerDay['placement'][] };
              };
        }) => {
          const before = parentVolunteerDays.length;
          for (let index = parentVolunteerDays.length - 1; index >= 0; index -= 1) {
            const row = parentVolunteerDays[index];
            if (
              row &&
              ('id' in where
                ? where.id.in.includes(row.id)
                : row.parentUserId === where.parentUserId &&
                  row.date.getTime() > where.date.gt.getTime() &&
                  where.placement.in.includes(row.placement))
            ) {
              parentVolunteerDays.splice(index, 1);
            }
          }
          return Promise.resolve({ count: before - parentVolunteerDays.length });
        },
      ),
      createMany: vi.fn(
        ({
          data,
        }: {
          data: Pick<StoredParentVolunteerDay, 'parentUserId' | 'date' | 'placement' | 'slot'>[];
        }) => {
          const candidates = [...parentVolunteerDays, ...data];
          const duplicate = candidates.some((row, index) =>
            candidates.slice(index + 1).some(
              (other) =>
                (other.parentUserId === row.parentUserId &&
                  dateKey(other.date) === dateKey(row.date) &&
                  other.placement === row.placement) ||
                (dateKey(other.date) === dateKey(row.date) &&
                  other.placement === row.placement &&
                  other.slot === row.slot),
            ),
          );
          if (duplicate) throw new Error('duplicate parent volunteer day');

          parentVolunteerDays.push(
            ...data.map((row) => ({
              id: `parent_volunteer_${String(nextParentVolunteerDayId++)}`,
              createdAt: at('2026-04-29T09:00:00.000Z'),
              updatedAt: at('2026-04-29T09:00:00.000Z'),
              ...row,
            })),
          );
          return Promise.resolve({ count: data.length });
        },
      ),
    },
    shiftSwapRequest: {
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: {
            status: StoredSwap['status'];
            OR: { fromShiftId?: string; toShiftId?: string }[];
          };
        }) =>
          Promise.resolve(
            swaps.find(
              (swap) =>
                swap.status === where.status &&
                where.OR.some(
                  (condition) =>
                    condition.fromShiftId === swap.fromShiftId ||
                    condition.toShiftId === swap.toShiftId,
                ),
            ) ?? null,
          ),
      ),
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            status: StoredSwap['status'];
            OR?: { requesterUserId?: string; targetUserId?: string }[];
          };
        }) =>
          Promise.resolve(
            swaps
              .filter((swap) => swap.status === where.status)
              .filter(
                (swap) =>
                  where.OR === undefined ||
                  where.OR.some(
                    (condition) =>
                      condition.requesterUserId === swap.requesterUserId ||
                      condition.targetUserId === swap.targetUserId,
                  ),
              )
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

  return {
    db,
    users,
    availability,
    monthlyAvailability,
    parentVolunteerDays,
    shifts,
    swaps,
  };
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  const appRouter = router({ rota: rotaRouter });
  return appRouter.createCaller(makeTestContext({ db, user }));
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
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'availability windows must not overlap',
    });
  });

  it('lets full-admin users set their own weekly availability', async () => {
    const { db, availability } = makeFakeDb();

    await expect(
      makeCaller(headUser, db).rota.setMyAvailability({
        windows: [{ dayOfWeek: 3, startMinute: 600, endMinute: 900 }],
      }),
    ).resolves.toMatchObject([{ dayOfWeek: 3, startMinute: 600, endMinute: 900 }]);
    expect(availability).toHaveLength(1);
    expect(availability[0]).toMatchObject({ staffUserId: headUser.id });
  });

  it('allows ClubsAdmin users to use staff self-service workflows', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(clubsUser, db).rota.setMyAvailability({
        windows: [{ dayOfWeek: 4, startMinute: 600, endMinute: 780 }],
      }),
    ).resolves.toMatchObject([{ dayOfWeek: 4, startMinute: 600, endMinute: 780 }]);
  });

  it('denies non-staff roles from staff self-service workflows', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(parentUser, db).rota.myAvailability()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets staff replace exact-date monthly unavailability for a selected month', async () => {
    const { db, monthlyAvailability } = makeFakeDb();
    const caller = makeCaller(supervisorUser, db);

    await expect(
      caller.rota.setMyMonthlyAvailability({
        month: '2026-05',
        windows: [
          { date: '2026-05-06', startMinute: 540, endMinute: 720 },
          { date: '2026-05-20', startMinute: 0, endMinute: 1440 },
        ],
      }),
    ).resolves.toMatchObject([
      { date: '2026-05-06', startMinute: 540, endMinute: 720 },
      { date: '2026-05-20', startMinute: 0, endMinute: 1440 },
    ]);
    expect(monthlyAvailability).toHaveLength(2);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'Update',
        entity: 'StaffMonthlyAvailability',
        entityId: supervisorUser.id,
        meta: {
          month: '2026-05',
          windowCount: 2,
          source: 'rota.setMyMonthlyAvailability',
        },
      },
    });

    await expect(caller.rota.myMonthlyAvailability({ month: '2026-05' })).resolves.toMatchObject([
      { date: '2026-05-06', startMinute: 540, endMinute: 720 },
      { date: '2026-05-20', startMinute: 0, endMinute: 1440 },
    ]);
  });

  it('rejects monthly unavailability outside the month or overlapping on the same date', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(supervisorUser, db);

    await expect(
      caller.rota.setMyMonthlyAvailability({
        month: '2026-05',
        windows: [{ date: '2026-06-01', startMinute: 540, endMinute: 720 }],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'monthly unavailability dates must be inside the selected month',
    });

    await expect(
      caller.rota.setMyMonthlyAvailability({
        month: '2026-05',
        windows: [
          { date: '2026-05-06', startMinute: 540, endMinute: 720 },
          { date: '2026-05-06', startMinute: 700, endMinute: 840 },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'monthly unavailability windows must not overlap',
    });
  });
});

describe('parent volunteer days', () => {
  type AnyParentVolunteerSlots = Awaited<
    ReturnType<ReturnType<typeof makeCaller>['rota']['parentVolunteerSlots']>
  >;
  type ParentVolunteerSlots = Extract<AnyParentVolunteerSlots, { scope: 'parent' }>;
  type ParentVolunteerTerm = ParentVolunteerSlots['terms'][number];

  function firstAvailableParentVolunteerTerm(slots: AnyParentVolunteerSlots): ParentVolunteerTerm {
    if (slots.scope !== 'parent') throw new Error('Expected parent volunteer scope');
    const term = slots.terms[0];
    if (!term) throw new Error('Expected an available parent volunteer term');
    return term;
  }

  async function grantedStaffVolunteerSelection(db: FakeDb, users: StoredUser[]) {
    const supervisor = users.find((user) => user.id === supervisorUser.id);
    if (!supervisor) throw new Error('Expected supervisor fixture');
    supervisor.staffParentVolunteerAccess = true;
    const staffCaller = makeCaller(supervisorUser, db);
    const staffSlots = await staffCaller.rota.parentVolunteerSlots();
    const term = staffSlots.terms[0];
    const lunchDate = term?.lunchAndClubs.primary.days[0]?.date;
    if (!term || !lunchDate) throw new Error('Expected an available staff volunteer day');
    return { lunchDate, staffCaller, supervisor, term };
  }

  it('lists only eligible staff access recipients and limits management to Head and Technical Support', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(headUser, db).rota.listStaffParentVolunteerAccess()).resolves.toEqual([
      expect.objectContaining({ id: clubsLeadUser.id, childCount: 1, enabled: false }),
      expect.objectContaining({ id: supervisorUser.id, childCount: 1, enabled: false }),
    ]);
    expect(db.$enc.decrypt).toHaveBeenCalledTimes(2);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'StaffParentVolunteerAccess',
        meta: { count: 2, source: 'rota.listStaffParentVolunteerAccess' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);

    db.$enc.decrypt.mockClear();
    db.auditLog.create.mockClear();
    await expect(
      makeCaller(principalUser, db).rota.listStaffParentVolunteerAccess(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.$enc.decrypt).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();

    await expect(
      makeCaller(technicalSupportUser, db).rota.setStaffParentVolunteerAccess({
        userId: clubsLeadUser.id,
        enabled: true,
      }),
    ).resolves.toMatchObject({ id: clubsLeadUser.id, childCount: 1, enabled: true });
    for (const user of [parentUser, secondSupervisorUser, inactiveSupervisorUser]) {
      await expect(
        makeCaller(headUser, db).rota.setStaffParentVolunteerAccess({
          userId: user.id,
          enabled: true,
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
  });

  it('does not audit a manager list read when a staff name cannot be decrypted', async () => {
    const { db } = makeFakeDb();
    db.$enc.decrypt.mockReturnValueOnce(null);

    await expect(makeCaller(headUser, db).rota.listStaffParentVolunteerAccess()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'user PII decrypt failed',
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an access change when the target loses eligibility before the transaction writes', async () => {
    const { db, users } = makeFakeDb();
    const supervisor = users.find((user) => user.id === supervisorUser.id);
    if (!supervisor) throw new Error('Expected supervisor fixture');
    db.$transaction.mockImplementationOnce(async (fn: (tx: FakeDb) => Promise<unknown>) => {
      supervisor.activeChildCount = 0;
      return fn(db);
    });

    await expect(
      makeCaller(headUser, db).rota.setStaffParentVolunteerAccess({
        userId: supervisorUser.id,
        enabled: true,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Staff parent volunteer access can only be changed for eligible staff',
    });
    expect(supervisor.staffParentVolunteerAccess).toBe(false);
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.$queryRaw.mock.calls[0]?.slice(1)).toEqual([supervisorUser.id, false]);
  });

  it('does not let an in-flight staff booking recreate a reservation after revocation commits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
    try {
      const { db, users, parentVolunteerDays } = makeFakeDb();
      const supervisor = users.find((user) => user.id === supervisorUser.id);
      if (!supervisor) throw new Error('Expected supervisor fixture');
      supervisor.staffParentVolunteerAccess = true;

      const staffCaller = makeCaller(supervisorUser, db);
      const staffSlots = await staffCaller.rota.parentVolunteerSlots();
      const term = staffSlots.terms[0];
      const lunchDate = term?.lunchAndClubs.primary.days.find(
        (candidate) => candidate.date === '2026-09-04',
      )?.date;
      if (!term || !lunchDate) throw new Error('Expected an available staff volunteer day');

      let signalBookingTransaction: (() => void) | undefined;
      const bookingTransactionEntered = new Promise<void>((resolve) => {
        signalBookingTransaction = resolve;
      });
      let resumeBookingTransaction: (() => void) | undefined;
      const bookingTransactionResume = new Promise<void>((resolve) => {
        resumeBookingTransaction = resolve;
      });
      let transactionCount = 0;
      db.$transaction.mockImplementation(async (fn: (tx: FakeDb) => Promise<unknown>) => {
        transactionCount += 1;
        if (transactionCount === 1) {
          signalBookingTransaction?.();
          await bookingTransactionResume;
        }
        return fn(db);
      });

      const inFlightBooking = staffCaller.rota.setMyParentVolunteerDays({
        termId: term.id,
        primaryLunchAndClubsDates: [lunchDate],
      });
      await bookingTransactionEntered;

      await makeCaller(headUser, db).rota.setStaffParentVolunteerAccess({
        userId: supervisorUser.id,
        enabled: false,
      });
      expect(supervisor.staffParentVolunteerAccess).toBe(false);

      resumeBookingTransaction?.();
      await expect(inFlightBooking).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'parent volunteer access is not available',
      });
      expect(
        parentVolunteerDays.filter(
          (row) => row.parentUserId === supervisorUser.id && dateKey(row.date) === lunchDate,
        ),
      ).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a staff booking when the last active child is lost inside the transaction before locking', async () => {
    const { db, users, parentVolunteerDays } = makeFakeDb();
    const { lunchDate, staffCaller, supervisor, term } = await grantedStaffVolunteerSelection(
      db,
      users,
    );
    db.$transaction.mockImplementationOnce(async (fn: (tx: FakeDb) => Promise<unknown>) => {
      supervisor.activeChildCount = 0;
      return fn(db);
    });

    await expect(
      staffCaller.rota.setMyParentVolunteerDays({
        termId: term.id,
        primaryLunchAndClubsDates: [lunchDate],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'parent volunteer access is not available',
    });
    expect(parentVolunteerDays).toHaveLength(0);
  });

  it('locks the eligible user, guardian, and active student with parameterized staff inputs', async () => {
    const { db, users } = makeFakeDb();
    const { lunchDate, staffCaller, term } = await grantedStaffVolunteerSelection(db, users);

    await staffCaller.rota.setMyParentVolunteerDays({
      termId: term.id,
      primaryLunchAndClubsDates: [lunchDate],
    });

    const lockCall = db.$queryRaw.mock.calls[0];
    const lockSql = ((lockCall?.[0] as readonly string[] | undefined) ?? [])
      .join('?')
      .replace(/\s+/gu, ' ')
      .trim();
    expect(lockCall?.slice(1)).toEqual([supervisorUser.id, true]);
    expect(lockSql).toContain('FOR UPDATE OF eligible_user, guardian_link, active_student');
  });

  it('does not change staff account metadata when volunteer days are saved', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
    try {
      const { db, users } = makeFakeDb();
      const { lunchDate, staffCaller, supervisor, term } = await grantedStaffVolunteerSelection(
        db,
        users,
      );
      const accountUpdatedAt = supervisor.updatedAt;

      await staffCaller.rota.setMyParentVolunteerDays({
        termId: term.id,
        primaryLunchAndClubsDates: [lunchDate],
      });

      expect(supervisor.updatedAt).toEqual(accountUpdatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives granted staff Lunch and Clubs only, blocks a crafted Centre request, and revokes future reservations', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
    try {
      const { db, parentVolunteerDays } = makeFakeDb();
      await makeCaller(headUser, db).rota.setStaffParentVolunteerAccess({
        userId: supervisorUser.id,
        enabled: true,
      });

      const staffCaller = makeCaller(supervisorUser, db);
      const staffSlots = await staffCaller.rota.parentVolunteerSlots();
      expect(staffSlots.scope).toBe('staff');
      expect(staffSlots.terms[0]).not.toHaveProperty('centreVolunteer');
      const term = staffSlots.terms[0];
      if (!term) throw new Error('Expected an available staff volunteer term');
      const lunchDate = term.lunchAndClubs.primary.days.find(
        (day) => day.date === '2026-09-04',
      )?.date;
      if (!lunchDate) throw new Error('Expected an available lunch and clubs day');

      await expect(
        staffCaller.rota.setMyParentVolunteerDays({
          termId: term.id,
          centreDates: [lunchDate],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await staffCaller.rota.setMyParentVolunteerDays({
        termId: term.id,
        primaryLunchAndClubsDates: [lunchDate],
      });

      parentVolunteerDays.push(
        {
          id: 'past_lunch_reservation',
          parentUserId: supervisorUser.id,
          date: day('2026-09-01'),
          placement: 'LunchAndClubsSecondary',
          slot: 1,
          createdAt: day('2026-09-01'),
          updatedAt: day('2026-09-01'),
        },
        {
          id: 'future_lunch_reservation',
          parentUserId: supervisorUser.id,
          date: day('2026-09-03'),
          placement: 'LunchAndClubsPrimary',
          slot: 1,
          createdAt: day('2026-09-01'),
          updatedAt: day('2026-09-01'),
        },
      );

      await makeCaller(headUser, db).rota.setStaffParentVolunteerAccess({
        userId: supervisorUser.id,
        enabled: false,
      });
      expect(db.user.update.mock.invocationCallOrder.at(-1)).toBeLessThan(
        db.parentVolunteerDay.deleteMany.mock.invocationCallOrder.at(-1) ?? 0,
      );
      expect(
        parentVolunteerDays.filter(
          (row) =>
            row.parentUserId === supervisorUser.id &&
            row.placement !== 'Centre' &&
            row.date.getTime() > day('2026-09-02').getTime(),
        ),
      ).toHaveLength(0);
      expect(
        parentVolunteerDays.filter(
          (row) => row.parentUserId === supervisorUser.id && dateKey(row.date) === '2026-09-01',
        ),
      ).toHaveLength(1);
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: headUser.id,
          action: 'Update',
          entity: 'StaffParentVolunteerAccess',
          entityId: supervisorUser.id,
          meta: {
            enabled: false,
            releasedReservationCount: 2,
            source: 'rota.setStaffParentVolunteerAccess',
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rechecks a granted staff member’s active child link on every volunteer request', async () => {
    const { db, users } = makeFakeDb();
    await makeCaller(headUser, db).rota.setStaffParentVolunteerAccess({
      userId: supervisorUser.id,
      enabled: true,
    });
    await expect(makeCaller(supervisorUser, db).rota.parentVolunteerSlots()).resolves.toMatchObject(
      {
        scope: 'staff',
      },
    );

    const supervisor = users.find((user) => user.id === supervisorUser.id);
    if (!supervisor) throw new Error('Expected supervisor fixture');
    supervisor.activeChildCount = 0;

    await expect(makeCaller(supervisorUser, db).rota.parentVolunteerSlots()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    supervisor.activeChildCount = 1;
    supervisor.active = false;
    await expect(makeCaller(supervisorUser, db).rota.parentVolunteerSlots()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('keeps parent selections private and separates centre, Primary, and Secondary capacity', async () => {
    const { db, parentVolunteerDays } = makeFakeDb();
    const parentCaller = makeCaller(parentUser, db);

    const initialSlots = await parentCaller.rota.parentVolunteerSlots();
    const initialTerm = firstAvailableParentVolunteerTerm(initialSlots);
    const [firstDay, secondDay] = initialTerm.centreVolunteer.days;
    if (!firstDay || !secondDay) throw new Error('Expected at least two parent volunteer days');
    const firstDate = firstDay.date;
    const secondDate = secondDay.date;
    expect(initialTerm).toMatchObject({
      centreVolunteer: { dailyCapacity: 2 },
      lunchAndClubs: {
        primary: { dailyCapacity: 3 },
        secondary: { dailyCapacity: 2 },
      },
    });
    expect(initialTerm.from).toBe(firstDate);
    expect(initialTerm.centreVolunteer.days[0]).toMatchObject({ date: firstDate });
    expect(initialTerm.centreVolunteer.days[0]).not.toHaveProperty('parent');
    expect(initialTerm.lunchAndClubs.primary.days[0]).not.toHaveProperty('volunteers');

    const parentSelection = firstAvailableParentVolunteerTerm(
      await parentCaller.rota.setMyParentVolunteerDays({
        termId: initialTerm.id,
        centreDates: [firstDate, secondDate],
        primaryLunchAndClubsDates: [firstDate],
        secondaryLunchAndClubsDates: [],
      }),
    );
    expect(
      parentSelection.centreVolunteer.days.find((slot) => slot.date === firstDate),
    ).toMatchObject({
      selected: true,
      spacesRemaining: 1,
      status: 'Selected',
    });
    expect(
      parentSelection.centreVolunteer.days.find((slot) => slot.date === secondDate),
    ).toMatchObject({
      selected: true,
      spacesRemaining: 1,
      status: 'Selected',
    });
    expect(
      parentSelection.lunchAndClubs.primary.days.find((slot) => slot.date === firstDate),
    ).toMatchObject({ selected: true, spacesRemaining: 2, status: 'Selected' });

    const secondParentSelection = firstAvailableParentVolunteerTerm(
      await makeCaller(secondParentUser, db).rota.setMyParentVolunteerDays({
        termId: initialTerm.id,
        centreDates: [firstDate],
        primaryLunchAndClubsDates: [firstDate],
        secondaryLunchAndClubsDates: [secondDate],
      }),
    );
    expect(
      secondParentSelection.centreVolunteer.days.find((slot) => slot.date === firstDate),
    ).toMatchObject({
      selected: true,
      spacesRemaining: 0,
      status: 'Selected',
    });
    await expect(
      makeCaller(thirdParentUser, db).rota.setMyParentVolunteerDays({
        termId: initialTerm.id,
        centreDates: [firstDate],
        primaryLunchAndClubsDates: [],
        secondaryLunchAndClubsDates: [],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: `${firstDate} already has no centre volunteer spaces`,
    });

    const thirdParentSelection = firstAvailableParentVolunteerTerm(
      await makeCaller(thirdParentUser, db).rota.setMyParentVolunteerDays({
        termId: initialTerm.id,
        centreDates: [],
        primaryLunchAndClubsDates: [firstDate],
        secondaryLunchAndClubsDates: [secondDate],
      }),
    );
    expect(
      thirdParentSelection.lunchAndClubs.primary.days.find((slot) => slot.date === firstDate),
    ).toMatchObject({ selected: true, spacesRemaining: 0, status: 'Selected' });
    expect(
      thirdParentSelection.lunchAndClubs.secondary.days.find((slot) => slot.date === secondDate),
    ).toMatchObject({ selected: true, spacesRemaining: 0, status: 'Selected' });
    expect(parentVolunteerDays).toHaveLength(8);

    const updatedParentSelection = firstAvailableParentVolunteerTerm(
      await parentCaller.rota.setMyParentVolunteerDays({
        termId: initialTerm.id,
        centreDates: [secondDate],
        primaryLunchAndClubsDates: [firstDate],
        secondaryLunchAndClubsDates: [],
      }),
    );
    expect(
      updatedParentSelection.centreVolunteer.days.find((slot) => slot.date === firstDate),
    ).toMatchObject({
      selected: false,
      spacesRemaining: 1,
      status: 'Available',
    });
    expect(
      updatedParentSelection.centreVolunteer.days.find((slot) => slot.date === secondDate),
    ).toMatchObject({
      selected: true,
      spacesRemaining: 1,
      status: 'Selected',
    });

    const scheduleStart = new Date(`${firstDate}T00:00:00.000Z`);
    const scheduleEnd = new Date(scheduleStart);
    scheduleEnd.setUTCDate(scheduleEnd.getUTCDate() + 13);
    const scheduleInput = { from: scheduleStart, to: scheduleEnd };
    for (const user of [headUser, technicalSupportUser]) {
      const volunteerSchedule = await makeCaller(user, db).rota.parentVolunteerSchedule(
        scheduleInput,
      );
      expect(volunteerSchedule).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: firstDate,
            placement: 'LunchAndClubsPrimary',
            parent: { id: secondParentUser.id, fullName: 'Second Parent' },
          }),
          expect.objectContaining({
            date: secondDate,
            placement: 'LunchAndClubsSecondary',
            parent: { id: thirdParentUser.id, fullName: 'Third Parent' },
          }),
        ]),
      );
    }
  });

  it('preserves other volunteer placements when a parent saves one card', async () => {
    const { db } = makeFakeDb();
    const parentCaller = makeCaller(parentUser, db);
    const initialTerm = firstAvailableParentVolunteerTerm(
      await parentCaller.rota.parentVolunteerSlots(),
    );
    const [firstDay, secondDay] = initialTerm.centreVolunteer.days;
    if (!firstDay || !secondDay) throw new Error('Expected at least two parent volunteer days');
    const firstDate = firstDay.date;
    const secondDate = secondDay.date;

    await parentCaller.rota.setMyParentVolunteerDays({
      termId: initialTerm.id,
      centreDates: [firstDate],
      primaryLunchAndClubsDates: [secondDate],
      secondaryLunchAndClubsDates: [],
    });

    const centreUpdate = firstAvailableParentVolunteerTerm(
      await parentCaller.rota.setMyParentVolunteerDays({
        termId: initialTerm.id,
        centreDates: [secondDate],
      }),
    );
    expect(centreUpdate.centreVolunteer.days.find((slot) => slot.date === firstDate)).toMatchObject(
      { selected: false },
    );
    expect(
      centreUpdate.centreVolunteer.days.find((slot) => slot.date === secondDate),
    ).toMatchObject({ selected: true });
    expect(
      centreUpdate.lunchAndClubs.primary.days.find((slot) => slot.date === secondDate),
    ).toMatchObject({ selected: true });

    const lunchAndClubsUpdate = firstAvailableParentVolunteerTerm(
      await parentCaller.rota.setMyParentVolunteerDays({
        termId: initialTerm.id,
        primaryLunchAndClubsDates: [],
        secondaryLunchAndClubsDates: [firstDate],
      }),
    );
    expect(
      lunchAndClubsUpdate.centreVolunteer.days.find((slot) => slot.date === secondDate),
    ).toMatchObject({ selected: true });
    expect(
      lunchAndClubsUpdate.lunchAndClubs.primary.days.find((slot) => slot.date === secondDate),
    ).toMatchObject({ selected: false });
    expect(
      lunchAndClubsUpdate.lunchAndClubs.secondary.days.find((slot) => slot.date === firstDate),
    ).toMatchObject({ selected: true });
  });

  it('limits volunteering to parents and to the available term', async () => {
    const { db } = makeFakeDb();
    const parentCaller = makeCaller(parentUser, db);
    const term = firstAvailableParentVolunteerTerm(await parentCaller.rota.parentVolunteerSlots());
    const beforeTerm = new Date(`${term.from}T00:00:00.000Z`);
    beforeTerm.setUTCDate(beforeTerm.getUTCDate() - 1);

    await expect(makeCaller(supervisorUser, db).rota.parentVolunteerSlots()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      parentCaller.rota.setMyParentVolunteerDays({
        termId: term.id,
        centreDates: [dateKey(beforeTerm)],
        primaryLunchAndClubsDates: [],
        secondaryLunchAndClubsDates: [],
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Volunteer days must be within an available term',
    });
    await expect(
      makeCaller(parentUser, db).rota.parentVolunteerSchedule({
        from: new Date(`${term.from}T00:00:00.000Z`),
        to: new Date(`${term.from}T00:00:00.000Z`),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('shows the full current term and opens the next term seven days before it starts', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
      const { db } = makeFakeDb();
      const caller = makeCaller(parentUser, db);

      const beforeOpeningSlots = await caller.rota.parentVolunteerSlots();
      expect(beforeOpeningSlots.terms.map((term) => term.id)).toEqual(['2026-Summer']);
      const summerTerm = firstAvailableParentVolunteerTerm(beforeOpeningSlots);
      expect(summerTerm).toMatchObject({ from: '2026-04-13', to: '2026-07-20' });
      expect(summerTerm.centreVolunteer.days.at(0)).toMatchObject({ date: '2026-04-13' });
      expect(summerTerm.centreVolunteer.days.at(-1)).toMatchObject({ date: '2026-07-20' });

      await expect(
        caller.rota.setMyParentVolunteerDays({
          termId: '2026-Autumn',
          centreDates: ['2026-09-01'],
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Volunteer term is not currently available',
      });

      vi.setSystemTime(new Date('2026-08-25T12:00:00.000Z'));

      const openingDaySlots = await caller.rota.parentVolunteerSlots();
      if (openingDaySlots.scope !== 'parent') throw new Error('Expected parent volunteer scope');
      expect(openingDaySlots.terms.map((term) => term.id)).toEqual(['2026-Summer', '2026-Autumn']);
      const autumnTerm = openingDaySlots.terms[1];
      expect(autumnTerm).toMatchObject({ from: '2026-09-01', to: '2026-12-18' });
      expect(autumnTerm?.centreVolunteer.days.at(0)).toMatchObject({ date: '2026-09-01' });
      expect(autumnTerm?.centreVolunteer.days.at(-1)).toMatchObject({ date: '2026-12-18' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('rota scheduling', () => {
  it('lists active staff candidates with decrypted display fields for full-admin users', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(headUser, db).rota.listStaff()).resolves.toEqual([
      {
        id: clubsUser.id,
        role: 'ClubsAdmin',
        fullName: 'Clubs User',
        email: 'clubs@example.test',
      },
      { id: headUser.id, role: 'Head', fullName: 'Head User', email: 'head@example.test' },
      {
        id: secondSupervisorUser.id,
        role: 'Supervisor',
        fullName: 'Supervisor Two',
        email: 'sup2@example.test',
      },
      {
        id: supervisorUser.id,
        role: 'Supervisor',
        fullName: 'Supervisor One',
        email: 'sup@example.test',
      },
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 4, source: 'rota.listStaff' },
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
      makeCaller(supervisorUser, db).rota.weekSchedule({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets staff read the active team schedule', async () => {
    const { db, users, shifts } = makeFakeDb();
    const head = makeCaller(headUser, db);
    await head.rota.createShift({
      staffUserId: supervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T09:00:00.000Z'),
      endsAt: at('2026-04-29T12:00:00.000Z'),
      notes: 'Morning group',
    });
    await head.rota.createShift({
      staffUserId: secondSupervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T13:00:00.000Z'),
      endsAt: at('2026-04-29T16:00:00.000Z'),
    });
    users.push({
      id: 'u_inactive_sup',
      role: 'Supervisor',
      active: false,
      staffParentVolunteerAccess: false,
      activeChildCount: 0,
      fullNameEnc: 'enc:Inactive Supervisor',
      emailEnc: 'enc:inactive@example.test',
      createdAt: at('2026-04-25T09:00:00.000Z'),
      updatedAt: at('2026-04-25T09:00:00.000Z'),
    });
    shifts.push({
      id: 'shift_inactive',
      staffUserId: 'u_inactive_sup',
      kind: 'Cover',
      yearGroupBandId: 'band_lower',
      date: day('2026-04-29'),
      startsAt: at('2026-04-29T17:00:00.000Z'),
      endsAt: at('2026-04-29T18:00:00.000Z'),
      notes: null,
      createdAt: at('2026-04-29T10:00:00.000Z'),
      updatedAt: at('2026-04-29T10:00:00.000Z'),
    });

    await expect(
      makeCaller(supervisorUser, db).rota.teamSchedule({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).resolves.toMatchObject([
      {
        id: 'shift_1',
        staff: { fullName: 'Supervisor One' },
        notes: 'Morning group',
      },
      {
        id: 'shift_2',
        staff: { fullName: 'Supervisor Two' },
      },
    ]);
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'DecryptPii',
        entity: 'StaffShift',
        meta: { count: 2, source: 'rota.teamSchedule' },
      },
    });

    await expect(
      makeCaller(parentUser, db).rota.teamSchedule({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).rota.teamSchedule({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets full-admin read active staff availability and excludes inactive or non-staff users', async () => {
    const { db, users, availability } = makeFakeDb();
    users.push({
      id: 'u_inactive_sup',
      role: 'Supervisor',
      active: false,
      staffParentVolunteerAccess: false,
      activeChildCount: 0,
      fullNameEnc: 'enc:Inactive Supervisor',
      emailEnc: 'enc:inactive@example.test',
      createdAt: at('2026-04-25T09:00:00.000Z'),
      updatedAt: at('2026-04-25T09:00:00.000Z'),
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
    expect(rows.map((row) => row.id)).toEqual([
      clubsUser.id,
      headUser.id,
      secondSupervisorUser.id,
      supervisorUser.id,
    ]);
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
        meta: { count: 4, source: 'rota.staffAvailability' },
      },
    });

    await expect(makeCaller(supervisorUser, db).rota.staffAvailability()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets full-admin read active staff monthly unavailability for a date range', async () => {
    const { db, users, monthlyAvailability } = makeFakeDb();
    users.push({
      id: 'u_inactive_sup',
      role: 'Supervisor',
      active: false,
      staffParentVolunteerAccess: false,
      activeChildCount: 0,
      fullNameEnc: 'enc:Inactive Supervisor',
      emailEnc: 'enc:inactive@example.test',
      createdAt: at('2026-04-25T09:00:00.000Z'),
      updatedAt: at('2026-04-25T09:00:00.000Z'),
    });
    monthlyAvailability.push(
      {
        id: 'monthly_1',
        staffUserId: supervisorUser.id,
        date: day('2026-05-06'),
        startMinute: 540,
        endMinute: 720,
        createdAt: at('2026-04-29T09:00:00.000Z'),
        updatedAt: at('2026-04-29T09:00:00.000Z'),
      },
      {
        id: 'monthly_2',
        staffUserId: supervisorUser.id,
        date: day('2026-05-20'),
        startMinute: 540,
        endMinute: 720,
        createdAt: at('2026-04-29T09:00:00.000Z'),
        updatedAt: at('2026-04-29T09:00:00.000Z'),
      },
      {
        id: 'monthly_inactive',
        staffUserId: 'u_inactive_sup',
        date: day('2026-05-06'),
        startMinute: 540,
        endMinute: 720,
        createdAt: at('2026-04-29T09:00:00.000Z'),
        updatedAt: at('2026-04-29T09:00:00.000Z'),
      },
    );

    const rows = await makeCaller(headUser, db).rota.staffMonthlyAvailability({
      from: day('2026-05-01'),
      to: day('2026-05-10'),
    });
    expect(rows.find((row) => row.id === supervisorUser.id)).toMatchObject({
      fullName: 'Supervisor One',
      availability: [{ date: '2026-05-06', startMinute: 540, endMinute: 720 }],
    });
    expect(rows.some((row) => row.id === 'u_inactive_sup')).toBe(false);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'StaffMonthlyAvailability',
        meta: { count: 4, source: 'rota.staffMonthlyAvailability' },
      },
    });

    await expect(
      makeCaller(supervisorUser, db).rota.staffMonthlyAvailability({
        from: day('2026-05-01'),
        to: day('2026-05-10'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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
          kind: 'Cover',
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
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'supervisor shift overlaps an existing shift',
    });

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
      makeCaller(supervisorUser, db).rota.myRota({
        from: day('2026-04-29'),
        to: day('2026-04-29'),
      }),
    ).resolves.toHaveLength(1);
  });

  it('supports meeting shifts without a year-group band and validates cover shift bands', async () => {
    const { db } = makeFakeDb();
    const head = makeCaller(headUser, db);

    await expect(
      head.rota.createShift({
        staffUserId: supervisorUser.id,
        kind: 'Meeting',
        date: day('2026-04-29'),
        startsAt: at('2026-04-29T09:00:00.000Z'),
        endsAt: at('2026-04-29T10:00:00.000Z'),
        notes: 'Safeguarding review',
      }),
    ).resolves.toMatchObject({
      id: 'shift_1',
      kind: 'Meeting',
      yearGroupBandId: null,
      bandName: null,
      bandColour: null,
    });

    await expect(
      head.rota.createShift({
        staffUserId: supervisorUser.id,
        kind: 'Cover',
        date: day('2026-04-30'),
        startsAt: at('2026-04-30T09:00:00.000Z'),
        endsAt: at('2026-04-30T10:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'cover shifts require a year-group band',
    });

    await expect(
      head.rota.updateShift({
        id: 'shift_1',
        kind: 'Cover',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'cover shifts require a year-group band',
    });
  });

  it('lets full-admin delete shifts unless a pending swap references the shift', async () => {
    const { db, shifts, swaps } = makeFakeDb();
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
      date: day('2026-04-30'),
      startsAt: at('2026-04-30T09:00:00.000Z'),
      endsAt: at('2026-04-30T12:00:00.000Z'),
    });
    swaps.push({
      id: 'swap_pending',
      requesterUserId: supervisorUser.id,
      targetUserId: secondSupervisorUser.id,
      fromShiftId: 'shift_2',
      toShiftId: 'shift_1',
      status: 'Pending',
      approvedById: null,
      reviewedAt: null,
      createdAt: at('2026-04-29T12:00:00.000Z'),
      updatedAt: at('2026-04-29T12:00:00.000Z'),
    });

    await expect(head.rota.deleteShift({ id: 'shift_2' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'shift has a pending swap request',
    });
    await expect(head.rota.deleteShift({ id: 'shift_1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'shift has a pending swap request',
    });

    const pendingSwap = swaps[0];
    if (!pendingSwap) throw new Error('expected pending swap');
    swaps[0] = { ...pendingSwap, status: 'Rejected' };
    await expect(head.rota.deleteShift({ id: 'shift_1' })).resolves.toEqual({ id: 'shift_1' });
    expect(shifts.map((shift) => shift.id)).toEqual(['shift_2']);
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        userId: headUser.id,
        action: 'Delete',
        entity: 'StaffShift',
        entityId: 'shift_1',
        meta: {
          staffUserId: supervisorUser.id,
          date: '2026-04-29',
          source: 'rota.deleteShift',
        },
      },
    });
  });
});

describe('rota shift swaps', () => {
  it('lets staff read swap candidates without returning their own shifts', async () => {
    const { db } = makeFakeDb();
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

    await expect(
      makeCaller(supervisorUser, db).rota.swapCandidates({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).resolves.toMatchObject([
      {
        id: 'shift_2',
        staffUserId: secondSupervisorUser.id,
        date: '2026-04-29',
        bandName: 'Lower Primary',
        bandColour: '#5B90C5',
        staff: {
          id: secondSupervisorUser.id,
          role: 'Supervisor',
          fullName: 'Supervisor Two',
          email: 'sup2@example.test',
        },
      },
    ]);
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'DecryptPii',
        entity: 'StaffShift',
        meta: { count: 1, source: 'rota.swapCandidates' },
      },
    });

    await expect(
      makeCaller(headUser, db).rota.swapCandidates({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).resolves.toHaveLength(2);
    await expect(
      makeCaller(parentUser, db).rota.swapCandidates({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).rota.swapCandidates({
        from: day('2026-04-27'),
        to: day('2026-05-03'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

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

  it('lets staff list only their own pending shift swap requests', async () => {
    const { db } = makeFakeDb();
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
    await head.rota.createShift({
      staffUserId: headUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-04-30'),
      startsAt: at('2026-04-30T09:00:00.000Z'),
      endsAt: at('2026-04-30T12:00:00.000Z'),
    });
    await head.rota.createShift({
      staffUserId: secondSupervisorUser.id,
      yearGroupBandId: 'band_lower',
      date: day('2026-05-01'),
      startsAt: at('2026-05-01T09:00:00.000Z'),
      endsAt: at('2026-05-01T12:00:00.000Z'),
    });
    await makeCaller(supervisorUser, db).rota.requestSwap({
      fromShiftId: 'shift_1',
      toShiftId: 'shift_2',
    });
    await makeCaller(secondSupervisorUser, db).rota.requestSwap({
      fromShiftId: 'shift_4',
      toShiftId: 'shift_3',
    });

    await expect(makeCaller(supervisorUser, db).rota.mySwapRequests()).resolves.toMatchObject([
      {
        id: 'swap_1',
        direction: 'Requested',
        requester: { fullName: 'Supervisor One' },
        targetUser: { fullName: 'Supervisor Two' },
        fromShift: { id: 'shift_1', bandName: 'Lower Primary' },
        toShift: { id: 'shift_2', bandName: 'Lower Primary' },
      },
    ]);
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'DecryptPii',
        entity: 'ShiftSwapRequest',
        meta: { count: 1, source: 'rota.mySwapRequests' },
      },
    });

    await expect(makeCaller(parentUser, db).rota.mySwapRequests()).rejects.toMatchObject({
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
    expect(shifts.find((shift) => shift.id === 'shift_1')).toMatchObject({
      staffUserId: supervisorUser.id,
    });
    expect(shifts.find((shift) => shift.id === 'shift_2')).toMatchObject({
      staffUserId: secondSupervisorUser.id,
    });

    await expect(head.rota.approveSwap({ id: 'swap_1' })).resolves.toMatchObject({
      id: 'swap_1',
      status: 'Approved',
      approvedById: headUser.id,
    });
    expect(shifts.find((shift) => shift.id === 'shift_1')).toMatchObject({
      staffUserId: secondSupervisorUser.id,
    });
    expect(shifts.find((shift) => shift.id === 'shift_2')).toMatchObject({
      staffUserId: supervisorUser.id,
    });
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
    expect(shifts.find((shift) => shift.id === 'shift_1')).toMatchObject({
      staffUserId: supervisorUser.id,
    });
    expect(shifts.find((shift) => shift.id === 'shift_2')).toMatchObject({
      staffUserId: secondSupervisorUser.id,
    });
  });
});
