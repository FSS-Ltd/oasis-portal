import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma } from '@oasis/db';
import {
  canUseAdminOperations,
  canUseAllStudentSupervisorWorkflow,
  deriveEnglandWalesSchoolYear,
  standardSchoolYearSchema,
} from '@oasis/domain';
import { loadDailyYearBandScope, studentWhereForDailyScope } from '../lib/daily-year-band-scope.js';
import { assertStudentPortalUnlocked } from '../lib/student-portal-access.js';
import { adminOperationsProcedure, roleProcedure, router } from '../trpc.js';
import { deleteArchivedStudent } from '../students/delete-archived-student.js';

const STUDENT_READ_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'TechnicalSupport',
  'ClubsAdmin',
  'Supervisor',
] as const;

const DEFAULT_CURRENT_PACE_NUMBER = 1001;

const studentInclude = Prisma.validator<Prisma.StudentInclude>()({
  subjects: {
    include: { subject: true },
  },
  registrationProfile: {
    select: {
      registration: {
        select: { homeAddressEnc: true },
      },
    },
  },
});

const createInput = z.object({
  fullName: z.string().trim().min(1),
  dob: z.coerce.date(),
  yearGroup: standardSchoolYearSchema.optional(),
  enrolmentDate: z.coerce.date(),
  address: z.string().trim().min(1).optional(),
});

const updateInput = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(1).optional(),
  dob: z.coerce.date().optional(),
  yearGroup: standardSchoolYearSchema.optional(),
  enrolmentDate: z.coerce.date().optional(),
  address: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional(),
});

const listInput = z
  .object({
    search: z.string().trim().min(1).optional(),
    includeInactive: z.boolean().optional(),
    date: z.coerce.date().optional(),
  })
  .optional();

const byIdInput = z.object({ id: z.string().min(1) });
const deleteArchivedInput = byIdInput;

const assignSubjectInput = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  currentPaceNumber: z.number().int().positive().optional(),
});

const setCurrentPaceInput = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  currentPaceNumber: z.number().int().positive(),
});

const unassignSubjectInput = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
});

type StudentWithSubjects = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decryptStudent(
  ctx: { db: { $enc: { decrypt: (value: string | null | undefined) => string | null } } },
  student: StudentWithSubjects,
) {
  const fullName = ctx.db.$enc.decrypt(student.fullNameEnc);
  const dob = ctx.db.$enc.decrypt(student.dobEnc);
  if (!fullName || !dob) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student PII decrypt failed' });
  }

  return {
    id: student.id,
    userId: student.userId,
    fullName,
    dob,
    address:
      ctx.db.$enc.decrypt(student.addressEnc) ??
      ctx.db.$enc.decrypt(student.registrationProfile?.registration.homeAddressEnc),
    yearGroup: student.yearGroup,
    enrolmentDate: student.enrolmentDate,
    active: student.active,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    subjects: student.subjects.map((assignment) => ({
      subjectId: assignment.subjectId,
      code: assignment.subject.code,
      name: assignment.subject.name,
      currentPaceNumber: assignment.currentPaceNumber,
    })),
  };
}

async function auditDecryptPii(
  ctx: {
    db: { auditLog: { create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown> } };
    user: { id: string };
  },
  meta: { count: number; source: 'student.list' | 'student.byId' | 'student.me' },
  entityId?: string,
) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    userId: ctx.user.id,
    action: 'DecryptPii',
    entity: 'Student',
    meta,
  };
  if (entityId !== undefined) data.entityId = entityId;

  await ctx.db.auditLog.create({
    data,
  });
}

export const studentRouter = router({
  me: roleProcedure('Student').query(async ({ ctx }) => {
    const student = await ctx.db.student.findUnique({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        userId: true,
        fullNameEnc: true,
        yearGroup: true,
        enrolmentDate: true,
        active: true,
      },
    });

    if (!student?.active) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'student profile not found' });
    }
    await assertStudentPortalUnlocked(ctx, { entity: 'student.me', studentId: student.id });

    const fullName = ctx.db.$enc.decrypt(student.fullNameEnc);
    if (!fullName) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'student PII decrypt failed' });
    }

    await auditDecryptPii(ctx, { count: 1, source: 'student.me' }, student.id);

    return {
      id: student.id,
      userId: student.userId,
      fullName,
      yearGroup: student.yearGroup,
      enrolmentDate: student.enrolmentDate,
      active: student.active,
    };
  }),

  list: roleProcedure(...STUDENT_READ_ROLES)
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const scope = await loadDailyYearBandScope(ctx, input?.date ?? new Date());
      const where: Prisma.StudentWhereInput = {};
      if (!canUseAdminOperations(ctx.user) || !input?.includeInactive) {
        where.active = true;
      }
      if (input?.search) where.nameBidx = ctx.db.$enc.blindIndex(input.search);
      if (!canUseAllStudentSupervisorWorkflow(ctx.user)) {
        Object.assign(where, studentWhereForDailyScope(scope));
      }

      const students = await ctx.db.student.findMany({
        where,
        include: studentInclude,
        orderBy: { createdAt: 'desc' },
      });

      const rows = students.map((student) => decryptStudent(ctx, student));
      await auditDecryptPii(ctx, { count: rows.length, source: 'student.list' });
      return rows;
    }),

  byId: roleProcedure(...STUDENT_READ_ROLES)
    .input(byIdInput)
    .query(async ({ ctx, input }) => {
      const student = await ctx.db.student.findUnique({
        where: { id: input.id },
        include: studentInclude,
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }

      const row = decryptStudent(ctx, student);
      await auditDecryptPii(ctx, { count: 1, source: 'student.byId' }, student.id);
      return row;
    }),

  create: adminOperationsProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const yearGroup = input.yearGroup ?? deriveEnglandWalesSchoolYear(input.dob);
    const student = await ctx.db.student.create({
      data: {
        fullNameEnc: ctx.db.$enc.encrypt(input.fullName),
        nameBidx: ctx.db.$enc.blindIndex(input.fullName),
        dobEnc: ctx.db.$enc.encrypt(dateOnly(input.dob)),
        addressEnc: ctx.db.$enc.encrypt(input.address),
        yearGroup,
        enrolmentDate: input.enrolmentDate,
      },
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'Student',
        entityId: student.id,
        meta: { yearGroup },
      },
    });

    return { id: student.id };
  }),

  update: adminOperationsProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const data: Prisma.StudentUpdateInput = {};
    if (input.fullName !== undefined) {
      data.fullNameEnc = ctx.db.$enc.encrypt(input.fullName);
      data.nameBidx = ctx.db.$enc.blindIndex(input.fullName);
    }
    if (input.dob !== undefined) data.dobEnc = ctx.db.$enc.encrypt(dateOnly(input.dob));
    if (input.address !== undefined) data.addressEnc = ctx.db.$enc.encrypt(input.address);
    if (input.yearGroup !== undefined) data.yearGroup = input.yearGroup;
    if (input.enrolmentDate !== undefined) data.enrolmentDate = input.enrolmentDate;
    if (input.active !== undefined) data.active = input.active;

    try {
      const student = await ctx.db.student.update({
        where: { id: input.id },
        data,
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'Student',
          entityId: student.id,
          meta: { fields: Object.keys(data).sort() },
        },
      });
      return { id: student.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      throw err;
    }
  }),

  assignSubject: adminOperationsProcedure
    .input(assignSubjectInput)
    .mutation(async ({ ctx, input }) => {
      const [student, subject] = await Promise.all([
        ctx.db.student.findUnique({ where: { id: input.studentId }, select: { id: true } }),
        ctx.db.subject.findUnique({
          where: { id: input.subjectId },
          select: { id: true, active: true },
        }),
      ]);
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!subject) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'subject not found' });
      }
      if (!subject.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'subject is inactive' });
      }

      const currentPaceNumber = input.currentPaceNumber ?? DEFAULT_CURRENT_PACE_NUMBER;
      try {
        const assignment = await ctx.db.studentSubject.create({
          data: {
            studentId: input.studentId,
            subjectId: input.subjectId,
            currentPaceNumber,
          },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'StudentSubject',
            entityId: assignment.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              currentPaceNumber,
            },
          },
        });
        return { created: true, assignmentId: assignment.id, currentPaceNumber };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await ctx.db.studentSubject.findUnique({
            where: {
              studentId_subjectId: {
                studentId: input.studentId,
                subjectId: input.subjectId,
              },
            },
          });
          if (existing) {
            return {
              created: false,
              assignmentId: existing.id,
              currentPaceNumber: existing.currentPaceNumber,
            };
          }
        }
        throw err;
      }
    }),

  setCurrentPace: adminOperationsProcedure
    .input(setCurrentPaceInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const assignment = await ctx.db.studentSubject.update({
          where: {
            studentId_subjectId: {
              studentId: input.studentId,
              subjectId: input.subjectId,
            },
          },
          data: { currentPaceNumber: input.currentPaceNumber },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'StudentSubject',
            entityId: assignment.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              currentPaceNumber: input.currentPaceNumber,
            },
          },
        });
        return { assignmentId: assignment.id, currentPaceNumber: assignment.currentPaceNumber };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student subject not found' });
        }
        throw err;
      }
    }),

  unassignSubject: adminOperationsProcedure
    .input(unassignSubjectInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const assignment = await ctx.db.studentSubject.delete({
          where: {
            studentId_subjectId: {
              studentId: input.studentId,
              subjectId: input.subjectId,
            },
          },
        });
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Delete',
            entity: 'StudentSubject',
            entityId: assignment.id,
            meta: {
              studentId: input.studentId,
              subjectId: input.subjectId,
              previousPaceNumber: assignment.currentPaceNumber,
              historicalPaceRecordsPreserved: true,
            },
          },
        });
        return {
          assignmentId: assignment.id,
          studentId: input.studentId,
          subjectId: input.subjectId,
        };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'student subject not found' });
        }
        throw err;
      }
    }),

  deleteArchived: adminOperationsProcedure
    .input(deleteArchivedInput)
    .mutation(async ({ ctx, input }) =>
      deleteArchivedStudent(
        {
          $transaction: (callback) => ctx.db.$transaction((tx) => callback(tx)),
        },
        { actorUserId: ctx.user.id, studentId: input.id },
      ),
    ),
});
