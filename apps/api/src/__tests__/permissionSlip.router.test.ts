import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { permissionSlipRouter } from '../routers/permissionSlip.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const pastorUser: SessionUser = { id: 'u_pastor', role: 'Pastor', tags: [], requires2fa: false };
const principalUser: SessionUser = {
  id: 'u_principal',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};
const headOfDisciplineUser: SessionUser = {
  id: 'u_hod',
  role: 'HeadOfDiscipline',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'u_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const clubsLeadUser: SessionUser = {
  id: 'u_clubs_lead',
  role: 'ClubsLead',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = { id: 'u_student', role: 'Student', tags: [], requires2fa: false };

type SlipCategory = 'SchoolTrip' | 'Activity' | 'Reward' | 'Consent';
type ResponseStatus = 'Pending' | 'Signed' | 'Declined';
type SignatureSource = 'ParentPortal' | 'Physical';
type PaymentStatus = 'NotRequired' | 'Unpaid' | 'PaymentPending' | 'Paid';
type CalendarCategory = 'Trips' | 'OasisDays';

interface StoredStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
  createdAt: Date;
}

interface StoredGuardian {
  id: string;
  userId: string;
  studentId: string;
}

interface StoredCalendarEvent {
  id: string;
  title: string;
  descriptionEnc: string | null;
  audience: 'Parents';
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

interface StoredBringItem {
  id: string;
  slipId: string;
  position: number;
  labelEnc: string;
  createdAt: Date;
}

interface StoredQuestion {
  id: string;
  slipId: string;
  position: number;
  labelEnc: string;
  required: boolean;
  createdAt: Date;
}

interface StoredAnswer {
  questionId: string;
  slipId: string;
  studentId: string;
  answerEnc: string;
  createdAt: Date;
}

interface StoredRecipient {
  slipId: string;
  studentId: string;
  position: number;
  responseStatus: ResponseStatus;
  signatureSource: SignatureSource | null;
  parentNameEnc: string | null;
  signedAt: Date | null;
  medicalInfoEnc: string | null;
  emergencyContactEnc: string | null;
  declineReasonEnc: string | null;
  parentRespondedById: string | null;
  physicalSignedById: string | null;
  paymentStatus: PaymentStatus;
  parentMarkedPaidAt: Date | null;
  parentMarkedPaidById: string | null;
  paymentConfirmedAt: Date | null;
  paymentConfirmedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSlip {
  id: string;
  title: string;
  category: SlipCategory;
  descriptionEnc: string | null;
  eventDate: Date | null;
  deadline: Date;
  departureTimeMinutes: number | null;
  returnTimeMinutes: number | null;
  locationEnc: string | null;
  transportEnc: string | null;
  costEnc: string | null;
  consentTextEnc: string;
  requireMedical: boolean;
  requireEmergencyContact: boolean;
  requirePayment: boolean;
  recipientLabel: string;
  active: boolean;
  calendarEventId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditCreateArgs {
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

function makeSlip(input: Partial<StoredSlip> & Pick<StoredSlip, 'id' | 'title'>): StoredSlip {
  return {
    category: 'SchoolTrip',
    descriptionEnc: encrypt('Trip description'),
    eventDate: date('2026-12-20'),
    deadline: date('2026-12-10'),
    departureTimeMinutes: 9 * 60,
    returnTimeMinutes: 15 * 60,
    locationEnc: encrypt('Museum'),
    transportEnc: encrypt('Minibus'),
    costEnc: encrypt('GBP 20'),
    consentTextEnc: encrypt('I give permission.'),
    requireMedical: true,
    requireEmergencyContact: true,
    requirePayment: true,
    recipientLabel: 'Years 7-10',
    active: true,
    calendarEventId: null,
    createdById: headUser.id,
    createdAt: new Date('2026-05-10T10:00:00.000Z'),
    updatedAt: new Date('2026-05-10T10:00:00.000Z'),
    ...input,
  };
}

function makeRecipient(
  input: Pick<StoredRecipient, 'slipId' | 'studentId' | 'position'> & Partial<StoredRecipient>,
): StoredRecipient {
  return {
    responseStatus: 'Pending',
    signatureSource: null,
    parentNameEnc: null,
    signedAt: null,
    medicalInfoEnc: null,
    emergencyContactEnc: null,
    declineReasonEnc: null,
    parentRespondedById: null,
    physicalSignedById: null,
    paymentStatus: 'Unpaid',
    parentMarkedPaidAt: null,
    parentMarkedPaidById: null,
    paymentConfirmedAt: null,
    paymentConfirmedById: null,
    createdAt: new Date('2026-05-10T10:00:00.000Z'),
    updatedAt: new Date('2026-05-10T10:00:00.000Z'),
    ...input,
  };
}

function makeFakeDb(seed?: {
  guardians?: StoredGuardian[];
  recipients?: StoredRecipient[];
  slips?: StoredSlip[];
}) {
  const students: StoredStudent[] = [
    {
      id: 's_child_1',
      active: true,
      fullNameEnc: encrypt('Joshua Johnson'),
      yearGroup: 'Y9',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 's_child_2',
      active: true,
      fullNameEnc: encrypt('Grace Williams'),
      yearGroup: 'Y8',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  ];
  const guardians = seed?.guardians ?? [
    { id: 'g_1', userId: parentUser.id, studentId: 's_child_1' },
  ];
  const slips = [...(seed?.slips ?? [])];
  const recipients = [...(seed?.recipients ?? [])];
  const bringItems: StoredBringItem[] = [];
  const questions: StoredQuestion[] = [];
  const answers: StoredAnswer[] = [];
  const calendarEvents: StoredCalendarEvent[] = [];
  let slipSequence = 1;
  let calendarSequence = 1;
  let bringSequence = 1;
  let questionSequence = 1;

  function withRelations(slip: StoredSlip) {
    return {
      ...slip,
      bringItems: bringItems
        .filter((item) => item.slipId === slip.id)
        .sort((left, right) => left.position - right.position),
      questions: questions
        .filter((question) => question.slipId === slip.id)
        .sort((left, right) => left.position - right.position),
      recipients: recipients
        .filter((recipient) => recipient.slipId === slip.id)
        .sort((left, right) => left.position - right.position)
        .map((recipient) => {
          const student = students.find((candidate) => candidate.id === recipient.studentId);
          if (!student) throw new Error('student not found');
          return {
            ...recipient,
            student,
            answers: answers.filter(
              (answer) => answer.slipId === recipient.slipId && answer.studentId === recipient.studentId,
            ),
          };
        }),
    };
  }

  const db = {
    $enc: { encrypt, decrypt },
    auditLog: {
      create: vi.fn((args: AuditCreateArgs) => Promise.resolve(args)),
    },
    guardian: {
      findMany: vi.fn((args: { where: { userId: string }; select: { studentId: true } }) =>
        Promise.resolve(
          guardians
            .filter((guardian) => guardian.userId === args.where.userId)
            .map((guardian) => ({ studentId: guardian.studentId })),
        ),
      ),
      findUnique: vi.fn(
        (args: { where: { userId_studentId: { userId: string; studentId: string } } }) =>
          Promise.resolve(
            guardians.find(
              (guardian) =>
                guardian.userId === args.where.userId_studentId.userId &&
                guardian.studentId === args.where.userId_studentId.studentId,
            ) ?? null,
          ),
      ),
    },
    student: {
      findMany: vi.fn(
        (args: {
          where?: { id?: { in: string[] }; active?: boolean };
          select?: unknown;
          orderBy?: unknown;
        }) => {
          const ids = args.where?.id?.in;
          return Promise.resolve(
            students.filter((student) => {
              if (ids && !ids.includes(student.id)) return false;
              if (args.where?.active !== undefined && student.active !== args.where.active) return false;
              return true;
            }),
          );
        },
      ),
    },
    calendarEvent: {
      create: vi.fn((args: { data: Omit<StoredCalendarEvent, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const event: StoredCalendarEvent = {
          id: `event_${String(calendarSequence++)}`,
          createdAt: new Date('2026-05-10T11:00:00.000Z'),
          updatedAt: new Date('2026-05-10T11:00:00.000Z'),
          ...args.data,
        };
        calendarEvents.push(event);
        return Promise.resolve(event);
      }),
      update: vi.fn(
        (args: {
          where: { id: string };
          data: Partial<Omit<StoredCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>>;
        }) => {
          const event = calendarEvents.find((candidate) => candidate.id === args.where.id);
          if (!event) throw new Error('calendar event not found');
          Object.assign(event, args.data, { updatedAt: new Date('2026-05-10T12:00:00.000Z') });
          return Promise.resolve(event);
        },
      ),
    },
    permissionSlip: {
      findMany: vi.fn((args: { where?: { active?: boolean; recipients?: { some: { studentId: { in: string[] } } } } } = {}) =>
        Promise.resolve(
          slips
            .filter((slip) => {
              if (args.where?.active !== undefined && slip.active !== args.where.active) return false;
              const ids = args.where?.recipients?.some.studentId.in;
              if (
                ids &&
                !recipients.some(
                  (recipient) => recipient.slipId === slip.id && ids.includes(recipient.studentId),
                )
              ) {
                return false;
              }
              return true;
            })
            .map(withRelations),
        ),
      ),
      findUnique: vi.fn((args: { where: { id: string }; include?: unknown; select?: { id?: true; calendarEventId?: true } }) => {
        const slip = slips.find((candidate) => candidate.id === args.where.id);
        if (!slip) return Promise.resolve(null);
        if (args.select) {
          return Promise.resolve({
            ...(args.select.id ? { id: slip.id } : {}),
            ...(args.select.calendarEventId ? { calendarEventId: slip.calendarEventId } : {}),
          });
        }
        return Promise.resolve(args.include ? withRelations(slip) : slip);
      }),
      create: vi.fn(
        (args: {
          data: Omit<StoredSlip, 'id' | 'createdAt' | 'updatedAt' | 'createdById' | 'calendarEventId'> & {
            calendarEvent?: { connect: { id: string } };
            createdBy: { connect: { id: string } };
          };
        }) => {
          const slip: StoredSlip = {
            id: `slip_${String(slipSequence++)}`,
            createdAt: new Date('2026-05-10T11:30:00.000Z'),
            updatedAt: new Date('2026-05-10T11:30:00.000Z'),
            ...args.data,
            calendarEventId: args.data.calendarEvent?.connect.id ?? null,
            createdById: args.data.createdBy.connect.id,
          };
          slips.push(slip);
          return Promise.resolve(slip);
        },
      ),
      update: vi.fn(
        (args: {
          where: { id: string };
          data: Partial<Omit<StoredSlip, 'id' | 'createdAt' | 'updatedAt'>>;
        }) => {
          const slip = slips.find((candidate) => candidate.id === args.where.id);
          if (!slip) throw new Error('slip not found');
          Object.assign(slip, args.data, { updatedAt: new Date('2026-05-10T12:30:00.000Z') });
          return Promise.resolve(slip);
        },
      ),
    },
    permissionSlipRecipient: {
      findUnique: vi.fn(
        (args: {
          where: { slipId_studentId: { slipId: string; studentId: string } };
          select?: { slipId?: true; paymentStatus?: true; responseStatus?: true };
        }) => {
          const recipient =
            recipients.find(
              (candidate) =>
                candidate.slipId === args.where.slipId_studentId.slipId &&
                candidate.studentId === args.where.slipId_studentId.studentId,
            ) ?? null;
          if (!recipient || !args.select) return Promise.resolve(recipient);
          return Promise.resolve({
            ...(args.select.slipId ? { slipId: recipient.slipId } : {}),
            ...(args.select.paymentStatus ? { paymentStatus: recipient.paymentStatus } : {}),
            ...(args.select.responseStatus ? { responseStatus: recipient.responseStatus } : {}),
          });
        },
      ),
      update: vi.fn(
        (args: {
          where: { slipId_studentId: { slipId: string; studentId: string } };
          data: Partial<Omit<StoredRecipient, 'slipId' | 'studentId' | 'createdAt' | 'updatedAt'>>;
        }) => {
          const recipient = recipients.find(
            (candidate) =>
              candidate.slipId === args.where.slipId_studentId.slipId &&
              candidate.studentId === args.where.slipId_studentId.studentId,
          );
          if (!recipient) throw new Error('recipient not found');
          Object.assign(recipient, args.data, {
            updatedAt: new Date('2026-05-10T13:00:00.000Z'),
          });
          return Promise.resolve(recipient);
        },
      ),
      updateMany: vi.fn(
        (args: {
          where: { slipId: string; studentId: { in: string[] }; responseStatus: ResponseStatus };
          data: Partial<Omit<StoredRecipient, 'slipId' | 'studentId' | 'createdAt' | 'updatedAt'>>;
        }) => {
          let count = 0;
          recipients.forEach((recipient) => {
            if (
              recipient.slipId === args.where.slipId &&
              args.where.studentId.in.includes(recipient.studentId) &&
              recipient.responseStatus === args.where.responseStatus
            ) {
              Object.assign(recipient, args.data, {
                updatedAt: new Date('2026-05-10T13:00:00.000Z'),
              });
              count += 1;
            }
          });
          return Promise.resolve({ count });
        },
      ),
      deleteMany: vi.fn((args: { where: { slipId: string; studentId: { notIn: string[] } } }) => {
        for (let index = recipients.length - 1; index >= 0; index -= 1) {
          const recipient = recipients[index];
          if (
            recipient &&
            recipient.slipId === args.where.slipId &&
            !args.where.studentId.notIn.includes(recipient.studentId)
          ) {
            recipients.splice(index, 1);
          }
        }
        return Promise.resolve({ count: 0 });
      }),
      createMany: vi.fn(
        (args: {
          data: Array<Pick<StoredRecipient, 'paymentStatus' | 'position' | 'slipId' | 'studentId'>>;
          skipDuplicates?: boolean;
        }) => {
          args.data.forEach((row) => {
            if (
              args.skipDuplicates &&
              recipients.some(
                (recipient) => recipient.slipId === row.slipId && recipient.studentId === row.studentId,
              )
            ) {
              return;
            }
            recipients.push(makeRecipient(row));
          });
          return Promise.resolve({ count: args.data.length });
        },
      ),
    },
    permissionSlipBringItem: {
      deleteMany: vi.fn((args: { where: { slipId: string } }) => {
        for (let index = bringItems.length - 1; index >= 0; index -= 1) {
          if (bringItems[index]?.slipId === args.where.slipId) bringItems.splice(index, 1);
        }
        return Promise.resolve({ count: 0 });
      }),
      createMany: vi.fn(
        (args: { data: Array<Pick<StoredBringItem, 'labelEnc' | 'position' | 'slipId'>> }) => {
          args.data.forEach((row) =>
            bringItems.push({
              id: `bring_${String(bringSequence++)}`,
              createdAt: new Date('2026-05-10T12:00:00.000Z'),
              ...row,
            }),
          );
          return Promise.resolve({ count: args.data.length });
        },
      ),
    },
    permissionSlipQuestion: {
      deleteMany: vi.fn((args: { where: { slipId: string } }) => {
        for (let index = questions.length - 1; index >= 0; index -= 1) {
          if (questions[index]?.slipId === args.where.slipId) questions.splice(index, 1);
        }
        return Promise.resolve({ count: 0 });
      }),
      createMany: vi.fn(
        (args: {
          data: Array<Pick<StoredQuestion, 'labelEnc' | 'position' | 'required' | 'slipId'>>;
        }) => {
          args.data.forEach((row) =>
            questions.push({
              id: `question_${String(questionSequence++)}`,
              createdAt: new Date('2026-05-10T12:00:00.000Z'),
              ...row,
            }),
          );
          return Promise.resolve({ count: args.data.length });
        },
      ),
    },
    permissionSlipAnswer: {
      createMany: vi.fn((args: { data: StoredAnswer[] }) => {
        args.data.forEach((row) =>
          answers.push({ ...row, createdAt: new Date('2026-05-10T14:00:00.000Z') }),
        );
        return Promise.resolve({ count: args.data.length });
      }),
    },
    slips,
    recipients,
    calendarEvents,
  };
  return db;
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db = makeFakeDb()) {
  const appRouter = router({ permissionSlip: permissionSlipRouter });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db };
}

const createInput = {
  title: 'Howletts Wild Animal Park',
  category: 'SchoolTrip' as const,
  description: 'A day visit.',
  eventDate: '2026-12-20',
  deadline: '2026-12-10',
  departureTime: '09:00',
  returnTime: '15:00',
  location: 'Howletts',
  transport: 'Minibus',
  cost: 'GBP 20',
  consentText: 'I give permission.',
  requireMedical: true,
  requireEmergencyContact: true,
  requirePayment: true,
  recipientLabel: 'Years 7-10',
  studentIds: ['s_child_1', 's_child_2'],
  bringItems: ['Packed lunch'],
  questions: [{ label: 'Can your child swim?', required: true }],
};

describe('permissionSlip.create', () => {
  it('creates a parent calendar event for event slips', async () => {
    const { caller, db } = makeCaller(headUser);

    const result = await caller.permissionSlip.create(createInput);

    expect(result.calendarEventId).toBe('event_1');
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[0]?.paymentStatus).toBe('Unpaid');
    expect(db.calendarEvents[0]).toMatchObject({
      title: 'Howletts Wild Animal Park',
      audience: 'Parents',
      category: 'Trips',
      startTimeMinutes: 540,
      endTimeMinutes: 900,
      active: true,
    });
  });
});

describe('permissionSlip.update and archive', () => {
  it('syncs linked calendar events through update and archive', async () => {
    const { caller, db } = makeCaller(headUser);
    const created = await caller.permissionSlip.create(createInput);

    await caller.permissionSlip.update({
      ...createInput,
      id: created.id,
      title: 'Updated trip',
      eventDate: '2026-12-21',
      category: 'Activity',
    });

    expect(db.calendarEvents[0]).toMatchObject({
      title: 'Updated trip',
      category: 'OasisDays',
      startDate: date('2026-12-21'),
      active: true,
    });

    await caller.permissionSlip.archive({ id: created.id });

    expect(db.slips[0]?.active).toBe(false);
    expect(db.calendarEvents[0]?.active).toBe(false);
  });

  it('updates pending recipient payment state when payment requirement changes', async () => {
    const slip = makeSlip({ id: 'slip_payment_change', title: 'Payment change trip' });
    const db = makeFakeDb({
      slips: [slip],
      recipients: [
        makeRecipient({ slipId: slip.id, studentId: 's_child_1', position: 1 }),
        makeRecipient({
          slipId: slip.id,
          studentId: 's_child_2',
          position: 2,
          responseStatus: 'Signed',
          signatureSource: 'ParentPortal',
          parentNameEnc: encrypt('Grace Williams'),
          signedAt: new Date('2026-05-21T10:00:00.000Z'),
          paymentStatus: 'Unpaid',
        }),
      ],
    });
    const { caller } = makeCaller(headUser, db);

    await caller.permissionSlip.update({
      ...createInput,
      id: slip.id,
      requirePayment: false,
    });

    expect(db.recipients.find((recipient) => recipient.studentId === 's_child_1')).toMatchObject({
      paymentStatus: 'NotRequired',
      responseStatus: 'Pending',
    });
    expect(db.recipients.find((recipient) => recipient.studentId === 's_child_2')).toMatchObject({
      paymentStatus: 'Unpaid',
      responseStatus: 'Signed',
    });
  });
});

describe('permissionSlip parent access', () => {
  it('only shows linked child recipients and allows a parent response for that child', async () => {
    const slip = makeSlip({ id: 'slip_existing', title: 'Museum trip' });
    const db = makeFakeDb({
      slips: [slip],
      recipients: [
        makeRecipient({ slipId: slip.id, studentId: 's_child_1', position: 1 }),
        makeRecipient({ slipId: slip.id, studentId: 's_child_2', position: 2 }),
      ],
    });
    const { caller } = makeCaller(parentUser, db);

    const list = await caller.permissionSlip.listParent();
    expect(list.slips).toHaveLength(1);
    expect(list.slips[0]?.recipients).toHaveLength(1);
    expect(list.slips[0]?.recipients[0]?.studentId).toBe('s_child_1');

    await expect(
      caller.permissionSlip.submitParentResponse({
        slipId: slip.id,
        studentId: 's_child_2',
        decision: 'Signed',
        parentName: 'Robert Johnson',
        medicalInfo: 'None',
        emergencyContact: 'Sarah Johnson 07700',
        answers: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const response = await caller.permissionSlip.submitParentResponse({
      slipId: slip.id,
      studentId: 's_child_1',
      decision: 'Signed',
      parentName: 'Robert Johnson',
      medicalInfo: 'None',
      emergencyContact: 'Sarah Johnson 07700',
      answers: [],
    });

    expect(response.recipients.find((recipient) => recipient.studentId === 's_child_1')).toMatchObject({
      responseStatus: 'Signed',
      paymentStatus: 'Unpaid',
    });
  });

  it('allows a linked supervisor guardian to list and respond for linked children only', async () => {
    const slip = makeSlip({ id: 'slip_supervisor', title: 'Supervisor child trip' });
    const db = makeFakeDb({
      guardians: [{ id: 'g_supervisor', userId: supervisorUser.id, studentId: 's_child_1' }],
      slips: [slip],
      recipients: [
        makeRecipient({ slipId: slip.id, studentId: 's_child_1', position: 1 }),
        makeRecipient({ slipId: slip.id, studentId: 's_child_2', position: 2 }),
      ],
    });
    const { caller } = makeCaller(supervisorUser, db);

    const list = await caller.permissionSlip.listParent();
    expect(list.slips).toHaveLength(1);
    expect(list.slips[0]?.recipients).toHaveLength(1);
    expect(list.slips[0]?.recipients[0]?.studentId).toBe('s_child_1');

    await expect(
      caller.permissionSlip.submitParentResponse({
        slipId: slip.id,
        studentId: 's_child_2',
        decision: 'Signed',
        parentName: 'Sam Supervisor',
        medicalInfo: 'None',
        emergencyContact: 'Sarah Johnson 07700',
        answers: [],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const response = await caller.permissionSlip.submitParentResponse({
      slipId: slip.id,
      studentId: 's_child_1',
      decision: 'Signed',
      parentName: 'Sam Supervisor',
      medicalInfo: 'None',
      emergencyContact: 'Sarah Johnson 07700',
      answers: [],
    });

    expect(response.recipients.find((recipient) => recipient.studentId === 's_child_1')).toMatchObject({
      parentRespondedById: supervisorUser.id,
      responseStatus: 'Signed',
      paymentStatus: 'Unpaid',
    });
  });

  it('moves signed unpaid slips to payment pending without marking them paid', async () => {
    const slip = makeSlip({ id: 'slip_paid', title: 'Paid trip' });
    const db = makeFakeDb({
      slips: [slip],
      recipients: [
        makeRecipient({
          slipId: slip.id,
          studentId: 's_child_1',
          position: 1,
          responseStatus: 'Signed',
          signatureSource: 'ParentPortal',
          parentNameEnc: encrypt('Robert Johnson'),
          signedAt: new Date('2026-05-21T10:00:00.000Z'),
          paymentStatus: 'Unpaid',
        }),
      ],
    });
    const { caller } = makeCaller(parentUser, db);

    const result = await caller.permissionSlip.parentMarkPaid({
      slipId: slip.id,
      studentId: 's_child_1',
    });

    expect(result.recipients[0]).toMatchObject({
      paymentStatus: 'PaymentPending',
      paymentConfirmedAt: null,
    });
    expect(db.recipients[0]?.paymentStatus).toBe('PaymentPending');
  });

  it('allows a linked supervisor guardian to mark signed unpaid slips as payment pending', async () => {
    const slip = makeSlip({ id: 'slip_supervisor_paid', title: 'Supervisor paid trip' });
    const db = makeFakeDb({
      guardians: [{ id: 'g_supervisor', userId: supervisorUser.id, studentId: 's_child_1' }],
      slips: [slip],
      recipients: [
        makeRecipient({
          slipId: slip.id,
          studentId: 's_child_1',
          position: 1,
          responseStatus: 'Signed',
          signatureSource: 'ParentPortal',
          parentNameEnc: encrypt('Sam Supervisor'),
          signedAt: new Date('2026-05-21T10:00:00.000Z'),
          paymentStatus: 'Unpaid',
        }),
      ],
    });
    const { caller } = makeCaller(supervisorUser, db);

    const result = await caller.permissionSlip.parentMarkPaid({
      slipId: slip.id,
      studentId: 's_child_1',
    });

    expect(result.recipients[0]).toMatchObject({
      parentMarkedPaidById: supervisorUser.id,
      paymentStatus: 'PaymentPending',
      paymentConfirmedAt: null,
    });
    expect(db.recipients[0]?.paymentStatus).toBe('PaymentPending');
  });

  it('denies users without linked-child guardian permission-slip access', async () => {
    await expect(makeCaller(studentUser).caller.permissionSlip.listParent()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(clubsLeadUser).caller.permissionSlip.listParent()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('permissionSlip Head/Pastor actions', () => {
  it('allows Head and Pastor to confirm payments and mark physical slips', async () => {
    const paymentSlip = makeSlip({ id: 'slip_confirm', title: 'Payment trip' });
    const paymentDb = makeFakeDb({
      slips: [paymentSlip],
      recipients: [
        makeRecipient({
          slipId: paymentSlip.id,
          studentId: 's_child_1',
          position: 1,
          responseStatus: 'Signed',
          paymentStatus: 'PaymentPending',
        }),
      ],
    });
    await expect(
      makeCaller(headUser, paymentDb).caller.permissionSlip.confirmPayment({
        slipId: paymentSlip.id,
        studentId: 's_child_1',
      }),
    ).resolves.toMatchObject({
      recipients: [expect.objectContaining({ paymentStatus: 'Paid' })],
    });

    const physicalSlip = makeSlip({
      id: 'slip_physical',
      title: 'Physical trip',
      deadline: date('2026-01-01'),
    });
    const physicalDb = makeFakeDb({
      slips: [physicalSlip],
      recipients: [makeRecipient({ slipId: physicalSlip.id, studentId: 's_child_1', position: 1 })],
    });

    await expect(
      makeCaller(pastorUser, physicalDb).caller.permissionSlip.markPhysicalSigned({
        slipId: physicalSlip.id,
        studentId: 's_child_1',
        parentName: 'Robert Johnson',
        medicalInfo: 'None',
        emergencyContact: 'Sarah Johnson 07700',
      }),
    ).resolves.toMatchObject({
      recipients: [
        expect.objectContaining({
          responseStatus: 'Signed',
          signatureSource: 'Physical',
          paymentStatus: 'Unpaid',
        }),
      ],
    });
  });

  it('denies Principal, Head of Discipline, Supervisor, and Parent approval actions', async () => {
    for (const user of [principalUser, headOfDisciplineUser, supervisorUser, parentUser]) {
      const slip = makeSlip({ id: `slip_${user.role}`, title: 'Denied trip' });
      const db = makeFakeDb({
        slips: [slip],
        recipients: [
          makeRecipient({
            slipId: slip.id,
            studentId: 's_child_1',
            position: 1,
            responseStatus: 'Signed',
            paymentStatus: 'PaymentPending',
          }),
        ],
      });
      const caller = makeCaller(user, db).caller;

      await expect(
        caller.permissionSlip.confirmPayment({ slipId: slip.id, studentId: 's_child_1' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        caller.permissionSlip.markPhysicalSigned({
          slipId: slip.id,
          studentId: 's_child_1',
          parentName: 'Robert Johnson',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });
});
