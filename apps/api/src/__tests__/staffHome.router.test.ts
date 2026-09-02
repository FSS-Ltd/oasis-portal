import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { staffHomeRouter } from '../routers/staffHome.js';
import { router } from '../trpc.js';

const supervisorUser: SessionUser = {
  id: 'staff_home_supervisor',
  role: 'Supervisor',
  tags: ['shopkeeper', 'club-lead'],
  requires2fa: false,
};

const parentUser: SessionUser = {
  id: 'staff_home_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function at(value: string): Date {
  return new Date(value);
}

interface StaffNoticeFindManyArgs {
  where: {
    active: boolean;
    audience: { in: Array<'Supervisors' | 'Both'> };
  };
}

function makeFakeDb() {
  const db = {
    auditLog: { create: vi.fn() },
    yearGroupBand: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    staffShift: {
      findMany: vi.fn((args: { where: { date?: Date | { gte: Date; lte: Date } } }) => {
        if (args.where.date instanceof Date) {
          return Promise.resolve([
            {
              yearGroupBand: {
                active: true,
                colour: '#5B90C5',
                id: 'band_upper',
                name: 'Upper Primary',
                standardYears: ['Year 5', 'Year 6'],
              },
            },
          ]);
        }

        return Promise.resolve([
          {
            id: 'shift_today',
            kind: 'Cover',
            yearGroupBandId: 'band_upper',
            date: day('2026-04-25'),
            startsAt: at('2026-04-25T09:00:00.000Z'),
            endsAt: at('2026-04-25T12:00:00.000Z'),
            notes: null,
            yearGroupBand: { name: 'Upper Primary', colour: '#5B90C5' },
          },
          {
            id: 'shift_later',
            kind: 'Meeting',
            yearGroupBandId: null,
            date: day('2026-04-27'),
            startsAt: at('2026-04-27T13:00:00.000Z'),
            endsAt: at('2026-04-27T14:00:00.000Z'),
            notes: null,
            yearGroupBand: null,
          },
        ]);
      }),
    },
    student: {
      findMany: vi.fn(() =>
        Promise.resolve([
          { id: 'student_1', attendance: [{ status: 'Present' }] },
          { id: 'student_2', attendance: [{ status: 'Late' }] },
          { id: 'student_3', attendance: [] },
        ]),
      ),
    },
    shiftSwapRequest: {
      count: vi.fn(() => Promise.resolve(2)),
    },
    behaviourEntry: {
      count: vi.fn(() => Promise.resolve(3)),
    },
    paceRecord: {
      count: vi.fn(() => Promise.resolve(4)),
    },
    staffNotice: {
      findMany: vi.fn((args: StaffNoticeFindManyArgs) => {
        void args;
        return Promise.resolve([
          { id: 'notice_read', reads: [{ userId: supervisorUser.id }] },
          { id: 'notice_unread', reads: [] },
        ]);
      }),
    },
    shopReservation: {
      count: vi.fn(() => Promise.resolve(5)),
    },
    clubLeadAssignment: {
      count: vi.fn(() => Promise.resolve(2)),
    },
  };

  return db;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const app = router({ staffHome: staffHomeRouter });
  const ctx = {
    db: db as unknown as AppContext['db'],
    requestId: 'staff-home-test',
    user,
    accountAccessState: user ? 'active' : 'unavailable',
    withRls: <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
  return { caller: app.createCaller(ctx), db };
}

describe('staffHome.summary', () => {
  it('returns compact daily staff-home counts without roster PII', async () => {
    const { caller, db } = makeCaller(supervisorUser);

    const summary = await caller.staffHome.summary({ date: day('2026-04-25') });

    expect(summary).toMatchObject({
      date: '2026-04-25',
      attendance: {
        absent: 0,
        late: 1,
        marked: 2,
        present: 1,
        total: 3,
        unmarked: 1,
      },
      behaviour: { entriesRecordedToday: 3 },
      pace: { testsRecordedToday: 4 },
      notices: { unread: 1 },
      permissions: {
        canManageClubs: false,
        canUseClubLeadAccess: true,
        canUseClubs: true,
        canUseShopCounter: true,
      },
      shop: { readyReservationCount: 5 },
      clubs: { assignedClubCount: 2 },
      rota: {
        pendingSwapCount: 2,
        shiftsThisWeek: 2,
        shiftsToday: 1,
      },
    });
    expect(summary).not.toHaveProperty('students');
    expect(summary).not.toHaveProperty('studentNames');
    expect(db.staffNotice.findMany).toHaveBeenCalledOnce();
    expect(db.staffNotice.findMany.mock.calls[0]?.[0].where.audience).toEqual({
      in: ['Supervisors', 'Both'],
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('denies non-staff users', async () => {
    await expect(makeCaller(parentUser).caller.staffHome.summary()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
