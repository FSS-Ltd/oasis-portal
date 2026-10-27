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
  where?: { id?: string; subjects?: { some?: { subject?: { code?: { in: string[] } } } } };
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
  subjectId: string | null;
  test: 'Math' | 'English' | 'WordBuilding' | 'Reading' | null;
  level: number | null;
  outcome: 'Pass' | 'Fail' | null;
  attemptedPaceNumbers: number[];
  circledPaceNumbers: number[];
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
  | 'studentId'
  | 'subjectId'
  | 'test'
  | 'level'
  | 'outcome'
  | 'attemptedPaceNumbers'
  | 'circledPaceNumbers'
  | 'recordedById'
>;
type DiagnosticOrClause = { studentId: string | { in: string[] }; subjectId?: string | null };

function matchesDiagnosticClause(row: DiagnosticRow, clause: DiagnosticOrClause): boolean {
  const studentMatches =
    typeof clause.studentId === 'string'
      ? row.studentId === clause.studentId
      : clause.studentId.in.includes(row.studentId);
  return studentMatches && (clause.subjectId === undefined || row.subjectId === clause.subjectId);
}
type OrderCreateData = Pick<OrderRow, 'studentId' | 'subjectId' | 'paceNumber' | 'createdById'> & {
  status: 'Ordered';
};

interface OrderUpdateArgs {
  where: { id: string | { in: string[] }; status?: OrderRow['status'] };
  data: Partial<OrderRow>;
}

interface DiagnosticUpdateArgs {
  where: { id: string; deletedAt?: null };
  data: { deletedAt: Date; deletedById: string };
}

interface SupplyCreateManyArgs {
  data: Array<Pick<SupplyRow, 'studentId' | 'subjectId' | 'paceNumber' | 'source' | 'createdById'>>;
  skipDuplicates?: boolean;
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
  auditLog: { create: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
  diagnosticResult: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  paceInventoryOrder: {
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
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

/** The printed example chart: gaps 1008, advance from PACE 1015. */
function englishChart(overrides: Record<string, unknown> = {}) {
  return {
    studentId: STUDENT_ID,
    test: 'English' as const,
    attemptedPaceNumbers: Array.from({ length: 17 }, (_, index) => 1001 + index),
    circledPaceNumbers: [1008, 1015, 1016, 1017],
    ...overrides,
  };
}

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
      createMany: vi.fn(({ data }: { data: Record<string, unknown>[] }) => {
        auditInsideRls.push(rlsState.depth > 0);
        return Promise.resolve({ count: data.length });
      }),
    },
    diagnosticResult: {
      count: vi.fn(({ where }: { where: { deletedAt: null; OR: DiagnosticOrClause[] } }) =>
        Promise.resolve(
          diagnostics.filter(
            (row) =>
              !row.deletedAt && where.OR.some((clause) => matchesDiagnosticClause(row, clause)),
          ).length,
        ),
      ),
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
          skip,
          take,
          where,
        }: {
          orderBy?: DiagnosticOrderBy | DiagnosticOrderBy[];
          take?: number;
          skip?: number;
          where?: {
            deletedAt?: null;
            OR?: DiagnosticOrClause[];
          };
        } = {}) => {
          const rows = sortDiagnosticRows(
            [...diagnostics]
              .filter((diagnostic) => {
                if (where?.deletedAt !== undefined && diagnostic.deletedAt) return false;
                return (
                  !where?.OR ||
                  where.OR.some((clause) => matchesDiagnosticClause(diagnostic, clause))
                );
              })
              .reverse(),
            orderBy,
          );
          return Promise.resolve(
            rows.slice(skip ?? 0, take === undefined ? undefined : (skip ?? 0) + take),
          );
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
      count: vi.fn(
        ({
          where,
        }: {
          where: {
            OR: Array<{ studentId: string; subjectId: string }>;
            status: OrderRow['status'] | { in: OrderRow['status'][] };
          };
        }) =>
          Promise.resolve(
            orders.filter(
              (row) =>
                where.OR.some(
                  (assignment) =>
                    row.studentId === assignment.studentId &&
                    row.subjectId === assignment.subjectId,
                ) &&
                (typeof where.status === 'string'
                  ? row.status === where.status
                  : where.status.in.includes(row.status)),
            ).length,
          ),
      ),
      groupBy: vi.fn(
        ({ where }: { where: { OR: Array<{ studentId: string; subjectId: string }> } }) => {
          const counts = new Map<
            string,
            { studentId: string; status: OrderRow['status']; _count: { _all: number } }
          >();
          for (const row of orders) {
            if (
              !where.OR.some(
                (assignment) =>
                  row.studentId === assignment.studentId && row.subjectId === assignment.subjectId,
              )
            )
              continue;
            const key = `${row.studentId}:${row.status}`;
            const entry = counts.get(key) ?? {
              studentId: row.studentId,
              status: row.status,
              _count: { _all: 0 },
            };
            entry._count._all += 1;
            counts.set(key, entry);
          }
          return Promise.resolve([...counts.values()]);
        },
      ),
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
          skip,
          take,
          where,
        }: {
          orderBy?: OrderOrderBy | OrderOrderBy[];
          take?: number;
          skip?: number;
          where?: {
            id?: { in: string[] };
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
                if (where?.id && !where.id.in.includes(order.id)) return false;
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
          return Promise.resolve(
            rows.slice(skip ?? 0, take === undefined ? undefined : (skip ?? 0) + take),
          );
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
        const matching = orders.filter(
          (candidate) =>
            (typeof where.id === 'string'
              ? candidate.id === where.id
              : where.id.in.includes(candidate.id)) && candidate.status === where.status,
        );
        for (const order of matching) Object.assign(order, data, { updatedAt: new Date() });
        return Promise.resolve({ count: matching.length });
      }),
    },
    studentPaceSupply: {
      createMany: vi.fn(({ data, skipDuplicates }: SupplyCreateManyArgs) => {
        const now = new Date();
        let count = 0;
        for (const item of data) {
          if (
            supply.some(
              (row) =>
                row.studentId === item.studentId &&
                row.subjectId === item.subjectId &&
                row.paceNumber === item.paceNumber,
            )
          ) {
            if (skipDuplicates) continue;
            throw Object.assign(new Error('duplicate supply'), { code: 'P2002' });
          }
          supply.push({
            id: `supply_${String(supply.length + 1)}`,
            ...item,
            createdAt: now,
            updatedAt: now,
          });
          count += 1;
        }
        return Promise.resolve({ count });
      }),
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
                (!where?.id || student.id === where.id) &&
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
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: {
            studentId: string;
            subjectId?: string;
            subject?: { code?: { in: string[] } };
          };
        }) => {
          const student = students.find((candidate) => candidate.id === where.studentId);
          const assignment = where.subjectId
            ? findAssignment(where.studentId, where.subjectId)
            : student?.subjects.find(
                (candidate) =>
                  candidate.subject.active &&
                  (where.subject?.code?.in.includes(candidate.subject.code) ?? true),
              );
          return Promise.resolve(
            student?.active &&
              assignment?.subject.active &&
              (!where.subject?.code || where.subject.code.in.includes(assignment.subject.code))
              ? assignment
              : null,
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
    const orderSnapshot = orders.map((order) => ({ ...order }));
    const supplySnapshot = supply.map((row) => ({ ...row }));
    try {
      return await callback(db);
    } catch (error) {
      orders.splice(0, orders.length, ...orderSnapshot);
      supply.splice(0, supply.length, ...supplySnapshot);
      throw error;
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
      caller.academicInventory.markOrdersInTransit({ orderIds: ['order_1'] }),
      'FORBIDDEN',
    );
    await expectCode(caller.academicInventory.recordDiagnostic(englishChart()), 'FORBIDDEN');
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

    await expectCode(caller.academicInventory.recordDiagnostic(englishChart()), 'BAD_REQUEST');

    expect(diagnostics).toHaveLength(0);
  });

  it('marks selected orders across students and subjects in transit with one timestamp and per-order audits', async () => {
    const students = cloneStudents(defaultStudents);
    const firstStudent = students[0];
    if (!firstStudent) throw new Error('expected first student fixture');
    firstStudent.subjects.push({
      id: 'assignment_2',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_2_ID,
      currentPaceNumber: 1011,
      subject: { id: SUBJECT_2_ID, code: 'MATH', name: 'Maths', active: true },
    });
    students.push({
      id: STUDENT_2_ID,
      active: true,
      fullNameEnc: 'enc:Second Learner',
      yearGroup: 'Year 7',
      subjects: [
        {
          id: 'assignment_3',
          studentId: STUDENT_2_ID,
          subjectId: SUBJECT_ID,
          currentPaceNumber: 1011,
          subject: { id: SUBJECT_ID, code: 'ENG', name: 'English', active: true },
        },
      ],
    });
    const { caller, db, orders, supply, auditInsideRls } = makeCaller(HEAD, students);
    const first = await createOrder(caller, { paceNumber: 1013 });
    const second = await createOrder(caller, { subjectId: SUBJECT_2_ID, paceNumber: 1014 });
    const third = await createOrder(caller, { studentId: STUDENT_2_ID, paceNumber: 1025 });
    db.auditLog.create.mockClear();

    await expect(
      caller.academicInventory.markOrdersInTransit({ orderIds: [first.id, second.id, third.id] }),
    ).resolves.toEqual({ count: 3 });
    expect(orders.map((order) => order.status)).toEqual(['InTransit', 'InTransit', 'InTransit']);
    const [firstUpdated, secondUpdated, thirdUpdated] = orders;
    if (!firstUpdated || !secondUpdated || !thirdUpdated) throw new Error('expected three orders');
    expect(firstUpdated.inTransitAt).toBeInstanceOf(Date);
    expect(secondUpdated.inTransitAt).toEqual(firstUpdated.inTransitAt);
    expect(thirdUpdated.inTransitAt).toEqual(firstUpdated.inTransitAt);
    expect(supply).toEqual([]);
    expect(db.paceInventoryOrder.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: [first.id, second.id, third.id] }, status: 'Ordered' },
      data: { status: 'InTransit', inTransitAt: firstUpdated.inTransitAt },
    });
    expect(callArgs(db.auditLog.createMany)).toEqual({
      data: [first.id, second.id, third.id].map((entityId) => ({
        userId: HEAD.id,
        action: 'Update',
        entity: 'PaceInventoryOrder',
        entityId,
        meta: { fromStatus: 'Ordered', toStatus: 'InTransit' },
      })),
    });
    expect(auditInsideRls.at(-1)).toBe(true);
  });

  it('rejects missing or changed bulk orders before writing', async () => {
    const { caller, db, orders } = makeCaller(HEAD);
    const first = await createOrder(caller, { paceNumber: 1013 });
    const second = await createOrder(caller, { paceNumber: 1014 });
    await expectCode(
      caller.academicInventory.markOrdersInTransit({ orderIds: [first.id, 'missing'] }),
      'NOT_FOUND',
    );
    await caller.academicInventory.updateOrderStatus({ orderId: second.id, status: 'InTransit' });
    db.paceInventoryOrder.updateMany.mockClear();
    db.auditLog.createMany.mockClear();
    await expectCode(
      caller.academicInventory.markOrdersInTransit({ orderIds: [first.id, second.id] }),
      'CONFLICT',
    );
    expect(orders.find((order) => order.id === first.id)?.status).toBe('Ordered');
    expect(db.paceInventoryOrder.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.createMany).not.toHaveBeenCalled();
  });

  it('rolls back bulk changes when a conditional update races or audit logging fails', async () => {
    const { caller, db, orders } = makeCaller(HEAD);
    const first = await createOrder(caller, { paceNumber: 1013 });
    const second = await createOrder(caller, { paceNumber: 1014 });
    db.paceInventoryOrder.updateMany.mockResolvedValueOnce({ count: 1 });
    await expectCode(
      caller.academicInventory.markOrdersInTransit({ orderIds: [first.id, second.id] }),
      'CONFLICT',
    );
    expect(orders.every((order) => order.status === 'Ordered')).toBe(true);
    expect(db.auditLog.createMany).not.toHaveBeenCalled();

    db.auditLog.createMany.mockRejectedValueOnce(new Error('audit failed'));
    await expect(
      caller.academicInventory.markOrdersInTransit({ orderIds: [first.id, second.id] }),
    ).rejects.toThrow('audit failed');
    expect(orders.every((order) => order.status === 'Ordered' && order.inTransitAt === null)).toBe(
      true,
    );
  });

  it('delivers a mixed-child batch atomically with one timestamp and deduplicated supply', async () => {
    const students = cloneStudents(defaultStudents);
    const firstStudent = students[0];
    if (!firstStudent) throw new Error('expected first student fixture');
    firstStudent.subjects.push({
      id: 'assignment_math',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_2_ID,
      currentPaceNumber: 1011,
      subject: { id: SUBJECT_2_ID, code: 'MA', name: 'Maths', active: true },
    });
    students.push({
      id: STUDENT_2_ID,
      active: true,
      fullNameEnc: 'enc:Second Learner',
      yearGroup: 'Year 7',
      subjects: [
        {
          id: 'assignment_2',
          studentId: STUDENT_2_ID,
          subjectId: SUBJECT_ID,
          currentPaceNumber: 1021,
          subject: { id: SUBJECT_ID, code: 'EN', name: 'English', active: true },
        },
      ],
    });
    const { caller, db, orders, supply } = makeCaller(HEAD, students);
    const first = await createOrder(caller, { paceNumber: 1013 });
    const second = await createOrder(caller, { studentId: STUDENT_2_ID, paceNumber: 1023 });
    const third = await createOrder(caller, { subjectId: SUBJECT_2_ID, paceNumber: 1014 });
    await caller.academicInventory.markOrdersInTransit({
      orderIds: [first.id, second.id, third.id],
    });
    const recordedAt = new Date();
    supply.push({
      id: 'existing-supply',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_ID,
      paceNumber: 1013,
      source: 'CurrentStock',
      createdById: HEAD.id,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    });
    db.auditLog.createMany.mockClear();

    await expect(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, second.id, third.id] }),
    ).resolves.toEqual({ count: 3 });
    expect(orders.map((row) => row.status)).toEqual(['Delivered', 'Delivered', 'Delivered']);
    expect(orders[0]?.deliveredAt).toBeInstanceOf(Date);
    expect(orders[0]?.deliveredAt).toEqual(orders[1]?.deliveredAt);
    expect(orders[0]?.deliveredAt).toEqual(orders[2]?.deliveredAt);
    expect(supply.map((row) => [row.studentId, row.subjectId, row.paceNumber])).toEqual(
      expect.arrayContaining([
        [STUDENT_ID, SUBJECT_ID, 1013],
        [STUDENT_2_ID, SUBJECT_ID, 1023],
        [STUDENT_ID, SUBJECT_2_ID, 1014],
      ]),
    );
    expect(supply).toHaveLength(3);
    expect(db.studentPaceSupply.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
      }),
    );
    expect(callArgs(db.auditLog.createMany)).toMatchObject({
      data: [
        { entityId: first.id, meta: { fromStatus: 'InTransit', toStatus: 'Delivered' } },
        { entityId: second.id, meta: { fromStatus: 'InTransit', toStatus: 'Delivered' } },
        { entityId: third.id, meta: { fromStatus: 'InTransit', toStatus: 'Delivered' } },
      ],
    });
  });

  it('rejects duplicate, missing, stale, and unsupported bulk deliveries', async () => {
    const { caller, db, orders, supply } = makeCaller(HEAD);
    const first = await createOrder(caller, { paceNumber: 1013 });
    const second = await createOrder(caller, { paceNumber: 1014 });
    await caller.academicInventory.markOrdersInTransit({ orderIds: [first.id, second.id] });
    await expectCode(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, first.id] }),
      'BAD_REQUEST',
    );
    await expectCode(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, 'missing'] }),
      'NOT_FOUND',
    );
    const stale = orders[1];
    if (!stale) throw new Error('expected second order');
    stale.status = 'Delivered';
    await expectCode(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, second.id] }),
      'CONFLICT',
    );
    const current = orders.find((row) => row.id === second.id);
    if (!current) throw new Error('expected second order after rollback');
    current.status = 'InTransit';
    current.paceNumber = 1145;
    await expectCode(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, second.id] }),
      'BAD_REQUEST',
    );
    expect(orders[0]?.status).toBe('InTransit');
    expect(supply).toEqual([]);
    expect(db.studentPaceSupply.createMany).not.toHaveBeenCalled();
  });

  it('rolls back delivery status and supply when conditional update, supply, or audit fails', async () => {
    const { caller, db, orders, supply } = makeCaller(HEAD);
    const first = await createOrder(caller, { paceNumber: 1013 });
    const second = await createOrder(caller, { paceNumber: 1014 });
    await caller.academicInventory.markOrdersInTransit({ orderIds: [first.id, second.id] });
    db.paceInventoryOrder.updateMany.mockResolvedValueOnce({ count: 1 });
    await expectCode(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, second.id] }),
      'CONFLICT',
    );
    db.studentPaceSupply.createMany.mockRejectedValueOnce(new Error('supply failed'));
    await expect(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, second.id] }),
    ).rejects.toThrow('supply failed');
    db.auditLog.createMany.mockRejectedValueOnce(new Error('audit failed'));
    await expect(
      caller.academicInventory.markOrdersDelivered({ orderIds: [first.id, second.id] }),
    ).rejects.toThrow('audit failed');
    expect(orders.every((row) => row.status === 'InTransit' && row.deliveredAt === null)).toBe(
      true,
    );
    expect(supply).toEqual([]);
  });

  it('forbids bulk delivery without Head access', async () => {
    const { caller } = makeCaller(SUPERVISOR);
    await expectCode(
      caller.academicInventory.markOrdersDelivered({ orderIds: ['order_1'] }),
      'FORBIDDEN',
    );
  });

  it('rejects delivery when the PACE assignment is no longer active', async () => {
    const { caller, orders, students, supply } = makeCaller(HEAD);
    const created = await createOrder(caller);
    await caller.academicInventory.markOrdersInTransit({ orderIds: [created.id] });
    const assignment = students[0]?.subjects[0];
    if (!assignment) throw new Error('expected assignment fixture');
    assignment.subject.active = false;
    await expectCode(
      caller.academicInventory.markOrdersDelivered({ orderIds: [created.id] }),
      'BAD_REQUEST',
    );
    expect(orders[0]?.status).toBe('InTransit');
    expect(supply).toEqual([]);
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

    expect(summary.alerts).toMatchObject([
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
    expect(summary.alerts).toMatchObject([
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

    expect(summary.alerts).toMatchObject([
      {
        studentId: STUDENT_ID,
        subjectId: SUBJECT_ID,
        currentPaceNumber: 1011,
        availablePaceNumbers: [1013, 1014],
        remainingPaceCount: 2,
      },
    ]);
  });

  it('keeps low supply visible while PACEs are ordered or in transit', async () => {
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
    const orderedSummary = await caller.academicInventory.summary();
    expect(orderedSummary.alerts[0]?.pendingOrders).toMatchObject([
      { id: outstandingOrder.id, paceNumber: 1144, status: 'Ordered' },
    ]);
    expect(orderedSummary.alerts[0]?.pendingOrders[0]?.orderedAt).toBeInstanceOf(Date);
    await caller.academicInventory.updateOrderStatus({
      orderId: outstandingOrder.id,
      status: 'InTransit',
    });
    summary = await caller.academicInventory.summary();
    expect(summary.alerts[0]?.pendingOrders).toMatchObject([
      { id: outstandingOrder.id, paceNumber: 1144, status: 'InTransit' },
    ]);
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
    const lastPage = await caller.academicInventory.ordersForStudent({
      studentId: STUDENT_ID,
      status: 'Delivered',
      page: 6,
      pageSize: 20,
    });
    expect(lastPage.totalRows).toBe(105);
    expect(lastPage.rows).toHaveLength(5);
    expect(lastPage.rows.at(-1)?.id).toBe('delivered-000');
    const emptyPage = await caller.academicInventory.ordersForStudent({
      studentId: STUDENT_ID,
      status: 'Delivered',
      page: 7,
      pageSize: 20,
    });
    expect(emptyPage.rows).toEqual([]);
    expect(emptyPage.totalRows).toBe(105);
    const leanSummary = await caller.academicInventory.summary({ includeHistory: false });
    expect(leanSummary.orders).toHaveLength(144);
    expect(leanSummary.diagnostics).toEqual([]);
    expect(leanSummary.orderCountsByStudent).toContainEqual({
      studentId: STUDENT_ID,
      status: 'Delivered',
      _count: { _all: 105 },
    });
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
        test: null,
        level: (index % 5) + 1,
        outcome: index % 2 === 0 ? 'Pass' : 'Fail',
        attemptedPaceNumbers: [],
        circledPaceNumbers: [],
        recordedById: HEAD.id,
        recordedAt,
        createdAt: recordedAt,
        deletedAt: null,
        deletedById: null,
      });
    }

    const summary = await caller.academicInventory.summary();

    expect(summary.diagnostics).toHaveLength(105);
    const lastPage = await caller.academicInventory.diagnosticsHistory({ page: 6, pageSize: 20 });
    expect(lastPage.totalRows).toBe(105);
    expect(lastPage.rows).toHaveLength(5);
    expect(lastPage.rows.at(-1)?.id).toBe('diagnostic-000');
    expect(
      (await caller.academicInventory.diagnosticsHistory({ page: 7, pageSize: 20 })).rows,
    ).toEqual([]);
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
      test: null,
      level: 1,
      outcome: 'Pass',
      attemptedPaceNumbers: [],
      circledPaceNumbers: [],
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
    await expectCode(
      caller.academicInventory.createOrder({
        studentId: STUDENT_ID,
        subjectId: 'subject_custom',
        paceNumber: 1013,
      }),
      'BAD_REQUEST',
    );
  });

  it('includes production aliases and custom Word Building without merging assignments', async () => {
    const codes = ['MA', 'EN', 'CWL', 'AS', 'BS', 'CUSTOM-WORD-BUILDING'];
    const student = cloneStudents(defaultStudents)[0];
    if (!student) throw new Error('expected student fixture');
    student.subjects = codes.map((code) => ({
      id: `assignment_${code}`,
      studentId: STUDENT_ID,
      subjectId: `subject_${code}`,
      currentPaceNumber: 1011,
      subject: { id: `subject_${code}`, code, name: code, active: true },
    }));
    const inactive: StudentRow = {
      id: STUDENT_2_ID,
      active: false,
      fullNameEnc: 'enc:Inactive Learner',
      yearGroup: 'Year 7',
      subjects: [
        {
          id: 'inactive_assignment',
          studentId: STUDENT_2_ID,
          subjectId: 'inactive_subject',
          currentPaceNumber: 1011,
          subject: { id: 'inactive_subject', code: 'MA', name: 'Maths', active: true },
        },
      ],
    };
    const { caller } = makeCaller(HEAD, [student, inactive]);
    const summary = await caller.academicInventory.summary({ includeHistory: false });

    expect(summary.students).toHaveLength(1);
    expect(summary.students[0]?.subjects.map((row) => row.subject.code)).toEqual(codes);
    expect(summary.alerts.map((row) => row.subjectId)).toEqual(
      codes.map((code) => `subject_${code}`),
    );
    expect(summary.alerts.every((row) => row.remainingPaceCount === 0)).toBe(true);
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
      test: null,
      level: 2,
      outcome: 'Pass',
      attemptedPaceNumbers: [],
      circledPaceNumbers: [],
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

  it('shows a low-stock alert while a future PACE is in transit', async () => {
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

    expect(summary.alerts).toMatchObject([
      {
        remainingPaceCount: 1,
        pendingOrders: [{ paceNumber: 1013, status: 'InTransit' }],
      },
    ]);
  });

  it('records a PACE chart without changing the assignment PACE', async () => {
    const { auditInsideRls, caller, db, diagnostics, rejectDirectProtectedAccess, withRls } =
      makeCaller(HEAD);

    const result = await caller.academicInventory.recordDiagnostic(englishChart());

    expect(result).toMatchObject({
      test: 'English',
      subjectId: SUBJECT_ID,
      level: null,
      outcome: null,
      circledPaceNumbers: [1008, 1015, 1016, 1017],
      placement: { learningGaps: [1008], performanceLevelPace: 1015 },
    });
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
        meta: {
          test: 'English',
          subjectId: SUBJECT_ID,
          circledPaceNumbers: [1008, 1015, 1016, 1017],
        },
      },
    });
    expect(auditInsideRls).toEqual([true]);
  });

  it('rejects a chart for a subject the student is not assigned', async () => {
    const { caller, diagnostics } = makeCaller(HEAD);

    await expectCode(
      caller.academicInventory.recordDiagnostic(englishChart({ test: 'Math' })),
      'BAD_REQUEST',
    );

    expect(diagnostics).toHaveLength(0);
  });

  it('records Word Building against its assigned subject as Level 1–10', async () => {
    const students = cloneStudents(defaultStudents);
    students[0]?.subjects.push({
      id: 'assignment_wb',
      studentId: STUDENT_ID,
      subjectId: SUBJECT_2_ID,
      currentPaceNumber: 1001,
      subject: { id: SUBJECT_2_ID, code: 'WB', name: 'Word Building', active: true },
    });
    const { caller, diagnostics } = makeCaller(HEAD, students);

    const result = await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID,
      test: 'WordBuilding',
      level: 10,
      outcome: 'Pass',
    });

    expect(result).toMatchObject({
      test: 'WordBuilding',
      subjectId: SUBJECT_2_ID,
      level: 10,
      outcome: 'Pass',
      placement: null,
    });
    expect(diagnostics).toHaveLength(1);
    await expectCode(
      caller.academicInventory.recordDiagnostic({
        studentId: STUDENT_ID,
        test: 'WordBuilding',
        level: 11,
        outcome: 'Pass',
      }),
      'BAD_REQUEST',
    );
  });

  it('rejects Word Building when the student is not assigned it', async () => {
    const { caller, diagnostics } = makeCaller(HEAD);

    await expectCode(
      caller.academicInventory.recordDiagnostic({
        studentId: STUDENT_ID,
        test: 'WordBuilding',
        level: 3,
        outcome: 'Fail',
      }),
      'BAD_REQUEST',
    );

    expect(diagnostics).toHaveLength(0);
  });

  it('records Reading without a subject and still lists it in the summary and history', async () => {
    const { caller, diagnostics } = makeCaller(HEAD);

    const result = await caller.academicInventory.recordDiagnostic({
      studentId: STUDENT_ID,
      test: 'Reading',
      level: 7,
      outcome: 'Pass',
    });

    expect(result).toMatchObject({ test: 'Reading', subjectId: null, level: 7, outcome: 'Pass' });
    expect(diagnostics).toHaveLength(1);
    const summary = await caller.academicInventory.summary();
    expect(summary.diagnostics).toMatchObject([{ test: 'Reading', subjectId: null, level: 7 }]);
    const history = await caller.academicInventory.diagnosticsHistory({ page: 1, pageSize: 10 });
    expect(history.rows).toMatchObject([{ test: 'Reading', level: 7 }]);
    expect(history.totalRows).toBe(1);
  });

  it('returns the derived placement for chart rows in history', async () => {
    const { caller } = makeCaller(HEAD);
    await caller.academicInventory.recordDiagnostic(englishChart());

    const history = await caller.academicInventory.diagnosticsHistory({ page: 1, pageSize: 10 });

    expect(history.rows).toMatchObject([
      { test: 'English', placement: { learningGaps: [1008], performanceLevelPace: 1015 } },
    ]);
  });

  it('soft-deletes a recorded diagnostic without touching the assignment', async () => {
    const { auditInsideRls, caller, db, diagnostics } = makeCaller(HEAD);
    const diagnostic = await caller.academicInventory.recordDiagnostic(englishChart());

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
    const diagnostic = await caller.academicInventory.recordDiagnostic(englishChart());
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
    expect(summary.alerts).toMatchObject([
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
