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
import {
  loadDailyYearBandScope,
  studentMatchesDailyScope,
  studentWhereForDailyScope,
} from '../lib/daily-year-band-scope.js';
import { adminOperationsProcedure, authedProcedure, roleProcedure, router } from '../trpc.js';

type AuthedContext = AppContext & { user: SessionUser };

const ATTENDANCE_ROLES = [
  'Head',
  'Principal',
  'Pastor',
  'HeadOfDiscipline',
  'ClubsAdmin',
  'Supervisor',
] as const;

const attendanceStatusSchema = z.enum(['Present', 'Absent', 'Late']);
const absenceReasonSchema = z.enum(['Sick', 'Holiday', 'NotScheduled', 'Excused', 'Unexcused']);
const insightKindSchema = z.enum(['students', 'staff']);

const attendanceMarkInput = z
  .object({
    studentId: z.string().min(1),
    date: z.coerce.date(),
    status: attendanceStatusSchema,
    absenceReason: absenceReasonSchema.nullish(),
  })
  .superRefine(requireAbsenceReason);

const staffAttendanceMarkInput = z
  .object({
    staffUserId: z.string().min(1),
    date: z.coerce.date(),
    status: attendanceStatusSchema,
    absenceReason: absenceReasonSchema.nullish(),
  })
  .superRefine(requireAbsenceReason);

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

const insightsInput = z
  .object({
    ...dateRangeShape,
    kind: insightKindSchema,
    subjectId: z.string().min(1).optional(),
  })
  .refine(validateDateRange, {
    message: 'from must be on or before to',
    path: ['to'],
  });

type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
type AbsenceReason = z.infer<typeof absenceReasonSchema>;
type InsightKind = z.infer<typeof insightKindSchema>;
type AbsenceReasonBucket = AbsenceReason | 'Unknown';
type AttendanceSummary = Record<AttendanceStatus, number> & { total: number };

const ATTENDANCE_STATUSES = attendanceStatusSchema.options;
const ABSENCE_REASON_BUCKETS = [...absenceReasonSchema.options, 'Unknown'] as const;
const ABSENCE_REASON_LABELS = {
  Sick: 'Sick',
  Holiday: 'Holiday',
  NotScheduled: 'Not scheduled',
  Excused: 'Excused',
  Unexcused: 'Unexcused',
  Unknown: 'Unknown',
} as const satisfies Record<AbsenceReasonBucket, string>;

function requireAbsenceReason(
  input: { status: AttendanceStatus; absenceReason?: AbsenceReason | null | undefined },
  ctx: z.RefinementCtx,
): void {
  if (input.status === 'Absent' && !input.absenceReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'absenceReason is required when status is Absent',
      path: ['absenceReason'],
    });
  }
}

function validateDateRange(input: { from: Date; to: Date }): boolean {
  return normalizeDate(input.from).getTime() <= normalizeDate(input.to).getTime();
}

function normalizeDate(date: Date): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return normalizeDate(date).toISOString().slice(0, 10);
}

function absenceReasonForStatus(
  status: AttendanceStatus,
  absenceReason: AbsenceReason | null | undefined,
): AbsenceReason | null {
  return status === 'Absent' ? (absenceReason ?? null) : null;
}

function emptySummary(): AttendanceSummary {
  return { total: 0, Present: 0, Absent: 0, Late: 0 };
}

function attendanceRate(summary: Pick<AttendanceSummary, 'Present' | 'total'>): number | null {
  if (summary.total === 0) return null;
  return Math.round((summary.Present / summary.total) * 100);
}

function incrementSummary(summary: AttendanceSummary, status: AttendanceStatus): void {
  summary.total += 1;
  summary[status] += 1;
}

function absenceBucket(
  status: AttendanceStatus,
  reason: AbsenceReason | null,
): AbsenceReasonBucket | null {
  if (status !== 'Absent') return null;
  return reason ?? 'Unknown';
}

function reasonLabel(reason: AbsenceReason | null): string | null {
  if (!reason) return null;
  return ABSENCE_REASON_LABELS[reason];
}

function buildInsightsResult(
  kind: InsightKind,
  from: Date,
  to: Date,
  selectedId: string | null,
  summary: AttendanceSummary,
  trendByDate: Map<string, AttendanceSummary>,
  reasons: Map<AbsenceReasonBucket, number>,
  people: {
    id: string;
    label: string;
    name: string;
    detail: string;
    active: boolean;
  }[],
  records: {
    id: string;
    date: string;
    subjectId: string;
    subjectName: string;
    detail: string;
    status: AttendanceStatus;
    absenceReason: AbsenceReason | null;
    absenceReasonLabel: string | null;
    recordedAt: Date;
  }[],
) {
  return {
    kind,
    from: dateKey(from),
    to: dateKey(to),
    selectedId,
    people,
    summary: {
      total: summary.total,
      present: summary.Present,
      absent: summary.Absent,
      late: summary.Late,
      attendanceRate: attendanceRate(summary),
    },
    trend: [...trendByDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, daySummary]) => ({
        date,
        total: daySummary.total,
        present: daySummary.Present,
        absent: daySummary.Absent,
        late: daySummary.Late,
        attendanceRate: attendanceRate(daySummary),
      })),
    statusBreakdown: ATTENDANCE_STATUSES.map((status) => ({
      status,
      count: summary[status],
    })),
    absenceReasons: ABSENCE_REASON_BUCKETS.map((reason) => ({
      reason,
      label: ABSENCE_REASON_LABELS[reason],
      count: reasons.get(reason) ?? 0,
    })),
    records,
  };
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

  const denied = new AccessDeniedError(
    'attendance export requires full-admin or attendance-exporter',
  );
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

async function denyOutOfDailyScope(
  ctx: AuthedContext,
  entity: string,
  meta: Record<string, unknown>,
): Promise<never> {
  const denied = new AccessDeniedError('student is outside supervisor assigned year band');
  await ctx.db.auditLog.create({
    data: {
      userId: ctx.user.id,
      action: 'PermissionDenied',
      entity,
      meta: { ...meta, role: ctx.user.role, reason: denied.message },
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
      const scope = await loadDailyYearBandScope(ctx, date);
      const students = await ctx.db.student.findMany({
        where: { active: true, ...studentWhereForDailyScope(scope) },
        select: {
          id: true,
          fullNameEnc: true,
          yearGroup: true,
          attendance: {
            where: { date },
            select: {
              id: true,
              status: true,
              absenceReason: true,
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
          absenceReason: attendance?.absenceReason ?? null,
          absenceReasonLabel: reasonLabel(attendance?.absenceReason ?? null),
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
    .input(attendanceMarkInput)
    .mutation(async ({ ctx, input }) => {
      await requireCanRecordAttendance(ctx);
      const date = normalizeDate(input.date);
      const absenceReason = absenceReasonForStatus(input.status, input.absenceReason);
      const scope = await loadDailyYearBandScope(ctx, date);
      const student = await ctx.db.student.findUnique({
        where: { id: input.studentId },
        select: { id: true, active: true, yearGroup: true },
      });
      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
      }
      if (!student.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'student is inactive' });
      }
      if (!studentMatchesDailyScope(scope, student)) {
        await denyOutOfDailyScope(ctx, 'attendance.mark', {
          studentId: input.studentId,
          studentYearGroup: student.yearGroup,
          date: dateKey(date),
          assignedBands: scope.assignedBands.map((band) => band.id),
        });
      }

      const existing = await ctx.db.attendance.findUnique({
        where: { studentId_date: { studentId: input.studentId, date } },
        select: { id: true },
      });

      const attendance = existing
        ? await ctx.db.attendance.update({
            where: { id: existing.id },
            data: { status: input.status, absenceReason, recordedById: ctx.user.id },
          })
        : await ctx.db.attendance.create({
            data: {
              studentId: input.studentId,
              date,
              status: input.status,
              absenceReason,
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
            ...(absenceReason ? { absenceReason } : {}),
          },
        },
      });

      return {
        id: attendance.id,
        studentId: attendance.studentId,
        date: dateKey(attendance.date),
        status: attendance.status,
        absenceReason: attendance.absenceReason,
        absenceReasonLabel: reasonLabel(attendance.absenceReason),
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

  exportStudentsCsv: authedProcedure.input(studentExportInput).query(async ({ ctx, input }) => {
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
        absenceReason: true,
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
      [
        'Date',
        'Student ID',
        'Student Name',
        'Year Group',
        'Status',
        'Absence Reason',
        'Recorded At',
      ],
      rows.map((row) => [
        dateKey(row.date),
        row.student.id,
        decryptRequired(ctx.db.$enc.decrypt, row.student.fullNameEnc, 'student'),
        row.student.yearGroup,
        row.status,
        row.status === 'Absent' ? (reasonLabel(row.absenceReason) ?? 'Unknown') : '',
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
        absenceReason: true,
        recordedById: true,
        createdAt: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      date: dateKey(row.date),
      status: row.status,
      absenceReason: row.absenceReason,
      absenceReasonLabel: reasonLabel(row.absenceReason),
      recordedById: row.recordedById,
      recordedAt: row.createdAt,
    }));
  }),

  staffForDate: adminOperationsProcedure
    .input(z.object({ date: z.coerce.date() }))
    .query(async ({ ctx, input }) => {
      const date = normalizeDate(input.date);
      const [shifts, attendanceRows, activeStaff] = await Promise.all([
        ctx.db.staffShift.findMany({
          where: {
            date,
            staffUser: { active: true, role: { in: [...ATTENDANCE_ROLES] } },
          },
          orderBy: [{ startsAt: 'asc' }],
          include: {
            staffUser: {
              select: { id: true, fullNameEnc: true, emailEnc: true, role: true, active: true },
            },
            yearGroupBand: { select: { name: true, colour: true } },
          },
        }),
        ctx.db.staffAttendance.findMany({
          where: { date },
          orderBy: [{ createdAt: 'asc' }],
          include: {
            staffUser: {
              select: { id: true, fullNameEnc: true, emailEnc: true, role: true, active: true },
            },
          },
        }),
        ctx.db.user.findMany({
          where: { active: true, role: { in: [...ATTENDANCE_ROLES] } },
          orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, fullNameEnc: true, emailEnc: true, role: true, active: true },
        }),
      ]);

      const attendanceByStaffId = new Map(attendanceRows.map((row) => [row.staffUserId, row]));
      const scheduledByStaffId = new Map<
        string,
        {
          staffUser: (typeof shifts)[number]['staffUser'];
          shifts: {
            id: string;
            startsAt: Date;
            endsAt: Date;
            bandName: string | null;
            bandColour: string | null;
          }[];
        }
      >();

      for (const shift of shifts) {
        const existing = scheduledByStaffId.get(shift.staffUserId);
        const mappedShift = {
          id: shift.id,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          bandName: shift.kind === 'Meeting' ? 'Meeting' : (shift.yearGroupBand?.name ?? null),
          bandColour: shift.kind === 'Meeting' ? '#0f766e' : (shift.yearGroupBand?.colour ?? null),
        };
        if (existing) {
          existing.shifts.push(mappedShift);
        } else {
          scheduledByStaffId.set(shift.staffUserId, {
            staffUser: shift.staffUser,
            shifts: [mappedShift],
          });
        }
      }

      const rows = [...scheduledByStaffId.entries()].map(([staffUserId, scheduled]) => {
        const attendance = attendanceByStaffId.get(staffUserId) ?? null;
        const staffName = decryptRequired(
          ctx.db.$enc.decrypt,
          scheduled.staffUser.fullNameEnc,
          'user',
        );
        return {
          staffUserId,
          staffName,
          email: decryptRequired(ctx.db.$enc.decrypt, scheduled.staffUser.emailEnc, 'user'),
          role: scheduled.staffUser.role,
          active: scheduled.staffUser.active,
          date: dateKey(date),
          scheduled: true,
          shifts: scheduled.shifts,
          attendanceId: attendance?.id ?? null,
          status: attendance?.status ?? null,
          absenceReason: attendance?.absenceReason ?? null,
          absenceReasonLabel: reasonLabel(attendance?.absenceReason ?? null),
          recordedById: attendance?.recordedById ?? null,
          recordedAt: attendance?.createdAt ?? null,
        };
      });

      for (const attendance of attendanceRows) {
        if (scheduledByStaffId.has(attendance.staffUserId)) continue;
        rows.push({
          staffUserId: attendance.staffUserId,
          staffName: decryptRequired(ctx.db.$enc.decrypt, attendance.staffUser.fullNameEnc, 'user'),
          email: decryptRequired(ctx.db.$enc.decrypt, attendance.staffUser.emailEnc, 'user'),
          role: attendance.staffUser.role,
          active: attendance.staffUser.active,
          date: dateKey(date),
          scheduled: false,
          shifts: [],
          attendanceId: attendance.id,
          status: attendance.status,
          absenceReason: attendance.absenceReason,
          absenceReasonLabel: reasonLabel(attendance.absenceReason),
          recordedById: attendance.recordedById,
          recordedAt: attendance.createdAt,
        });
      }

      const visibleStaffIds = new Set(rows.map((row) => row.staffUserId));
      const unscheduledOptions = activeStaff
        .filter((staff) => !visibleStaffIds.has(staff.id))
        .map((staff) => {
          const staffName = decryptRequired(ctx.db.$enc.decrypt, staff.fullNameEnc, 'user');
          return {
            id: staff.id,
            label: `${staffName} · ${staff.role}`,
            name: staffName,
            email: decryptRequired(ctx.db.$enc.decrypt, staff.emailEnc, 'user'),
            role: staff.role,
          };
        });

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'StaffAttendance',
          meta: {
            count: rows.length,
            optionCount: unscheduledOptions.length,
            source: 'attendance.staffForDate',
          },
        },
      });

      return {
        date: dateKey(date),
        rows,
        unscheduledOptions,
      };
    }),

  markStaff: adminOperationsProcedure.input(staffAttendanceMarkInput).mutation(async ({ ctx, input }) => {
    const date = normalizeDate(input.date);
    const absenceReason = absenceReasonForStatus(input.status, input.absenceReason);
    await assertActiveStaffUser(ctx, input.staffUserId);

    const existing = await ctx.db.staffAttendance.findUnique({
      where: { staffUserId_date: { staffUserId: input.staffUserId, date } },
      select: { id: true },
    });

    const attendance = existing
      ? await ctx.db.staffAttendance.update({
          where: { id: existing.id },
          data: { status: input.status, absenceReason, recordedById: ctx.user.id },
        })
      : await ctx.db.staffAttendance.create({
          data: {
            staffUserId: input.staffUserId,
            date,
            status: input.status,
            absenceReason,
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
          ...(absenceReason ? { absenceReason } : {}),
        },
      },
    });

    return {
      id: attendance.id,
      staffUserId: attendance.staffUserId,
      date: dateKey(attendance.date),
      status: attendance.status,
      absenceReason: attendance.absenceReason,
      absenceReasonLabel: reasonLabel(attendance.absenceReason),
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
        absenceReason: true,
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
      [
        'Date',
        'Supervisor User ID',
        'Supervisor Name',
        'Email',
        'Role',
        'Status',
        'Absence Reason',
        'Recorded At',
      ],
      rows.map((row) => [
        dateKey(row.date),
        row.staffUser.id,
        decryptRequired(ctx.db.$enc.decrypt, row.staffUser.fullNameEnc, 'user'),
        decryptRequired(ctx.db.$enc.decrypt, row.staffUser.emailEnc, 'user'),
        row.staffUser.role,
        row.status,
        row.status === 'Absent' ? (reasonLabel(row.absenceReason) ?? 'Unknown') : '',
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
        absenceReason: true,
        recordedById: true,
        createdAt: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      date: dateKey(row.date),
      status: row.status,
      absenceReason: row.absenceReason,
      absenceReasonLabel: reasonLabel(row.absenceReason),
      recordedById: row.recordedById,
      recordedAt: row.createdAt,
    }));
  }),

  insights: authedProcedure.input(insightsInput).query(async ({ ctx, input }) => {
    const from = normalizeDate(input.from);
    const to = normalizeDate(input.to);
    const selectedId = input.subjectId ?? null;
    await requireCanExportAttendance(ctx, {
      kind: `${input.kind}-insights`,
      from: dateKey(from),
      to: dateKey(to),
      subjectId: selectedId,
    });

    const summary = emptySummary();
    const trendByDate = new Map<string, AttendanceSummary>();
    const reasons = new Map<AbsenceReasonBucket, number>(
      ABSENCE_REASON_BUCKETS.map((reason) => [reason, 0]),
    );

    if (input.kind === 'students') {
      const [peopleRows, attendanceRows] = await Promise.all([
        ctx.db.student.findMany({
          orderBy: [{ createdAt: 'desc' }],
          select: { id: true, fullNameEnc: true, yearGroup: true, active: true },
        }),
        ctx.db.attendance.findMany({
          where: {
            date: { gte: from, lte: to },
            ...(selectedId ? { studentId: selectedId } : {}),
          },
          select: {
            id: true,
            date: true,
            status: true,
            absenceReason: true,
            createdAt: true,
            student: { select: { id: true, fullNameEnc: true, yearGroup: true, active: true } },
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);

      for (const row of attendanceRows) {
        incrementSummary(summary, row.status);
        const key = dateKey(row.date);
        const daySummary = trendByDate.get(key) ?? emptySummary();
        incrementSummary(daySummary, row.status);
        trendByDate.set(key, daySummary);
        const bucket = absenceBucket(row.status, row.absenceReason);
        if (bucket) reasons.set(bucket, (reasons.get(bucket) ?? 0) + 1);
      }

      const people = peopleRows.map((student) => {
        const name = decryptRequired(ctx.db.$enc.decrypt, student.fullNameEnc, 'student');
        return {
          id: student.id,
          label: `${name} · ${student.yearGroup}${student.active ? '' : ' · Inactive'}`,
          name,
          detail: student.yearGroup,
          active: student.active,
        };
      });
      const records = attendanceRows.slice(0, 60).map((row) => ({
        id: row.id,
        date: dateKey(row.date),
        subjectId: row.student.id,
        subjectName: decryptRequired(ctx.db.$enc.decrypt, row.student.fullNameEnc, 'student'),
        detail: row.student.yearGroup,
        status: row.status,
        absenceReason: row.absenceReason,
        absenceReasonLabel: reasonLabel(row.absenceReason),
        recordedAt: row.createdAt,
      }));

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'Student',
          meta: {
            count: people.length + records.length,
            source: 'attendance.insights',
            kind: input.kind,
          },
        },
      });

      return buildInsightsResult(
        input.kind,
        from,
        to,
        selectedId,
        summary,
        trendByDate,
        reasons,
        people,
        records,
      );
    }

    const [peopleRows, attendanceRows] = await Promise.all([
      ctx.db.user.findMany({
        where: { role: { in: [...ATTENDANCE_ROLES] } },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, fullNameEnc: true, emailEnc: true, role: true, active: true },
      }),
      ctx.db.staffAttendance.findMany({
        where: {
          date: { gte: from, lte: to },
          ...(selectedId ? { staffUserId: selectedId } : {}),
        },
        select: {
          id: true,
          date: true,
          status: true,
          absenceReason: true,
          createdAt: true,
          staffUser: {
            select: { id: true, fullNameEnc: true, emailEnc: true, role: true, active: true },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    for (const row of attendanceRows) {
      incrementSummary(summary, row.status);
      const key = dateKey(row.date);
      const daySummary = trendByDate.get(key) ?? emptySummary();
      incrementSummary(daySummary, row.status);
      trendByDate.set(key, daySummary);
      const bucket = absenceBucket(row.status, row.absenceReason);
      if (bucket) reasons.set(bucket, (reasons.get(bucket) ?? 0) + 1);
    }

    const people = peopleRows.map((staff) => {
      const name = decryptRequired(ctx.db.$enc.decrypt, staff.fullNameEnc, 'user');
      return {
        id: staff.id,
        label: `${name} · ${staff.role}${staff.active ? '' : ' · Inactive'}`,
        name,
        detail: staff.role,
        active: staff.active,
      };
    });
    const records = attendanceRows.slice(0, 60).map((row) => ({
      id: row.id,
      date: dateKey(row.date),
      subjectId: row.staffUser.id,
      subjectName: decryptRequired(ctx.db.$enc.decrypt, row.staffUser.fullNameEnc, 'user'),
      detail: row.staffUser.role,
      status: row.status,
      absenceReason: row.absenceReason,
      absenceReasonLabel: reasonLabel(row.absenceReason),
      recordedAt: row.createdAt,
    }));

    await ctx.db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: {
          count: people.length + records.length,
          source: 'attendance.insights',
          kind: input.kind,
        },
      },
    });

    return buildInsightsResult(
      input.kind,
      from,
      to,
      selectedId,
      summary,
      trendByDate,
      reasons,
      people,
      records,
    );
  }),
});
