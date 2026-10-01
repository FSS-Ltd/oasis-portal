import { PACE_CATALOGUE, type SessionUser } from '@oasis/domain';
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

interface StudentFindManyArgs {
  where?: { subjects?: { some?: { subject?: { code?: { in: string[] } } } } };
  select?: { subjects?: { where?: { subject?: { code?: { in: string[] } } } } };
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
type OrderCreateData = Pick<OrderRow, 'studentId' | 'subjectId' | 'paceNumber' | 'createdById'> & {
  status: 'Ordered';
};

interface OrderUpdateArgs {
  where: { id: string; status?: OrderRow['status'] };
  data: Partial<OrderRow>;
}

interface DiagnosticUpdateArgs {
  where: { id: string; deletedAt?: null };
  data: { deletedAt: Date; deletedById: string };
}

interface SupplyCreateManyArgs {
  data: Array<Pick<SupplyRow, 'studentId' | 'subjectId' | 'paceNumber' | 'source' | 'createdById'>>;
}

interface SupplyUpsertArgs {
  where: {
    studentId_subjectId_paceNumber: Pick<SupplyRow, 'studentId' | 'subjectId' | 'paceNumber'>;
  };
  create: Pick<SupplyRow, 'studentId' | 'subjectId' | 'paceNumber' | 'source' | 'createdById'>;
}

type SortDirection = 'asc' | 'desc';

interface OrderOrderBy {
  createdAt?: SortDirection;
  id?: SortDirection;
}

interface DiagnosticOrderBy {
  id?: SortDirection;
  recordedAt?: SortDirection;
}

interface AssignmentUpdateArgs {
  where: { studentId_subjectId: { studentId: string; subjectId: string } };
  data: { currentPaceNumber: number };
}

interface FakeDb {
  $enc: { decrypt: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  $executeRaw: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  diagnosticResult: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  paceInventoryOrder: {
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  paceGapPlan: { findMany: ReturnType<typeof vi.fn> };
  paceProgress: { findMany: ReturnType<typeof vi.fn> };
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

function directionAdjusted(comparison: number, direction: SortDirection): number {
  return direction === 'asc' ? comparison : -comparison;
}

function sortOrderRows(rows: OrderRow[], orderBy?: OrderOrderBy | OrderOrderBy[]): OrderRow[] {
  const clauses = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  return rows.sort((left, right) => {
    for (const clause of clauses) {
      if (clause.createdAt) {
        const comparison = directionAdjusted(
          left.createdAt.getTime() - right.createdAt.getTime(),
          clause.createdAt,
        );
        if (comparison !== 0) return comparison;
      }
      if (clause.id) {
        const comparison = directionAdjusted(left.id.localeCompare(right.id), clause.id);
        if (comparison !== 0) return comparison;
      }
    }
    return 0;
  });
}

function sortDiagnosticRows(
  rows: DiagnosticRow[],
  orderBy?: DiagnosticOrderBy | DiagnosticOrderBy[],
): DiagnosticRow[] {
  const clauses = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  return rows.sort((left, right) => {
    for (const clause of clauses) {
      if (clause.recordedAt) {
        const comparison = directionAdjusted(
          left.recordedAt.getTime() - right.recordedAt.getTime(),
          clause.recordedAt,
        );
        if (comparison !== 0) return comparison;
      }
      if (clause.id) {
        const comparison = directionAdjusted(left.id.localeCompare(right.id), clause.id);
        if (comparison !== 0) return comparison;
      }
    }
    return 0;
  });
}

function makeFakeDb(studentFixtures: StudentRow[] = defaultStudents) {
  const students = cloneStudents(studentFixtures);
  const orders: OrderRow[] = [];
  const diagnostics: DiagnosticRow[] = [];
  const supply: SupplyRow[] = [];
  const rlsState = { depth: 0 };
  const auditInsideRls: boolean[] = [];
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
    $executeRaw: vi.fn().mockResolvedValue(0),
    auditLog: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        auditInsideRls.push(rlsState.depth > 0);
        return Promise.resolve({ id: 'audit_1', ...data });
      }),
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
      findMany: vi.fn(
        ({
          orderBy,
          take,
          where,
        }: {
          orderBy?: DiagnosticOrderBy | DiagnosticOrderBy[];
          take?: number;
          where?: {
            deletedAt?: null;
            OR?: Array<{ studentId: string; subjectId: string }>;
          };
        } = {}) => {
          const rows = sortDiagnosticRows(
            [...diagnostics]
              .filter((diagnostic) => {
                if (where?.deletedAt !== undefined && diagnostic.deletedAt) return false;
                return (
                  !where?.OR ||
                  where.OR.some(
                    (assignment) =>
                      diagnostic.studentId === assignment.studentId &&
                      diagnostic.subjectId === assignment.subjectId,
                  )
                );
              })
              .reverse(),
            orderBy,
          );
          return Promise.resolve(take === undefined ? rows : rows.slice(0, take));
        },
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
      updateMany: vi.fn(({ where, data }: DiagnosticUpdateArgs) => {
        const diagnostic = diagnostics.find(
          (candidate) => candidate.id === where.id && !candidate.deletedAt,
        );
        if (!diagnostic) return Promise.resolve({ count: 0 });
        Object.assign(diagnostic, data);
        return Promise.resolve({ count: 1 });
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
          orderBy,
          take,
          where,
        }: {
          orderBy?: OrderOrderBy | OrderOrderBy[];
          take?: number;
          where?: {
            studentId?: string | { in: string[] };
            subjectId?: string;
            paceNumber?: { in: number[] };
            status?: OrderRow['status'] | { in: OrderRow['status'][] };
            OR?: Array<{ studentId: string; subjectId: string }>;
          };
        } = {}) => {
          const rows = sortOrderRows(
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
                if (where?.paceNumber && !where.paceNumber.in.includes(order.paceNumber))
                  return false;
                if (
                  where?.OR &&
                  !where.OR.some(
                    (assignment) =>
                      order.studentId === assignment.studentId &&
                      order.subjectId === assignment.subjectId,
                  )
                ) {
                  return false;
                }
                if (!where?.status) return true;
                return typeof where.status === 'string'
                  ? order.status === where.status
                  : where.status.in.includes(order.status);
              })
              .reverse(),
            orderBy,
          );
          return Promise.resolve(take === undefined ? rows : rows.slice(0, take));
        },
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
      updateMany: vi.fn(({ where, data }: OrderUpdateArgs) => {
        const order = orders.find(
          (candidate) => candidate.id === where.id && candidate.status === where.status,
        );
        if (!order) return Promise.resolve({ count: 0 });
        Object.assign(order, data, { updatedAt: new Date() });
        return Promise.resolve({ count: 1 });
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
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            studentId?: string | { in: string[] };
            subjectId?: string;
            paceNumber?: { in: number[] };
            OR?: Array<{ studentId: string; subjectId: string }>;
          };
        } = {}) =>
          Promise.resolve(
            supply.filter((item) => {
              if (
                where?.studentId &&
                (typeof where.studentId === 'string'
                  ? item.studentId !== where.studentId
                  : !where.studentId.in.includes(item.studentId))
              ) {
                return false;
              }
              if (where?.subjectId && item.subjectId !== where.subjectId) return false;
              if (where?.paceNumber && !where.paceNumber.in.includes(item.paceNumber)) return false;
              return (
                !where?.OR ||
                where.OR.some(
                  (assignment) =>
                    item.studentId === assignment.studentId &&
                    item.subjectId === assignment.subjectId,
                )
              );
            }),
          ),
      ),
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
    paceGapPlan: { findMany: vi.fn().mockResolvedValue([]) },
    paceProgress: { findMany: vi.fn().mockResolvedValue([]) },
    student: {
      findMany: vi.fn(({ where, select }: StudentFindManyArgs = {}) =>
        Promise.resolve(
          students
            .filter(
              (student) =>
                student.active &&
                student.subjects.some(
                  (assignment) =>
                    assignment.subject.active &&
                    (!where?.subjects?.some?.subject?.code ||
                      where.subjects.some.subject.code.in.includes(assignment.subject.code)),
                ),
            )
            .map((student) => ({
              ...student,
              subjects: student.subjects.filter(
                (assignment) =>
                  assignment.subject.active &&
                  (!select?.subjects?.where?.subject?.code ||
                    select.subjects.where.subject.code.in.includes(assignment.subject.code)),
              ),
            })),
        ),
      ),
    },
    studentSubject: {
      findFirst: vi.fn(({ where }: { where: { studentId: string; subjectId: string } }) => {
        const student = students.find((candidate) => candidate.id === where.studentId);
        const assignment = findAssignment(where.studentId, where.subjectId);
        return Promise.resolve(student?.active && assignment?.subject.active ? assignment : null);
      }),
      findUnique: vi.fn(
        ({
          where: { studentId_subjectId: key },
        }: {
          where: { studentId_subjectId: { studentId: string; subjectId: string } };
        }) => Promise.resolve(findAssignment(key.studentId, key.subjectId)),
      ),
      update: vi.fn(({ where: { studentId_subjectId: key }, data }: AssignmentUpdateArgs) => {
        const assignment = findAssignment(key.studentId, key.subjectId);
        if (!assignment) throw new Error('assignment not found');
        assignment.currentPaceNumber = data.currentPaceNumber;
        return Promise.resolve(assignment);
      }),
    },
  };
  transaction.mockImplementation(async (callback) => {
    rlsState.depth += 1;
    try {
      return await callback(db);
    } finally {
      rlsState.depth -= 1;
    }
  });

  return { auditInsideRls, db, diagnostics, orders, rlsState, students, supply };
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
    $transaction: state.db.$transaction,
    diagnosticResult: {
      create: rejectDirectProtectedAccess,
      findMany: rejectDirectProtectedAccess,
      findFirst: rejectDirectProtectedAccess,
      update: rejectDirectProtectedAccess,
      updateMany: rejectDirectProtectedAccess,
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
  const runWithRls = async (callback: (tx: RlsTx) => Promise<unknown>) => {
    state.rlsState.depth += 1;
    try {
      return await callback(state.db as unknown as RlsTx);
    } finally {
      state.rlsState.depth -= 1;
    }
  };
  const withRls = vi.fn(runWithRls);
  const context: AppContext = {
    db: directDb as unknown as AppContext['db'],
    user,
    accountAccessState: 'active',
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
    const { auditInsideRls, caller, db, orders, rejectDirectProtectedAccess } = makeCaller(HEAD);

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
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(rejectDirectProtectedAccess).not.toHaveBeenCalled();
    const audit = callArgs(db.auditLog.create) as { data: Record<string, unknown> };
    expect(audit.data).toMatchObject({
      userId: HEAD.id,
      action: 'Create',
      entity: 'PaceInventoryOrder',
      entityId: 'order_1',
    });
    expect(auditInsideRls).toEqual([true]);
  });

  it('adds selected current supply in one RLS bulk write', async () => {
    const { auditInsideRls, caller, db, supply } = makeCaller(HEAD);

    const result = await addCurrentSupply(caller, [1011, 1012]);

    expect(result).toEqual({ count: 2 });
    expect(supply.map((row) => row.paceNumber)).toEqual([1011, 1012]);
    const supplyCreate = callArgs(db.studentPaceSupply.createMany) as SupplyCreateManyArgs;
    expect(supplyCreate.data).toContainEqual(
      expect.objectContaining({ paceNumber: 1011, source: 'CurrentStock' }),
    );
    expect(auditInsideRls).toEqual([true]);

    await expectCode(addCurrentSupply(caller, [1012]), 'BAD_REQUEST');
  });

  it('creates selected orders in one RLS bulk write', async () => {
    const { auditInsideRls, caller, db, orders } = makeCaller(HEAD);

    const result = await caller.academicInventory.createOrders({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumbers: [1013, 1014],
    });

    expect(result).toEqual({ count: 2 });
    expect(orders.map((row) => row.paceNumber)).toEqual([1013, 1014]);
    expect(db.paceInventoryOrder.createMany).toHaveBeenCalled();
    expect(auditInsideRls).toEqual([true]);

    await expectCode(
      caller.academicInventory.createOrders({
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumbers: [1014],
      }),
      'BAD_REQUEST',
    );
  });

  it('rejects supply and order entry when the selected PACE is already unavailable', async () => {
    const supplied = makeCaller(HEAD);
    await addCurrentSupply(supplied.caller, [1011]);

    await expectCode(createOrder(supplied.caller, { paceNumber: 1011 }), 'BAD_REQUEST');
    await expectCode(
      supplied.caller.academicInventory.createOrders({
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumbers: [1011],
      }),
      'BAD_REQUEST',
    );

    const pending = makeCaller(HEAD);
    await createOrder(pending.caller, { paceNumber: 1013 });

    await expectCode(addCurrentSupply(pending.caller, [1013]), 'BAD_REQUEST');
    await expectCode(
      pending.caller.academicInventory.createOrders({
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumbers: [1013],
      }),
      'BAD_REQUEST',
    );

    const bulkPending = makeCaller(HEAD);
    await bulkPending.caller.academicInventory.createOrders({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumbers: [1014],
    });
    await expectCode(createOrder(bulkPending.caller, { paceNumber: 1014 }), 'BAD_REQUEST');
  });

  it('maps a concurrent supply uniqueness conflict to a safe retriable error', async () => {
    const { caller, db, supply } = makeCaller(HEAD);
    db.studentPaceSupply.createMany.mockRejectedValueOnce({ code: 'P2002' });

    await expectCode(addCurrentSupply(caller, [1011]), 'CONFLICT');

    expect(supply).toEqual([]);
    expect(db.auditLog.create).not.toHaveBeenCalled();
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
    await expectCode(
      caller.academicInventory.deleteDiagnostic({ diagnosticId: 'diagnostic_1' }),
      'FORBIDDEN',
    );

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
    const { auditInsideRls, caller, db, orders, supply } = makeCaller(HEAD);
    await addCurrentSupply(caller, [1013]);
    const now = new Date();
    const order: OrderRow = {
      id: 'order_1',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumber: 1013,
      status: 'Ordered',
      orderedAt: now,
      inTransitAt: null,
      deliveredAt: null,
      createdById: HEAD.id,
      createdAt: now,
      updatedAt: now,
    };
    orders.push(order);
    db.auditLog.create.mockClear();

    const inTransit = await caller.academicInventory.updateOrderStatus({
      orderId: order.id,
      status: 'InTransit',
    });
    expect(inTransit).toMatchObject({ status: 'InTransit', deliveredAt: null });
    expect(inTransit.inTransitAt).toBeInstanceOf(Date);
    const inTransitUpdate = callArgs(db.paceInventoryOrder.updateMany) as OrderUpdateArgs;
    expect(inTransitUpdate.where).toEqual({ id: order.id, status: 'Ordered' });
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
    const deliveredUpdate = callArgs(db.paceInventoryOrder.updateMany) as OrderUpdateArgs;
    expect(deliveredUpdate.where).toEqual({ id: order.id, status: 'InTransit' });
    expect(Object.keys(deliveredUpdate.data).sort()).toEqual(['deliveredAt', 'status']);
    expect(deliveredUpdate.data).toMatchObject({ status: 'Delivered' });
    expect(deliveredUpdate.data.deliveredAt).toBeInstanceOf(Date);
    const supplyUpsert = callArgs(db.studentPaceSupply.upsert) as SupplyUpsertArgs;
    expect(supplyUpsert.where).toEqual({
      studentId_subjectId_paceNumber: {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1013,
      },
    });
    expect(supplyUpsert.create.source).toBe('DeliveredOrder');
    expect(supply).toHaveLength(1);
    expect(supply[0]).toMatchObject({ paceNumber: 1013, source: 'CurrentStock' });
    expect(db.$transaction).toHaveBeenCalledTimes(3);
    expect(auditInsideRls).toEqual([true, true, true]);
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

  it('fails a conditional order-status update race without supply or an audit', async () => {
    const { caller, db, supply } = makeCaller(HEAD);
    const order = await createOrder(caller);
    db.auditLog.create.mockClear();
    db.paceInventoryOrder.updateMany.mockResolvedValueOnce({ count: 0 });

    await expectCode(
      caller.academicInventory.updateOrderStatus({ orderId: order.id, status: 'InTransit' }),
      'CONFLICT',
    );

    expect(db.paceInventoryOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: order.id, status: 'Ordered' } }),
    );
    expect(supply).toEqual([]);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects delivery of a legacy out-of-range order before any write', async () => {
    const { caller, db, orders, supply } = makeCaller(HEAD);
    const now = new Date('2026-08-31T12:00:00.000Z');
    orders.push({
      id: 'legacy-order',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumber: 1145,
      status: 'InTransit',
      orderedAt: now,
      inTransitAt: now,
      deliveredAt: null,
      createdById: HEAD.id,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      caller.academicInventory.updateOrderStatus({
        orderId: 'legacy-order',
        status: 'Delivered',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'PACE orders outside the supported range cannot be marked delivered.',
    });

    expect(db.paceInventoryOrder.updateMany).not.toHaveBeenCalled();
    expect(db.studentPaceSupply.upsert).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(supply).toEqual([]);
    expect(orders[0]).toMatchObject({ status: 'InTransit', deliveredAt: null });
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

  it('shows low supply only when no future PACEs are ordered or in transit', async () => {
    const students = cloneStudents(defaultStudents);
    const assignment = students[0]?.subjects[0];
    if (!assignment) throw new Error('expected assignment fixture');
    assignment.currentPaceNumber = 1141;
    const { caller } = makeCaller(HEAD, students);

    await addCurrentSupply(caller, [1142, 1143]);
    let summary = await caller.academicInventory.summary();
    expect(summary.alerts).toMatchObject([
      {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        availablePaceNumbers: [1142, 1143],
        remainingPaceCount: 2,
      },
    ]);

    const outstandingOrder = await createOrder(caller, { paceNumber: 1144 });
    expect((await caller.academicInventory.summary()).alerts).toEqual([]);
    await caller.academicInventory.updateOrderStatus({
      orderId: outstandingOrder.id,
      status: 'InTransit',
    });
    summary = await caller.academicInventory.summary();
    expect(summary.alerts).toEqual([]);
  });

  it('returns every outstanding order while bounding delivered history', async () => {
    const { caller, orders } = makeCaller(HEAD);
    const baseTime = Date.parse('2026-08-31T08:00:00.000Z');

    for (const [index, paceNumber] of PACE_CATALOGUE.entries()) {
      const createdAt = new Date(baseTime + index * 1_000);
      orders.push({
        id: `outstanding-${String(index).padStart(3, '0')}`,
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber,
        status: index % 2 === 0 ? 'Ordered' : 'InTransit',
        orderedAt: createdAt,
        inTransitAt: index % 2 === 0 ? null : createdAt,
        deliveredAt: null,
        createdById: HEAD.id,
        createdAt,
        updatedAt: createdAt,
      });
    }
    for (let index = 0; index < 105; index += 1) {
      const createdAt = new Date(baseTime + 200_000 + index * 1_000);
      orders.push({
        id: `delivered-${String(index).padStart(3, '0')}`,
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1001 + index,
        status: 'Delivered',
        orderedAt: createdAt,
        inTransitAt: createdAt,
        deliveredAt: createdAt,
        createdById: HEAD.id,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const summary = await caller.academicInventory.summary();
    const outstandingOrders = summary.orders.filter((order) => order.status !== 'Delivered');
    const deliveredOrders = summary.orders.filter((order) => order.status === 'Delivered');
    const unavailablePaceNumbers = new Set(
      outstandingOrders
        .filter((order) => order.studentId === STUDENT_ID && order.subjectId === SUBJECT_ID)
        .map((order) => order.paceNumber),
    );

    expect(outstandingOrders).toHaveLength(144);
    expect(PACE_CATALOGUE.every((paceNumber) => unavailablePaceNumbers.has(paceNumber))).toBe(true);
    expect(deliveredOrders).toHaveLength(100);
    expect(deliveredOrders.some((order) => order.id === 'delivered-104')).toBe(true);
    expect(deliveredOrders.some((order) => order.id === 'delivered-000')).toBe(false);
  });

  it('returns every active diagnostic reference', async () => {
    const { caller, diagnostics } = makeCaller(HEAD);
    const baseTime = Date.parse('2026-08-31T08:00:00.000Z');
    for (let index = 0; index < 105; index += 1) {
      const recordedAt = new Date(baseTime + index * 1_000);
      diagnostics.push({
        id: `diagnostic-${String(index).padStart(3, '0')}`,
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        level: (index % 5) + 1,
        outcome: index % 2 === 0 ? 'Pass' : 'Fail',
        recordedById: HEAD.id,
        recordedAt,
        createdAt: recordedAt,
        deletedAt: null,
        deletedById: null,
      });
    }

    const summary = await caller.academicInventory.summary();

    expect(summary.diagnostics).toHaveLength(105);
  });

  it('orders combined outstanding and delivered history deterministically', async () => {
    const { caller, orders } = makeCaller(HEAD);
    const createdAt = new Date('2026-08-31T12:00:00.000Z');
    orders.push(
      {
        id: 'order-z',
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1013,
        status: 'Ordered',
        orderedAt: createdAt,
        inTransitAt: null,
        deliveredAt: null,
        createdById: HEAD.id,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'order-a',
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        paceNumber: 1014,
        status: 'Delivered',
        orderedAt: createdAt,
        inTransitAt: createdAt,
        deliveredAt: createdAt,
        createdById: HEAD.id,
        createdAt,
        updatedAt: createdAt,
      },
    );

    const summary = await caller.academicInventory.summary();

    expect(summary.orders.map((order) => order.id)).toEqual(['order-z', 'order-a']);
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

  it('returns only active ACE assignments and related inventory records', async () => {
    const defaultStudent = defaultStudents[0];
    if (!defaultStudent) throw new Error('expected default student fixture');
    const customStudentId = 'student_custom_only';
    const students: StudentRow[] = [
      {
        ...defaultStudent,
        subjects: [
          ...defaultStudent.subjects,
          {
            id: 'assignment_math',
            studentId: STUDENT_ID,
            subjectId: SUBJECT_2_ID,
            currentPaceNumber: 1011,
            subject: { id: SUBJECT_2_ID, code: 'MATH', name: 'Mathematics', active: true },
          },
          {
            id: 'assignment_custom',
            studentId: STUDENT_ID,
            subjectId: 'subject_custom',
            currentPaceNumber: 1011,
            subject: {
              id: 'subject_custom',
              code: 'CUSTOM-ANIMAL',
              name: 'Animal Science',
              active: true,
            },
          },
          {
            id: 'assignment_inactive',
            studentId: STUDENT_ID,
            subjectId: 'subject_inactive',
            currentPaceNumber: 1011,
            subject: { id: 'subject_inactive', code: 'SCI', name: 'Science', active: false },
          },
        ],
      },
      {
        id: customStudentId,
        active: true,
        fullNameEnc: 'enc:Custom Only',
        yearGroup: 'Year 6',
        subjects: [
          {
            id: 'assignment_custom_only',
            studentId: customStudentId,
            subjectId: 'subject_special',
            currentPaceNumber: 1011,
            subject: {
              id: 'subject_special',
              code: 'SPECIAL',
              name: 'Special Subject',
              active: true,
            },
          },
        ],
      },
    ];
    const { caller, diagnostics, orders, supply } = makeCaller(HEAD, students);
    const now = new Date();
    orders.push({
      id: 'custom-order',
      studentId: STUDENT_ID,
      subjectId: 'subject_custom',
      paceNumber: 1012,
      status: 'Ordered',
      orderedAt: now,
      inTransitAt: null,
      deliveredAt: null,
      createdById: HEAD.id,
      createdAt: now,
      updatedAt: now,
    });
    diagnostics.push({
      id: 'custom-diagnostic',
      studentId: STUDENT_ID,
      subjectId: 'subject_custom',
      level: 1,
      outcome: 'Pass',
      recordedById: HEAD.id,
      recordedAt: now,
      createdAt: now,
      deletedAt: null,
      deletedById: null,
    });
    supply.push({
      id: 'custom-supply',
      studentId: STUDENT_ID,
      subjectId: 'subject_custom',
      paceNumber: 1012,
      source: 'CurrentStock',
      createdById: HEAD.id,
      createdAt: now,
      updatedAt: now,
    });

    const summary = await caller.academicInventory.summary();

    expect(summary.students.map((student) => student.id)).toEqual([STUDENT_ID]);
    expect(summary.students[0]?.subjects.map((row) => row.subject.code)).toEqual(['ENG', 'MATH']);
    expect(summary.orders).toEqual([]);
    expect(summary.diagnostics).toEqual([]);
    expect(summary.supply).toEqual([]);
  });

  it('returns history only for active student-subject assignments', async () => {
    const { caller, diagnostics, orders, supply } = makeCaller(HEAD);
    const now = new Date();
    orders.push({
      id: 'historic-order',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_2_ID,
      paceNumber: 1013,
      status: 'Delivered',
      orderedAt: now,
      inTransitAt: now,
      deliveredAt: now,
      createdById: HEAD.id,
      createdAt: now,
      updatedAt: now,
    });
    diagnostics.push({
      id: 'historic-diagnostic',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_2_ID,
      level: 2,
      outcome: 'Pass',
      recordedById: HEAD.id,
      recordedAt: now,
      createdAt: now,
      deletedAt: null,
      deletedById: null,
    });
    supply.push({
      id: 'historic-supply',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_2_ID,
      paceNumber: 1013,
      source: 'DeliveredOrder',
      createdById: HEAD.id,
      createdAt: now,
      updatedAt: now,
    });

    const summary = await caller.academicInventory.summary();

    expect(summary.orders).toEqual([]);
    expect(summary.diagnostics).toEqual([]);
    expect(summary.supply).toEqual([]);
  });

  it('hides a low-stock alert while a future PACE is in transit', async () => {
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

    expect(summary.alerts).toEqual([]);
  });

  it('records a diagnostic without changing the assignment PACE', async () => {
    const { auditInsideRls, caller, db, diagnostics, rejectDirectProtectedAccess, withRls } =
      makeCaller(HEAD);

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
    expect(auditInsideRls).toEqual([true]);
  });

  it('soft-deletes a recorded diagnostic without touching the assignment', async () => {
    const { auditInsideRls, caller, db, diagnostics } = makeCaller(HEAD);
    const diagnostic = await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      level: 2,
      outcome: 'Fail',
    });

    const result = await caller.academicInventory.deleteDiagnostic({ diagnosticId: diagnostic.id });

    expect(result).toEqual({ id: diagnostic.id });
    expect(diagnostics[0]?.deletedById).toBe(HEAD.id);
    expect(diagnostics[0]?.deletedAt).toBeInstanceOf(Date);
    const diagnosticUpdate = callArgs(db.diagnosticResult.updateMany) as DiagnosticUpdateArgs;
    expect(diagnosticUpdate.where).toEqual({ id: diagnostic.id, deletedAt: null });
    expect(diagnosticUpdate.data.deletedById).toBe(HEAD.id);
    expect(diagnosticUpdate.data.deletedAt).toBeInstanceOf(Date);
    expect(db.studentSubject.update).not.toHaveBeenCalled();
    expect(auditInsideRls).toEqual([true, true]);
    const summary = await caller.academicInventory.summary();
    expect(summary.diagnostics).toEqual([]);
  });

  it('does not audit when another Head deletes a diagnostic first', async () => {
    const { caller, db } = makeCaller(HEAD);
    const diagnostic = await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      level: 2,
      outcome: 'Fail',
    });
    db.auditLog.create.mockClear();
    db.diagnosticResult.updateMany.mockResolvedValueOnce({ count: 0 });

    await expectCode(
      caller.academicInventory.deleteDiagnostic({ diagnosticId: diagnostic.id }),
      'NOT_FOUND',
    );

    expect(db.diagnosticResult.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: diagnostic.id, deletedAt: null } }),
    );
    expect(db.auditLog.create).not.toHaveBeenCalled();
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
