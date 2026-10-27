import {
  availablePacesAhead,
  ACE_SUBJECT_CODES,
  bulkPaceInventoryOrderInput,
  currentStudentPaceSupplyInput,
  deleteDiagnosticResultInput,
  diagnosticResultInput,
  markPaceOrdersInTransitInput,
  markPaceOrdersDeliveredInput,
  PACE_CATALOGUE,
  createPaceGapPlanInput,
  paceInventoryOrderInput,
  paceInventoryStatusInput,
  paceGapAssignmentInput,
  paceGapPaceNumber,
  requiresPaceReorder,
  resolvePaceGapPlanInput,
  updatePaceGapPlanInput,
} from '@oasis/domain';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  applySerializableRlsTx,
  RlsSerializationConflictError,
  type AppContext,
  type RlsTx,
} from '../context.js';
import { roleProcedure, router } from '../trpc.js';
import {
  cancelGapPlan,
  createGapPlan,
  getGapPlanSummary,
  reopenGapPlan,
  updateGapPlan,
} from '../pace/pace-gap-plans.js';

const RECENT_HISTORY_LIMIT = 100;
const NEXT_ORDER_STATUS = {
  Ordered: 'InTransit',
  InTransit: 'Delivered',
  Delivered: null,
} as const;
const ORDER_SUMMARY_SELECT = {
  id: true,
  studentId: true,
  subjectId: true,
  paceNumber: true,
  status: true,
  orderedAt: true,
  inTransitAt: true,
  deliveredAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

const createOrderInput = diagnosticResultInput
  .pick({ studentId: true, subjectId: true })
  .extend({ paceNumber: paceInventoryOrderInput.shape.paceNumber });

const pageInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(20).default(10),
});

const orderFilterInput = z.enum(['Outstanding', 'Ordered', 'InTransit', 'Delivered']);

async function activeInventoryAssignments(tx: RlsTx, studentId?: string) {
  const students = await tx.student.findMany({
    where: {
      ...(studentId ? { id: studentId } : {}),
      active: true,
      subjects: { some: { subject: { active: true, code: { in: [...ACE_SUBJECT_CODES] } } } },
    },
    select: {
      id: true,
      subjects: {
        where: { subject: { active: true, code: { in: [...ACE_SUBJECT_CODES] } } },
        select: { subjectId: true },
      },
    },
  });
  return students.flatMap((student) =>
    student.subjects.map((assignment) => ({
      studentId: student.id,
      subjectId: assignment.subjectId,
    })),
  );
}

function newestOrdersFirst(
  left: { createdAt: Date; id: string },
  right: { createdAt: Date; id: string },
): number {
  const createdAtComparison = right.createdAt.getTime() - left.createdAt.getTime();
  if (createdAtComparison !== 0) return createdAtComparison;
  if (left.id === right.id) return 0;
  return left.id < right.id ? 1 : -1;
}

async function requireAssignment(
  db: RlsTx,
  input: { studentId: string; subjectId: string },
): Promise<void> {
  const assignment = await db.studentSubject.findFirst({
    where: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      student: { active: true },
      subject: { active: true, code: { in: [...ACE_SUBJECT_CODES] } },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'student is not assigned to this subject',
    });
  }
}

function selectedPaceNumbersAlreadyExist(
  selectedPaceNumbers: readonly number[],
  existingPaceNumbers: readonly number[],
): number[] {
  const existing = new Set(existingPaceNumbers);
  return selectedPaceNumbers.filter((paceNumber) => existing.has(paceNumber));
}

function duplicatePaceNumbersMessage(prefix: string, paceNumbers: readonly number[]): string {
  return `${prefix}: ${paceNumbers.join(', ')}`;
}

async function requirePaceNumbersAvailable(
  tx: RlsTx,
  input: { studentId: string; subjectId: string; paceNumbers: readonly number[] },
): Promise<void> {
  const [existingSupply, pendingOrders] = await Promise.all([
    tx.studentPaceSupply.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        paceNumber: { in: [...input.paceNumbers] },
      },
      select: { paceNumber: true },
    }),
    tx.paceInventoryOrder.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        paceNumber: { in: [...input.paceNumbers] },
        status: { in: ['Ordered', 'InTransit'] },
      },
      select: { paceNumber: true },
    }),
  ]);
  const unavailablePaceNumbers = selectedPaceNumbersAlreadyExist(input.paceNumbers, [
    ...existingSupply.map((item) => item.paceNumber),
    ...pendingOrders.map((item) => item.paceNumber),
  ]);
  if (unavailablePaceNumbers.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: duplicatePaceNumbersMessage(
        'selected PACE numbers are already supplied or awaiting delivery',
        unavailablePaceNumbers,
      ),
    });
  }
}

function isUniqueConstraintConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function withSerializableInventoryRls<T>(
  ctx: Pick<AppContext, 'db' | 'user'>,
  mutation: (tx: RlsTx) => Promise<T>,
): Promise<T> {
  try {
    return await applySerializableRlsTx(ctx.db, ctx.user, mutation);
  } catch (error) {
    if (error instanceof RlsSerializationConflictError || isUniqueConstraintConflict(error)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'The inventory changed while your request was being processed. Please retry.',
      });
    }
    throw error;
  }
}

export const academicInventoryRouter = router({
  summary: roleProcedure('Head')
    .input(z.object({ includeHistory: z.boolean().default(true) }).optional())
    .query(async ({ ctx, input }) => {
      const {
        students,
        orders,
        diagnostics,
        supply,
        activeGapPlans,
        completedGapPaces,
        orderCounts,
      } = await ctx.withRls(async (tx) => {
        const students = await tx.student.findMany({
          where: {
            active: true,
            subjects: {
              some: { subject: { active: true, code: { in: [...ACE_SUBJECT_CODES] } } },
            },
          },
          select: {
            id: true,
            fullNameEnc: true,
            yearGroup: true,
            subjects: {
              where: { subject: { active: true, code: { in: [...ACE_SUBJECT_CODES] } } },
              select: {
                id: true,
                studentId: true,
                subjectId: true,
                currentPaceNumber: true,
                subject: { select: { id: true, code: true, name: true, active: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        });
        const activeAssignments = students.flatMap((student) =>
          student.subjects.map((assignment) => ({
            studentId: student.id,
            subjectId: assignment.subjectId,
          })),
        );

        const [
          outstandingOrders,
          deliveredOrders,
          diagnostics,
          supply,
          activeGapPlans,
          completedGapPaces,
          orderCounts,
        ] = await Promise.all([
          tx.paceInventoryOrder.findMany({
            where: { OR: activeAssignments, status: { in: ['Ordered', 'InTransit'] } },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: ORDER_SUMMARY_SELECT,
          }),
          input?.includeHistory === false
            ? Promise.resolve([])
            : tx.paceInventoryOrder.findMany({
                where: { OR: activeAssignments, status: 'Delivered' },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: RECENT_HISTORY_LIMIT,
                select: ORDER_SUMMARY_SELECT,
              }),
          input?.includeHistory === false
            ? Promise.resolve([])
            : tx.diagnosticResult.findMany({
                where: { deletedAt: null, OR: activeAssignments },
                orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
                select: {
                  id: true,
                  studentId: true,
                  subjectId: true,
                  level: true,
                  outcome: true,
                  recordedById: true,
                  recordedAt: true,
                  createdAt: true,
                },
              }),
          tx.studentPaceSupply.findMany({
            where: { OR: activeAssignments },
            select: {
              id: true,
              studentId: true,
              subjectId: true,
              paceNumber: true,
              source: true,
              createdById: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          tx.paceGapPlan.findMany({
            where: { OR: activeAssignments, status: 'Active' },
            include: { items: { where: { removedAt: null }, select: { paceNumber: true } } },
          }),
          tx.paceProgress.findMany({
            where: { OR: activeAssignments, completedAt: { not: null } },
            select: { studentId: true, subjectId: true, paceNumber: true },
          }),
          tx.paceInventoryOrder.groupBy({
            by: ['studentId', 'status'],
            where: { OR: activeAssignments },
            _count: { _all: true },
          }),
        ]);
        const orders = [...outstandingOrders, ...deliveredOrders].sort(newestOrdersFirst);
        return {
          students,
          orders,
          diagnostics,
          supply,
          activeGapPlans,
          completedGapPaces,
          orderCounts,
        };
      });

      const supplyByAssignment = new Map<string, number[]>();
      for (const item of supply) {
        const key = `${item.studentId}:${item.subjectId}`;
        const paceNumbers = supplyByAssignment.get(key) ?? [];
        paceNumbers.push(item.paceNumber);
        supplyByAssignment.set(key, paceNumbers);
      }

      const outstandingPacesByAssignment = new Map<
        string,
        Array<{ id: string; paceNumber: number; status: 'Ordered' | 'InTransit'; orderedAt: Date }>
      >();
      for (const order of orders) {
        if (order.status === 'Delivered') continue;
        const key = `${order.studentId}:${order.subjectId}`;
        const paceNumbers = outstandingPacesByAssignment.get(key) ?? [];
        paceNumbers.push({
          id: order.id,
          paceNumber: order.paceNumber,
          status: order.status,
          orderedAt: order.orderedAt,
        });
        outstandingPacesByAssignment.set(key, paceNumbers);
      }

      const gapPlanByAssignment = new Map(
        activeGapPlans.map((plan) => [`${plan.studentId}:${plan.subjectId}`, plan]),
      );
      const completedPaceKeys = new Set(
        completedGapPaces.map(
          (row) => `${row.studentId}:${row.subjectId}:${String(row.paceNumber)}`,
        ),
      );

      const alerts = students.flatMap((student) =>
        student.subjects.flatMap((assignment) => {
          const assignmentKey = `${student.id}:${assignment.subjectId}`;
          const gapPlan = gapPlanByAssignment.get(assignmentKey);
          const allowedPaces = gapPlan
            ? new Set([
                ...gapPlan.items
                  .map((item) => item.paceNumber)
                  .filter(
                    (paceNumber) =>
                      paceNumber > assignment.currentPaceNumber &&
                      !completedPaceKeys.has(`${assignmentKey}:${String(paceNumber)}`),
                  ),
                ...PACE_CATALOGUE.filter((paceNumber) => paceNumber >= gapPlan.jumpToPaceNumber),
              ])
            : null;
          const pendingOrders = (outstandingPacesByAssignment.get(assignmentKey) ?? []).filter(
            ({ paceNumber }) =>
              paceNumber > assignment.currentPaceNumber &&
              (!allowedPaces || allowedPaces.has(paceNumber)),
          );

          const supplied = supplyByAssignment.get(assignmentKey) ?? [];
          const availablePaceNumbers = gapPlan
            ? supplied.filter((paceNumber) => allowedPaces?.has(paceNumber))
            : availablePacesAhead(assignment.currentPaceNumber, supplied);
          // PACEs already ordered or in transit count as covered, so the student drops off
          // the list once everything they still need has been ordered.
          const remainingInCatalogue = (allowedPaces ? [...allowedPaces] : PACE_CATALOGUE).filter(
            (paceNumber) => paceNumber > assignment.currentPaceNumber,
          ).length;
          if (
            !requiresPaceReorder(
              assignment.currentPaceNumber,
              [...availablePaceNumbers, ...pendingOrders.map(({ paceNumber }) => paceNumber)],
              remainingInCatalogue,
            )
          ) {
            return [];
          }
          return [
            {
              studentId: student.id,
              subjectId: assignment.subjectId,
              currentPaceNumber: assignment.currentPaceNumber,
              availablePaceNumbers,
              remainingPaceCount: availablePaceNumbers.length,
              pendingOrders,
            },
          ];
        }),
      );

      const decryptedStudents = students.map(({ fullNameEnc, ...student }) => {
        const fullName = ctx.db.$enc.decrypt(fullNameEnc);
        if (!fullName) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'student name decrypt failed',
          });
        }
        return { ...student, fullName };
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: { source: 'academicInventory.summary', count: decryptedStudents.length },
        },
      });

      return {
        students: decryptedStudents,
        orders,
        diagnostics,
        supply,
        alerts,
        orderCountsByStudent: orderCounts,
      };
    }),

  ordersForStudent: roleProcedure('Head')
    .input(pageInput.extend({ studentId: z.string().trim().min(1), status: orderFilterInput }))
    .query(({ ctx, input }) =>
      ctx.withRls(async (tx) => {
        const assignments = await activeInventoryAssignments(tx, input.studentId);
        const where = {
          OR: assignments,
          status:
            input.status === 'Outstanding'
              ? { in: ['Ordered' as const, 'InTransit' as const] }
              : input.status,
        };
        const [totalRows, rows] = await Promise.all([
          tx.paceInventoryOrder.count({ where }),
          tx.paceInventoryOrder.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            select: ORDER_SUMMARY_SELECT,
          }),
        ]);
        return {
          rows,
          totalRows,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(totalRows / input.pageSize),
        };
      }),
    ),

  diagnosticsHistory: roleProcedure('Head')
    .input(pageInput)
    .query(({ ctx, input }) =>
      ctx.withRls(async (tx) => {
        const assignments = await activeInventoryAssignments(tx);
        const where = { OR: assignments, deletedAt: null };
        const [totalRows, rows] = await Promise.all([
          tx.diagnosticResult.count({ where }),
          tx.diagnosticResult.findMany({
            where,
            orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            select: {
              id: true,
              studentId: true,
              subjectId: true,
              level: true,
              outcome: true,
              recordedById: true,
              recordedAt: true,
              createdAt: true,
            },
          }),
        ]);
        return {
          rows,
          totalRows,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(totalRows / input.pageSize),
        };
      }),
    ),

  gapPlansForAssignment: roleProcedure('Head')
    .input(paceGapAssignmentInput)
    .query(({ ctx, input }) => getGapPlanSummary(ctx, input)),

  createGapPlan: roleProcedure('Head')
    .input(createPaceGapPlanInput)
    .mutation(({ ctx, input }) => createGapPlan(ctx, input)),

  updateGapPlan: roleProcedure('Head')
    .input(updatePaceGapPlanInput)
    .mutation(({ ctx, input }) => updateGapPlan(ctx, input)),

  cancelGapPlan: roleProcedure('Head')
    .input(resolvePaceGapPlanInput)
    .mutation(({ ctx, input }) => cancelGapPlan(ctx, input)),

  reviewGapPlan: roleProcedure('Head')
    .input(
      resolvePaceGapPlanInput.extend({
        decision: z.literal('Reopen'),
        jumpToPaceNumber: paceGapPaceNumber.optional(),
      }),
    )
    .mutation(({ ctx, input }) => reopenGapPlan(ctx, input)),

  createOrder: roleProcedure('Head')
    .input(createOrderInput)
    .mutation(async ({ ctx, input }) => {
      return withSerializableInventoryRls(ctx, async (tx) => {
        await requireAssignment(tx, input);
        await requirePaceNumbersAvailable(tx, { ...input, paceNumbers: [input.paceNumber] });
        const order = await tx.paceInventoryOrder.create({
          data: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumber: input.paceNumber,
            status: 'Ordered',
            createdById: ctx.user.id,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'PaceInventoryOrder',
            entityId: order.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              paceNumber: input.paceNumber,
            },
          },
        });
        return order;
      });
    }),

  addCurrentSupply: roleProcedure('Head')
    .input(currentStudentPaceSupplyInput)
    .mutation(async ({ ctx, input }) => {
      return withSerializableInventoryRls(ctx, async (tx) => {
        await requireAssignment(tx, input);
        await requirePaceNumbersAvailable(tx, input);
        const result = await tx.studentPaceSupply.createMany({
          data: input.paceNumbers.map((paceNumber) => ({
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumber,
            source: 'CurrentStock',
            createdById: ctx.user.id,
          })),
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'StudentPaceSupply',
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              paceNumbers: input.paceNumbers,
              source: 'CurrentStock',
            },
          },
        });
        return result;
      });
    }),

  createOrders: roleProcedure('Head')
    .input(bulkPaceInventoryOrderInput)
    .mutation(async ({ ctx, input }) => {
      return withSerializableInventoryRls(ctx, async (tx) => {
        await requireAssignment(tx, input);
        await requirePaceNumbersAvailable(tx, input);
        const result = await tx.paceInventoryOrder.createMany({
          data: input.paceNumbers.map((paceNumber) => ({
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumber,
            status: 'Ordered',
            createdById: ctx.user.id,
          })),
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'PaceInventoryOrder',
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              paceNumbers: input.paceNumbers,
            },
          },
        });
        return result;
      });
    }),

  updateOrderStatus: roleProcedure('Head')
    .input(paceInventoryStatusInput)
    .mutation(async ({ ctx, input }) => {
      return withSerializableInventoryRls(ctx, async (tx) => {
        const order = await tx.paceInventoryOrder.findUnique({
          where: { id: input.orderId },
        });
        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'inventory order not found' });
        }

        const nextStatus = NEXT_ORDER_STATUS[order.status];
        if (input.status !== nextStatus) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'invalid inventory order transition',
          });
        }
        if (input.status === 'Delivered' && !PACE_CATALOGUE.includes(order.paceNumber)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'PACE orders outside the supported range cannot be marked delivered.',
          });
        }

        const previousStatus = order.status;
        const reachedAt = new Date();
        const data =
          input.status === 'InTransit'
            ? { status: 'InTransit' as const, inTransitAt: reachedAt }
            : { status: 'Delivered' as const, deliveredAt: reachedAt };
        const updateResult = await tx.paceInventoryOrder.updateMany({
          where: { id: order.id, status: previousStatus },
          data,
        });
        if (updateResult.count !== 1) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'The inventory order changed before it could be updated. Please retry.',
          });
        }
        if (input.status === 'Delivered') {
          await tx.studentPaceSupply.upsert({
            where: {
              studentId_subjectId_paceNumber: {
                studentId: order.studentId,
                subjectId: order.subjectId,
                paceNumber: order.paceNumber,
              },
            },
            create: {
              studentId: order.studentId,
              subjectId: order.subjectId,
              paceNumber: order.paceNumber,
              source: 'DeliveredOrder',
              createdById: ctx.user.id,
            },
            update: {},
          });
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'PaceInventoryOrder',
            entityId: order.id,
            meta: { fromStatus: previousStatus, toStatus: input.status },
          },
        });
        return { ...order, ...data, updatedAt: reachedAt };
      });
    }),

  markOrdersInTransit: roleProcedure('Head')
    .input(markPaceOrdersInTransitInput)
    .mutation(async ({ ctx, input }) => {
      return withSerializableInventoryRls(ctx, async (tx) => {
        const orders = await tx.paceInventoryOrder.findMany({
          where: { id: { in: input.orderIds } },
          select: { id: true, status: true },
        });
        if (orders.length !== input.orderIds.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One or more inventory orders were not found.',
          });
        }
        if (orders.some((order) => order.status !== 'Ordered')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'One or more inventory orders changed. Refresh and try again.',
          });
        }

        const reachedAt = new Date();
        const result = await tx.paceInventoryOrder.updateMany({
          where: { id: { in: input.orderIds }, status: 'Ordered' },
          data: { status: 'InTransit', inTransitAt: reachedAt },
        });
        if (result.count !== input.orderIds.length) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'One or more inventory orders changed. Refresh and try again.',
          });
        }
        await tx.auditLog.createMany({
          data: input.orderIds.map((orderId) => ({
            userId: ctx.user.id,
            action: 'Update',
            entity: 'PaceInventoryOrder',
            entityId: orderId,
            meta: { fromStatus: 'Ordered', toStatus: 'InTransit' },
          })),
        });
        return { count: result.count };
      });
    }),

  markOrdersDelivered: roleProcedure('Head')
    .input(markPaceOrdersDeliveredInput)
    .mutation(async ({ ctx, input }) =>
      withSerializableInventoryRls(ctx, async (tx) => {
        const orders = await tx.paceInventoryOrder.findMany({
          where: { id: { in: input.orderIds } },
          select: { id: true, studentId: true, subjectId: true, paceNumber: true, status: true },
        });
        if (orders.length !== input.orderIds.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'One or more inventory orders were not found.',
          });
        }
        if (orders.some((order) => order.status !== 'InTransit')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'One or more orders changed. Refresh and try again.',
          });
        }
        if (orders.some((order) => !PACE_CATALOGUE.includes(order.paceNumber))) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'PACE orders outside the supported range cannot be marked delivered.',
          });
        }
        const assignments = await activeInventoryAssignments(tx);
        const allowed = new Set(assignments.map((row) => `${row.studentId}:${row.subjectId}`));
        if (orders.some((order) => !allowed.has(`${order.studentId}:${order.subjectId}`))) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'One or more orders no longer have an active PACE assignment.',
          });
        }
        const reachedAt = new Date();
        const result = await tx.paceInventoryOrder.updateMany({
          where: { id: { in: input.orderIds }, status: 'InTransit' },
          data: { status: 'Delivered', deliveredAt: reachedAt },
        });
        if (result.count !== input.orderIds.length) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'One or more orders changed. Refresh and try again.',
          });
        }
        const uniqueSupply = new Map(
          orders.map((order) => [
            `${order.studentId}:${order.subjectId}:${String(order.paceNumber)}`,
            {
              studentId: order.studentId,
              subjectId: order.subjectId,
              paceNumber: order.paceNumber,
              source: 'DeliveredOrder' as const,
              createdById: ctx.user.id,
            },
          ]),
        );
        await tx.studentPaceSupply.createMany({
          data: [...uniqueSupply.values()],
          skipDuplicates: true,
        });
        await tx.auditLog.createMany({
          data: input.orderIds.map((orderId) => ({
            userId: ctx.user.id,
            action: 'Update' as const,
            entity: 'PaceInventoryOrder',
            entityId: orderId,
            meta: { fromStatus: 'InTransit', toStatus: 'Delivered' },
          })),
        });
        return { count: result.count };
      }),
    ),

  recordDiagnostic: roleProcedure('Head')
    .input(diagnosticResultInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.withRls(async (tx) => {
        await requireAssignment(tx, input);
        const diagnostic = await tx.diagnosticResult.create({
          data: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            level: input.level,
            outcome: input.outcome,
            recordedById: ctx.user.id,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'DiagnosticResult',
            entityId: diagnostic.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              level: input.level,
              outcome: input.outcome,
            },
          },
        });
        return diagnostic;
      });
    }),

  deleteDiagnostic: roleProcedure('Head')
    .input(deleteDiagnosticResultInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.withRls(async (tx) => {
        const result = await tx.diagnosticResult.updateMany({
          where: { id: input.diagnosticId, deletedAt: null },
          data: { deletedAt: new Date(), deletedById: ctx.user.id },
        });
        if (result.count !== 1) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'diagnostic result not found' });
        }
        const deleted = { id: input.diagnosticId };
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Delete',
            entity: 'DiagnosticResult',
            entityId: deleted.id,
            meta: { diagnosticId: deleted.id },
          },
        });
        return deleted;
      });
    }),
});
