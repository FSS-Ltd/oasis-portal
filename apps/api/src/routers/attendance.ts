import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { AccessDeniedError, hasTag, isFullAdmin, type SessionUser } from '@oasis/domain';
import { authedProcedure, roleProcedure, router } from '../trpc.js';

const ATTENDANCE_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'Supervisor',
] as const;

const attendanceStatusSchema = z.enum(['Present', 'Absent', 'Late']);

const dateRangeInput = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((input) => normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime(), {
    message: 'from must be on or before to',
    path: ['to'],
  });

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

function requireCanExportAttendance(user: SessionUser): void {
  if (isFullAdmin(user) || hasTag(user, 'attendance-exporter')) return;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'attendance export requires full-admin or attendance-exporter',
    cause: new AccessDeniedError('attendance export requires full-admin or attendance-exporter'),
  });
}

export const attendanceRouter = router({
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
        studentId: z.string().cuid(),
        date: z.coerce.date(),
        status: attendanceStatusSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

  exportStudentsCsv: authedProcedure
    .input(dateRangeInput)
    .query(async ({ ctx, input }) => {
      requireCanExportAttendance(ctx.user);

      const from = normalizeDate(input.from);
      const to = normalizeDate(input.to);
      const rows = await ctx.db.attendance.findMany({
        where: {
          date: {
            gte: from,
            lte: to,
          },
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
            rowCount: rows.length,
          },
        },
      });

      return {
        filename: `student-attendance-${dateKey(from)}-to-${dateKey(to)}.csv`,
        contentType: 'text/csv; charset=utf-8',
        csv,
      };
    }),
});
