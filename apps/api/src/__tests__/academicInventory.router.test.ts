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
  };
  paceInventoryOrder: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  student: { findMany: ReturnType<typeof vi.fn> };
  studentSubject: {
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
        };
        diagnostics.push(row);
        return Promise.resolve(row);
      }),
      findMany: vi.fn(() => Promise.resolve([...diagnostics].reverse())),
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
      findMany: vi.fn(({ where }: { where?: { status?: OrderRow['status'] } } = {}) =>
        Promise.resolve(
          [...orders]
            .filter((order) => where?.status === undefined || order.status === where.status)
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

  return { db, diagnostics, orders, students };
}

function callArgs(mock: ReturnType<typeof vi.fn>, index = -1): unknown {
  const resolvedIndex = index < 0 ? mock.mock.calls.length + index : index;
  const call = mock.mock.calls[resolvedIndex] as unknown[] | undefined;
  if (!call?.[0]) throw new Error('expected mock call');
  return call[0];
}

function makeCaller(user: SessionUser, studentFixtures?: StudentRow[]) {
  const state = makeFakeDb(studentFixtures);
  const context: AppContext = {
    db: state.db as unknown as AppContext['db'],
    user,
    requestId: 'req_inventory_test',
    withRls: async <T>(callback: (tx: RlsTx) => Promise<T>) =>
      callback(state.db as unknown as RlsTx),
  };
  const testRouter = router({ academicInventory: academicInventoryRouter });
  return { ...state, caller: testRouter.createCaller(context) };
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

describe('academic inventory router', () => {
  it('allows a Head to create one order for a student, subject, and PACE', async () => {
    const { caller, db, orders } = makeCaller(HEAD);

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
    const audit = callArgs(db.auditLog.create) as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({
      userId: HEAD.id,
      action: 'Create',
      entity: 'PaceInventoryOrder',
      entityId: 'order_1',
    });
  });

  it('rejects a Supervisor before creating an order', async () => {
    const { caller, orders } = makeCaller(SUPERVISOR);

    await expectCode(createOrder(caller), 'FORBIDDEN');

    expect(orders).toHaveLength(0);
  });

  it('rejects an order for an unassigned subject', async () => {
    const { caller, orders } = makeCaller(HEAD);

    await expectCode(createOrder(caller, { subjectId: SUBJECT_2_ID }), 'BAD_REQUEST');

    expect(orders).toHaveLength(0);
  });

  it('moves orders through Ordered, InTransit, then Delivered', async () => {
    const { caller, db } = makeCaller(HEAD);
    const order = await createOrder(caller);

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
        deliveredPaceNumber: 1013,
      },
    ]);
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
      deliveredPaceNumber: 1012,
    });
  });

  it('records a Level 2 failure and advances the assignment to PACE 1013 transactionally', async () => {
    const { caller, db, diagnostics } = makeCaller(HEAD);

    const result = await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      level: 2,
      outcome: 'Fail',
    });

    expect(result).toMatchObject({ level: 2, outcome: 'Fail' });
    expect(diagnostics).toHaveLength(1);
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.studentSubject.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentPaceNumber: 1013 } }),
    );
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
        deliveredPaceNumber: 1013,
      },
      {
        studentId: STUDENT_2_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1023,
        deliveredPaceNumber: 1025,
      },
    ]);
  });
});
