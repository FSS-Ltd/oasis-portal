import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { calendarRouter } from '../routers/calendar.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const principalUser: SessionUser = {
  id: 'u_principal',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'u_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const calendarManagerUser: SessionUser = {
  id: 'u_calendar',
  role: 'Supervisor',
  tags: ['calendar-manager'],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const studentUser: SessionUser = {
  id: 'u_student',
  role: 'Student',
  tags: [],
  requires2fa: false,
};
const technicalSupportUser: SessionUser = {
  id: 'u_support',
  role: 'TechnicalSupport',
  tags: ['calendar-manager'],
  requires2fa: false,
};

type CalendarAudience = 'All' | 'Parents' | 'Supervisors' | 'Heads' | 'Custom';
type CalendarCategory = 'HalfTerm' | 'Trips' | 'OasisDays' | 'Birthdays' | 'Meetings' | 'Trainings';

interface StoredCalendarEvent {
  id: string;
  title: string;
  descriptionEnc: string | null;
  audience: CalendarAudience;
  category: CalendarCategory;
  startDate: Date;
  endDate: Date;
  startTimeMinutes: number | null;
  endTimeMinutes: number | null;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredBirthdayStudent {
  id: string;
  fullNameEnc: string;
  dobEnc: string;
}

interface StoredBirthdaySupervisor {
  id: string;
  fullNameEnc: string;
  dobEnc: string | null;
}

interface StoredUser {
  id: string;
  role: SessionUser['role'];
  active: boolean;
  fullNameEnc: string;
  emailEnc: string;
  createdAt: Date;
}

interface StoredRequiredPerson {
  eventId: string;
  userId: string;
  taggedById: string;
  createdAt: Date;
}

interface FakeCalendarCreateArgs {
  data: Omit<StoredCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;
}

interface FakeCalendarFindManyArgs {
  where?: {
    active?: boolean;
    audience?: {
      in?: CalendarAudience[];
      not?: CalendarAudience;
      notIn?: readonly CalendarAudience[];
    };
    OR?: Array<{
      audience?: {
        in?: CalendarAudience[];
        not?: CalendarAudience;
        notIn?: readonly CalendarAudience[];
      };
      requiredPeople?: { some: { userId: string } };
    }>;
    requiredPeople?: { some: { userId: string } };
  };
  include?: unknown;
}

interface FakeCalendarFindUniqueArgs {
  where: { id: string };
  include?: unknown;
}

interface FakeCalendarUpdateArgs {
  where: { id: string };
  data: Partial<Omit<StoredCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>>;
}

interface FakeAuditCreateArgs {
  data: {
    userId: string;
    action: 'Create' | 'Update' | 'DecryptPii';
    entity: string;
    entityId?: string;
    meta: Record<string, unknown>;
  };
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function makeEvent(
  input: Partial<StoredCalendarEvent> & Pick<StoredCalendarEvent, 'id' | 'title'>,
) {
  return {
    descriptionEnc: null,
    audience: 'All',
    category: 'OasisDays',
    startDate: date('2026-05-20'),
    endDate: date('2026-05-20'),
    startTimeMinutes: null,
    endTimeMinutes: null,
    active: true,
    createdById: headUser.id,
    createdAt: new Date('2026-05-08T10:00:00.000Z'),
    updatedAt: new Date('2026-05-08T10:00:00.000Z'),
    ...input,
  } satisfies StoredCalendarEvent;
}

function makeUser(input: Partial<StoredUser> & Pick<StoredUser, 'id' | 'role'>): StoredUser {
  return {
    active: true,
    fullNameEnc: `enc:${input.id}`,
    emailEnc: `enc:${input.id}@oasis.test`,
    createdAt: new Date('2026-05-08T09:00:00.000Z'),
    ...input,
  };
}

function makeFakeDb(
  initialEvents: StoredCalendarEvent[] = [],
  birthdayRows: {
    students?: StoredBirthdayStudent[];
    supervisors?: StoredBirthdaySupervisor[];
  } = {},
  initialUsers: StoredUser[] = [],
  initialRequiredPeople: StoredRequiredPerson[] = [],
) {
  const events = [...initialEvents];
  const students = [...(birthdayRows.students ?? [])];
  const supervisors = [...(birthdayRows.supervisors ?? [])];
  const users = [...initialUsers];
  const requiredPeople = [...initialRequiredPeople];
  const auditCreate = vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args));

  function eventMatchesWhere(event: StoredCalendarEvent, where: FakeCalendarFindManyArgs['where']) {
    if (!where) return true;
    if (where.active !== undefined && event.active !== where.active) return false;
    if (where.audience?.in && !where.audience.in.includes(event.audience)) return false;
    if (where.audience?.not && event.audience === where.audience.not) return false;
    if (where.audience?.notIn?.includes(event.audience)) return false;
    if (
      where.requiredPeople?.some &&
      !requiredPeople.some(
        (person) =>
          person.eventId === event.id && person.userId === where.requiredPeople?.some.userId,
      )
    ) {
      return false;
    }
    if (where.OR && !where.OR.some((candidate) => eventMatchesWhere(event, candidate))) {
      return false;
    }
    return true;
  }

  function withRequiredPeople(event: StoredCalendarEvent) {
    return {
      ...event,
      requiredPeople: requiredPeople
        .filter((person) => person.eventId === event.id)
        .map((person) => {
          const user = users.find((candidate) => candidate.id === person.userId);
          if (!user) throw new Error('required person user not found');
          return {
            user: {
              id: user.id,
              role: user.role,
              fullNameEnc: user.fullNameEnc,
            },
          };
        }),
    };
  }

  function userMatchesWhere(user: StoredUser, where: Record<string, unknown> | undefined) {
    if (!where) return true;
    if (where.active !== undefined && user.active !== where.active) return false;
    const role = where.role as { in?: SessionUser['role'][] } | SessionUser['role'] | undefined;
    if (typeof role === 'string' && user.role !== role) return false;
    if (role && typeof role !== 'string' && role.in && !role.in.includes(user.role)) return false;
    const id = where.id as { in?: string[] } | undefined;
    if (id?.in && !id.in.includes(user.id)) return false;
    return true;
  }

  const db = {
    $transaction: vi.fn(),
    $enc: { encrypt, decrypt },
    auditLog: { create: auditCreate },
    calendarEvent: {
      create: vi.fn((args: FakeCalendarCreateArgs) => {
        const event: StoredCalendarEvent = {
          id: 'cmevent00000000000000001',
          createdAt: new Date('2026-05-08T12:00:00.000Z'),
          updatedAt: new Date('2026-05-08T12:00:00.000Z'),
          ...args.data,
        };
        events.push(event);
        return Promise.resolve(event);
      }),
      findMany: vi.fn((args: FakeCalendarFindManyArgs = {}) =>
        Promise.resolve(
          events
            .filter((event) => eventMatchesWhere(event, args.where))
            .sort(
              (a, b) =>
                Number(b.active) - Number(a.active) ||
                a.startDate.getTime() - b.startDate.getTime() ||
                b.createdAt.getTime() - a.createdAt.getTime(),
            )
            .map((event) => (args.include ? withRequiredPeople(event) : event)),
        ),
      ),
      findUnique: vi.fn((args: FakeCalendarFindUniqueArgs) => {
        const event = events.find((candidate) => candidate.id === args.where.id);
        if (!event) return Promise.resolve(null);
        return Promise.resolve(args.include ? withRequiredPeople(event) : event);
      }),
      update: vi.fn((args: FakeCalendarUpdateArgs) => {
        const index = events.findIndex((event) => event.id === args.where.id);
        if (index === -1) throw new Error('not found');
        const current = events[index];
        if (!current) throw new Error('not found');
        const updated: StoredCalendarEvent = {
          ...current,
          ...args.data,
          updatedAt: new Date('2026-05-08T13:00:00.000Z'),
        };
        events[index] = updated;
        return Promise.resolve(updated);
      }),
    },
    calendarEventRequiredPerson: {
      deleteMany: vi.fn((args: { where: { eventId: string } }) => {
        for (let index = requiredPeople.length - 1; index >= 0; index -= 1) {
          if (requiredPeople[index]?.eventId === args.where.eventId) {
            requiredPeople.splice(index, 1);
          }
        }
        return Promise.resolve({ count: 0 });
      }),
      createMany: vi.fn(
        (args: {
          data: Array<{ eventId: string; taggedById: string; userId: string }>;
          skipDuplicates: boolean;
        }) => {
          args.data.forEach((row) => {
            if (
              requiredPeople.some(
                (person) => person.eventId === row.eventId && person.userId === row.userId,
              )
            ) {
              return;
            }
            requiredPeople.push({ ...row, createdAt: new Date('2026-05-08T12:30:00.000Z') });
          });
          return Promise.resolve({ count: args.data.length });
        },
      ),
    },
    student: {
      findMany: vi.fn(() => Promise.resolve(students)),
    },
    user: {
      findMany: vi.fn((args: { where?: Record<string, unknown>; select?: unknown } = {}) => {
        if (args.where?.dobEnc) return Promise.resolve(supervisors);
        return Promise.resolve(users.filter((user) => userMatchesWhere(user, args.where)));
      }),
    },
    events,
    requiredPeople,
  };
  db.$transaction.mockImplementation(async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db));
  return db;
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ calendar: calendarRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

describe('calendar.create', () => {
  it('allows full-admin users to create encrypted single-date events and audits creation', async () => {
    const { caller, db } = makeCaller(headUser);

    await expect(
      caller.calendar.create({
        title: '  Half-term reminder  ',
        description: '  Centre closed.  ',
        audience: 'All',
        category: 'HalfTerm',
        startDate: '2026-05-25',
        startTime: '09:00',
        endTime: '10:30',
      }),
    ).resolves.toMatchObject({
      id: 'cmevent00000000000000001',
      title: 'Half-term reminder',
      description: 'Centre closed.',
      audience: 'All',
      category: 'HalfTerm',
      startDate: '2026-05-25',
      endDate: '2026-05-25',
      startTime: '09:00',
      endTime: '10:30',
      active: true,
      createdById: headUser.id,
      source: 'Manual',
    });
    expect(db.events[0]?.descriptionEnc).toBe('enc:Centre closed.');
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'CalendarEvent',
        entityId: 'cmevent00000000000000001',
        meta: {
          source: 'calendar.create',
          audience: 'All',
          category: 'HalfTerm',
          startDate: '2026-05-25',
          endDate: '2026-05-25',
          startTime: '09:00',
          endTime: '10:30',
        },
      },
    });
  });

  it('allows tagged staff to create date ranges', async () => {
    const { caller } = makeCaller(calendarManagerUser);

    await expect(
      caller.calendar.create({
        title: 'Half-term',
        audience: 'Parents',
        category: 'OasisDays',
        startDate: '2026-05-25',
        endDate: '2026-05-29',
      }),
    ).resolves.toMatchObject({
      title: 'Half-term',
      audience: 'Parents',
      category: 'OasisDays',
      startDate: '2026-05-25',
      endDate: '2026-05-29',
    });
  });

  it('rejects invalid date ranges', async () => {
    const { caller } = makeCaller(headUser);

    await expect(
      caller.calendar.create({
        title: 'Bad range',
        audience: 'All',
        category: 'OasisDays',
        startDate: '2026-05-29',
        endDate: '2026-05-25',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('allows full admins and denies untagged staff and unsupported roles', async () => {
    await expect(
      makeCaller(principalUser).caller.calendar.create({
        title: 'Principal date',
        audience: 'Supervisors',
        category: 'OasisDays',
        startDate: '2026-05-25',
      }),
    ).resolves.toMatchObject({ title: 'Principal date', createdById: principalUser.id });
    await expect(
      makeCaller(supervisorUser).caller.calendar.create({
        title: 'Staff date',
        audience: 'Supervisors',
        category: 'OasisDays',
        startDate: '2026-05-25',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(technicalSupportUser).caller.calendar.create({
        title: 'Support date',
        audience: 'All',
        category: 'OasisDays',
        startDate: '2026-05-25',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects birthday as a manual category and invalid time ranges', async () => {
    const { caller } = makeCaller(headUser);
    const createWithUnknownInput = caller.calendar.create as unknown as (
      input: unknown,
    ) => Promise<unknown>;

    await expect(
      createWithUnknownInput({
        title: 'Manual birthday',
        audience: 'Heads',
        category: 'Birthdays',
        startDate: '2026-05-25',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.calendar.create({
        title: 'Training',
        audience: 'Supervisors',
        category: 'Trainings',
        startDate: '2026-05-25',
        startTime: '11:00',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.calendar.create({
        title: 'Training',
        audience: 'Supervisors',
        category: 'Trainings',
        startDate: '2026-05-25',
        endDate: '2026-05-26',
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('limits head-only manual events to full-admin calendar managers', async () => {
    await expect(
      makeCaller(headUser).caller.calendar.create({
        title: 'Heads meeting',
        audience: 'Heads',
        category: 'Meetings',
        startDate: '2026-05-25',
      }),
    ).resolves.toMatchObject({ audience: 'Heads', category: 'Meetings' });

    await expect(
      makeCaller(calendarManagerUser).caller.calendar.create({
        title: 'Heads meeting',
        audience: 'Heads',
        category: 'Meetings',
        startDate: '2026-05-25',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows full admins to assign active staff as required people', async () => {
    const staff = makeUser({
      id: 'staff_required',
      role: 'Supervisor',
      fullNameEnc: 'enc:Required Supervisor',
    });
    const { caller, db } = makeCaller(headUser, makeFakeDb([], {}, [staff]));

    await expect(
      caller.calendar.create({
        title: 'Trip planning',
        audience: 'Parents',
        category: 'Trips',
        startDate: '2026-05-25',
        requiredPersonIds: [staff.id],
      }),
    ).resolves.toMatchObject({
      title: 'Trip planning',
      requiredPeople: [{ id: staff.id, fullName: 'Required Supervisor', role: 'Supervisor' }],
    });
    expect(db.requiredPeople).toEqual([
      expect.objectContaining({
        eventId: 'cmevent00000000000000001',
        userId: staff.id,
        taggedById: headUser.id,
      }),
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'CalendarEventRequiredPerson',
        meta: { count: 1, source: 'calendar.create' },
      },
    });
  });

  it('allows full admins to create custom events visible only to required people', async () => {
    const staff = makeUser({
      id: supervisorUser.id,
      role: 'Supervisor',
      fullNameEnc: 'enc:Required Supervisor',
    });
    const db = makeFakeDb([], {}, [staff]);
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.calendar.create({
        title: 'Private planning',
        audience: 'Custom',
        category: 'Meetings',
        startDate: '2026-05-25',
        requiredPersonIds: [staff.id],
      }),
    ).resolves.toMatchObject({
      title: 'Private planning',
      audience: 'Custom',
      requiredPeople: [
        { id: supervisorUser.id, fullName: 'Required Supervisor', role: 'Supervisor' },
      ],
    });

    await expect(makeCaller(supervisorUser, db).caller.calendar.listForStaff()).resolves.toEqual([
      expect.objectContaining({ audience: 'Custom', id: 'cmevent00000000000000001' }),
    ]);
    await expect(makeCaller(parentUser, db).caller.calendar.listForParents()).resolves.toEqual([]);
  });

  it('rejects custom events without required people and from tagged calendar managers', async () => {
    const staff = makeUser({ id: supervisorUser.id, role: 'Supervisor' });

    await expect(
      makeCaller(headUser).caller.calendar.create({
        title: 'Private planning',
        audience: 'Custom',
        category: 'Meetings',
        startDate: '2026-05-25',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      makeCaller(calendarManagerUser, makeFakeDb([], {}, [staff])).caller.calendar.create({
        title: 'Private planning',
        audience: 'Custom',
        category: 'Meetings',
        startDate: '2026-05-25',
        requiredPersonIds: [staff.id],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects required people from tagged calendar managers and invalid users', async () => {
    const staff = makeUser({ id: 'staff_required', role: 'Supervisor' });
    const inactiveStaff = makeUser({ id: 'staff_inactive', role: 'Supervisor', active: false });
    const parent = makeUser({ id: 'parent_required', role: 'Parent' });

    await expect(
      makeCaller(calendarManagerUser, makeFakeDb([], {}, [staff])).caller.calendar.create({
        title: 'Planning',
        audience: 'Supervisors',
        category: 'Meetings',
        startDate: '2026-05-25',
        requiredPersonIds: [staff.id],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(headUser, makeFakeDb([], {}, [inactiveStaff])).caller.calendar.create({
        title: 'Planning',
        audience: 'Supervisors',
        category: 'Meetings',
        startDate: '2026-05-25',
        requiredPersonIds: [inactiveStaff.id],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      makeCaller(headUser, makeFakeDb([], {}, [parent])).caller.calendar.create({
        title: 'Planning',
        audience: 'Supervisors',
        category: 'Meetings',
        startDate: '2026-05-25',
        requiredPersonIds: [parent.id],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('calendar reader lists', () => {
  const events = [
    makeEvent({ id: 'event_all', title: 'All portals', audience: 'All' }),
    makeEvent({ id: 'event_parent', title: 'Parents only', audience: 'Parents' }),
    makeEvent({ id: 'event_staff', title: 'Staff only', audience: 'Supervisors' }),
    makeEvent({ id: 'event_heads', title: 'Heads only', audience: 'Heads' }),
    makeEvent({ id: 'event_custom', title: 'Custom only', audience: 'Custom' }),
    makeEvent({ id: 'event_archived', title: 'Archived', active: false, audience: 'All' }),
  ];

  it('returns Parents and All events for parents', async () => {
    const { caller } = makeCaller(parentUser, makeFakeDb(events));

    await expect(caller.calendar.listForParents()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'event_all' }),
        expect.objectContaining({ id: 'event_parent' }),
      ]),
    );
    const result = await caller.calendar.listForParents();
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_staff' })]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_heads' })]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_custom' })]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_archived' })]),
    );
  });

  it('returns Supervisors and All events for supervisors', async () => {
    const { caller } = makeCaller(supervisorUser, makeFakeDb(events));

    const result = await caller.calendar.listForStaff();
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'event_all' }),
        expect.objectContaining({ id: 'event_staff' }),
      ]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_parent' })]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_heads' })]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_custom' })]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_archived' })]),
    );
  });

  it('returns visible events by role while preserving audience targeting', async () => {
    const parentResult = await makeCaller(
      parentUser,
      makeFakeDb(events),
    ).caller.calendar.listVisible();
    expect(parentResult).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'event_all' }),
        expect.objectContaining({ id: 'event_parent' }),
      ]),
    );
    expect(parentResult).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_staff' })]),
    );

    const staffResult = await makeCaller(
      principalUser,
      makeFakeDb(events),
    ).caller.calendar.listVisible();
    expect(staffResult).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'event_all' }),
        expect.objectContaining({ id: 'event_staff' }),
        expect.objectContaining({ id: 'event_heads' }),
      ]),
    );
    expect(staffResult).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'event_parent' })]),
    );

    const studentResult = await makeCaller(
      studentUser,
      makeFakeDb(events),
    ).caller.calendar.listVisible();
    expect(studentResult).toEqual([expect.objectContaining({ id: 'event_all' })]);
  });

  it('denies unsupported reader roles', async () => {
    await expect(makeCaller(studentUser).caller.calendar.listForParents()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(parentUser).caller.calendar.listForStaff()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('adds virtual birthday events only for full-admin head roles', async () => {
    const db = makeFakeDb([], {
      students: [{ id: 'student_1', fullNameEnc: 'enc:Grace Williams', dobEnc: 'enc:2014-05-20' }],
      supervisors: [
        { id: 'supervisor_1', fullNameEnc: 'enc:Mrs Thompson', dobEnc: 'enc:1984-06-01' },
      ],
    });

    const headResult = await makeCaller(headUser, db).caller.calendar.listForAdmin();
    const studentBirthday = headResult.find((event) =>
      event.id.startsWith('birthday:student:student_1'),
    );
    const supervisorBirthday = headResult.find((event) =>
      event.id.startsWith('birthday:supervisor:supervisor_1'),
    );
    expect(studentBirthday).toMatchObject({
      category: 'Birthdays',
      source: 'Birthday',
      personType: 'Student',
      audience: 'Heads',
      title: "Grace Williams's birthday",
    });
    expect(supervisorBirthday).toMatchObject({
      category: 'Birthdays',
      source: 'Birthday',
      personType: 'Supervisor',
      audience: 'Heads',
      title: "Mrs Thompson's birthday",
    });

    const managerResult = await makeCaller(calendarManagerUser, db).caller.calendar.listForAdmin();
    expect(managerResult).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'Birthday' })]),
    );
    await expect(makeCaller(parentUser, db).caller.calendar.listVisible()).resolves.toEqual([]);
  });

  it('shows tagged staff otherwise hidden events without exposing people to parents', async () => {
    const staff = makeUser({
      id: supervisorUser.id,
      role: 'Supervisor',
      fullNameEnc: 'enc:Required Supervisor',
    });
    const db = makeFakeDb(
      [makeEvent({ id: 'event_parent_required_staff', title: 'Parent trip', audience: 'Parents' })],
      {},
      [staff],
      [
        {
          eventId: 'event_parent_required_staff',
          userId: supervisorUser.id,
          taggedById: headUser.id,
          createdAt: new Date('2026-05-08T12:00:00.000Z'),
        },
      ],
    );

    await expect(makeCaller(supervisorUser, db).caller.calendar.listForStaff()).resolves.toEqual([
      expect.objectContaining({
        id: 'event_parent_required_staff',
        requiredPeople: [
          { id: supervisorUser.id, fullName: 'Required Supervisor', role: 'Supervisor' },
        ],
      }),
    ]);

    await expect(makeCaller(parentUser, db).caller.calendar.listForParents()).resolves.toEqual([
      expect.objectContaining({
        id: 'event_parent_required_staff',
        requiredPeople: [],
      }),
    ]);
  });

  it('lists required person candidates for full admins only', async () => {
    const staff = makeUser({
      id: 'staff_required',
      role: 'Supervisor',
      fullNameEnc: 'enc:Required Supervisor',
    });
    const parent = makeUser({ id: 'parent_1', role: 'Parent', fullNameEnc: 'enc:Parent' });
    const db = makeFakeDb([], {}, [staff, parent]);

    await expect(
      makeCaller(headUser, db).caller.calendar.listRequiredPersonCandidates(),
    ).resolves.toEqual([{ id: staff.id, fullName: 'Required Supervisor', role: 'Supervisor' }]);
    await expect(
      makeCaller(calendarManagerUser, db).caller.calendar.listRequiredPersonCandidates(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('calendar.update and calendar.archive', () => {
  it('updates an event and writes an audit row', async () => {
    const db = makeFakeDb([makeEvent({ id: 'event_update', title: 'Original' })]);
    const { caller } = makeCaller(calendarManagerUser, db);

    await expect(
      caller.calendar.update({
        id: 'event_update',
        title: 'Updated',
        description: 'New details',
        audience: 'Supervisors',
        category: 'Meetings',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      }),
    ).resolves.toMatchObject({
      id: 'event_update',
      title: 'Updated',
      description: 'New details',
      audience: 'Supervisors',
      category: 'Meetings',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: calendarManagerUser.id,
        action: 'Update',
        entity: 'CalendarEvent',
        entityId: 'event_update',
        meta: {
          source: 'calendar.update',
          audience: 'Supervisors',
          category: 'Meetings',
          startDate: '2026-06-01',
          endDate: '2026-06-02',
          startTime: null,
          endTime: null,
        },
      },
    });
  });

  it('preserves required people when omitted and replaces them when full admin submits ids', async () => {
    const firstStaff = makeUser({
      id: 'staff_first',
      role: 'Supervisor',
      fullNameEnc: 'enc:First Staff',
    });
    const secondStaff = makeUser({
      id: 'staff_second',
      role: 'Principal',
      fullNameEnc: 'enc:Second Staff',
    });
    const db = makeFakeDb(
      [makeEvent({ id: 'event_update_people', title: 'Original' })],
      {},
      [firstStaff, secondStaff],
      [
        {
          eventId: 'event_update_people',
          userId: firstStaff.id,
          taggedById: headUser.id,
          createdAt: new Date('2026-05-08T12:00:00.000Z'),
        },
      ],
    );
    const { caller } = makeCaller(headUser, db);

    await expect(
      caller.calendar.update({
        id: 'event_update_people',
        title: 'Updated title',
        audience: 'All',
        category: 'OasisDays',
        startDate: '2026-05-25',
      }),
    ).resolves.toMatchObject({
      requiredPeople: [{ id: firstStaff.id, fullName: 'First Staff', role: 'Supervisor' }],
    });
    expect(db.requiredPeople).toEqual([
      expect.objectContaining({ eventId: 'event_update_people', userId: firstStaff.id }),
    ]);

    await expect(
      caller.calendar.update({
        id: 'event_update_people',
        title: 'Updated title',
        audience: 'All',
        category: 'OasisDays',
        startDate: '2026-05-25',
        requiredPersonIds: [secondStaff.id],
      }),
    ).resolves.toMatchObject({
      requiredPeople: [{ id: secondStaff.id, fullName: 'Second Staff', role: 'Principal' }],
    });
    expect(db.requiredPeople).toEqual([
      expect.objectContaining({ eventId: 'event_update_people', userId: secondStaff.id }),
    ]);
  });

  it('prevents tagged calendar managers from updating or archiving restricted events', async () => {
    const db = makeFakeDb([
      makeEvent({ id: 'event_heads', title: 'Heads only', audience: 'Heads' }),
      makeEvent({ id: 'event_custom', title: 'Tagged people only', audience: 'Custom' }),
    ]);
    const { caller } = makeCaller(calendarManagerUser, db);

    await expect(
      caller.calendar.update({
        id: 'event_heads',
        title: 'Updated',
        audience: 'Supervisors',
        category: 'Meetings',
        startDate: '2026-06-01',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.calendar.archive({ id: 'event_heads' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller.calendar.update({
        id: 'event_custom',
        title: 'Updated',
        audience: 'Supervisors',
        category: 'Meetings',
        startDate: '2026-06-01',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.calendar.archive({ id: 'event_custom' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('archives events, writes an audit row, and hides them from readers', async () => {
    const db = makeFakeDb([makeEvent({ id: 'event_archive', title: 'Archive me' })]);
    const { caller } = makeCaller(headUser, db);

    await expect(caller.calendar.archive({ id: 'event_archive' })).resolves.toMatchObject({
      id: 'event_archive',
      active: false,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'CalendarEvent',
        entityId: 'event_archive',
        meta: { source: 'calendar.archive' },
      },
    });

    const parentCaller = makeCaller(parentUser, db).caller;
    await expect(parentCaller.calendar.listForParents()).resolves.toEqual([]);
  });
});
