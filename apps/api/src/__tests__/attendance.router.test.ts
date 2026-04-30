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

type AttendanceStatus = 'Present' | 'Absent' | 'Late';

interface StoredStudent {
  id: string;
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
  recordedById: string;
  createdAt: Date;
}

interface StoredStaffAttendance {
  id: string;
  staffUserId: string;
  date: Date;
  status: AttendanceStatus;
  recordedById: string;
  createdAt: Date;
}

interface StoredYearGroupBand {
  id: string;
  name: string;
  standardYears: string[];
  active: boolean;
  sortOrder: number;
  colour: string;
}

interface FakeDb {
  $enc: {
    decrypt: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  attendance: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  staffAttendance: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  yearGroupBand: {
    findMany: ReturnType<typeof vi.fn>;
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

function makeFakeDb() {
  const students: StoredStudent[] = [
    {
      id: activeStudentId,
      fullNameEnc: 'enc:Jane Learner',
      yearGroup: 'Year 6',
      active: true,
      createdAt: new Date('2026-04-20T09:00:00.000Z'),
    },
    {
      id: secondStudentId,
      fullNameEnc: 'enc:Amos Scholar',
      yearGroup: 'Year 5',
      active: true,
      createdAt: new Date('2026-04-21T09:00:00.000Z'),
    },
    {
      id: inactiveStudentId,
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
      id: parentUser.id,
      fullNameEnc: 'enc:Parent User',
      emailEnc: 'enc:parent@example.test',
      role: 'Parent',
      active: true,
    },
  ];
  const attendance: StoredAttendance[] = [];
  const staffAttendance: StoredStaffAttendance[] = [];
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

  const db: FakeDb = {
    $enc: { decrypt: vi.fn(decrypt) },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    student: {
      findMany: vi.fn(
        ({
          where,
          select,
        }: {
          where?: { active?: boolean };
          select?: { attendance?: { where?: { date?: Date } } };
        }) => {
          const attendanceDate = select?.attendance?.where?.date;
          return Promise.resolve(
            students
              .filter((student) => where?.active === undefined || student.active === where.active)
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .map((student) => ({
                id: student.id,
                fullNameEnc: student.fullNameEnc,
                yearGroup: student.yearGroup,
                attendance: attendance
                  .filter((row) => row.studentId === student.id)
                  .filter(
                    (row) =>
                      attendanceDate === undefined || dateKey(row.date) === dateKey(attendanceDate),
                  )
                  .map((row) => ({
                    id: row.id,
                    status: row.status,
                    recordedById: row.recordedById,
                    createdAt: row.createdAt,
                  }))
                  .slice(0, 1),
              })),
          );
        },
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        if (!student) return Promise.resolve(null);
        return Promise.resolve({ id: student.id, active: student.active });
      }),
    },
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) return Promise.resolve(null);
        return Promise.resolve({ id: user.id, role: user.role, active: user.active });
      }),
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
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<StoredAttendance> }) => {
        const row = attendance.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error('attendance row missing');
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
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
      findMany: vi.fn(({ where }: { where: { date: { gte: Date; lte: Date } } }) =>
        Promise.resolve(
          attendance
            .filter(
              (row) =>
                row.date.getTime() >= where.date.gte.getTime() &&
                row.date.getTime() <= where.date.lte.getTime(),
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
            .map((row) => {
              const student = students.find((candidate) => candidate.id === row.studentId);
              if (!student) throw new Error('test student missing');
              return {
                date: row.date,
                status: row.status,
                createdAt: row.createdAt,
                student: {
                  id: student.id,
                  fullNameEnc: student.fullNameEnc,
                  yearGroup: student.yearGroup,
                },
              };
            }),
        ),
      ),
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
      findMany: vi.fn(({ where }: { where: { date: { gte: Date; lte: Date } } }) =>
        Promise.resolve(
          staffAttendance
            .filter(
              (row) =>
                row.date.getTime() >= where.date.gte.getTime() &&
                row.date.getTime() <= where.date.lte.getTime(),
            )
            .sort(
              (a, b) =>
                a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
            )
            .map((row) => {
              const staffUser = users.find((candidate) => candidate.id === row.staffUserId);
              if (!staffUser) throw new Error('test staff user missing');
              return {
                date: row.date,
                status: row.status,
                createdAt: row.createdAt,
                staffUser: {
                  id: staffUser.id,
                  fullNameEnc: staffUser.fullNameEnc,
                  emailEnc: staffUser.emailEnc,
                  role: staffUser.role,
                },
              };
            }),
        ),
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
  };

  return { db, students, attendance, staffAttendance, yearGroupBands };
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
    await expect(makeCaller(supervisorUser, db).attendance.listYearGroupBands()).resolves.toHaveLength(2);
    await expect(makeCaller(parentUser, db).attendance.listYearGroupBands()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(studentUser, db).attendance.listYearGroupBands()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
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

    await expect(makeCaller(parentUser, db).attendance.forDate({ date: day('2026-04-29') })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(studentUser, db).attendance.forDate({ date: day('2026-04-29') })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
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

  it('allows Head and attendance-recorder, but denies untagged daily-workflow users', async () => {
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
      makeCaller(supervisorUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-30'),
        status: 'Absent',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(principalUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-30'),
        status: 'Absent',
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
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(studentUser, db).attendance.mark({
        studentId: activeStudentId,
        date: day('2026-04-29'),
        status: 'Absent',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const caller = makeCaller(headUser, db);
    await expect(
      caller.attendance.mark({
        studentId: 'ckstudentmissing000000001',
        date: day('2026-04-29'),
        status: 'Absent',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'student not found' });
    await expect(
      caller.attendance.mark({
        studentId: inactiveStudentId,
        date: day('2026-04-29'),
        status: 'Absent',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'student is inactive' });
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
        'Date,Student ID,Student Name,Year Group,Status,Recorded At',
        '2026-04-28,ctx-student,Jane Learner,Year 6,Absent,2026-04-29T10:00:00.000Z',
        '2026-04-29,ckstudent000000000000002,Amos Scholar,Year 5,Late,2026-04-29T10:01:00.000Z',
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
        meta: { kind: 'student', from: '2026-04-28', to: '2026-04-29', rowCount: 2 },
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
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'staff user not found' });
    await expect(
      caller.attendance.markStaff({
        staffUserId: parentUser.id,
        date: day('2026-04-29'),
        status: 'Present',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'user is not active staff' });
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
      filename: 'staff-attendance-2026-04-28-to-2026-04-29.csv',
      contentType: 'text/csv; charset=utf-8',
      csv: [
        'Date,Staff User ID,Staff Name,Email,Role,Status,Recorded At',
        '2026-04-28,ckusersup000000000000001,Supervisor User,supervisor@example.test,Supervisor,Absent,2026-04-29T11:00:00.000Z',
        '2026-04-29,ckuserexport000000000001,Exporter User,exporter@example.test,Supervisor,Late,2026-04-29T11:01:00.000Z',
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
        meta: { kind: 'staff', from: '2026-04-28', to: '2026-04-29', rowCount: 2 },
      },
    });

    await expect(
      makeCaller(headUser, db).attendance.exportStaffCsv({
        from: day('2026-04-29'),
        to: day('2026-04-29'),
      }),
    ).resolves.toMatchObject({ filename: 'staff-attendance-2026-04-29-to-2026-04-29.csv' });
    await expect(
      makeCaller(supervisorUser, db).attendance.exportStaffCsv({
        from: day('2026-04-28'),
        to: day('2026-04-29'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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
});
