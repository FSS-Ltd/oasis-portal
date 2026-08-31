import type { SessionUser } from '@oasis/domain';
import type { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';
import type { AppContext, RlsTx } from '../context.js';
import { academicInventoryRouter } from '../routers/academicInventory.js';
import { router } from '../trpc.js';

const HEAD: SessionUser = { id: 'user_head', role: 'Head', tags: [], requires2fa: false };
const SUPERVISOR: SessionUser = {
  id: 'user_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const STUDENT_ID = 'student_1';
const STUDENT_2_ID = 'student_2';
const SUBJECT_ID = 'subject_english';
const SUBJECT_2_ID = 'subject_math';

interface Assignment {
  id: string;
  studentId: string;
  subjectId: string;
  currentPaceNumber: number;
  subject: { id: string; code: string; name: string; active: boolean };
}

interface StudentRow {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
  subjects: Assignment[];
}

interface OrderRow {
  id: string;
  studentId: string;
  subjectId: string;
  paceNumber: number;
  status: 'Ordered' | 'InTransit' | 'Delivered';
  orderedAt: Date;
  inTransitAt: Date | null;
  deliveredAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DiagnosticRow {
  id: string;
  studentId: string;
  subjectId: string;
  level: number;
  outcome: 'Pass' | 'Fail';
  recordedById: string;
  recordedAt: Date;
  createdAt: Date;
  deletedAt: Date | null;
  deletedById: string | null;
}

interface SupplyRow {
  id: string;
  studentId: string;
  subjectId: string;
  paceNumber: number;
  source: 'CurrentStock' | 'DeliveredOrder';
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

type DiagnosticCreateData = Pick<
  DiagnosticRow,
  'studentId' | 'subjectId' | 'level' | 'outcome' | 'recordedById'
>;
type OrderCreateData = Pick<
  OrderRow,
  'studentId' | 'subjectId' | 'paceNumber' | 'createdById'
> & { status: 'Ordered' };

interface OrderUpdateArgs {
  where: { id: string };
  data: Partial<OrderRow>;
}

interface DiagnosticUpdateArgs {
  where: { id: string };
  data: { deletedAt: Date; deletedById: string };
}

interface AssignmentUpdateArgs {
  where: { studentId_subjectId: { studentId: string; subjectId: string } };
  data: { currentPaceNumber: number };
}

interface FakeDb {
  $enc: { decrypt: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  diagnosticResult: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  paceInventoryOrder: {
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  studentPaceSupply: {
    createMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  student: { findMany: ReturnType<typeof vi.fn> };
  studentSubject: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

const defaultStudents: StudentRow[] = [
  {
    id: STUDENT_ID,
    active: true,
    fullNameEnc: 'enc:Jane Learner',
    yearGroup: 'Year 6',
    subjects: [
      {
        id: 'assignment_1',
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1011,
        subject: { id: SUBJECT_ID, code: 'ENG', name: 'English', active: true },
      },
    ],
  },
];

function cloneStudents(students: StudentRow[]): StudentRow[] {
  return students.map((student) => ({
    ...student,
    subjects: student.subjects.map((assignment) => ({
      ...assignment,
      subject: { ...assignment.subject },
    })),
  }));
}

function makeFakeDb(studentFixtures: StudentRow[] = defaultStudents) {
  const students = cloneStudents(studentFixtures);
  const orders: OrderRow[] = [];
  const diagnostics: DiagnosticRow[] = [];
  const supply: SupplyRow[] = [];
  const transaction = vi.fn<(callback: (tx: FakeDb) => Promise<unknown>) => Promise<unknown>>();

  const findAssignment = (studentId: string, subjectId: string): Assignment | null =>
    students
      .find((student) => student.id === studentId)
      ?.subjects.find((assignment) => assignment.subjectId === subjectId) ?? null;

  const db: FakeDb = {
    $enc: {
      decrypt: vi.fn((value: string) => value.replace(/^enc:/, '')),
    },
    $transaction: transaction,
    auditLog: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'audit_1', ...data }),
      ),
    },
    diagnosticResult: {
      create: vi.fn(({ data }: { data: DiagnosticCreateData }) => {
        const now = new Date();
        const row: DiagnosticRow = {
          id: `diagnostic_${String(diagnostics.length + 1)}`,
          ...data,
          recordedAt: now,
          createdAt: now,
          deletedAt: null,
          deletedById: null,
        };
        diagnostics.push(row);
        return Promise.resolve(row);
      }),
      findMany: vi.fn(({ where }: { where?: { deletedAt?: null } } = {}) =>
        Promise.resolve(
          [...diagnostics]
            .filter((diagnostic) => where?.deletedAt === undefined || !diagnostic.deletedAt)
            .reverse(),
        ),
      ),
      findFirst: vi.fn(({ where }: { where: { id: string; deletedAt: null } }) =>
        Promise.resolve(
          diagnostics.find((diagnostic) => diagnostic.id === where.id && !diagnostic.deletedAt) ??
            null,
        ),
      ),
      update: vi.fn(({ where, data }: DiagnosticUpdateArgs) => {
        const diagnostic = diagnostics.find((candidate) => candidate.id === where.id);
        if (!diagnostic) throw new Error('diagnostic not found');
        Object.assign(diagnostic, data);
        return Promise.resolve(diagnostic);
      }),
    },
    paceInventoryOrder: {
      create: vi.fn(({ data }: { data: OrderCreateData }) => {
        const now = new Date();
        const row: OrderRow = {
          id: `order_${String(orders.length + 1)}`,
          ...data,
          status: 'Ordered',
          orderedAt: now,
          inTransitAt: null,
          deliveredAt: null,
          createdAt: now,
          updatedAt: now,
        };
        orders.push(row);
        return Promise.resolve(row);
      }),
      createMany: vi.fn(({ data }: { data: OrderCreateData[] }) => {
        const now = new Date();
        for (const item of data) {
          orders.push({
            id: `order_${String(orders.length + 1)}`,
            ...item,
            status: 'Ordered',
            orderedAt: now,
            inTransitAt: null,
            deliveredAt: null,
            createdAt: now,
            updatedAt: now,
          });
        }
        return Promise.resolve({ count: data.length });
      }),
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            studentId?: string | { in: string[] };
            subjectId?: string;
            paceNumber?: { in: number[] };
            status?: OrderRow['status'] | { in: OrderRow['status'][] };
          };
        } = {}) =>
          Promise.resolve(
            [...orders]
              .filter((order) => {
                if (
                  where?.studentId &&
                  (typeof where.studentId === 'string'
                    ? order.studentId !== where.studentId
                    : !where.studentId.in.includes(order.studentId))
                ) {
                  return false;
                }
                if (where?.subjectId && order.subjectId !== where.subjectId) return false;
                if (where?.paceNumber && !where.paceNumber.in.includes(order.paceNumber)) return false;
                if (!where?.status) return true;
                return typeof where.status === 'string'
                  ? order.status === where.status
                  : where.status.in.includes(order.status);
              })
              .reverse(),
          ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(orders.find((order) => order.id === where.id) ?? null),
      ),
      update: vi.fn(({ where, data }: OrderUpdateArgs) => {
        const order = orders.find((candidate) => candidate.id === where.id);
        if (!order) throw new Error('order not found');
        Object.assign(order, data, { updatedAt: new Date() });
        return Promise.resolve(order);
      }),
    },
    studentPaceSupply: {
      createMany: vi.fn(
        ({
          data,
        }: {
          data: Array<
            Pick<SupplyRow, 'studentId' | 'subjectId' | 'paceNumber' | 'source' | 'createdById'>
          >;
        }) => {
          const now = new Date();
          for (const item of data) {
            supply.push({
              id: `supply_${String(supply.length + 1)}`,
              ...item,
              createdAt: now,
              updatedAt: now,
            });
          }
          return Promise.resolve({ count: data.length });
        },
      ),
      findMany: vi.fn(() => Promise.resolve([...supply])),
      upsert: vi.fn(
        ({
          where: { studentId_subjectId_paceNumber: key },
          create,
        }: {
          where: {
            studentId_subjectId_paceNumber: Pick<
              SupplyRow,
              'studentId' | 'subjectId' | 'paceNumber'
            >;
          };
          create: Pick<
            SupplyRow,
            'studentId' | 'subjectId' | 'paceNumber' | 'source' | 'createdById'
          >;
        }) => {
          const existing = supply.find(
            (row) =>
              row.studentId === key.studentId &&
              row.subjectId === key.subjectId &&
              row.paceNumber === key.paceNumber,
          );
          if (existing) return Promise.resolve(existing);
          const now = new Date();
          const row: SupplyRow = {
            id: `supply_${String(supply.length + 1)}`,
            ...create,
            createdAt: now,
            updatedAt: now,
          };
          supply.push(row);
          return Promise.resolve(row);
        },
      ),
    },
    student: {
      findMany: vi.fn(() =>
        Promise.resolve(
          students.filter(
            (student) =>
              student.active && student.subjects.some((assignment) => assignment.subject.active),
          ),
        ),
      ),
    },
    studentSubject: {
      findFirst: vi.fn(
        ({ where }: { where: { studentId: string; subjectId: string } }) => {
          const student = students.find((candidate) => candidate.id === where.studentId);
          const assignment = findAssignment(where.studentId, where.subjectId);
          return Promise.resolve(
            student?.active && assignment?.subject.active ? assignment : null,
          );
        },
      ),
      findUnique: vi.fn(
        ({
          where: { studentId_subjectId: key },
        }: {
          where: { studentId_subjectId: { studentId: string; subjectId: string } };
        }) => Promise.resolve(findAssignment(key.studentId, key.subjectId)),
      ),
      update: vi.fn(
        ({ where: { studentId_subjectId: key }, data }: AssignmentUpdateArgs) => {
          const assignment = findAssignment(key.studentId, key.subjectId);
          if (!assignment) throw new Error('assignment not found');
          assignment.currentPaceNumber = data.currentPaceNumber;
          return Promise.resolve(assignment);
        },
      ),
    },
  };
  transaction.mockImplementation((callback) => callback(db));

  return { db, diagnostics, orders, students, supply };
}

function callArgs(mock: ReturnType<typeof vi.fn>, index = -1): unknown {
  const resolvedIndex = index < 0 ? mock.mock.calls.length + index : index;
  const call = mock.mock.calls[resolvedIndex] as unknown[] | undefined;
  if (!call?.[0]) throw new Error('expected mock call');
  return call[0];
}

function makeCaller(user: SessionUser, studentFixtures?: StudentRow[]) {
  const state = makeFakeDb(studentFixtures);
  const rejectDirectProtectedAccess = vi.fn(() =>
    Promise.reject(new Error('protected model accessed outside withRls')),
  );
  const directDb = {
    ...state.db,
    $transaction: rejectDirectProtectedAccess,
    diagnosticResult: {
      create: rejectDirectProtectedAccess,
      findMany: rejectDirectProtectedAccess,
      findFirst: rejectDirectProtectedAccess,
      update: rejectDirectProtectedAccess,
    },
    paceInventoryOrder: {
      create: rejectDirectProtectedAccess,
      createMany: rejectDirectProtectedAccess,
      findMany: rejectDirectProtectedAccess,
      findUnique: rejectDirectProtectedAccess,
      update: rejectDirectProtectedAccess,
    },
    studentPaceSupply: {
      createMany: rejectDirectProtectedAccess,
      findMany: rejectDirectProtectedAccess,
      upsert: rejectDirectProtectedAccess,
    },
    student: { findMany: rejectDirectProtectedAccess },
    studentSubject: {
      findFirst: rejectDirectProtectedAccess,
      findUnique: rejectDirectProtectedAccess,
      update: rejectDirectProtectedAccess,
    },
  };
  const withRls = vi.fn((callback: (tx: RlsTx) => Promise<unknown>) =>
    callback(state.db as unknown as RlsTx),
  );
  const context: AppContext = {
    db: directDb as unknown as AppContext['db'],
    user,
    requestId: 'req_inventory_test',
    withRls: withRls as unknown as AppContext['withRls'],
  };
  const testRouter = router({ academicInventory: academicInventoryRouter });
  return {
    ...state,
    caller: testRouter.createCaller(context),
    rejectDirectProtectedAccess,
    withRls,
  };
}

async function expectCode(promise: Promise<unknown>, code: TRPCError['code']): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

async function createOrder(
  caller: ReturnType<typeof makeCaller>['caller'],
  input: { studentId?: string; subjectId?: string; paceNumber?: number } = {},
) {
  return caller.academicInventory.createOrder({
    studentId: input.studentId ?? STUDENT_ID,
    subjectId: input.subjectId ?? SUBJECT_ID,
    paceNumber: input.paceNumber ?? 1013,
  });
}

async function addCurrentSupply(
  caller: ReturnType<typeof makeCaller>['caller'],
  paceNumbers: number[],
) {
  return caller.academicInventory.addCurrentSupply({
    studentId: STUDENT_ID,
    subjectId: SUBJECT_ID,
    paceNumbers,
  });
}

describe('academic inventory router', () => {
  it('allows a Head to create one order for a student, subject, and PACE', async () => {
    const { caller, db, orders, rejectDirectProtectedAccess, withRls } = makeCaller(HEAD);

    const result = await createOrder(caller);

    expect(result).toMatchObject({
      id: 'order_1',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumber: 1013,
      status: 'Ordered',
    });
    expect(orders).toHaveLength(1);
    expect(orders[0]).not.toHaveProperty('quantity');
    expect(withRls).toHaveBeenCalledOnce();
    expect(rejectDirectProtectedAccess).not.toHaveBeenCalled();
    const audit = callArgs(db.auditLog.create) as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({
      userId: HEAD.id,
      action: 'Create',
      entity: 'PaceInventoryOrder',
      entityId: 'order_1',
    });
  });

  it('adds selected current supply in one RLS bulk write', async () => {
    const { caller, db, supply } = makeCaller(HEAD);

    const result = await addCurrentSupply(caller, [1011, 1012]);

    expect(result).toEqual({ count: 2 });
    expect(supply.map((row) => row.paceNumber)).toEqual([1011, 1012]);
    expect(db.studentPaceSupply.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ paceNumber: 1011, source: 'CurrentStock' }),
        ]),
      }),
    );

    await expectCode(addCurrentSupply(caller, [1012]), 'BAD_REQUEST');
  });

  it('creates selected orders in one RLS bulk write', async () => {
    const { caller, db, orders } = makeCaller(HEAD);

    const result = await caller.academicInventory.createOrders({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumbers: [1013, 1014],
    });

    expect(result).toEqual({ count: 2 });
    expect(orders.map((row) => row.paceNumber)).toEqual([1013, 1014]);
    expect(db.paceInventoryOrder.createMany).toHaveBeenCalled();

    await expectCode(
      caller.academicInventory.createOrders({
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumbers: [1014],
      }),
      'BAD_REQUEST',
    );
  });

  it('rejects a Supervisor from every inventory procedure before database access', async () => {
    const { caller, orders, withRls } = makeCaller(SUPERVISOR);

    await expectCode(caller.academicInventory.summary(), 'FORBIDDEN');
    await expectCode(createOrder(caller), 'FORBIDDEN');
    await expectCode(addCurrentSupply(caller, [1011]), 'FORBIDDEN');
    await expectCode(
      caller.academicInventory.createOrders({
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumbers: [1013],
      }),
      'FORBIDDEN',
    );
    await expectCode(
      caller.academicInventory.updateOrderStatus({ orderId: 'order_1', status: 'InTransit' }),
      'FORBIDDEN',
    );
    await expectCode(
      caller.academicInventory.recordDiagnostic({
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        level: 2,
        outcome: 'Fail',
      }),
      'FORBIDDEN',
    );
    await expectCode(caller.academicInventory.deleteDiagnostic({ diagnosticId: 'diagnostic_1' }), 'FORBIDDEN');

    expect(withRls).not.toHaveBeenCalled();
    expect(orders).toHaveLength(0);
  });

  it('rejects an order for an unassigned subject', async () => {
    const { caller, orders } = makeCaller(HEAD);

    await expectCode(createOrder(caller, { subjectId: SUBJECT_2_ID }), 'BAD_REQUEST');

    expect(orders).toHaveLength(0);
  });

  it('rejects an order for an inactive student assignment', async () => {
    const students = cloneStudents(defaultStudents);
    const student = students[0];
    if (!student) throw new Error('expected student fixture');
    student.active = false;
    const { caller, orders } = makeCaller(HEAD, students);

    await expectCode(createOrder(caller), 'BAD_REQUEST');

    expect(orders).toHaveLength(0);
  });

  it('rejects a diagnostic for an inactive subject assignment', async () => {
    const students = cloneStudents(defaultStudents);
    const assignment = students[0]?.subjects[0];
    if (!assignment) throw new Error('expected assignment fixture');
    assignment.subject.active = false;
    const { caller, diagnostics } = makeCaller(HEAD, students);

    await expectCode(
      caller.academicInventory.recordDiagnostic({
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        level: 2,
        outcome: 'Fail',
      }),
      'BAD_REQUEST',
    );

    expect(diagnostics).toHaveLength(0);
  });

  it('moves orders through Ordered, InTransit, then Delivered', async () => {
    const { caller, db, supply, withRls } = makeCaller(HEAD);
    await addCurrentSupply(caller, [1013]);
    const order = await createOrder(caller);
    db.auditLog.create.mockClear();

    const inTransit = await caller.academicInventory.updateOrderStatus({
      orderId: order.id,
      status: 'InTransit',
    });
    expect(inTransit).toMatchObject({ status: 'InTransit', deliveredAt: null });
    expect(inTransit.inTransitAt).toBeInstanceOf(Date);
    const inTransitUpdate = callArgs(db.paceInventoryOrder.update) as OrderUpdateArgs;
    expect(inTransitUpdate.where).toEqual({ id: order.id });
    expect(Object.keys(inTransitUpdate.data).sort()).toEqual(['inTransitAt', 'status']);
    expect(inTransitUpdate.data).toMatchObject({ status: 'InTransit' });
    expect(inTransitUpdate.data.inTransitAt).toBeInstanceOf(Date);
    expect(callArgs(db.auditLog.create)).toMatchObject({
      data: {
        userId: HEAD.id,
        action: 'Update',
        entity: 'PaceInventoryOrder',
        entityId: order.id,
        meta: { fromStatus: 'Ordered', toStatus: 'InTransit' },
      },
    });

    const delivered = await caller.academicInventory.updateOrderStatus({
      orderId: order.id,
      status: 'Delivered',
    });
    expect(delivered).toMatchObject({ status: 'Delivered' });
    expect(delivered.deliveredAt).toBeInstanceOf(Date);
    const deliveredUpdate = callArgs(db.paceInventoryOrder.update) as OrderUpdateArgs;
    expect(deliveredUpdate.where).toEqual({ id: order.id });
    expect(Object.keys(deliveredUpdate.data).sort()).toEqual(['deliveredAt', 'status']);
    expect(deliveredUpdate.data).toMatchObject({ status: 'Delivered' });
    expect(deliveredUpdate.data.deliveredAt).toBeInstanceOf(Date);
    expect(db.studentPaceSupply.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_subjectId_paceNumber: {
            studentId: STUDENT_ID,
            subjectId: SUBJECT_ID,
            paceNumber: 1013,
          },
        },
        create: expect.objectContaining({ source: 'DeliveredOrder' }),
      }),
    );
    expect(supply).toHaveLength(1);
    expect(supply[0]).toMatchObject({ paceNumber: 1013, source: 'CurrentStock' });
    expect(withRls).toHaveBeenCalledTimes(4);
  });

  it('rejects skipped and backward order transitions', async () => {
    const { caller } = makeCaller(HEAD);
    const order = await createOrder(caller);

    await expectCode(
      caller.academicInventory.updateOrderStatus({ orderId: order.id, status: 'Delivered' }),
      'BAD_REQUEST',
    );
    await caller.academicInventory.updateOrderStatus({ orderId: order.id, status: 'InTransit' });
    await expectCode(
      caller.academicInventory.updateOrderStatus({ orderId: order.id, status: 'Ordered' }),
      'BAD_REQUEST',
    );
  });

  it('alerts at two PACEs remaining but not three', async () => {
    const students = cloneStudents(defaultStudents);
    const firstStudent = students[0];
    if (!firstStudent) throw new Error('expected student fixture');
    firstStudent.subjects.push({
      id: 'assignment_2',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_2_ID,
      currentPaceNumber: 1010,
      subject: { id: SUBJECT_2_ID, code: 'MATH', name: 'Maths', active: true },
    });
    const { caller } = makeCaller(HEAD, students);
    const englishOrder = await createOrder(caller, { paceNumber: 1013 });
    await caller.academicInventory.updateOrderStatus({
      orderId: englishOrder.id,
      status: 'InTransit',
    });
    await caller.academicInventory.updateOrderStatus({
      orderId: englishOrder.id,
      status: 'Delivered',
    });
    const mathsOrder = await createOrder(caller, {
      subjectId: SUBJECT_2_ID,
      paceNumber: 1013,
    });
    await caller.academicInventory.updateOrderStatus({
      orderId: mathsOrder.id,
      status: 'InTransit',
    });
    await caller.academicInventory.updateOrderStatus({
      orderId: mathsOrder.id,
      status: 'Delivered',
    });

    const summary = await caller.academicInventory.summary();

    expect(summary.alerts).toEqual([
      {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1011,
        availablePaceNumbers: [1013],
        remainingPaceCount: 1,
      },
      {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_2_ID,
        currentPaceNumber: 1010,
        availablePaceNumbers: [1013],
        remainingPaceCount: 1,
      },
    ]);
  });

  it('bases alerts exclusively on supplied PACEs ahead of the current PACE', async () => {
    const students = cloneStudents(defaultStudents);
    const assignment = students[0]?.subjects[0];
    if (!assignment) throw new Error('expected assignment fixture');
    assignment.currentPaceNumber = 1010;
    const { caller } = makeCaller(HEAD, students);

    await addCurrentSupply(caller, [1011, 1012]);
    let summary = await caller.academicInventory.summary();
    expect(summary.alerts).toEqual([
      {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1010,
        availablePaceNumbers: [1011, 1012],
        remainingPaceCount: 2,
      },
    ]);

    await addCurrentSupply(caller, [1013]);
    summary = await caller.academicInventory.summary();
    expect(summary.alerts).toEqual([]);

    const ordered = await caller.academicInventory.createOrders({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumbers: [1014],
    });
    expect(ordered).toEqual({ count: 1 });
    await caller.academicInventory.updateOrderStatus({ orderId: 'order_1', status: 'InTransit' });
    summary = await caller.academicInventory.summary();
    expect(summary.alerts).toEqual([]);
  });

  it('counts each delivered PACE as available supply', async () => {
    const { caller } = makeCaller(HEAD);
    const highest = await createOrder(caller, { paceNumber: 1014 });
    const latest = await createOrder(caller, { paceNumber: 1013 });
    for (const order of [highest, latest]) {
      await caller.academicInventory.updateOrderStatus({
        orderId: order.id,
        status: 'InTransit',
      });
      await caller.academicInventory.updateOrderStatus({
        orderId: order.id,
        status: 'Delivered',
      });
    }

    const summary = await caller.academicInventory.summary();

    expect(summary.alerts).toEqual([
      {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1011,
        availablePaceNumbers: [1013, 1014],
        remainingPaceCount: 2,
      },
    ]);
  });

  it('audits authorized summary name decryption after using the RLS client', async () => {
    const { caller, db, rejectDirectProtectedAccess, withRls } = makeCaller(HEAD);

    const summary = await caller.academicInventory.summary();

    expect(summary.students[0]?.fullName).toBe('Jane Learner');
    expect(withRls).toHaveBeenCalledOnce();
    expect(rejectDirectProtectedAccess).not.toHaveBeenCalled();
    expect(callArgs(db.auditLog.create)).toEqual({
      data: {
        userId: HEAD.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { source: 'academicInventory.summary', count: 1 },
      },
    });
  });

  it('does not let an InTransit PACE 1013 suppress a delivered-stock alert', async () => {
    const students = cloneStudents(defaultStudents);
    const firstStudent = students[0];
    if (!firstStudent?.subjects[0]) throw new Error('expected assignment fixture');
    firstStudent.subjects[0].currentPaceNumber = 1010;
    const { caller } = makeCaller(HEAD, students);
    const delivered = await createOrder(caller, { paceNumber: 1012 });
    await caller.academicInventory.updateOrderStatus({
      orderId: delivered.id,
      status: 'InTransit',
    });
    await caller.academicInventory.updateOrderStatus({
      orderId: delivered.id,
      status: 'Delivered',
    });
    const inTransit = await createOrder(caller, { paceNumber: 1013 });
    await caller.academicInventory.updateOrderStatus({
      orderId: inTransit.id,
      status: 'InTransit',
    });

    const summary = await caller.academicInventory.summary();

    expect(summary.alerts).toHaveLength(1);
    expect(summary.alerts[0]).toMatchObject({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      availablePaceNumbers: [1012],
      remainingPaceCount: 1,
    });
  });

  it('records a diagnostic without changing the assignment PACE', async () => {
    const { caller, db, diagnostics, rejectDirectProtectedAccess, withRls } = makeCaller(HEAD);

    const result = await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      level: 2,
      outcome: 'Fail',
    });

    expect(result).toMatchObject({ level: 2, outcome: 'Fail' });
    expect(diagnostics).toHaveLength(1);
    expect(withRls).toHaveBeenCalledOnce();
    expect(rejectDirectProtectedAccess).not.toHaveBeenCalled();
    expect(db.studentSubject.update).not.toHaveBeenCalled();
    expect(callArgs(db.auditLog.create)).toMatchObject({
      data: {
        userId: HEAD.id,
        action: 'Create',
        entity: 'DiagnosticResult',
        entityId: 'diagnostic_1',
      },
    });
  });

  it('soft-deletes a recorded diagnostic without touching the assignment', async () => {
    const { caller, db, diagnostics } = makeCaller(HEAD);
    const diagnostic = await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      level: 2,
      outcome: 'Fail',
    });

    const result = await caller.academicInventory.deleteDiagnostic({ diagnosticId: diagnostic.id });

    expect(result).toEqual({ id: diagnostic.id });
    expect(diagnostics[0]).toMatchObject({ deletedById: HEAD.id, deletedAt: expect.any(Date) });
    expect(db.diagnosticResult.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedById: HEAD.id, deletedAt: expect.any(Date) }),
      }),
    );
    expect(db.studentSubject.update).not.toHaveBeenCalled();
    const summary = await caller.academicInventory.summary();
    expect(summary.diagnostics).toEqual([]);
  });

  it('keeps two students orders and alerts separate', async () => {
    const students = cloneStudents(defaultStudents);
    students.push({
      id: STUDENT_2_ID,
      active: true,
      fullNameEnc: 'enc:John Learner',
      yearGroup: 'Year 7',
      subjects: [
        {
          id: 'assignment_2',
          studentId: STUDENT_2_ID,
          subjectId: SUBJECT_ID,
          currentPaceNumber: 1023,
          subject: { id: SUBJECT_ID, code: 'ENG', name: 'English', active: true },
        },
      ],
    });
    const { caller } = makeCaller(HEAD, students);
    const first = await createOrder(caller, { paceNumber: 1013 });
    const second = await createOrder(caller, { studentId: STUDENT_2_ID, paceNumber: 1025 });
    for (const order of [first, second]) {
      await caller.academicInventory.updateOrderStatus({
        orderId: order.id,
        status: 'InTransit',
      });
      await caller.academicInventory.updateOrderStatus({
        orderId: order.id,
        status: 'Delivered',
      });
    }

    const summary = await caller.academicInventory.summary();

    expect(summary.students.map((student) => student.fullName)).toEqual([
      'Jane Learner',
      'John Learner',
    ]);
    expect(summary.orders.map((order) => [order.studentId, order.paceNumber])).toEqual([
      [STUDENT_2_ID, 1025],
      [STUDENT_ID, 1013],
    ]);
    expect(summary.alerts).toEqual([
      {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1011,
        availablePaceNumbers: [1013],
        remainingPaceCount: 1,
      },
      {
        studentId: STUDENT_2_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1023,
        availablePaceNumbers: [1025],
        remainingPaceCount: 1,
      },
    ]);
  });
});
