import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { canonicalSchoolYear } from '@oasis/domain';
import type { AppContext } from '../context.js';
import { assertStudentPortalAccess } from '../lib/student-portal-access.js';
import {
  createStudentNotifications,
  listStudentNotifications,
} from '../services/student-notifications.js';
import { adminOperationsProcedure, roleProcedure, router } from '../trpc.js';

const announcementAudienceSchema = z.enum(['All', 'Primary', 'Secondary', 'Student']);

const announceInput = z
  .object({
    audience: announcementAudienceSchema,
    studentId: z.string().cuid().optional(),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(1000),
  })
  .refine((input) => input.audience !== 'Student' || input.studentId !== undefined, {
    message: 'studentId is required for individual announcements',
    path: ['studentId'],
  });

const markReadInput = z.object({
  notificationId: z.string().cuid(),
});

async function loadOwnActiveStudent(ctx: AppContext): Promise<{ id: string; active: boolean }> {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'authentication required' });
  }

  const student = await ctx.db.student.findUnique({
    where: { userId: ctx.user.id },
    select: { id: true, active: true },
  });
  if (!student?.active) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
  }
  return student;
}

function standardYearNumber(yearGroup: string): number | null {
  const canonical = canonicalSchoolYear(yearGroup);
  if (canonical === 'Nursery' || canonical === 'Reception') return 0;
  if (canonical === null) return null;
  const match = /^Year ([1-9]|1[0-3])$/u.exec(canonical);
  return match ? Number(match[1]) : null;
}

function matchesAudience(
  student: { id: string; yearGroup: string },
  input: z.infer<typeof announceInput>,
): boolean {
  if (input.audience === 'All') return true;
  if (input.audience === 'Student') return student.id === input.studentId;

  const year = standardYearNumber(student.yearGroup);
  if (input.audience === 'Primary') {
    return year !== null && year <= 6;
  }
  return year !== null && year >= 7;
}

export const studentNotificationRouter = router({
  list: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, {
      entity: 'studentNotification.list',
      studentId: student.id,
    });

    return ctx.withRls((tx) => listStudentNotifications(ctx, tx, student.id));
  }),

  unreadCount: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await loadOwnActiveStudent(ctx);
    await assertStudentPortalAccess(ctx, {
      entity: 'studentNotification.unreadCount',
      studentId: student.id,
    });

    return ctx.withRls(async (tx) => ({
      count: await tx.studentNotification.count({
        where: { studentId: student.id, readAt: null },
      }),
    }));
  }),

  markRead: roleProcedure('Student')
    .input(markReadInput)
    .mutation(async ({ ctx, input }) => {
      const student = await loadOwnActiveStudent(ctx);
      await assertStudentPortalAccess(ctx, {
        entity: 'studentNotification.markRead',
        studentId: student.id,
      });

      return ctx.withRls(async (tx) => {
        const updated = await tx.studentNotification.updateMany({
          where: { id: input.notificationId, studentId: student.id, readAt: null },
          data: { readAt: new Date() },
        });

        if (updated.count === 0) {
          const existing = await tx.studentNotification.findFirst({
            where: { id: input.notificationId, studentId: student.id },
            select: { id: true, readAt: true },
          });
          if (!existing) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'notification not found' });
          }
        }

        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'StudentNotification',
            entityId: input.notificationId,
            meta: { source: 'studentNotification.markRead', studentId: student.id },
          },
        });

        return { id: input.notificationId, read: true };
      });
    }),

  announce: adminOperationsProcedure.input(announceInput).mutation(async ({ ctx, input }) => {
    const students = await ctx.db.student.findMany({
      where: { active: true },
      select: { id: true, yearGroup: true },
      orderBy: { createdAt: 'asc' },
    });
    const targetStudents = students.filter((student) => matchesAudience(student, input));
    if (input.audience === 'Student' && targetStudents.length === 0) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
    }

    return ctx.withRls(async (tx) => {
      const result = await createStudentNotifications(ctx, tx, {
        auditSource: 'studentNotification.announce',
        notifications: targetStudents.map((student) => ({
          studentId: student.id,
          kind: 'SystemAnnouncement',
          title: input.title,
          body: input.body,
          sourceEntity: 'SystemAnnouncement',
          sourceId: null,
          createdById: ctx.user.id,
        })),
      });

      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'StudentAnnouncement',
          meta: {
            audience: input.audience,
            studentId: input.studentId ?? null,
            recipientCount: result.count,
          },
        },
      });

      return { recipientCount: result.count };
    });
  }),
});
