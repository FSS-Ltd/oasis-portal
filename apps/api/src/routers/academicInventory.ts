import {
  diagnosticResultInput,
  firstPaceNumberForDiagnosticLevel,
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

export const academicInventoryRouter = router({
  summary: roleProcedure('Head').query(async ({ ctx }) => {
    const { students, orders, diagnostics, deliveredOrders } = await ctx.withRls(async (tx) => {
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

      const [orders, diagnostics, deliveredOrders] = await Promise.all([
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
          where: { studentId: { in: studentIds } },
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
        tx.paceInventoryOrder.findMany({
          where: { studentId: { in: studentIds }, status: 'Delivered' },
          select: { studentId: true, subjectId: true, paceNumber: true },
        }),
      ]);
      return { students, orders, diagnostics, deliveredOrders };
    });

    const highestDeliveredByAssignment = new Map<string, Map<string, number>>();
    for (const order of deliveredOrders) {
      let bySubject = highestDeliveredByAssignment.get(order.studentId);
      if (!bySubject) {
        bySubject = new Map<string, number>();
        highestDeliveredByAssignment.set(order.studentId, bySubject);
      }
      const currentHighest = bySubject.get(order.subjectId);
      if (currentHighest === undefined || order.paceNumber > currentHighest) {
        bySubject.set(order.subjectId, order.paceNumber);
      }
    }

    const alerts = students.flatMap((student) =>
      student.subjects.flatMap((assignment) => {
        const deliveredPaceNumber =
          highestDeliveredByAssignment.get(student.id)?.get(assignment.subjectId) ?? null;
        if (
          deliveredPaceNumber === null ||
          !requiresPaceReorder(assignment.currentPaceNumber, deliveredPaceNumber)
        ) {
          return [];
        }
        return [
          {
            studentId: student.id,
            subjectId: assignment.subjectId,
            currentPaceNumber: assignment.currentPaceNumber,
            deliveredPaceNumber,
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

  updateOrderStatus: roleProcedure('Head')
    .input(paceInventoryStatusInput)
    .mutation(async ({ ctx, input }) => {
      const { orderId, previousStatus, updated } = await ctx.withRls(async (tx) => {
        const order = await tx.paceInventoryOrder.findUnique({
          where: { id: input.orderId },
          select: { id: true, status: true },
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
      const currentPaceNumber = firstPaceNumberForDiagnosticLevel(input.level);
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
        await tx.studentSubject.update({
          where: {
            studentId_subjectId: {
              studentId: input.studentId,
              subjectId: input.subjectId,
            },
          },
          data: { currentPaceNumber },
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
            currentPaceNumber,
          },
        },
      });
      return result;
    }),
});
