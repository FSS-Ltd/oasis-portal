import { TRPCError } from '@trpc/server';
import { AccessDeniedError, requirePersonalTasks, type SessionUser } from '@oasis/domain';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import {
  syncTimetableTasks,
  type TimetableTaskDb,
  type TimetableTaskSyncSummary,
} from '../services/timetable-tasks.js';
import { authedProcedure, router } from '../trpc.js';

const taskTitle = z.string().trim().min(1, 'Enter a task title').max(180);

const createTaskInput = z.object({
  dueAt: z.coerce.date().nullable().optional(),
  reminderAt: z.coerce.date().nullable().optional(),
  title: taskTitle,
});

const completeTaskInput = z.object({
  completed: z.boolean(),
  id: z.string().min(1),
});

function assertPersonalTaskAccess(user: SessionUser): void {
  try {
    requirePersonalTasks(user);
  } catch (error) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        error instanceof AccessDeniedError
          ? error.message
          : 'personal tasks are only available to staff',
      cause: error instanceof Error ? error : undefined,
    });
  }
}

function missingTask(): TRPCError {
  return new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
}

async function taskOwnedBy(ctx: AppContext, ownerId: string, taskId: string) {
  const task = await ctx.withRls((db) =>
    db.personalTask.findFirst({
      where: { id: taskId, ownerId },
    }),
  );

  if (!task) throw missingTask();
  return task;
}

interface PersonalTaskRouterDeps {
  syncTimetableTasks(input: {
    db: TimetableTaskDb;
    asOf?: Date;
    headIds?: readonly string[];
  }): Promise<TimetableTaskSyncSummary>;
}

export function createPersonalTaskRouter(deps: PersonalTaskRouterDeps = { syncTimetableTasks }) {
  return router({
    list: authedProcedure.query(async ({ ctx }) => {
      assertPersonalTaskAccess(ctx.user);
      if (ctx.user.role === 'Head') {
        await ctx.withRls((db) =>
          deps.syncTimetableTasks({
            db: db as unknown as TimetableTaskDb,
            headIds: [ctx.user.id],
          }),
        );
      }

      return ctx.withRls((db) =>
        db.personalTask.findMany({
          orderBy: { createdAt: 'desc' },
          where: { ownerId: ctx.user.id },
        }),
      );
    }),

    create: authedProcedure.input(createTaskInput).mutation(async ({ ctx, input }) => {
      assertPersonalTaskAccess(ctx.user);

      return ctx.withRls((db) =>
        db.personalTask.create({
          data: {
            dueAt: input.dueAt ?? null,
            ownerId: ctx.user.id,
            reminderAt: input.reminderAt ?? null,
            title: input.title,
          },
        }),
      );
    }),

    setCompleted: authedProcedure.input(completeTaskInput).mutation(async ({ ctx, input }) => {
      assertPersonalTaskAccess(ctx.user);
      await taskOwnedBy(ctx, ctx.user.id, input.id);

      return ctx.withRls((db) =>
        db.personalTask.update({
          data: { completedAt: input.completed ? new Date() : null },
          where: { id: input.id },
        }),
      );
    }),
  });
}

export const personalTaskRouter = createPersonalTaskRouter();
