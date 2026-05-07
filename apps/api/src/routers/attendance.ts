import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  AccessDeniedError,
  canExportAttendance,
  canRecordStudentAttendance,
  isStaff,
  type SessionUser,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { authedProcedure, fullAdminProcedure, roleProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const ATTENDANCE_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'Supervisor',
] as const;

const attendanceStatusSchema = z.enum(['Present', 'Absent', 'Late']);

const dateRangeShape = {
  from: z.coerce.date(),
  to: z.coerce.date(),
} as const;

const studentExportInput = z
  .object({
    ...dateRangeShape,
    studentId: z.string().min(1).optional(),
  })
  .refine(validateDateRange, {
    message: 'from must be on or before to',
    path: ['to'],
  });

const staffExportInput = z
  .object({
    ...dateRangeShape,
    staffUserId: z.string().min(1).optional(),
  })
  .refine(validateDateRange, {
    message: 'from must be on or before to',
    path: ['to'],
  });

const studentHistoryInput = z
  .object({
    ...dateRangeShape,
    studentId: z.string().min(1),
  })
  .refine(validateDateRange, {
    message: 'from must be on or before to',
    path: ['to'],
  });

const staffHistoryInput = z
  .object({
    ...dateRangeShape,
    staffUserId: z.string().min(1),
  })
  .refine(validateDateRange, {
    message: 'from must be on or before to',
    path: ['to'],
  });

function validateDateRange(input: { from: Date; to: Date }): boolean {
  return normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime();
}

function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function decryptRequired(
  decrypt: (value: string | null | undefined) => string | null,
  value: string,
  entity: string,
): string {
  const decrypted = decrypt(value);
  if (!decrypted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${entity} PII decrypt failed` });
  }
  return decrypted;
}

function csvEscape(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (!/[",\n\r]/u.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

async function requireCanExportAttendance(
  ctx: AuthedContext,
  meta: Record<string, string | number | null>,
): Promise<void> {
  if (canExportAttendance(ctx.user)) return;

  const denied = new AccessDeniedError('attendance export requires full-admin or attendance-exporter');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'AttendanceExport',
      meta: { ...meta, role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function requireCanRecordAttendance(ctx: AuthedContext): Promise<void> {
  if (canRecordStudentAttendance(ctx.user)) return;
  const denied = new AccessDeniedError('attendance recording requires Head or attendance-recorder');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity: 'attendance.mark',
      meta: { role: ctx.user.role, reason: denied.message },
    },
  });
  throw new TRPCError({ code: 'FORBIDDEN', message: denied.message, cause: denied });
}

async function assertActiveStaffUser(
  ctx: {
    db: {
      user: {
        findUnique: (args: {
          where: { id: string };
          select: { id: true; role: true; active: true };
        }) => Promise<{ id: string; role: SessionUser['role']; active: boolean } | null>;
      };
    };
  },
  staffUserId: string,
): Promise<void> {
  const user = await ctx.db.user.findUnique({
    where: { id: staffUserId },
    select: { id: true, role: true, active: true },
  });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'supervisor user not found' });
  }
  if (!user.active || !isStaff(user)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'user is not an active supervisor' });
  }
}

export const attendanceRouter = router({
  listYearGroupBands: roleProcedure(...ATTENDANCE_ROLES).query(async ({ ctx }) => {
    return ctx.db.yearGroupBand.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        standardYears: true,
        colour: true,
        sortOrder: true,
      },
    });
  }),

  forDate: roleProcedure(...ATTENDANCE_ROLES)
    .input(z.object({ date: z.coerce.date() }))
    .query(async ({ ctx, input }) => {
      const date = normalizeDate(input.date);
      const students = await ctx.db.student.findMany({
        where: { active: true },
        select: {
          id: true,
          fullNameEnc: true,
          yearGroup: true,
          attendance: {
            where: { date },
            select: {
              id: true,
              status: true,
              recordedById: true,
              createdAt: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const rows = students.map((student) => {
        const attendance = student.attendance[0] ?? null;
        return {
          studentId: student.id,
          studentName: decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student'),
          yearGroup: student.yearGroup,
          date: dateKey(date),
          status: attendance?.status ?? null,
          attendanceId: attendance?.id ?? null,
          recordedById: attendance?.recordedById ?? null,
          recordedAt: attendance?.createdAt ?? null,
        };
      });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: { count: rows.length, source: 'attendance.forDate' },
        },
      });

      return rows;
    }),

  mark: roleProcedure(...ATTENDANCE_ROLES)
    .input(
      z.object({
        studentId: z.string().min(1),
        date: z.coerce.date(),
        status: attendanceStatusSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCanRecordAttendance(ctx);
      const date = normalizeDate(input.date);
      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        select: { id: true, active: true },
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!student.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
      }

      const existing = await ctx.db.attendance.findUnique({
        where: { studentId_date: { studentId: input.studentId, date } },
        select: { id: true },
      });

      const attendance = existing
        ? await ctx.db.attendance.update({
            where: { id: existing.id },
            data: { status: input.status, recordedById: ctx.user.id },
          })
        : await ctx.db.attendance.create({
            data: {
              studentId: input.studentId,
              date,
              status: input.status,
              recordedById: ctx.user.id,
            },
          });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: existing ? 'Update' : 'Create',
          entity: 'Attendance',
          entityId: attendance.id,
          meta: {
            studentId: input.studentId,
            date: dateKey(date),
            status: input.status,
          },
        },
      });

      return {
        id: attendance.id,
        studentId: attendance.studentId,
        date: dateKey(attendance.date),
        status: attendance.status,
        recordedById: attendance.recordedById,
        recordedAt: attendance.createdAt,
      };
    }),

  listExportOptions: authedProcedure.query(async ({ ctx }) => {
    await requireCanExportAttendance(ctx, { kind: 'options' });

    const [students, staffUsers] = await Promise.all([
      ctx.db.student.findMany({
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          fullNameEnc: true,
          yearGroup: true,
          active: true,
        },
      }),
      ctx.db.user.findMany({
        where: {
          role: { in: [...ATTENDANCE_ROLES] },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          fullNameEnc: true,
          emailEnc: true,
          role: true,
          active: true,
        },
      }),
    ]);

    const studentOptions = students.map((student) => {
      const studentName = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student');
      return {
        id: student.id,
        label: `${studentName} · ${student.yearGroup}${student.active ? '' : ' · Inactive'}`,
        name: studentName,
        yearGroup: student.yearGroup,
        active: student.active,
      };
    });
    const staffOptions = staffUsers.map((staffUser) => {
      const staffName = decryptRequired(ctx.db.$enc.decrypt, staffUser.fullNameEnc, 'user');
      const email = decryptRequired(ctx.db.$enc.decrypt, staffUser.emailEnc, 'user');
      return {
        id: staffUser.id,
        label: `${staffName} · ${staffUser.role}${staffUser.active ? '' : ' · Inactive'}`,
        name: staffName,
        email,
        role: staffUser.role,
        active: staffUser.active,
      };
    });

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: studentOptions.length, source: 'attendance.listExportOptions' },
      },
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: staffOptions.length, source: 'attendance.listExportOptions' },
      },
    });

    return {
      students: studentOptions,
      staff: staffOptions,
    };
  }),

  exportStudentsCsv: authedProcedure
    .input(studentExportInput)
    .query(async ({ ctx, input }) => {
      const from = normalizeDate(input.from);
      const to = normalizeDate(input.to);
      const selectedStudentId = input.studentId ?? null;
      await requireCanExportAttendance(ctx, {
        kind: 'student',
        from: dateKey(from),
        to: dateKey(to),
        studentId: selectedStudentId,
      });

      const rows = await ctx.db.attendance.findMany({
        where: {
          date: {
            gte: from,
            lte: to,
          },
          ...(selectedStudentId ? { studentId: selectedStudentId } : {}),
        },
        select: {
          date: true,
          status: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              fullNameEnc: true,
              yearGroup: true,
            },
          },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      });

      const csv = buildCsv(
        ['Date', 'Student ID', 'Student Name', 'Year Group', 'Status', 'Recorded At'],
        rows.map((row) => [
          dateKey(row.date),
          row.student.id,
          decryptRequired(ctx.db.$enc.decrypt, row.student.fullNameEnc, 'student'),
          row.student.yearGroup,
          row.status,
          row.createdAt.toISOString(),
        ]),
      );

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: { count: rows.length, source: 'attendance.exportStudentsCsv' },
        },
      });
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Update',
          entity: 'AttendanceExport',
          meta: {
            kind: 'student',
            from: dateKey(from),
            to: dateKey(to),
            studentId: selectedStudentId,
            rowCount: rows.length,
            scope: selectedStudentId ? 'individual' : 'all',
          },
        },
      });

      return {
        filename: `student-attendance-${dateKey(from)}-to-${dateKey(to)}.csv`,
        contentType: 'text/csv; charset=utf-8',
        csv,
      };
    }),

  studentHistory: authedProcedure.input(studentHistoryInput).query(async ({ ctx, input }) => {
    const from = normalizeDate(input.from);
    const to = normalizeDate(input.to);
    await requireCanExportAttendance(ctx, {
      kind: 'student-history',
      from: dateKey(from),
      to: dateKey(to),
      studentId: input.studentId,
    });

    const rows = await ctx.db.attendance.findMany({
      where: {
        studentId: input.studentId,
        date: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        date: true,
        status: true,
        recordedById: true,
        createdAt: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      date: dateKey(row.date),
      status: row.status,
      recordedById: row.recordedById,
      recordedAt: row.createdAt,
    }));
  }),

  markStaff: fullAdminProcedure
    .input(
      z.object({
        staffUserId: z.string().min(1),
        date: z.coerce.date(),
        status: attendanceStatusSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const date = normalizeDate(input.date);
      await assertActiveStaffUser(ctx, input.staffUserId);

      const existing = await ctx.db.staffAttendance.findUnique({
        where: { staffUserId_date: { staffUserId: input.staffUserId, date } },
        select: { id: true },
      });

      const attendance = existing
        ? await ctx.db.staffAttendance.update({
            where: { id: existing.id },
            data: { status: input.status, recordedById: ctx.user.id },
          })
        : await ctx.db.staffAttendance.create({
            data: {
              staffUserId: input.staffUserId,
              date,
              status: input.status,
              recordedById: ctx.user.id,
            },
          });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: existing ? 'Update' : 'Create',
          entity: 'StaffAttendance',
          entityId: attendance.id,
          meta: {
            staffUserId: input.staffUserId,
            date: dateKey(date),
            status: input.status,
          },
        },
      });

      return {
        id: attendance.id,
        staffUserId: attendance.staffUserId,
        date: dateKey(attendance.date),
        status: attendance.status,
        recordedById: attendance.recordedById,
        recordedAt: attendance.createdAt,
      };
    }),

  exportStaffCsv: authedProcedure.input(staffExportInput).query(async ({ ctx, input }) => {
    const from = normalizeDate(input.from);
    const to = normalizeDate(input.to);
    const selectedStaffUserId = input.staffUserId ?? null;
    await requireCanExportAttendance(ctx, {
      kind: 'staff',
      from: dateKey(from),
      to: dateKey(to),
      staffUserId: selectedStaffUserId,
    });

    const rows = await ctx.db.staffAttendance.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
        ...(selectedStaffUserId ? { staffUserId: selectedStaffUserId } : {}),
      },
      select: {
        date: true,
        status: true,
        createdAt: true,
        staffUser: {
          select: {
            id: true,
            fullNameEnc: true,
            emailEnc: true,
            role: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const csv = buildCsv(
      ['Date', 'Supervisor User ID', 'Supervisor Name', 'Email', 'Role', 'Status', 'Recorded At'],
      rows.map((row) => [
        dateKey(row.date),
        row.staffUser.id,
        decryptRequired(ctx.db.$enc.decrypt, row.staffUser.fullNameEnc, 'user'),
        decryptRequired(ctx.db.$enc.decrypt, row.staffUser.emailEnc, 'user'),
        row.staffUser.role,
        row.status,
        row.createdAt.toISOString(),
      ]),
    );

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: rows.length, source: 'attendance.exportStaffCsv' },
      },
    });
    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'AttendanceExport',
        meta: {
          kind: 'staff',
          from: dateKey(from),
          to: dateKey(to),
          staffUserId: selectedStaffUserId,
          rowCount: rows.length,
          scope: selectedStaffUserId ? 'individual' : 'all',
        },
      },
    });

    return {
      filename: `supervisor-attendance-${dateKey(from)}-to-${dateKey(to)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      csv,
    };
  }),

  staffHistory: authedProcedure.input(staffHistoryInput).query(async ({ ctx, input }) => {
    const from = normalizeDate(input.from);
    const to = normalizeDate(input.to);
    await requireCanExportAttendance(ctx, {
      kind: 'staff-history',
      from: dateKey(from),
      to: dateKey(to),
      staffUserId: input.staffUserId,
    });

    const rows = await ctx.db.staffAttendance.findMany({
      where: {
        staffUserId: input.staffUserId,
        date: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        date: true,
        status: true,
        recordedById: true,
        createdAt: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      date: dateKey(row.date),
      status: row.status,
      recordedById: row.recordedById,
      recordedAt: row.createdAt,
    }));
  }),
});
