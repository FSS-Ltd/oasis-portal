import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { attendanceRouter } from '../routers/attendance.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'ckuserhead00000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'ckusersup000000000000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const attendanceExporterUser: SessionUser = {
  id: 'ckuserexport000000000001',
  role: 'Supervisor',
  tags: ['attendance-exporter'],
  requires2fa: false,
};
const attendanceRecorderUser: SessionUser = {
  id: 'ckuserrecord000000000001',
  role: 'Supervisor',
  tags: ['attendance-recorder'],
  requires2fa: false,
};
const principalUser: SessionUser = {
  id: 'ckuserprincipal000000001',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'ckuserparent000000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'ckuserstudent00000000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const activeStudentId = 'ctx-student';
const secondStudentId = 'ckstudent000000000000002';
const inactiveStudentId = 'ckstudent000000000000003';
const inactiveStaffUserId = 'ckuserinactive000000001';

type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type AbsenceReason = 'Sick' | 'Holiday' | 'NotScheduled' | 'Excused' | 'Unexcused';
type SpecialAttendanceRegister = 'FieldTrip' | 'MinibusInbound' | 'MinibusOutbound' | 'TheCedars';

interface StoredStudent {
  id: string;
  userId: string | null;
  fullNameEnc: string;
  yearGroup: string;
  active: boolean;
  createdAt: Date;
}

interface StoredUser {
  id: string;
  fullNameEnc: string;
  emailEnc: string;
  role: SessionUser['role'];
  active: boolean;
}

interface StoredAttendance {
  id: string;
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  absenceReason: AbsenceReason | null;
  recordedById: string;
  createdAt: Date;
}

interface StoredStaffAttendance {
  id: string;
  staffUserId: string;
  date: Date;
  status: AttendanceStatus;
  absenceReason: AbsenceReason | null;
  recordedById: string;
  createdAt: Date;
}

interface StoredSpecialAttendanceSession {
  id: string;
  date: Date;
  register: SpecialAttendanceRegister;
  destinationEnc: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSpecialAttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  recordedById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredYearGroupBand {
  id: string;
  name: string;
  standardYears: string[];
  active: boolean;
  sortOrder: number;
  colour: string;
}

interface StoredStaffShift {
  id: string;
  staffUserId: string;
  yearGroupBandId: string;
  date: Date;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  attendance: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  staffAttendance: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  specialAttendanceSession: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  specialAttendanceRecord: {
    deleteMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  yearGroupBand: {
    findMany: ReturnType<typeof vi.fn>;
  };
  staffShift: {
    findMany: ReturnType<typeof vi.fn>;
  };
  studentPortalSettings: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentPortalUsageMinute: {
    count: ReturnType<typeof vi.fn>;
  };
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.replace(/^enc:/u, '');
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function makeFakeDb() {
  const students: StoredStudent[] = [
    {
      id: activeStudentId,
      userId: studentUser.id,
      fullNameEnc: 'enc:Jane Learner',
      yearGroup: 'Year 6',
      active: true,
      createdAt: new Date('2026-04-20T09:00:00.000Z'),
    },
    {
      id: secondStudentId,
      userId: null,
      fullNameEnc: 'enc:Amos Scholar',
      yearGroup: 'Year 5',
      active: true,
      createdAt: new Date('2026-04-21T09:00:00.000Z'),
    },
    {
      id: inactiveStudentId,
      userId: null,
      fullNameEnc: 'enc:Former Student',
      yearGroup: 'Year 7',
      active: false,
      createdAt: new Date('2026-04-22T09:00:00.000Z'),
    },
  ];
  const users: StoredUser[] = [
    {
      id: headUser.id,
      fullNameEnc: 'enc:Head User',
      emailEnc: 'enc:head@example.test',
      role: 'Head',
      active: true,
    },
    {
      id: supervisorUser.id,
      fullNameEnc: 'enc:Supervisor User',
      emailEnc: 'enc:supervisor@example.test',
      role: 'Supervisor',
      active: true,
    },
    {
      id: attendanceExporterUser.id,
      fullNameEnc: 'enc:Exporter User',
      emailEnc: 'enc:exporter@example.test',
      role: 'Supervisor',
      active: true,
    },
    {
      id: attendanceRecorderUser.id,
      fullNameEnc: 'enc:Recorder User',
      emailEnc: 'enc:recorder@example.test',
      role: 'Supervisor',
      active: true,
    },
    {
      id: parentUser.id,
      fullNameEnc: 'enc:Parent User',
      emailEnc: 'enc:parent@example.test',
      role: 'Parent',
      active: true,
    },
    {
      id: inactiveStaffUserId,
      fullNameEnc: 'enc:Inactive Supervisor',
      emailEnc: 'enc:inactive@example.test',
      role: 'Supervisor',
      active: false,
    },
  ];
  const attendance: StoredAttendance[] = [];
  const staffAttendance: StoredStaffAttendance[] = [];
  const specialAttendanceSessions: StoredSpecialAttendanceSession[] = [];
  const specialAttendanceRecords: StoredSpecialAttendanceRecord[] = [];
  const yearGroupBands: StoredYearGroupBand[] = [
    {
      id: 'band_upper',
      name: 'Upper Primary',
      standardYears: ['Year 5', 'Year 6'],
      active: true,
      sortOrder: 2,
      colour: '#5B90C5',
    },
    {
      id: 'band_secondary',
      name: 'Secondary',
      standardYears: ['Year 7', 'Year 8'],
      active: true,
      sortOrder: 3,
      colour: '#7D1C2C',
    },
    {
      id: 'band_inactive',
      name: 'Inactive',
      standardYears: ['Year 4'],
      active: false,
      sortOrder: 1,
      colour: '#166534',
    },
  ];
  const staffShifts: StoredStaffShift[] = [
    {
      id: 'shift-supervisor-1',
      staffUserId: supervisorUser.id,
      yearGroupBandId: 'band_upper',
      date: day('2026-04-29'),
      startsAt: new Date('2026-04-29T09:00:00.000Z'),
      endsAt: new Date('2026-04-29T12:00:00.000Z'),
      notes: null,
    },
    {
      id: 'shift-recorder-1',
      staffUserId: attendanceRecorderUser.id,
      yearGroupBandId: 'band_upper',
      date: day('2026-04-29'),
      startsAt: new Date('2026-04-29T09:00:00.000Z'),
      endsAt: new Date('2026-04-29T12:00:00.000Z'),
      notes: null,
    },
  ];

  const db: FakeDb = {
    $enc: { decrypt: vi.fn(decrypt), encrypt: vi.fn(encrypt) },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    student: {
      findMany: vi.fn(
        ({
          where,
          select,
        }: {
          where?: { active?: boolean; id?: { in: string[] }; yearGroup?: { in: string[] } };
          select?: { attendance?: { where?: { date?: Date } } };
        }) => {
          const attendanceDate = select?.attendance?.where?.date;
          return Promise.resolve(
            students
              .filter((student) => where?.active === undefined || student.active === where.active)
              .filter((student) => where?.id?.in === undefined || where.id.in.includes(student.id))
              .filter(
                (student) =>
                  where?.yearGroup?.in === undefined ||
                  where.yearGroup.in.includes(student.yearGroup),
              )
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .map((student) => ({
                id: student.id,
                fullNameEnc: student.fullNameEnc,
                yearGroup: student.yearGroup,
                active: student.active,
                attendance: attendance
                  .filter((row) => row.studentId === student.id)
                  .filter(
                    (row) =>
                      attendanceDate === undefined || dateKey(row.date) === dateKey(attendanceDate),
                  )
                  .map((row) => ({
                    id: row.id,
                    status: row.status,
                    absenceReason: row.absenceReason,
                    recordedById: row.recordedById,
                    createdAt: row.createdAt,
                  }))
                  .slice(0, 1),
              })),
          );
        },
      ),
      findUnique: vi.fn(({ where }: { where: { id?: string; userId?: string } }) => {
        const student = students.find((candidate) =>
          where.id !== undefined ? candidate.id === where.id : candidate.userId === where.userId,
        );
        if (!student) return Promise.resolve(null);
        return Promise.resolve({
          id: student.id,
          userId: student.userId,
          active: student.active,
          yearGroup: student.yearGroup,
        });
      }),
    },
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) return Promise.resolve(null);
        return Promise.resolve({ id: user.id, role: user.role, active: user.active });
      }),
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            active?: boolean;
            role?: { in?: readonly SessionUser['role'][] };
          };
        }) =>
          Promise.resolve(
            users
              .filter((user) => where?.active === undefined || user.active === where.active)
              .filter((user) => where?.role?.in === undefined || where.role.in.includes(user.role))
              .map((user) => ({
                id: user.id,
                fullNameEnc: user.fullNameEnc,
                emailEnc: user.emailEnc,
                role: user.role,
                active: user.active,
              })),
          ),
      ),
    },
    attendance: {
      create: vi.fn(({ data }: { data: Omit<StoredAttendance, 'id' | 'createdAt'> }) => {
        const rowNumber = String(attendance.length + 1).padStart(2, '0');
        const minute = String(attendance.length).padStart(2, '0');
        const row: StoredAttendance = {
          id: `ckattendance0000000000${rowNumber}`,
          createdAt: new Date(`2026-04-29T10:${minute}:00.000Z`),
          ...data,
        };
        attendance.push(row);
        return Promise.resolve(row);
      }),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Partial<StoredAttendance> }) => {
          const row = attendance.find((candidate) => candidate.id === where.id);
          if (!row) throw new Error('attendance row missing');
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
      findUnique: vi.fn(
        ({ where }: { where: { studentId_date: { studentId: string; date: Date } } }) =>
          Promise.resolve(
            attendance.find(
              (row) =>
                row.studentId === where.studentId_date.studentId &&
                dateKey(row.date) === dateKey(where.studentId_date.date),
            ) ?? null,
          ),
      ),
      findMany: vi.fn(
        ({
          orderBy,
          select,
          where,
        }: {
          orderBy?: Array<Record<string, 'asc' | 'desc'>>;
          select?: { id?: true; student?: unknown };
          where: { date: { gte?: Date; lte?: Date } | Date; studentId?: string };
        }) => {
          const sortDirection = orderBy?.[0]?.date === 'desc' ? -1 : 1;
          const from = where.date instanceof Date ? where.date : where.date.gte;
          const to = where.date instanceof Date ? where.date : where.date.lte;
          const rows = attendance
            .filter(
              (row) =>
                (from === undefined || row.date.getTime() >= from.getTime()) &&
                (to === undefined || row.date.getTime() <= to.getTime()),
            )
            .filter((row) => where.studentId === undefined || row.studentId === where.studentId)
            .sort(
              (a, b) =>
                (a.date.getTime() - b.date.getTime() ||
                  a.createdAt.getTime() - b.createdAt.getTime()) * sortDirection,
            );
          if (select?.id && select.student === undefined) {
            return Promise.resolve(
              rows.map((row) => ({
                id: row.id,
                date: row.date,
                status: row.status,
                absenceReason: row.absenceReason,
                recordedById: row.recordedById,
                createdAt: row.createdAt,
              })),
            );
          }
          return Promise.resolve(
            rows.map((row) => {
              const student = students.find((candidate) => candidate.id === row.studentId);
              if (!student) throw new Error('test student missing');
              return {
                id: row.id,
                date: row.date,
                status: row.status,
                absenceReason: row.absenceReason,
                createdAt: row.createdAt,
                recordedById: row.recordedById,
                studentId: row.studentId,
                student: {
                  id: student.id,
                  fullNameEnc: student.fullNameEnc,
                  yearGroup: student.yearGroup,
                  active: student.active,
                },
              };
            }),
          );
        },
      ),
      deleteMany: vi.fn(({ where }: { where: { date: Date; studentId?: { in: string[] } } }) => {
        let count = 0;
        for (let index = attendance.length - 1; index >= 0; index -= 1) {
          const row = attendance[index];
          if (
            row &&
            dateKey(row.date) === dateKey(where.date) &&
            (where.studentId === undefined || where.studentId.in.includes(row.studentId))
          ) {
            attendance.splice(index, 1);
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    staffAttendance: {
      create: vi.fn(({ data }: { data: Omit<StoredStaffAttendance, 'id' | 'createdAt'> }) => {
        const rowNumber = String(staffAttendance.length + 1).padStart(2, '0');
        const minute = String(staffAttendance.length).padStart(2, '0');
        const row: StoredStaffAttendance = {
          id: `ckstaffattendance000000${rowNumber}`,
          createdAt: new Date(`2026-04-29T11:${minute}:00.000Z`),
          ...data,
        };
        staffAttendance.push(row);
        return Promise.resolve(row);
      }),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Partial<StoredStaffAttendance> }) => {
          const row = staffAttendance.find((candidate) => candidate.id === where.id);
          if (!row) throw new Error('staff attendance row missing');
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
      findUnique: vi.fn(
        ({ where }: { where: { staffUserId_date: { staffUserId: string; date: Date } } }) =>
          Promise.resolve(
            staffAttendance.find(
              (row) =>
                row.staffUserId === where.staffUserId_date.staffUserId &&
                dateKey(row.date) === dateKey(where.staffUserId_date.date),
            ) ?? null,
          ),
      ),
      findMany: vi.fn(
        ({
          orderBy,
          select,
          where,
        }: {
          orderBy?: Array<Record<string, 'asc' | 'desc'>>;
          select?: { id?: true; staffUser?: unknown };
          where: { date: { gte?: Date; lte?: Date } | Date; staffUserId?: string };
        }) => {
          const sortDirection = orderBy?.[0]?.date === 'desc' ? -1 : 1;
          const from = where.date instanceof Date ? where.date : where.date.gte;
          const to = where.date instanceof Date ? where.date : where.date.lte;
          const rows = staffAttendance
            .filter(
              (row) =>
                (from === undefined || row.date.getTime() >= from.getTime()) &&
                (to === undefined || row.date.getTime() <= to.getTime()),
            )
            .filter(
              (row) => where.staffUserId === undefined || row.staffUserId === where.staffUserId,
            )
            .sort(
              (a, b) =>
                (a.date.getTime() - b.date.getTime() ||
                  a.createdAt.getTime() - b.createdAt.getTime()) * sortDirection,
            );
          if (select?.id && select.staffUser === undefined) {
            return Promise.resolve(
              rows.map((row) => ({
                id: row.id,
                date: row.date,
                status: row.status,
                absenceReason: row.absenceReason,
                recordedById: row.recordedById,
                createdAt: row.createdAt,
              })),
            );
          }
          return Promise.resolve(
            rows.map((row) => {
              const staffUser = users.find((candidate) => candidate.id === row.staffUserId);
              if (!staffUser) throw new Error('test staff user missing');
              return {
                date: row.date,
                status: row.status,
                absenceReason: row.absenceReason,
                createdAt: row.createdAt,
                id: row.id,
                recordedById: row.recordedById,
                staffUserId: row.staffUserId,
                staffUser: {
                  id: staffUser.id,
                  fullNameEnc: staffUser.fullNameEnc,
                  emailEnc: staffUser.emailEnc,
                  role: staffUser.role,
                  active: staffUser.active,
                },
              };
            }),
          );
        },
      ),
      deleteMany: vi.fn(({ where }: { where: { date: Date } }) => {
        let count = 0;
        for (let index = staffAttendance.length - 1; index >= 0; index -= 1) {
          const row = staffAttendance[index];
          if (row && dateKey(row.date) === dateKey(where.date)) {
            staffAttendance.splice(index, 1);
            count += 1;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    specialAttendanceSession: {
      create: vi.fn(
        ({
          data,
        }: {
          data: Omit<StoredSpecialAttendanceSession, 'id' | 'createdAt' | 'updatedAt'>;
        }) => {
          const row: StoredSpecialAttendanceSession = {
            id: `ckspecialsession000000${String(specialAttendanceSessions.length + 1).padStart(2, '0')}`,
            createdAt: new Date('2026-04-29T12:00:00.000Z'),
            updatedAt: new Date('2026-04-29T12:00:00.000Z'),
            ...data,
          };
          specialAttendanceSessions.push(row);
          return Promise.resolve(row);
        },
      ),
      findUnique: vi.fn(
        ({
          where,
        }: {
          where: { date_register: { date: Date; register: SpecialAttendanceRegister } };
        }) =>
          Promise.resolve(
            specialAttendanceSessions.find(
              (row) =>
                dateKey(row.date) === dateKey(where.date_register.date) &&
                row.register === where.date_register.register,
            ) ?? null,
          ),
      ),
      upsert: vi.fn(
        ({
          create,
          update,
          where,
        }: {
          create: Omit<StoredSpecialAttendanceSession, 'id' | 'createdAt' | 'updatedAt'>;
          update: Partial<StoredSpecialAttendanceSession>;
          where: { date_register: { date: Date; register: SpecialAttendanceRegister } };
        }) => {
          const existing = specialAttendanceSessions.find(
            (row) =>
              dateKey(row.date) === dateKey(where.date_register.date) &&
              row.register === where.date_register.register,
          );
          if (existing) {
            Object.assign(existing, update, {
              updatedAt: new Date('2026-04-29T12:15:00.000Z'),
            });
            return Promise.resolve(existing);
          }
          const row: StoredSpecialAttendanceSession = {
            id: `ckspecialsession000000${String(specialAttendanceSessions.length + 1).padStart(2, '0')}`,
            createdAt: new Date('2026-04-29T12:00:00.000Z'),
            updatedAt: new Date('2026-04-29T12:00:00.000Z'),
            ...create,
          };
          specialAttendanceSessions.push(row);
          return Promise.resolve(row);
        },
      ),
    },
    specialAttendanceRecord: {
      deleteMany: vi.fn(
        ({ where }: { where: { sessionId: string; studentId?: { in: string[] } } }) => {
          let count = 0;
          for (let index = specialAttendanceRecords.length - 1; index >= 0; index -= 1) {
            const row = specialAttendanceRecords[index];
            if (
              row &&
              row.sessionId === where.sessionId &&
              (where.studentId === undefined || where.studentId.in.includes(row.studentId))
            ) {
              specialAttendanceRecords.splice(index, 1);
              count += 1;
            }
          }
          return Promise.resolve({ count });
        },
      ),
      findMany: vi.fn(({ where }: { where: { sessionId: string } }) =>
        Promise.resolve(
          specialAttendanceRecords.filter((row) => row.sessionId === where.sessionId),
        ),
      ),
      upsert: vi.fn(
        ({
          create,
          update,
          where,
        }: {
          create: Omit<StoredSpecialAttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>;
          update: Partial<StoredSpecialAttendanceRecord>;
          where: { sessionId_studentId: { sessionId: string; studentId: string } };
        }) => {
          const existing = specialAttendanceRecords.find(
            (row) =>
              row.sessionId === where.sessionId_studentId.sessionId &&
              row.studentId === where.sessionId_studentId.studentId,
          );
          if (existing) {
            Object.assign(existing, update, {
              updatedAt: new Date('2026-04-29T12:30:00.000Z'),
            });
            return Promise.resolve(existing);
          }
          const row: StoredSpecialAttendanceRecord = {
            id: `ckspecialrecord000000${String(specialAttendanceRecords.length + 1).padStart(2, '0')}`,
            createdAt: new Date('2026-04-29T12:30:00.000Z'),
            updatedAt: new Date('2026-04-29T12:30:00.000Z'),
            ...create,
          };
          specialAttendanceRecords.push(row);
          return Promise.resolve(row);
        },
      ),
    },
    yearGroupBand: {
      findMany: vi.fn(({ where }: { where?: { active?: boolean } } = {}) =>
        Promise.resolve(
          yearGroupBands
            .filter((band) => where?.active === undefined || band.active === where.active)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map(({ id, name, standardYears, colour, sortOrder }) => ({
              id,
              name,
              standardYears,
              colour,
              sortOrder,
            })),
        ),
      ),
    },
    staffShift: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            staffUserId?: string;
            date: Date;
            staffUser?: { active?: boolean; role?: { in?: readonly SessionUser['role'][] } };
          };
        }) =>
          Promise.resolve(
            staffShifts
              .filter(
                (shift) =>
                  where.staffUserId === undefined || shift.staffUserId === where.staffUserId,
              )
              .filter((shift) => dateKey(shift.date) === dateKey(where.date))
              .filter((shift) => {
                const staffUser = users.find((candidate) => candidate.id === shift.staffUserId);
                if (!staffUser) return false;
                if (
                  where.staffUser?.active !== undefined &&
                  staffUser.active !== where.staffUser.active
                ) {
                  return false;
                }
                return (
                  where.staffUser?.role?.in === undefined ||
                  where.staffUser.role.in.includes(staffUser.role)
                );
              })
              .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
              .map((shift) => {
                const staffUser = users.find((candidate) => candidate.id === shift.staffUserId);
                if (!staffUser) throw new Error('test staff user missing');
                const yearGroupBand =
                  yearGroupBands.find((band) => band.id === shift.yearGroupBandId) ?? null;
                return {
                  id: shift.id,
                  staffUserId: shift.staffUserId,
                  yearGroupBandId: shift.yearGroupBandId,
                  date: shift.date,
                  startsAt: shift.startsAt,
                  endsAt: shift.endsAt,
                  notes: shift.notes,
                  staffUser,
                  yearGroupBand,
                };
              }),
          ),
      ),
    },
    studentPortalSettings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    studentPortalUsageMinute: {
      count: vi.fn().mockResolvedValue(0),
    },
  };

  return {
    db,
    students,
    attendance,
    staffAttendance,
    specialAttendanceSessions,
    specialAttendanceRecords,
    yearGroupBands,
  };
}

function makeCtx(user: SessionUser | null, db: FakeDb): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn({} as RlsTx),
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: FakeDb) {
  const appRouter = router({ attendance: attendanceRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('attendance.listYearGroupBands', () => {
  it('allows full-admin and Supervisor, returns active bands in display order, and denies Parent/Student', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(headUser, db).attendance.listYearGroupBands()).resolves.toEqual([
      {
        id: 'band_upper',
        name: 'Upper Primary',
        standardYears: ['Year 5', 'Year 6'],
        colour: '#5B90C5',
        sortOrder: 2,
      },
      {
        id: 'band_secondary',
        name: 'Secondary',
        standardYears: ['Year 7', 'Year 8'],
        colour: '#7D1C2C',
        sortOrder: 3,
      },
    ]);
    await expect(
      makeCaller(supervisorUser, db).attendance.listYearGroupBands(),
    ).resolves.toHaveLength(2);
    await expect(makeCaller(parentUser, db).attendance.listYearGroupBands()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(studentUser, db).attendance.listYearGroupBands()).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      },
    );
  });
});

describe('attendance.forDate', () => {
  it('allows full-admin and Supervisor, returns active students only, and writes a PII audit row', async () => {
    const { db } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await headCaller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-29'),
      status: 'Present',
    });

    const supervisorCaller = makeCaller(supervisorUser, db);
    const rows = await supervisorCaller.attendance.forDate({ date: day('2026-04-29') });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.studentId)).not.toContain(inactiveStudentId);
    expect(rows.find((row) => row.studentId === activeStudentId)).toMatchObject({
      studentName: 'Jane Learner',
      yearGroup: 'Year 6',
      date: '2026-04-29',
      status: 'Present',
    });
    expect(rows.find((row) => row.studentId === secondStudentId)).toMatchObject({
      studentName: 'Amos Scholar',
      status: null,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 2, source: 'attendance.forDate' },
      },
    });

    await expect(
      makeCaller(parentUser, db).attendance.forDate({ date: day('2026-04-29') }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller(studentUser, db).attendance.forDate({ date: day('2026-04-29') }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns an empty roster for Supervisor when no shift is assigned that day', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).attendance.forDate({ date: day('2026-04-30') }),
    ).resolves.toEqual([]);
  });
});

describe('attendance.mark', () => {
  it('upserts by student/date and audits create then update', async () => {
    const { db, attendance } = makeFakeDb();
    const caller = makeCaller(attendanceRecorderUser, db);

    await expect(
      caller.attendance.mark({
        studentId: activeStudentId,
        date: new Date('2026-04-29T15:30:00.000Z'),
        status: 'Present',
      }),
    ).resolves.toMatchObject({
      id: 'ckattendance000000000001',
      studentId: activeStudentId,
      date: '2026-04-29',
      status: 'Present',
      recordedById: attendanceRecorderUser.id,
    });
    await expect(
      caller.attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Late',
      }),
    ).resolves.toMatchObject({
      id: 'ckattendance000000000001',
      studentId: activeStudentId,
      date: '2026-04-29',
      status: 'Late',
    });

    expect(attendance).toHaveLength(1);
    expect(attendance[0]).toMatchObject({ studentId: activeStudentId, status: 'Late' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceRecorderUser.id,
        action: 'Create',
        entity: 'Attendance',
        entityId: 'ckattendance000000000001',
        meta: { studentId: activeStudentId, date: '2026-04-29', status: 'Present' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceRecorderUser.id,
        action: 'Update',
        entity: 'Attendance',
        entityId: 'ckattendance000000000001',
        meta: { studentId: activeStudentId, date: '2026-04-29', status: 'Late' },
      },
    });
  });

  it('requires an absence reason for Absent and clears it when status changes', async () => {
    const { attendance, db } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(
      caller.attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Absent',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Absent',
        absenceReason: 'Sick',
      }),
    ).resolves.toMatchObject({
      status: 'Absent',
      absenceReason: 'Sick',
      absenceReasonLabel: 'Sick',
    });
    await expect(
      caller.attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Present',
      }),
    ).resolves.toMatchObject({
      status: 'Present',
      absenceReason: null,
      absenceReasonLabel: null,
    });
    expect(attendance[0]).toMatchObject({ status: 'Present', absenceReason: null });
  });

  it('allows full-admin and attendance-recorder, but denies untagged daily-workflow users', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(headUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Present',
      }),
    ).resolves.toMatchObject({ status: 'Present', recordedById: headUser.id });

    await expect(
      makeCaller(attendanceRecorderUser, db).attendance.mark({
        studentId: secondStudentId,
        date: day('2026-04-29'),
        status: 'Late',
      }),
    ).resolves.toMatchObject({ status: 'Late', recordedById: attendanceRecorderUser.id });

    await expect(
      makeCaller(principalUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-30'),
        status: 'Absent',
        absenceReason: 'Unexcused',
      }),
    ).resolves.toMatchObject({ status: 'Absent', recordedById: principalUser.id });
    await expect(
      makeCaller(supervisorUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-30'),
        status: 'Absent',
        absenceReason: 'Unexcused',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('denies Parent/Student and rejects missing or inactive students', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(parentUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Absent',
        absenceReason: 'Unexcused',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Absent',
        absenceReason: 'Unexcused',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const caller = makeCaller(headUser, db);
    await expect(
      caller.attendance.mark({
        studentId: 'ckstudentmissing000000001',
        date: day('2026-04-29'),
        status: 'Absent',
        absenceReason: 'Unexcused',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'student not found' });
    await expect(
      caller.attendance.mark({
        studentId: inactiveStudentId,
        date: day('2026-04-29'),
        status: 'Absent',
        absenceReason: 'Unexcused',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'student is inactive' });
  });
});

describe('attendance.resetForDate', () => {
  it('clears the selected student register date for attendance recorders only', async () => {
    const { attendance, db } = makeFakeDb();
    const caller = makeCaller(attendanceRecorderUser, db);

    await caller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-29'),
      status: 'Present',
    });
    await caller.attendance.mark({
      studentId: secondStudentId,
      date: day('2026-04-29'),
      status: 'Late',
    });
    await makeCaller(headUser, db).attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-30'),
      status: 'Present',
    });

    await expect(caller.attendance.resetForDate({ date: day('2026-04-29') })).resolves.toEqual({
      date: '2026-04-29',
      deletedCount: 2,
    });

    expect(attendance).toHaveLength(1);
    expect(attendance[0]).toMatchObject({ date: day('2026-04-30') });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceRecorderUser.id,
        action: 'Delete',
        entity: 'Attendance',
        meta: {
          date: '2026-04-29',
          deletedCount: 2,
          source: 'attendance.resetForDate',
          studentCount: 2,
        },
      },
    });

    await expect(
      makeCaller(supervisorUser, db).attendance.resetForDate({ date: day('2026-04-29') }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('attendance.specialAttendance', () => {
  it('records separate minibus journey registers with one shared destination', async () => {
    const { db, specialAttendanceRecords, specialAttendanceSessions } = makeFakeDb();
    const caller = makeCaller(attendanceRecorderUser, db);

    await expect(
      caller.attendance.saveSpecialSession({
        date: day('2026-04-29'),
        register: 'MinibusOutbound',
        destination: '',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.attendance.saveSpecialSession({
        date: day('2026-04-29'),
        register: 'MinibusOutbound',
        destination: 'The Cedars',
      }),
    ).resolves.toMatchObject({
      date: '2026-04-29',
      destination: 'The Cedars',
      register: 'MinibusOutbound',
    });
    await caller.attendance.saveSpecialSession({
      date: day('2026-04-29'),
      register: 'MinibusInbound',
      destination: 'Oasis Learning Centre',
    });

    await expect(
      caller.attendance.markSpecial({
        date: day('2026-04-29'),
        register: 'MinibusOutbound',
        studentId: activeStudentId,
        status: 'Present',
      }),
    ).resolves.toMatchObject({
      register: 'MinibusOutbound',
      studentId: activeStudentId,
      status: 'Present',
    });
    await caller.attendance.markSpecial({
      date: day('2026-04-29'),
      register: 'MinibusInbound',
      studentId: activeStudentId,
      status: 'Present',
    });

    const outbound = await caller.attendance.specialForDate({
      date: day('2026-04-29'),
      register: 'MinibusOutbound',
    });

    expect(outbound.session).toMatchObject({
      date: '2026-04-29',
      destination: 'The Cedars',
      register: 'MinibusOutbound',
    });
    expect(outbound.rows).toHaveLength(2);
    expect(outbound.rows.find((row) => row.studentId === activeStudentId)).toMatchObject({
      status: 'Present',
    });
    expect(outbound.rows.find((row) => row.studentId === secondStudentId)).toMatchObject({
      status: null,
    });
    expect(specialAttendanceSessions).toHaveLength(2);
    expect(specialAttendanceRecords).toHaveLength(2);
  });

  it('clears special attendance rows while preserving session metadata', async () => {
    const { db, specialAttendanceRecords, specialAttendanceSessions } = makeFakeDb();
    const caller = makeCaller(attendanceRecorderUser, db);

    await caller.attendance.saveSpecialSession({
      date: day('2026-04-29'),
      register: 'TheCedars',
    });
    await caller.attendance.markSpecial({
      date: day('2026-04-29'),
      register: 'TheCedars',
      studentId: activeStudentId,
      status: 'Present',
    });

    await expect(
      caller.attendance.resetSpecialForDate({
        date: day('2026-04-29'),
        register: 'TheCedars',
      }),
    ).resolves.toEqual({
      date: '2026-04-29',
      deletedCount: 1,
      register: 'TheCedars',
    });

    expect(specialAttendanceSessions).toHaveLength(1);
    expect(specialAttendanceRecords).toHaveLength(0);
    await expect(
      makeCaller(supervisorUser, db).attendance.markSpecial({
        date: day('2026-04-29'),
        register: 'TheCedars',
        studentId: activeStudentId,
        status: 'Present',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('attendance.listExportOptions', () => {
  it('returns student and staff selectors for export-authorised users and audits PII decrypts', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(attendanceExporterUser, db).attendance.listExportOptions(),
    ).resolves.toEqual({
      students: [
        {
          id: inactiveStudentId,
          label: 'Former Student · Year 7 · Inactive',
          name: 'Former Student',
          yearGroup: 'Year 7',
          active: false,
        },
        {
          id: secondStudentId,
          label: 'Amos Scholar · Year 5',
          name: 'Amos Scholar',
          yearGroup: 'Year 5',
          active: true,
        },
        {
          id: activeStudentId,
          label: 'Jane Learner · Year 6',
          name: 'Jane Learner',
          yearGroup: 'Year 6',
          active: true,
        },
      ],
      staff: [
        {
          id: headUser.id,
          label: 'Head User · Head',
          name: 'Head User',
          email: 'head@example.test',
          role: 'Head',
          active: true,
        },
        {
          id: supervisorUser.id,
          label: 'Supervisor User · Supervisor',
          name: 'Supervisor User',
          email: 'supervisor@example.test',
          role: 'Supervisor',
          active: true,
        },
        {
          id: attendanceExporterUser.id,
          label: 'Exporter User · Supervisor',
          name: 'Exporter User',
          email: 'exporter@example.test',
          role: 'Supervisor',
          active: true,
        },
        {
          id: attendanceRecorderUser.id,
          label: 'Recorder User · Supervisor',
          name: 'Recorder User',
          email: 'recorder@example.test',
          role: 'Supervisor',
          active: true,
        },
        {
          id: inactiveStaffUserId,
          label: 'Inactive Supervisor · Supervisor · Inactive',
          name: 'Inactive Supervisor',
          email: 'inactive@example.test',
          role: 'Supervisor',
          active: false,
        },
      ],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceExporterUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 3, source: 'attendance.listExportOptions' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceExporterUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 5, source: 'attendance.listExportOptions' },
      },
    });
  });

  it('denies selector loading for unauthorised users and audits each direct call', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).attendance.listExportOptions(),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'options',
          role: 'Supervisor',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
    await expect(makeCaller(parentUser, db).attendance.listExportOptions()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'options',
          role: 'Parent',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
    await expect(makeCaller(studentUser, db).attendance.listExportOptions()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: studentUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'options',
          role: 'Student',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
  });
});

describe('attendance.exportStudentsCsv', () => {
  it('allows full-admin and attendance-exporter tag, denies untagged users, and audits export', async () => {
    const { db } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await headCaller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Unexcused',
    });
    await headCaller.attendance.mark({
      studentId: secondStudentId,
      date: day('2026-04-29'),
      status: 'Late',
    });

    const exported = await makeCaller(attendanceExporterUser, db).attendance.exportStudentsCsv({
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    });

    expect(exported).toEqual({
      filename: 'student-attendance-2026-04-28-to-2026-04-29.csv',
      contentType: 'text/csv; charset=utf-8',
      csv: [
        'Date,Student ID,Student Name,Year Group,Status,Absence Reason,Recorded At',
        '2026-04-28,ctx-student,Jane Learner,Year 6,Absent,Unexcused,2026-04-29T10:00:00.000Z',
        '2026-04-29,ckstudent000000000000002,Amos Scholar,Year 5,Late,,2026-04-29T10:01:00.000Z',
      ].join('\n'),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceExporterUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 2, source: 'attendance.exportStudentsCsv' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceExporterUser.id,
        action: 'Update',
        entity: 'AttendanceExport',
        meta: {
          kind: 'student',
          from: '2026-04-28',
          to: '2026-04-29',
          studentId: null,
          rowCount: 2,
          scope: 'all',
        },
      },
    });

    await expect(
      makeCaller(headUser, db).attendance.exportStudentsCsv({
        from: day('2026-04-29'),
        to: day('2026-04-29'),
      }),
    ).resolves.toMatchObject({ filename: 'student-attendance-2026-04-29-to-2026-04-29.csv' });
    await expect(
      makeCaller(supervisorUser, db).attendance.exportStudentsCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'student',
          from: '2026-04-28',
          to: '2026-04-29',
          studentId: null,
          role: 'Supervisor',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
    await expect(
      makeCaller(parentUser, db).attendance.exportStudentsCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).attendance.exportStudentsCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('exports one selected student within the requested date range', async () => {
    const { db } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await headCaller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Unexcused',
    });
    await headCaller.attendance.mark({
      studentId: secondStudentId,
      date: day('2026-04-29'),
      status: 'Late',
    });

    const exported = await headCaller.attendance.exportStudentsCsv({
      from: day('2026-04-28'),
      to: day('2026-04-29'),
      studentId: secondStudentId,
    });

    expect(exported.csv).toBe(
      [
        'Date,Student ID,Student Name,Year Group,Status,Absence Reason,Recorded At',
        '2026-04-29,ckstudent000000000000002,Amos Scholar,Year 5,Late,,2026-04-29T10:01:00.000Z',
      ].join('\n'),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'AttendanceExport',
        meta: {
          kind: 'student',
          from: '2026-04-28',
          to: '2026-04-29',
          studentId: secondStudentId,
          rowCount: 1,
          scope: 'individual',
        },
      },
    });
  });

  it('rejects invalid ranges before export work starts', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(headUser, db).attendance.exportStudentsCsv({
        from: day('2026-04-29'),
        to: day('2026-04-28'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.attendance.findMany).not.toHaveBeenCalled();
  });

  it('audits selected-student denied calls with the requested selector', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).attendance.exportStudentsCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
        studentId: secondStudentId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'student',
          from: '2026-04-28',
          to: '2026-04-29',
          studentId: secondStudentId,
          role: 'Supervisor',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
  });

  it('exports selected archived student history rows', async () => {
    const { attendance, db } = makeFakeDb();
    attendance.push({
      id: 'ckattendanceinactive000002',
      studentId: inactiveStudentId,
      date: day('2026-04-28'),
      status: 'Present',
      absenceReason: null,
      recordedById: headUser.id,
      createdAt: new Date('2026-04-28T09:30:00.000Z'),
    });

    const exported = await makeCaller(headUser, db).attendance.exportStudentsCsv({
      from: day('2026-04-28'),
      to: day('2026-04-28'),
      studentId: inactiveStudentId,
    });

    expect(exported.csv).toBe(
      [
        'Date,Student ID,Student Name,Year Group,Status,Absence Reason,Recorded At',
        '2026-04-28,ckstudent000000000000003,Former Student,Year 7,Present,,2026-04-28T09:30:00.000Z',
      ].join('\n'),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'AttendanceExport',
        meta: {
          kind: 'student',
          from: '2026-04-28',
          to: '2026-04-28',
          studentId: inactiveStudentId,
          rowCount: 1,
          scope: 'individual',
        },
      },
    });
  });
});

describe('attendance.studentHistory', () => {
  it('returns selected student history for export-authorised users including archived students', async () => {
    const { attendance, db } = makeFakeDb();
    attendance.push({
      id: 'ckattendanceinactive000001',
      studentId: inactiveStudentId,
      date: day('2026-04-27'),
      status: 'Present',
      absenceReason: null,
      recordedById: headUser.id,
      createdAt: new Date('2026-04-27T09:00:00.000Z'),
    });
    const headCaller = makeCaller(headUser, db);
    await headCaller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Unexcused',
    });
    await headCaller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-29'),
      status: 'Late',
    });

    await expect(
      headCaller.attendance.studentHistory({
        studentId: activeStudentId,
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).resolves.toEqual([
      {
        id: 'ckattendance000000000003',
        date: '2026-04-29',
        status: 'Late',
        absenceReason: null,
        absenceReasonLabel: null,
        recordedById: headUser.id,
        recordedAt: new Date('2026-04-29T10:02:00.000Z'),
      },
      {
        id: 'ckattendance000000000002',
        date: '2026-04-28',
        status: 'Absent',
        absenceReason: 'Unexcused',
        absenceReasonLabel: 'Unexcused',
        recordedById: headUser.id,
        recordedAt: new Date('2026-04-29T10:01:00.000Z'),
      },
    ]);

    await expect(
      makeCaller(attendanceExporterUser, db).attendance.studentHistory({
        studentId: inactiveStudentId,
        from: day('2026-04-27'),
        to: day('2026-04-27'),
      }),
    ).resolves.toEqual([
      {
        id: 'ckattendanceinactive000001',
        date: '2026-04-27',
        status: 'Present',
        absenceReason: null,
        absenceReasonLabel: null,
        recordedById: headUser.id,
        recordedAt: new Date('2026-04-27T09:00:00.000Z'),
      },
    ]);
  });

  it('filters student history by attendance date, not recorded timestamp', async () => {
    const { attendance, db } = makeFakeDb();
    attendance.push(
      {
        id: 'ckattendanceattended001',
        studentId: activeStudentId,
        date: day('2026-04-17'),
        status: 'Present',
        absenceReason: null,
        recordedById: headUser.id,
        createdAt: new Date('2026-05-07T09:00:00.000Z'),
      },
      {
        id: 'ckattendancerecorded001',
        studentId: activeStudentId,
        date: day('2026-05-07'),
        status: 'Late',
        absenceReason: null,
        recordedById: headUser.id,
        createdAt: new Date('2026-04-17T09:00:00.000Z'),
      },
    );

    await expect(
      makeCaller(headUser, db).attendance.studentHistory({
        studentId: activeStudentId,
        from: day('2026-04-17'),
        to: day('2026-04-17'),
      }),
    ).resolves.toEqual([
      {
        id: 'ckattendanceattended001',
        date: '2026-04-17',
        status: 'Present',
        absenceReason: null,
        absenceReasonLabel: null,
        recordedById: headUser.id,
        recordedAt: new Date('2026-05-07T09:00:00.000Z'),
      },
    ]);
  });

  it('denies unauthorised users, audits denied calls, and rejects invalid ranges', async () => {
    const { db } = makeFakeDb();
    const input = {
      studentId: activeStudentId,
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    };

    await expect(
      makeCaller(supervisorUser, db).attendance.studentHistory(input),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'student-history',
          from: '2026-04-28',
          to: '2026-04-29',
          studentId: activeStudentId,
          role: 'Supervisor',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
    await expect(makeCaller(parentUser, db).attendance.studentHistory(input)).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      },
    );
    await expect(
      makeCaller(studentUser, db).attendance.studentHistory(input),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller(headUser, db).attendance.studentHistory({
        studentId: activeStudentId,
        from: day('2026-04-29'),
        to: day('2026-04-28'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('attendance.studentSummary', () => {
  it('returns student-safe own attendance with absence reason labels only when entered', async () => {
    const { attendance, db } = makeFakeDb();
    attendance.push(
      {
        id: 'ckattendanceown0000001',
        studentId: activeStudentId,
        date: day('2026-04-28'),
        status: 'Absent',
        absenceReason: 'Sick',
        recordedById: attendanceRecorderUser.id,
        createdAt: new Date('2026-04-28T09:30:00.000Z'),
      },
      {
        id: 'ckattendanceown0000002',
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Late',
        absenceReason: null,
        recordedById: attendanceRecorderUser.id,
        createdAt: new Date('2026-04-29T09:30:00.000Z'),
      },
      {
        id: 'ckattendanceother000001',
        studentId: secondStudentId,
        date: day('2026-04-29'),
        status: 'Present',
        absenceReason: null,
        recordedById: headUser.id,
        createdAt: new Date('2026-04-29T09:30:00.000Z'),
      },
    );

    const summary = await makeCaller(studentUser, db).attendance.studentSummary({
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    });

    expect(summary).toEqual({
      studentId: activeStudentId,
      from: '2026-04-28',
      to: '2026-04-29',
      summary: {
        total: 2,
        present: 0,
        absent: 1,
        late: 1,
        attendanceRate: 0,
      },
      records: [
        {
          id: 'ckattendanceown0000002',
          date: '2026-04-29',
          status: 'Late',
          absenceReason: null,
          absenceReasonLabel: null,
        },
        {
          id: 'ckattendanceown0000001',
          date: '2026-04-28',
          status: 'Absent',
          absenceReason: 'Sick',
          absenceReasonLabel: 'Sick',
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain(attendanceRecorderUser.id);
    expect(JSON.stringify(summary)).not.toContain(secondStudentId);
  });

  it('returns an empty summary when the student has no attendance records in range', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(studentUser, db).attendance.studentSummary({
        from: day('2026-05-01'),
        to: day('2026-05-31'),
      }),
    ).resolves.toEqual({
      studentId: activeStudentId,
      from: '2026-05-01',
      to: '2026-05-31',
      summary: {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        attendanceRate: null,
      },
      records: [],
    });
  });

  it('is student-only and rejects invalid ranges', async () => {
    const { db } = makeFakeDb();
    const input = {
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    };

    await expect(makeCaller(parentUser, db).attendance.studentSummary(input)).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      },
    );
    await expect(makeCaller(headUser, db).attendance.studentSummary(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller(studentUser, db).attendance.studentSummary({
        from: day('2026-04-29'),
        to: day('2026-04-28'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('attendance.markStaff', () => {
  it('upserts staff attendance by staff/date and audits create then update', async () => {
    const { db, staffAttendance } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(
      caller.attendance.markStaff({
        staffUserId: supervisorUser.id,
        date: new Date('2026-04-29T15:30:00.000Z'),
        status: 'Present',
      }),
    ).resolves.toMatchObject({
      id: 'ckstaffattendance00000001',
      staffUserId: supervisorUser.id,
      date: '2026-04-29',
      status: 'Present',
      recordedById: headUser.id,
    });
    await expect(
      caller.attendance.markStaff({
        staffUserId: supervisorUser.id,
        date: day('2026-04-29'),
        status: 'Late',
      }),
    ).resolves.toMatchObject({
      id: 'ckstaffattendance00000001',
      staffUserId: supervisorUser.id,
      date: '2026-04-29',
      status: 'Late',
    });

    expect(staffAttendance).toHaveLength(1);
    expect(staffAttendance[0]).toMatchObject({ staffUserId: supervisorUser.id, status: 'Late' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'StaffAttendance',
        entityId: 'ckstaffattendance00000001',
        meta: { staffUserId: supervisorUser.id, date: '2026-04-29', status: 'Present' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'StaffAttendance',
        entityId: 'ckstaffattendance00000001',
        meta: { staffUserId: supervisorUser.id, date: '2026-04-29', status: 'Late' },
      },
    });
  });

  it('denies non-admin users and rejects missing or non-staff users', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).attendance.markStaff({
        staffUserId: supervisorUser.id,
        date: day('2026-04-29'),
        status: 'Present',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const caller = makeCaller(headUser, db);
    await expect(
      caller.attendance.markStaff({
        staffUserId: 'u_missing',
        date: day('2026-04-29'),
        status: 'Present',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'supervisor user not found' });
    await expect(
      caller.attendance.markStaff({
        staffUserId: parentUser.id,
        date: day('2026-04-29'),
        status: 'Present',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'user is not an active supervisor',
    });
  });

  it('requires an absence reason for staff Absent and clears it when status changes', async () => {
    const { db, staffAttendance } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(
      caller.attendance.markStaff({
        staffUserId: supervisorUser.id,
        date: day('2026-04-29'),
        status: 'Absent',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.attendance.markStaff({
        staffUserId: supervisorUser.id,
        date: day('2026-04-29'),
        status: 'Absent',
        absenceReason: 'Holiday',
      }),
    ).resolves.toMatchObject({
      status: 'Absent',
      absenceReason: 'Holiday',
      absenceReasonLabel: 'Holiday',
    });
    await expect(
      caller.attendance.markStaff({
        staffUserId: supervisorUser.id,
        date: day('2026-04-29'),
        status: 'Present',
      }),
    ).resolves.toMatchObject({
      status: 'Present',
      absenceReason: null,
      absenceReasonLabel: null,
    });
    expect(staffAttendance[0]).toMatchObject({ status: 'Present', absenceReason: null });
  });
});

describe('attendance.resetStaffForDate', () => {
  it('clears the selected staff register date for admin operations users only', async () => {
    const { db, staffAttendance } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await caller.attendance.markStaff({
      staffUserId: supervisorUser.id,
      date: day('2026-04-29'),
      status: 'Present',
    });
    await caller.attendance.markStaff({
      staffUserId: attendanceRecorderUser.id,
      date: day('2026-04-29'),
      status: 'Late',
    });
    await caller.attendance.markStaff({
      staffUserId: supervisorUser.id,
      date: day('2026-04-30'),
      status: 'Present',
    });

    await expect(caller.attendance.resetStaffForDate({ date: day('2026-04-29') })).resolves.toEqual(
      {
        date: '2026-04-29',
        deletedCount: 2,
      },
    );

    expect(staffAttendance).toHaveLength(1);
    expect(staffAttendance[0]).toMatchObject({ date: day('2026-04-30') });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Delete',
        entity: 'StaffAttendance',
        meta: {
          date: '2026-04-29',
          deletedCount: 2,
          source: 'attendance.resetStaffForDate',
        },
      },
    });

    await expect(
      makeCaller(supervisorUser, db).attendance.resetStaffForDate({ date: day('2026-04-29') }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('attendance.staffForDate', () => {
  it('returns scheduled supervisors, unscheduled saved attendance, and addable unscheduled options', async () => {
    const { db } = makeFakeDb();
    await makeCaller(headUser, db).attendance.markStaff({
      staffUserId: attendanceExporterUser.id,
      date: day('2026-04-29'),
      status: 'Present',
    });

    const result = await makeCaller(headUser, db).attendance.staffForDate({
      date: day('2026-04-29'),
    });

    expect(result.rows).toHaveLength(3);
    expect(result.rows.find((row) => row.staffUserId === supervisorUser.id)).toMatchObject({
      staffName: 'Supervisor User',
      scheduled: true,
      status: null,
    });
    expect(result.rows.find((row) => row.staffUserId === attendanceExporterUser.id)).toMatchObject({
      staffName: 'Exporter User',
      scheduled: false,
      status: 'Present',
    });
    expect(result.unscheduledOptions.map((option) => option.id)).toEqual([headUser.id]);
  });

  it('denies non-full-admin users', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).attendance.staffForDate({ date: day('2026-04-29') }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('attendance.staffHistory', () => {
  it('returns selected staff history for export-authorised users including inactive staff', async () => {
    const { db, staffAttendance } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await headCaller.attendance.markStaff({
      staffUserId: supervisorUser.id,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Unexcused',
    });
    await headCaller.attendance.markStaff({
      staffUserId: supervisorUser.id,
      date: day('2026-04-29'),
      status: 'Late',
    });
    staffAttendance.push({
      id: 'ckstaffattendanceinactive01',
      staffUserId: inactiveStaffUserId,
      date: day('2026-04-27'),
      status: 'Present',
      absenceReason: null,
      recordedById: headUser.id,
      createdAt: new Date('2026-04-27T09:00:00.000Z'),
    });

    await expect(
      headCaller.attendance.staffHistory({
        staffUserId: supervisorUser.id,
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).resolves.toEqual([
      {
        id: 'ckstaffattendance00000002',
        date: '2026-04-29',
        status: 'Late',
        absenceReason: null,
        absenceReasonLabel: null,
        recordedById: headUser.id,
        recordedAt: new Date('2026-04-29T11:01:00.000Z'),
      },
      {
        id: 'ckstaffattendance00000001',
        date: '2026-04-28',
        status: 'Absent',
        absenceReason: 'Unexcused',
        absenceReasonLabel: 'Unexcused',
        recordedById: headUser.id,
        recordedAt: new Date('2026-04-29T11:00:00.000Z'),
      },
    ]);

    await expect(
      makeCaller(attendanceExporterUser, db).attendance.staffHistory({
        staffUserId: inactiveStaffUserId,
        from: day('2026-04-27'),
        to: day('2026-04-27'),
      }),
    ).resolves.toEqual([
      {
        id: 'ckstaffattendanceinactive01',
        date: '2026-04-27',
        status: 'Present',
        absenceReason: null,
        absenceReasonLabel: null,
        recordedById: headUser.id,
        recordedAt: new Date('2026-04-27T09:00:00.000Z'),
      },
    ]);
  });

  it('filters staff history by attendance date, not recorded timestamp', async () => {
    const { db, staffAttendance } = makeFakeDb();
    staffAttendance.push(
      {
        id: 'ckstaffattended001',
        staffUserId: supervisorUser.id,
        date: day('2026-04-17'),
        status: 'Present',
        absenceReason: null,
        recordedById: headUser.id,
        createdAt: new Date('2026-05-07T09:00:00.000Z'),
      },
      {
        id: 'ckstaffrecorded001',
        staffUserId: supervisorUser.id,
        date: day('2026-05-07'),
        status: 'Late',
        absenceReason: null,
        recordedById: headUser.id,
        createdAt: new Date('2026-04-17T09:00:00.000Z'),
      },
    );

    await expect(
      makeCaller(headUser, db).attendance.staffHistory({
        staffUserId: supervisorUser.id,
        from: day('2026-04-17'),
        to: day('2026-04-17'),
      }),
    ).resolves.toEqual([
      {
        id: 'ckstaffattended001',
        date: '2026-04-17',
        status: 'Present',
        absenceReason: null,
        absenceReasonLabel: null,
        recordedById: headUser.id,
        recordedAt: new Date('2026-05-07T09:00:00.000Z'),
      },
    ]);
  });

  it('denies unauthorised users, audits denied calls, and rejects invalid ranges', async () => {
    const { db } = makeFakeDb();
    const input = {
      staffUserId: supervisorUser.id,
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    };

    await expect(
      makeCaller(supervisorUser, db).attendance.staffHistory(input),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'staff-history',
          from: '2026-04-28',
          to: '2026-04-29',
          staffUserId: supervisorUser.id,
          role: 'Supervisor',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
    await expect(makeCaller(parentUser, db).attendance.staffHistory(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(studentUser, db).attendance.staffHistory(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      makeCaller(headUser, db).attendance.staffHistory({
        staffUserId: supervisorUser.id,
        from: day('2026-04-29'),
        to: day('2026-04-28'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('attendance.exportStaffCsv', () => {
  it('allows full-admin and attendance-exporter tag, denies untagged users, and audits export', async () => {
    const { db } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await headCaller.attendance.markStaff({
      staffUserId: supervisorUser.id,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Unexcused',
    });
    await headCaller.attendance.markStaff({
      staffUserId: attendanceExporterUser.id,
      date: day('2026-04-29'),
      status: 'Late',
    });

    const exported = await makeCaller(attendanceExporterUser, db).attendance.exportStaffCsv({
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    });

    expect(exported).toEqual({
      filename: 'supervisor-attendance-2026-04-28-to-2026-04-29.csv',
      contentType: 'text/csv; charset=utf-8',
      csv: [
        'Date,Supervisor User ID,Supervisor Name,Email,Role,Status,Absence Reason,Recorded At',
        '2026-04-28,ckusersup000000000000001,Supervisor User,supervisor@example.test,Supervisor,Absent,Unexcused,2026-04-29T11:00:00.000Z',
        '2026-04-29,ckuserexport000000000001,Exporter User,exporter@example.test,Supervisor,Late,,2026-04-29T11:01:00.000Z',
      ].join('\n'),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceExporterUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { count: 2, source: 'attendance.exportStaffCsv' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: attendanceExporterUser.id,
        action: 'Update',
        entity: 'AttendanceExport',
        meta: {
          kind: 'staff',
          from: '2026-04-28',
          to: '2026-04-29',
          staffUserId: null,
          rowCount: 2,
          scope: 'all',
        },
      },
    });

    await expect(
      makeCaller(headUser, db).attendance.exportStaffCsv({
        from: day('2026-04-29'),
        to: day('2026-04-29'),
      }),
    ).resolves.toMatchObject({
      filename: 'supervisor-attendance-2026-04-29-to-2026-04-29.csv',
    });
    await expect(
      makeCaller(supervisorUser, db).attendance.exportStaffCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'staff',
          from: '2026-04-28',
          to: '2026-04-29',
          staffUserId: null,
          role: 'Supervisor',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
    await expect(
      makeCaller(parentUser, db).attendance.exportStaffCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).attendance.exportStaffCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('exports one selected staff member within the requested date range', async () => {
    const { db } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await headCaller.attendance.markStaff({
      staffUserId: supervisorUser.id,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Unexcused',
    });
    await headCaller.attendance.markStaff({
      staffUserId: attendanceExporterUser.id,
      date: day('2026-04-29'),
      status: 'Late',
    });

    const exported = await headCaller.attendance.exportStaffCsv({
      from: day('2026-04-28'),
      to: day('2026-04-29'),
      staffUserId: attendanceExporterUser.id,
    });

    expect(exported.csv).toBe(
      [
        'Date,Supervisor User ID,Supervisor Name,Email,Role,Status,Absence Reason,Recorded At',
        '2026-04-29,ckuserexport000000000001,Exporter User,exporter@example.test,Supervisor,Late,,2026-04-29T11:01:00.000Z',
      ].join('\n'),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'AttendanceExport',
        meta: {
          kind: 'staff',
          from: '2026-04-28',
          to: '2026-04-29',
          staffUserId: attendanceExporterUser.id,
          rowCount: 1,
          scope: 'individual',
        },
      },
    });
  });

  it('rejects invalid ranges before staff export work starts', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(headUser, db).attendance.exportStaffCsv({
        from: day('2026-04-29'),
        to: day('2026-04-28'),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.staffAttendance.findMany).not.toHaveBeenCalled();
  });

  it('audits selected-staff denied calls with the requested selector', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).attendance.exportStaffCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
        staffUserId: attendanceExporterUser.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: supervisorUser.id,
        action: 'PermissionDenied',
        entity: 'AttendanceExport',
        meta: {
          kind: 'staff',
          from: '2026-04-28',
          to: '2026-04-29',
          staffUserId: attendanceExporterUser.id,
          role: 'Supervisor',
          reason: 'Access denied: attendance export requires full-admin or attendance-exporter',
        },
      },
    });
  });

  it('exports selected inactive staff history rows', async () => {
    const { db, staffAttendance } = makeFakeDb();
    staffAttendance.push({
      id: 'ckstaffattendanceinactive02',
      staffUserId: inactiveStaffUserId,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Unexcused',
      recordedById: headUser.id,
      createdAt: new Date('2026-04-28T09:45:00.000Z'),
    });

    const exported = await makeCaller(headUser, db).attendance.exportStaffCsv({
      from: day('2026-04-28'),
      to: day('2026-04-28'),
      staffUserId: inactiveStaffUserId,
    });

    expect(exported.csv).toBe(
      [
        'Date,Supervisor User ID,Supervisor Name,Email,Role,Status,Absence Reason,Recorded At',
        '2026-04-28,ckuserinactive000000001,Inactive Supervisor,inactive@example.test,Supervisor,Absent,Unexcused,2026-04-28T09:45:00.000Z',
      ].join('\n'),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'AttendanceExport',
        meta: {
          kind: 'staff',
          from: '2026-04-28',
          to: '2026-04-28',
          staffUserId: inactiveStaffUserId,
          rowCount: 1,
          scope: 'individual',
        },
      },
    });
  });
});

describe('attendance.insights', () => {
  it('returns aggregate and selected student attendance summaries with absence reason buckets', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    await caller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Sick',
    });
    await caller.attendance.mark({
      studentId: activeStudentId,
      date: day('2026-04-29'),
      status: 'Present',
    });
    await caller.attendance.mark({
      studentId: secondStudentId,
      date: day('2026-04-29'),
      status: 'Late',
    });

    const aggregate = await caller.attendance.insights({
      kind: 'students',
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    });
    expect(aggregate.summary).toEqual({
      total: 3,
      present: 1,
      absent: 1,
      late: 1,
      attendanceRate: 33,
    });
    expect(aggregate.trend).toHaveLength(2);
    expect(aggregate.absenceReasons.find((reason) => reason.reason === 'Sick')).toMatchObject({
      label: 'Sick',
      count: 1,
    });
    expect(aggregate.people).toHaveLength(3);

    const selected = await caller.attendance.insights({
      kind: 'students',
      from: day('2026-04-28'),
      to: day('2026-04-29'),
      subjectId: activeStudentId,
    });
    expect(selected.selectedId).toBe(activeStudentId);
    expect(selected.summary).toMatchObject({ total: 2, present: 1, absent: 1, late: 0 });
    expect(selected.records.map((record) => record.subjectId)).toEqual([
      activeStudentId,
      activeStudentId,
    ]);
  });

  it('returns staff attendance insights and denies unauthorised users', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    await caller.attendance.markStaff({
      staffUserId: supervisorUser.id,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: 'Holiday',
    });
    await caller.attendance.markStaff({
      staffUserId: attendanceExporterUser.id,
      date: day('2026-04-29'),
      status: 'Present',
    });

    const result = await caller.attendance.insights({
      kind: 'staff',
      from: day('2026-04-28'),
      to: day('2026-04-29'),
    });
    expect(result.summary).toMatchObject({ total: 2, present: 1, absent: 1, late: 0 });
    expect(result.absenceReasons.find((reason) => reason.reason === 'Holiday')).toMatchObject({
      label: 'Holiday',
      count: 1,
    });
    expect(result.people.map((person) => person.id)).toContain(supervisorUser.id);

    await expect(
      makeCaller(supervisorUser, db).attendance.insights({
        kind: 'staff',
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps legacy Absent rows without a reason in the Unknown bucket', async () => {
    const { attendance, db } = makeFakeDb();
    attendance.push({
      id: 'ckattendancelegacy001',
      studentId: activeStudentId,
      date: day('2026-04-28'),
      status: 'Absent',
      absenceReason: null,
      recordedById: headUser.id,
      createdAt: new Date('2026-04-28T09:00:00.000Z'),
    });

    const result = await makeCaller(headUser, db).attendance.insights({
      kind: 'students',
      from: day('2026-04-28'),
      to: day('2026-04-28'),
    });

    expect(result.absenceReasons.find((reason) => reason.reason === 'Unknown')).toMatchObject({
      label: 'Unknown',
      count: 1,
    });
    expect(result.records[0]).toMatchObject({
      status: 'Absent',
      absenceReason: null,
      absenceReasonLabel: null,
    });
  });
});
