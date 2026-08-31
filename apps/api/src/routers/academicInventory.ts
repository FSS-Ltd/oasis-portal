import {
  availablePacesAhead,
  bulkPaceInventoryOrderInput,
  currentStudentPaceSupplyInput,
  deleteDiagnosticResultInput,
  diagnosticResultInput,
  paceInventoryOrderInput,
  paceInventoryStatusInput,
  requiresPaceReorder,
} from '@oasis/domain';
import { TRPCError } from '@trpc/server';
import type { RlsTx } from '../context.js';
import { roleProcedure, router } from '../trpc.js';

const RECENT_HISTORY_LIMIT = 100;
const NEXT_ORDER_STATUS = {
  Ordered: 'InTransit',
  InTransit: 'Delivered',
  Delivered: null,
} as const;

const createOrderInput = diagnosticResultInput
  .pick({ studentId: true, subjectId: true })
  .extend({ paceNumber: paceInventoryOrderInput.shape.paceNumber });

async function requireAssignment(
  db: RlsTx,
  input: { studentId: string; subjectId: string },
): Promise<void> {
  const assignment = await db.studentSubject.findFirst({
    where: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      student: { active: true },
      subject: { active: true },
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

export const academicInventoryRouter = router({
  summary: roleProcedure('Head').query(async ({ ctx }) => {
    const { students, orders, diagnostics, supply } = await ctx.withRls(async (tx) => {
      const students = await tx.student.findMany({
        where: {
          active: true,
          subjects: { some: { subject: { active: true } } },
        },
        select: {
          id: true,
          fullNameEnc: true,
          yearGroup: true,
          subjects: {
            where: { subject: { active: true } },
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
      const studentIds = students.map((student) => student.id);

      const [orders, diagnostics, supply] = await Promise.all([
        tx.paceInventoryOrder.findMany({
          where: { studentId: { in: studentIds } },
          orderBy: { createdAt: 'desc' },
          take: RECENT_HISTORY_LIMIT,
          select: {
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
          },
        }),
        tx.diagnosticResult.findMany({
          where: { studentId: { in: studentIds }, deletedAt: null },
          orderBy: { recordedAt: 'desc' },
          take: RECENT_HISTORY_LIMIT,
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
          where: { studentId: { in: studentIds } },
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
      ]);
      return { students, orders, diagnostics, supply };
    });

    const supplyByAssignment = new Map<string, number[]>();
    for (const item of supply) {
      const key = `${item.studentId}:${item.subjectId}`;
      const paceNumbers = supplyByAssignment.get(key) ?? [];
      paceNumbers.push(item.paceNumber);
      supplyByAssignment.set(key, paceNumbers);
    }

    const alerts = students.flatMap((student) =>
      student.subjects.flatMap((assignment) => {
        const availablePaceNumbers = availablePacesAhead(
          assignment.currentPaceNumber,
          supplyByAssignment.get(`${student.id}:${assignment.subjectId}`) ?? [],
        );
        if (!requiresPaceReorder(assignment.currentPaceNumber, availablePaceNumbers)) {
          return [];
        }
        return [
          {
            studentId: student.id,
            subjectId: assignment.subjectId,
            currentPaceNumber: assignment.currentPaceNumber,
            availablePaceNumbers,
            remainingPaceCount: availablePaceNumbers.length,
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
    };
  }),

  createOrder: roleProcedure('Head')
    .input(createOrderInput)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.withRls(async (tx) => {
        await requireAssignment(tx, input);
        return tx.paceInventoryOrder.create({
          data: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumber: input.paceNumber,
            status: 'Ordered',
            createdById: ctx.user.id,
          },
        });
      });
      await ctx.db.auditLog.create({
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
    }),

  addCurrentSupply: roleProcedure('Head')
    .input(currentStudentPaceSupplyInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.withRls(async (tx) => {
        await requireAssignment(tx, input);
        const existingSupply = await tx.studentPaceSupply.findMany({
          where: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumber: { in: input.paceNumbers },
          },
          select: { paceNumber: true },
        });
        const existingPaceNumbers = selectedPaceNumbersAlreadyExist(
          input.paceNumbers,
          existingSupply.map((item) => item.paceNumber),
        );
        if (existingPaceNumbers.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: duplicatePaceNumbersMessage(
              'selected PACE numbers already exist in supply',
              existingPaceNumbers,
            ),
          });
        }
        return tx.studentPaceSupply.createMany({
          data: input.paceNumbers.map((paceNumber) => ({
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumber,
            source: 'CurrentStock',
            createdById: ctx.user.id,
          })),
        });
      });
      await ctx.db.auditLog.create({
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
    }),

  createOrders: roleProcedure('Head')
    .input(bulkPaceInventoryOrderInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.withRls(async (tx) => {
        await requireAssignment(tx, input);
        const [existingSupply, pendingOrders] = await Promise.all([
          tx.studentPaceSupply.findMany({
            where: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              paceNumber: { in: input.paceNumbers },
            },
            select: { paceNumber: true },
          }),
          tx.paceInventoryOrder.findMany({
            where: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              paceNumber: { in: input.paceNumbers },
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
        return tx.paceInventoryOrder.createMany({
          data: input.paceNumbers.map((paceNumber) => ({
            studentId: input.studentId,
            subjectId: input.subjectId,
            paceNumber,
            status: 'Ordered',
            createdById: ctx.user.id,
          })),
        });
      });
      await ctx.db.auditLog.create({
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
    }),

  updateOrderStatus: roleProcedure('Head')
    .input(paceInventoryStatusInput)
    .mutation(async ({ ctx, input }) => {
      const { orderId, previousStatus, updated } = await ctx.withRls(async (tx) => {
        const order = await tx.paceInventoryOrder.findUnique({
          where: { id: input.orderId },
          select: { id: true, studentId: true, subjectId: true, paceNumber: true, status: true },
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

        const previousStatus = order.status;
        const reachedAt = new Date();
        const data =
          input.status === 'InTransit'
            ? { status: 'InTransit' as const, inTransitAt: reachedAt }
            : { status: 'Delivered' as const, deliveredAt: reachedAt };
        const updated = await tx.paceInventoryOrder.update({
          where: { id: order.id },
          data,
        });
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
        return { orderId: order.id, previousStatus, updated };
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'PaceInventoryOrder',
          entityId: orderId,
          meta: { fromStatus: previousStatus, toStatus: input.status },
        },
      });
      return updated;
    }),

  recordDiagnostic: roleProcedure('Head')
    .input(diagnosticResultInput)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.withRls(async (tx) => {
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
        return diagnostic;
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'DiagnosticResult',
          entityId: result.id,
          meta: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            level: input.level,
            outcome: input.outcome,
          },
        },
      });
      return result;
    }),

  deleteDiagnostic: roleProcedure('Head')
    .input(deleteDiagnosticResultInput)
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.withRls(async (tx) => {
        const diagnostic = await tx.diagnosticResult.findFirst({
          where: { id: input.diagnosticId, deletedAt: null },
          select: { id: true },
        });
        if (!diagnostic) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'diagnostic result not found' });
        }
        await tx.diagnosticResult.update({
          where: { id: diagnostic.id },
          data: { deletedAt: new Date(), deletedById: ctx.user.id },
        });
        return { id: diagnostic.id };
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Delete',
          entity: 'DiagnosticResult',
          entityId: deleted.id,
          meta: { diagnosticId: deleted.id },
        },
      });
      return deleted;
    }),
});
