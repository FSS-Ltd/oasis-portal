import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { childLogRouter } from '../routers/childLog.js';
import { childNotesRouter } from '../routers/childNotes.js';
import { router } from '../trpc.js';

const headUser: SessionUser = { id: 'u_head', role: 'Head', tags: [], requires2fa: false };
const hodUser: SessionUser = {
  id: 'u_hod',
  role: 'HeadOfDiscipline',
  tags: [],
  requires2fa: false,
};
const principalUser: SessionUser = {
  id: 'u_principal',
  role: 'Principal',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'u_sup',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const technicalSupportUser: SessionUser = {
  id: 'u_support',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const taggedSupervisorUser: SessionUser = {
  id: 'u_tagged_sup',
  role: 'Supervisor',
  tags: ['student-drillthrough-viewer'],
  requires2fa: false,
};
const allStudentsSupervisorUser: SessionUser = {
  id: 'u_all_students_sup',
  role: 'Supervisor',
  tags: ['supervisor-all-students'],
  requires2fa: false,
};
const sensitiveViewerUser: SessionUser = {
  id: 'u_sensitive',
  role: 'Supervisor',
  tags: ['student-drillthrough-viewer', 'sensitive-note-viewer'],
  requires2fa: false,
};
const parentUser: SessionUser = { id: 'u_parent', role: 'Parent', tags: [], requires2fa: false };
const unlinkedParentUser: SessionUser = {
  id: 'u_other_parent',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'u_student',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

interface StoredChildNote {
  id: string;
  studentId: string;
  noteEnc: string;
  sensitive: boolean;
  createdById: string;
  deletedAt: Date | null;
  deletedById: string | null;
  seenAt: Date | null;
  seenById: string | null;
  headCommentEnc: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ChildNoteWhere {
  OR?: Array<{ createdBy?: { role: { in: readonly string[] } }; createdById?: string }>;
  studentId?: string | { in: string[] };
  createdBy?: { role: { in: readonly string[] } };
  createdById?: string;
  sensitive?: boolean;
  deletedAt?: null;
  createdAt?: { gte: Date; lt: Date };
}

interface StoredChildNoteCreateInput {
  studentId: string;
  noteEnc: string;
  sensitive: boolean;
  createdById: string;
}

interface StoredStudent {
  id: string;
  active: boolean;
  fullNameEnc: string;
  yearGroup: string;
  enrolmentDate: Date;
  createdAt: Date;
  subjects: Array<{
    subjectId: string;
    currentPaceNumber: number;
    subject: { id: string; code: string; name: string };
  }>;
}

interface StudentFindManyInput {
  where?: {
    active?: boolean;
    id?: { in: string[] };
    yearGroup?: { in: string[] };
  };
}

interface StoredYearGroupBand {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
  active: boolean;
}

interface StoredStaffShift {
  id: string;
  staffUserId: string;
  date: Date;
  startsAt: Date;
  yearGroupBand: StoredYearGroupBand;
}

interface StoredBehaviourEntry {
  id: string;
  studentId: string;
  type: string;
  category: string;
  visibility: string;
  meritDelta: number;
  recordedById: string;
  createdAt: Date;
  deletedAt: Date | null;
  headCommentEnc: string | null;
  noteEnc: string | null;
  recordedBy: { id: string; fullNameEnc: string; role: string } | undefined;
  seenAt: Date | null;
  seenBy: { id: string; fullNameEnc: string; role: string } | null;
  seenById: string | null;
  student: StoredStudent | undefined;
}

interface StaffShiftFindManyInput {
  where: {
    staffUserId: string;
    date: Date;
  };
}

type StoredAttendanceStatus = 'Present' | 'Absent' | 'Late';

interface StoredAttendance {
  id: string;
  studentId: string;
  date: Date;
  status: StoredAttendanceStatus;
  recordedById: string;
  createdAt: Date;
}

interface StoredPaceRecord {
  id: string;
  studentId: string;
  subjectId: string;
  paceNumber: number;
  paceTestScore: number | null;
  selfTestScore: number | null;
  completedAt: Date;
  createdAt: Date;
  subject: { id: string; code: string; name: string };
  recordedById: string;
  recordedBy: { id: string; fullNameEnc: string; role: string } | undefined;
}

interface StoredPaceProgress {
  studentId: string;
  subjectId: string;
  paceNumber: number;
  startedAt: Date;
  completedAt: Date | null;
}

interface StoredCalendarEvent {
  id: string;
  active: boolean;
  audience: 'All' | 'Parents' | 'Supervisors' | 'Heads' | 'Custom';
  category: 'HalfTerm' | 'Trips' | 'OasisDays' | 'Birthdays' | 'Meetings' | 'Trainings';
  startDate: Date;
  endDate: Date;
}

interface CalendarEventFindManyInput {
  where?: {
    active?: boolean;
    audience?: { in: Array<StoredCalendarEvent['audience']> };
    category?: StoredCalendarEvent['category'];
    startDate?: { lte: Date };
    endDate?: { gte: Date };
  };
  take?: number;
}

interface FakeDbOptions {
  attendanceRows?: StoredAttendance[];
  calendarEvents?: StoredCalendarEvent[];
  paceProgressRows?: StoredPaceProgress[];
  paceRecordRows?: StoredPaceRecord[];
}

const today = day('2026-04-30');

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function matchesStudentId(where: string | { in: string[] }, studentId: string): boolean {
  if (typeof where === 'string') return where === studentId;
  return where.in.includes(studentId);
}

function matchesBehaviourType(
  where: string | { in: readonly string[] } | undefined,
  type: string,
): boolean {
  if (where === undefined) return true;
  if (typeof where === 'string') return where === type;
  return where.in.includes(type);
}

function sameDay(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function makeOutOfBandStudent(): StoredStudent {
  return {
    id: 'student_2',
    active: true,
    fullNameEnc: 'enc:Secondary Learner',
    yearGroup: 'Year 9',
    enrolmentDate: day('2024-09-01'),
    createdAt: day('2024-09-02'),
    subjects: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(today);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeFakeDb(options: FakeDbOptions = {}) {
  const notes: StoredChildNote[] = [];
  const attendanceRows =
    options.attendanceRows ??
    ([
      {
        id: 'att_1',
        studentId: 'student_1',
        date: day('2026-04-29'),
        status: 'Late',
        recordedById: headUser.id,
        createdAt: day('2026-04-29'),
      },
    ] satisfies StoredAttendance[]);
  const calendarEvents = options.calendarEvents ?? [];
  const students: StoredStudent[] = [
    {
      id: 'student_1',
      active: true,
      fullNameEnc: 'enc:Jane Learner',
      yearGroup: 'Year 6',
      enrolmentDate: day('2024-09-01'),
      createdAt: day('2024-09-01'),
      subjects: [
        {
          subjectId: 'subject_1',
          currentPaceNumber: 1002,
          subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
        },
      ],
    },
  ];
  const lowerBand: StoredYearGroupBand = {
    id: 'band_lower',
    name: 'Lower school',
    standardYears: ['Year 6'],
    colour: '#0E7892',
    active: true,
  };
  const staffShifts: StoredStaffShift[] = [
    {
      id: 'shift_supervisor',
      staffUserId: supervisorUser.id,
      date: today,
      startsAt: new Date('2026-04-30T09:00:00.000Z'),
      yearGroupBand: lowerBand,
    },
    {
      id: 'shift_tagged_supervisor',
      staffUserId: taggedSupervisorUser.id,
      date: today,
      startsAt: new Date('2026-04-30T09:00:00.000Z'),
      yearGroupBand: lowerBand,
    },
    {
      id: 'shift_sensitive_viewer',
      staffUserId: sensitiveViewerUser.id,
      date: today,
      startsAt: new Date('2026-04-30T09:00:00.000Z'),
      yearGroupBand: lowerBand,
    },
  ];
  const guardians = [
    {
      id: 'guardian_1',
      userId: parentUser.id,
      studentId: 'student_1',
      student: students[0],
      createdAt: day('2024-09-01'),
    },
  ];
  const users = [
    { id: headUser.id, fullNameEnc: 'enc:Head User', role: headUser.role },
    { id: hodUser.id, fullNameEnc: 'enc:HOD User', role: hodUser.role },
    { id: principalUser.id, fullNameEnc: 'enc:Principal User', role: principalUser.role },
    { id: supervisorUser.id, fullNameEnc: 'enc:Supervisor User', role: supervisorUser.role },
    {
      id: technicalSupportUser.id,
      fullNameEnc: 'enc:Support User',
      role: technicalSupportUser.role,
    },
    {
      id: taggedSupervisorUser.id,
      fullNameEnc: 'enc:Tagged Supervisor',
      role: taggedSupervisorUser.role,
    },
    {
      id: allStudentsSupervisorUser.id,
      fullNameEnc: 'enc:All Students Supervisor',
      role: allStudentsSupervisorUser.role,
    },
    {
      id: sensitiveViewerUser.id,
      fullNameEnc: 'enc:Sensitive Viewer',
      role: sensitiveViewerUser.role,
    },
  ];
  const defaultPaceRecords = [
    {
      id: 'pace_pass_april',
      studentId: 'student_1',
      subjectId: 'subject_1',
      paceNumber: 1004,
      paceTestScore: 90,
      selfTestScore: null,
      completedAt: day('2026-04-29'),
      createdAt: day('2026-04-29'),
      subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
      recordedById: supervisorUser.id,
      recordedBy: users.find((user) => user.id === supervisorUser.id),
    },
    {
      id: 'pace_self_march',
      studentId: 'student_1',
      subjectId: 'subject_1',
      paceNumber: 1004,
      paceTestScore: null,
      selfTestScore: 100,
      completedAt: day('2026-03-20'),
      createdAt: day('2026-03-20'),
      subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
      recordedById: supervisorUser.id,
      recordedBy: users.find((user) => user.id === supervisorUser.id),
    },
    {
      id: 'pace_failed_march',
      studentId: 'student_1',
      subjectId: 'subject_1',
      paceNumber: 1003,
      paceTestScore: 75,
      selfTestScore: null,
      completedAt: day('2026-03-10'),
      createdAt: day('2026-03-10'),
      subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
      recordedById: supervisorUser.id,
      recordedBy: users.find((user) => user.id === supervisorUser.id),
    },
    {
      id: 'pace_pass_february',
      studentId: 'student_1',
      subjectId: 'subject_1',
      paceNumber: 1002,
      paceTestScore: 82,
      selfTestScore: null,
      completedAt: day('2026-02-01'),
      createdAt: day('2026-02-01'),
      subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
      recordedById: supervisorUser.id,
      recordedBy: users.find((user) => user.id === supervisorUser.id),
    },
    {
      id: 'pace_old_pass',
      studentId: 'student_1',
      subjectId: 'subject_1',
      paceNumber: 1001,
      paceTestScore: 95,
      selfTestScore: null,
      completedAt: day('2025-08-31'),
      createdAt: day('2025-08-31'),
      subject: { id: 'subject_1', code: 'MATH', name: 'Maths' },
      recordedById: supervisorUser.id,
      recordedBy: users.find((user) => user.id === supervisorUser.id),
    },
  ] satisfies StoredPaceRecord[];
  const paceRecordRows = options.paceRecordRows ?? defaultPaceRecords;
  const paceProgressRows =
    options.paceProgressRows ??
    ([
      {
        studentId: 'student_1',
        subjectId: 'subject_1',
        paceNumber: 1004,
        startedAt: day('2026-04-22'),
        completedAt: day('2026-04-29'),
      },
    ] satisfies StoredPaceProgress[]);
  const behaviourEntries: StoredBehaviourEntry[] = [
    {
      id: 'behaviour_1',
      studentId: 'student_1',
      type: 'Merit',
      category: 'Focus',
      visibility: 'General',
      meritDelta: 3,
      recordedById: supervisorUser.id,
      createdAt: day('2026-04-29'),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: 'enc:Focused well',
      recordedBy: users.find((user) => user.id === supervisorUser.id),
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: students[0],
    },
    {
      id: 'behaviour_2',
      studentId: 'student_1',
      type: 'Demerit',
      category: 'Pastoral',
      visibility: 'Sensitive',
      meritDelta: -5,
      recordedById: headUser.id,
      createdAt: day('2026-04-29'),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: 'enc:Sensitive behaviour',
      recordedBy: users.find((user) => user.id === headUser.id),
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: students[0],
    },
  ];
  const db = {
    $enc: {
      encrypt: vi.fn((value: string | null | undefined) => (value ? `enc:${value}` : null)),
      decrypt: vi.fn(decrypt),
    },
    auditLog: { create: vi.fn(() => Promise.resolve({ id: 'audit' })) },
    student: {
      findMany: vi.fn(({ where }: StudentFindManyInput = {}) =>
        Promise.resolve(
          students.filter((student) => {
            if (where?.active !== undefined && student.active !== where.active) return false;
            if (where?.id && !where.id.in.includes(student.id)) return false;
            if (where?.yearGroup && !where.yearGroup.in.includes(student.yearGroup)) return false;
            return true;
          }),
        ),
      ),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const student = students.find((row) => row.id === where.id);
        if (!student) return Promise.resolve(null);
        return Promise.resolve(student);
      }),
    },
    staffShift: {
      findMany: vi.fn(({ where }: StaffShiftFindManyInput) =>
        Promise.resolve(
          staffShifts.filter(
            (shift) => shift.staffUserId === where.staffUserId && sameDay(shift.date, where.date),
          ),
        ),
      ),
    },
    guardian: {
      findUnique: vi.fn(
        ({ where }: { where: { userId_studentId: { userId: string; studentId: string } } }) =>
          Promise.resolve(
            guardians.find(
              (guardian) =>
                guardian.userId === where.userId_studentId.userId &&
                guardian.studentId === where.userId_studentId.studentId,
            ) ?? null,
          ),
      ),
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(guardians.filter((guardian) => guardian.userId === where.userId)),
      ),
    },
    childNote: {
      create: vi.fn(({ data }: { data: StoredChildNoteCreateInput }) => {
        const minute = String(notes.length).padStart(2, '0');
        const rowNumber = String(notes.length + 1);
        const now = new Date(`2026-04-30T10:${minute}:00.000Z`);
        const row: StoredChildNote = {
          id: `note_${rowNumber}`,
          createdAt: now,
          deletedAt: null,
          deletedById: null,
          headCommentEnc: null,
          seenAt: null,
          seenById: null,
          updatedAt: now,
          ...data,
        };
        notes.push(row);
        return Promise.resolve(row);
      }),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const note = notes.find((candidate) => candidate.id === where.id);
        if (!note) return Promise.resolve(null);
        return Promise.resolve({
          ...note,
          createdBy: users.find((user) => user.id === note.createdById) ?? users[0],
        });
      }),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Partial<StoredChildNote> }) => {
          const note = notes.find((candidate) => candidate.id === where.id);
          if (!note) return Promise.reject(new Error('Record not found'));
          Object.assign(note, data, { updatedAt: new Date('2026-04-30T11:00:00.000Z') });
          return Promise.resolve(note);
        },
      ),
      findMany: vi.fn(({ where }: { where: ChildNoteWhere; include?: { createdBy?: unknown } }) => {
        const rows = notes.filter((note) => {
          if (where.studentId && !matchesStudentId(where.studentId, note.studentId)) return false;
          if (where.createdById && note.createdById !== where.createdById) return false;
          if (
            where.createdBy &&
            !where.createdBy.role.in.includes(
              users.find((user) => user.id === note.createdById)?.role ?? '',
            )
          ) {
            return false;
          }
          if (
            where.OR &&
            !where.OR.some((condition) => {
              if (condition.createdById && note.createdById !== condition.createdById) {
                return false;
              }
              if (
                condition.createdBy &&
                !condition.createdBy.role.in.includes(
                  users.find((user) => user.id === note.createdById)?.role ?? '',
                )
              ) {
                return false;
              }
              return true;
            })
          ) {
            return false;
          }
          if (where.deletedAt === null && note.deletedAt !== null) return false;
          if (where.sensitive === true && !note.sensitive) return false;
          if (where.sensitive === false && note.sensitive) return false;
          if (where.createdAt) {
            return note.createdAt >= where.createdAt.gte && note.createdAt < where.createdAt.lt;
          }
          return true;
        });
        return Promise.resolve(
          rows.map((note) => ({
            ...note,
            createdBy: users.find((user) => user.id === note.createdById) ?? users[0],
            seenBy: note.seenById
              ? (users.find((user) => user.id === note.seenById) ?? null)
              : null,
            student: students.find((student) => student.id === note.studentId) ?? students[0],
          })),
        );
      }),
    },
    attendance: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            studentId?: string | { in: string[] };
            date?: { gte: Date; lt: Date };
          };
        } = {}) => {
          return Promise.resolve(
            attendanceRows
              .filter(
                (row) =>
                  where?.studentId === undefined ||
                  matchesStudentId(where.studentId, row.studentId),
              )
              .filter(
                (row) =>
                  where?.date === undefined ||
                  (row.date >= where.date.gte && row.date < where.date.lt),
              ),
          );
        },
      ),
    },
    calendarEvent: {
      findMany: vi.fn(({ where, take }: CalendarEventFindManyInput = {}) => {
        const rows = calendarEvents.filter((event) => {
          if (where?.active !== undefined && event.active !== where.active) return false;
          if (where?.audience && !where.audience.in.includes(event.audience)) return false;
          if (where?.category && event.category !== where.category) return false;
          if (where?.startDate && event.startDate > where.startDate.lte) return false;
          if (where?.endDate && event.endDate < where.endDate.gte) return false;
          return true;
        });
        return Promise.resolve(take === undefined ? rows : rows.slice(0, take));
      }),
    },
    pacePolicy: { findUnique: vi.fn(() => Promise.resolve({ passThreshold: 80 })) },
    meritLedger: {
      aggregate: vi.fn(({ where }: { where: { studentId: string } }) =>
        Promise.resolve({ _sum: { delta: where.studentId === 'student_1' ? 17 : 0 } }),
      ),
      groupBy: vi.fn(() =>
        Promise.resolve([
          { studentId: 'student_1', account: 'Spend', _sum: { delta: 10 } },
          { studentId: 'student_1', account: 'Saving', _sum: { delta: 5 } },
          { studentId: 'student_1', account: 'Investment', _sum: { delta: 2 } },
        ]),
      ),
    },
    titheConfig: {
      findMany: vi.fn(() => Promise.resolve([{ studentId: 'student_1', percentage: 15 }])),
    },
    paceRecord: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            studentId?: string | { in: string[] };
            completedAt?: { gte: Date; lt: Date };
          };
        } = {}) => {
          return Promise.resolve(
            paceRecordRows
              .filter(
                (row) =>
                  where?.studentId === undefined ||
                  matchesStudentId(where.studentId, row.studentId),
              )
              .filter(
                (row) =>
                  where?.completedAt === undefined ||
                  (row.completedAt >= where.completedAt.gte &&
                    row.completedAt < where.completedAt.lt),
              ),
          );
        },
      ),
    },
    paceProgress: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            OR?: Array<{ paceNumber: number; studentId: string; subjectId: string }>;
            completedAt?: { gte: Date; lt: Date };
            studentId?: string | { in: string[] };
          };
        } = {}) => {
          return Promise.resolve(
            paceProgressRows
              .filter(
                (row) =>
                  where?.studentId === undefined ||
                  matchesStudentId(where.studentId, row.studentId),
              )
              .filter(
                (row) =>
                  where?.completedAt === undefined ||
                  (row.completedAt !== null &&
                    row.completedAt >= where.completedAt.gte &&
                    row.completedAt < where.completedAt.lt),
              )
              .filter(
                (row) =>
                  !where?.OR?.length ||
                  where.OR.some(
                    (candidate) =>
                      candidate.studentId === row.studentId &&
                      candidate.subjectId === row.subjectId &&
                      candidate.paceNumber === row.paceNumber,
                  ),
              ),
          );
        },
      ),
    },
    behaviourEntry: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const row = behaviourEntries.find((entry) => entry.id === where.id);
        if (!row) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<{
            seenAt: Date;
            seenById: string;
            headCommentEnc: string | null;
          }>;
        }) => {
          const entry = behaviourEntries.find((candidate) => candidate.id === where.id);
          if (!entry) return Promise.reject(new Error('Record not found'));
          Object.assign(entry, data);
          return Promise.resolve(entry);
        },
      ),
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            OR?: Array<{
              recordedBy?: { role: { in: readonly string[] } };
              recordedById?: string;
              type?: string | { in: readonly string[] };
              visibility?: 'General' | 'Sensitive';
            }>;
            deletedAt?: null;
            recordedBy?: { role: { in: readonly string[] } };
            recordedById?: string;
            type?: string | { in: readonly string[] };
            visibility?: 'General' | 'Sensitive';
            createdAt?: { gte: Date; lt: Date };
            studentId?: string | { in: string[] };
          };
        }) => {
          return Promise.resolve(
            behaviourEntries
              .filter(
                (row) =>
                  where?.studentId === undefined ||
                  matchesStudentId(where.studentId, row.studentId),
              )
              .filter(
                (row) => where?.visibility === undefined || row.visibility === where.visibility,
              )
              .filter((row) => matchesBehaviourType(where?.type, row.type))
              .filter((row) => where?.deletedAt === undefined || row.deletedAt === where.deletedAt)
              .filter(
                (row) =>
                  where?.recordedById === undefined || row.recordedById === where.recordedById,
              )
              .filter(
                (row) =>
                  where?.recordedBy === undefined ||
                  where.recordedBy.role.in.includes(row.recordedBy?.role ?? ''),
              )
              .filter(
                (row) =>
                  where?.OR === undefined ||
                  where.OR.some(
                    (condition) =>
                      (condition.recordedById === undefined ||
                        row.recordedById === condition.recordedById) &&
                      (condition.recordedBy === undefined ||
                        condition.recordedBy.role.in.includes(row.recordedBy?.role ?? '')) &&
                      (condition.visibility === undefined ||
                        row.visibility === condition.visibility) &&
                      matchesBehaviourType(condition.type, row.type),
                  ),
              )
              .filter(
                (row) =>
                  where?.createdAt === undefined ||
                  (row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt),
              ),
          );
        },
      ),
    },
  };

  return { behaviourEntries, db, guardians, notes, staffShifts, students };
}

function makeCtx(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>['db']): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => fn(db as unknown as RlsTx),
  };
}

function makeCaller(user: SessionUser | null, db: ReturnType<typeof makeFakeDb>['db']) {
  const appRouter = router({ childNotes: childNotesRouter, childLog: childLogRouter });
  return appRouter.createCaller(makeCtx(user, db));
}

describe('childNotes', () => {
  it('creates encrypted notes and filters sensitive notes by full-admin or tag', async () => {
    const { db, notes } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'General note',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Sensitive note',
      sensitive: true,
    });

    expect(notes.map((note) => note.noteEnc)).toEqual(['enc:General note', 'enc:Sensitive note']);
    expect(notes[0]?.createdById).toBe(supervisorUser.id);

    await expect(
      makeCaller(parentUser, db).childNotes.create({ studentId: 'student_1', note: 'x' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    await expect(
      makeCaller(supervisorUser, db).childNotes.listForStudent({ studentId: 'student_1' }),
    ).resolves.toMatchObject({
      notes: [{ note: 'General note', sensitive: false }],
    });
    const headNotes = await makeCaller(headUser, db).childNotes.listForStudent({
      studentId: 'student_1',
    });
    expect(headNotes.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'Sensitive note', sensitive: true }),
        expect.objectContaining({ note: 'General note', sensitive: false }),
      ]),
    );
    const principalNotes = await makeCaller(principalUser, db).childNotes.listForStudent({
      studentId: 'student_1',
    });
    expect(principalNotes.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'Sensitive note', sensitive: true }),
        expect.objectContaining({ note: 'General note', sensitive: false }),
      ]),
    );
    const taggedNotes = await makeCaller(sensitiveViewerUser, db).childNotes.listForStudent({
      studentId: 'student_1',
    });
    expect(taggedNotes.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'Sensitive note', sensitive: true }),
        expect.objectContaining({ note: 'General note', sensitive: false }),
      ]),
    );
  });

  it('lets full-admin edit and soft-delete child notes', async () => {
    const { db, notes } = makeFakeDb();
    const created = await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Original note',
      sensitive: false,
    });

    await expect(
      makeCaller(headUser, db).childNotes.update({
        id: created.id,
        note: 'Updated note',
        sensitive: true,
      }),
    ).resolves.toMatchObject({ id: created.id, sensitive: true });
    expect(notes[0]).toMatchObject({ noteEnc: 'enc:Updated note', sensitive: true });

    await expect(
      makeCaller(headUser, db).childNotes.delete({ id: created.id }),
    ).resolves.toMatchObject({
      id: created.id,
      studentId: 'student_1',
    });
    expect(notes[0]?.deletedById).toBe(headUser.id);
    await expect(
      makeCaller(headUser, db).childNotes.listForStudent({ studentId: 'student_1' }),
    ).resolves.toMatchObject({ notes: [] });
  });

  it('denies child note corrections to non-full-admin users', async () => {
    const { db } = makeFakeDb();
    const created = await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Original note',
      sensitive: false,
    });

    await expect(
      makeCaller(supervisorUser, db).childNotes.update({
        id: created.id,
        note: 'Updated note',
        sensitive: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(parentUser, db).childNotes.delete({ id: created.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('childLog.snapshot', () => {
  it('returns attendance, passed tests, behaviour, and visible notes for the range', async () => {
    const { db } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Visible note',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Hidden note',
      sensitive: true,
    });

    const snapshot = await makeCaller(supervisorUser, db).childLog.snapshot({
      studentId: 'student_1',
      from: day('2026-04-29'),
      to: day('2026-04-30'),
    });

    expect(snapshot.tardiness).toHaveLength(1);
    expect(snapshot.passedTests).toMatchObject([{ subjectCode: 'MATH', score: 90 }]);
    expect(snapshot.behaviour).toMatchObject([
      { type: 'Merit', meritDelta: 3, note: 'Focused well', recordedByName: 'Supervisor User' },
    ]);
    expect(snapshot.notes).toMatchObject([{ note: 'Visible note', sensitive: false }]);
    expect(snapshot.student).toMatchObject({ supervisorName: 'Supervisor User', totalMerits: 17 });
  });

  it('lists all active snapshot students for full-admin users', async () => {
    const { db, students } = makeFakeDb();
    students.push(makeOutOfBandStudent());
    students.push({
      ...makeOutOfBandStudent(),
      id: 'student_archived',
      active: false,
      fullNameEnc: 'enc:Archived Learner',
    });

    await expect(makeCaller(headUser, db).childLog.listSnapshotStudents()).resolves.toMatchObject([
      { id: 'student_1', fullName: 'Jane Learner', yearGroup: 'Year 6' },
      { id: 'student_2', fullName: 'Secondary Learner', yearGroup: 'Year 9' },
    ]);
  });

  it("lists only today's assigned band students for Supervisors", async () => {
    const { db, students } = makeFakeDb();
    students.push(makeOutOfBandStudent());

    await expect(
      makeCaller(supervisorUser, db).childLog.listSnapshotStudents(),
    ).resolves.toMatchObject([{ id: 'student_1', fullName: 'Jane Learner', yearGroup: 'Year 6' }]);
    await expect(
      makeCaller(taggedSupervisorUser, db).childLog.listSnapshotStudents(),
    ).resolves.toMatchObject([{ id: 'student_1', fullName: 'Jane Learner', yearGroup: 'Year 6' }]);
    await expect(
      makeCaller(allStudentsSupervisorUser, db).childLog.listSnapshotStudents(),
    ).resolves.toMatchObject([
      { id: 'student_1', fullName: 'Jane Learner', yearGroup: 'Year 6' },
      { id: 'student_2', fullName: 'Secondary Learner', yearGroup: 'Year 9' },
    ]);
  });

  it('returns no snapshot picker students when a Supervisor has no shift today', async () => {
    const { db, staffShifts } = makeFakeDb();
    staffShifts.length = 0;

    await expect(makeCaller(supervisorUser, db).childLog.listSnapshotStudents()).resolves.toEqual(
      [],
    );
  });

  it('blocks Supervisor direct snapshot access outside their assigned band', async () => {
    const { db, students } = makeFakeDb();
    students.push(makeOutOfBandStudent());

    await expect(
      makeCaller(supervisorUser, db).childLog.snapshot({
        studentId: 'student_2',
        from: day('2026-04-29'),
        to: day('2026-04-30'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'PermissionDenied',
        entity: 'childLog.snapshot',
        meta: {
          assignedBands: ['band_lower'],
          date: '2026-04-30',
          reason: 'Access denied: student is outside supervisor assigned year band',
          role: 'Supervisor',
          studentId: 'student_2',
          studentYearGroup: 'Year 9',
        },
        userId: supervisorUser.id,
      },
    });
  });

  it('allows full-admin direct snapshot access outside Supervisor bands', async () => {
    const { db, students } = makeFakeDb();
    students.push(makeOutOfBandStudent());

    await expect(
      makeCaller(headUser, db).childLog.snapshot({
        studentId: 'student_2',
        from: day('2026-04-29'),
        to: day('2026-04-30'),
      }),
    ).resolves.toMatchObject({
      student: { id: 'student_2', fullName: 'Secondary Learner', yearGroup: 'Year 9' },
    });
  });

  it('allows tagged Supervisors to open individual snapshots outside their assigned bands', async () => {
    const { db, students } = makeFakeDb();
    students.push(makeOutOfBandStudent());

    await expect(
      makeCaller(allStudentsSupervisorUser, db).childLog.snapshot({
        studentId: 'student_2',
        from: day('2026-04-29'),
        to: day('2026-04-30'),
      }),
    ).resolves.toMatchObject({
      student: { id: 'student_2', fullName: 'Secondary Learner', yearGroup: 'Year 9' },
    });
  });

  it('returns a full-admin centre snapshot for today across active students', async () => {
    const { behaviourEntries, db, students } = makeFakeDb();
    students.push(makeOutOfBandStudent());
    students.push({
      ...makeOutOfBandStudent(),
      id: 'student_archived',
      active: false,
      fullNameEnc: 'enc:Archived Learner',
    });
    await makeCaller(headUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Visible centre note',
      sensitive: false,
    });
    await makeCaller(headUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Sensitive centre note',
      sensitive: true,
    });
    behaviourEntries.push({
      id: 'behaviour_today',
      studentId: 'student_1',
      type: 'Merit',
      category: 'Scripture Memory',
      visibility: 'General',
      meritDelta: 5,
      recordedById: headUser.id,
      createdAt: day('2026-04-30'),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: 'enc:Today centre merit',
      recordedBy: { id: headUser.id, fullNameEnc: 'enc:Head User', role: headUser.role },
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: students[0],
    });

    const snapshot = await makeCaller(headUser, db).childLog.centreSnapshot({
      from: day('2026-04-30'),
      to: day('2026-04-30'),
    });

    expect(snapshot.summary).toMatchObject({
      activeStudentCount: 2,
      behaviourCount: 1,
      meritsEarned: 5,
      netMerits: 5,
      notesCount: 2,
      paceCount: 0,
    });
    expect(snapshot.students.map((row) => row.student.id)).toEqual(['student_1', 'student_2']);
    expect(snapshot.notes).toMatchObject([
      { note: 'Visible centre note', sensitive: false, student: { id: 'student_1' } },
      { note: 'Sensitive centre note', sensitive: true, student: { id: 'student_1' } },
    ]);
    expect(snapshot.behaviour).toMatchObject([
      {
        category: 'Scripture Memory',
        meritDelta: 5,
        note: 'Today centre merit',
        student: { id: 'student_1' },
      },
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'ReadSensitive',
        entity: 'ChildNote',
        meta: {
          count: 1,
          source: 'childLog.centreSnapshot',
        },
        userId: headUser.id,
      },
    });
  });

  it('filters centre snapshot activity by the selected range', async () => {
    const { db } = makeFakeDb();
    await makeCaller(headUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Today only note',
      sensitive: false,
    });

    const snapshot = await makeCaller(headUser, db).childLog.centreSnapshot({
      from: day('2026-04-29'),
      to: day('2026-04-29'),
    });

    expect(snapshot.summary).toMatchObject({
      activeStudentCount: 1,
      attendance: { late: 1, recorded: 1 },
      behaviourCount: 2,
      notesCount: 0,
      paceCount: 1,
    });
    expect(snapshot.behaviour).toHaveLength(2);
    expect(snapshot.passedTests).toMatchObject([{ subjectCode: 'MATH', score: 90 }]);
    expect(snapshot.notes).toEqual([]);
  });

  it('blocks Supervisors from centre snapshot access', async () => {
    const { db } = makeFakeDb();

    await expect(
      makeCaller(supervisorUser, db).childLog.centreSnapshot({
        from: day('2026-04-30'),
        to: day('2026-04-30'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'PermissionDenied',
        entity: 'childLog.centreSnapshot',
        meta: {
          reason: 'Access denied: centre snapshot requires full-admin access',
          role: 'Supervisor',
        },
        userId: supervisorUser.id,
      },
    });

    await expect(
      makeCaller(allStudentsSupervisorUser, db).childLog.centreSnapshot({
        from: day('2026-04-30'),
        to: day('2026-04-30'),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks Supervisor child notes outside their assigned band', async () => {
    const { db, students } = makeFakeDb();
    students.push(makeOutOfBandStudent());

    await makeCaller(headUser, db).childNotes.create({
      studentId: 'student_2',
      note: 'Full-admin note',
    });
    await expect(
      makeCaller(supervisorUser, db).childNotes.create({
        studentId: 'student_2',
        note: 'Out-of-band note',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(supervisorUser, db).childNotes.listForStudent({ studentId: 'student_2' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      makeCaller(allStudentsSupervisorUser, db).childNotes.create({
        studentId: 'student_2',
        note: 'All-student supervisor note',
      }),
    ).resolves.toMatchObject({ studentId: 'student_2', createdById: allStudentsSupervisorUser.id });

    const allStudentSupervisorNotes = await makeCaller(
      allStudentsSupervisorUser,
      db,
    ).childNotes.listForStudent({ studentId: 'student_2' });
    expect(allStudentSupervisorNotes.studentId).toBe('student_2');
    expect(allStudentSupervisorNotes.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          note: 'All-student supervisor note',
          createdById: allStudentsSupervisorUser.id,
        }),
      ]),
    );
  });

  it('lists only accessible students for linked adult accounts', async () => {
    const { db, guardians } = makeFakeDb();
    await expect(
      makeCaller(parentUser, db).childLog.listAccessibleStudents(),
    ).resolves.toMatchObject([{ id: 'student_1', fullName: 'Jane Learner', yearGroup: 'Year 6' }]);
    guardians.push({
      id: 'guardian_support',
      userId: technicalSupportUser.id,
      studentId: 'student_1',
      student: guardians[0]?.student,
      createdAt: day('2024-09-01'),
    });
    await expect(
      makeCaller(technicalSupportUser, db).childLog.listAccessibleStudents(),
    ).resolves.toMatchObject([{ id: 'student_1', fullName: 'Jane Learner', yearGroup: 'Year 6' }]);
    await expect(
      makeCaller(unlinkedParentUser, db).childLog.listAccessibleStudents(),
    ).resolves.toEqual([]);
  });

  it('returns a scoped parent dashboard for linked active children only', async () => {
    const { behaviourEntries, db } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Parent-visible note',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Parent-hidden note',
      sensitive: true,
    });
    behaviourEntries.push({
      id: 'behaviour_3',
      studentId: 'student_1',
      type: 'General',
      category: 'Misc',
      visibility: 'General',
      meritDelta: 0,
      recordedById: supervisorUser.id,
      createdAt: day('2026-04-29'),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: 'enc:Parent-visible general update',
      recordedBy: {
        id: supervisorUser.id,
        fullNameEnc: 'enc:Supervisor User',
        role: 'Supervisor',
      },
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: undefined,
    });

    const dashboard = await makeCaller(parentUser, db).childLog.parentDashboard();

    expect(dashboard.children).toHaveLength(1);
    expect(dashboard.children[0]).toMatchObject({
      student: { id: 'student_1', fullName: 'Jane Learner', active: true },
      metrics: {
        attendanceRate: 0,
        pacesCompletedThisAcademicYear: 2,
        tithePercentage: 15,
        totalMerits: 17,
      },
      attendance: [{ status: 'Late', date: '2026-04-29' }],
      behaviour: [
        {
          type: 'Merit',
          category: 'Focus',
          note: 'Focused well',
          meritDelta: 3,
        },
        {
          type: 'General',
          category: 'Misc',
          note: 'Parent-visible general update',
          meritDelta: 0,
        },
      ],
      notes: [{ note: 'Parent-visible note' }],
      pace: [
        { subjectCode: 'MATH', score: 90, passed: true, testType: 'PACE Test' },
        { subjectCode: 'MATH', score: 100, passed: true, testType: 'Self-Test' },
        { subjectCode: 'MATH', score: 75, passed: false, testType: 'PACE Test' },
      ],
    });
    expect(dashboard.children[0]?.behaviour).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ note: 'Sensitive behaviour' })]),
    );
    expect(dashboard.children[0]?.notes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ note: 'Parent-hidden note' })]),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: parentUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 1, source: 'childLog.parentDashboard' },
      },
    });
  });

  it.each(['Present', 'Late', 'Absent'] as const)(
    'returns today attendance status %s on an Oasis operating day',
    async (status) => {
      const { db } = makeFakeDb({
        attendanceRows: [
          {
            id: 'att_today',
            studentId: 'student_1',
            date: today,
            status,
            recordedById: headUser.id,
            createdAt: today,
          },
        ],
      });

      const dashboard = await makeCaller(parentUser, db).childLog.parentDashboard();

      expect(dashboard.children[0]?.todayStatus).toEqual({
        date: '2026-04-30',
        kind: 'attendance',
        label: status,
      });
    },
  );

  it('returns closed on non-operating days before attendance status', async () => {
    const monday = day('2026-05-04');
    vi.setSystemTime(monday);
    const { db } = makeFakeDb({
      attendanceRows: [
        {
          id: 'att_monday',
          studentId: 'student_1',
          date: monday,
          status: 'Present',
          recordedById: headUser.id,
          createdAt: monday,
        },
      ],
    });

    const dashboard = await makeCaller(parentUser, db).childLog.parentDashboard();

    expect(dashboard.children[0]?.todayStatus).toEqual({
      date: '2026-05-04',
      kind: 'closed',
      label: 'Closed',
    });
  });

  it('returns half term before attendance status when today has a parent-visible HalfTerm event', async () => {
    const { db } = makeFakeDb({
      attendanceRows: [
        {
          id: 'att_today',
          studentId: 'student_1',
          date: today,
          status: 'Present',
          recordedById: headUser.id,
          createdAt: today,
        },
      ],
      calendarEvents: [
        {
          id: 'half_term',
          active: true,
          audience: 'Parents',
          category: 'HalfTerm',
          startDate: day('2026-04-29'),
          endDate: day('2026-05-01'),
        },
      ],
    });

    const dashboard = await makeCaller(parentUser, db).childLog.parentDashboard();

    expect(dashboard.children[0]?.todayStatus).toEqual({
      date: '2026-04-30',
      kind: 'halfTerm',
      label: 'Half Term',
    });
  });

  it('returns no mark on operating days without today attendance', async () => {
    const { db } = makeFakeDb();

    const dashboard = await makeCaller(parentUser, db).childLog.parentDashboard();

    expect(dashboard.children[0]?.todayStatus).toEqual({
      date: '2026-04-30',
      kind: 'unmarked',
      label: 'No mark',
    });
  });

  it('returns an empty parent dashboard for unlinked parents and denies unsupported users', async () => {
    const { db } = makeFakeDb();

    const unlinkedDashboard = await makeCaller(unlinkedParentUser, db).childLog.parentDashboard();
    expect(unlinkedDashboard.children).toEqual([]);
    expect(typeof unlinkedDashboard.range.from).toBe('string');
    expect(typeof unlinkedDashboard.range.to).toBe('string');
    await expect(makeCaller(studentUser, db).childLog.parentDashboard()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('can limit full-admin child lists to linked children', async () => {
    const { db, guardians, students } = makeFakeDb();
    const linkedStudent = students[0];
    if (!linkedStudent) throw new Error('test fixture missing linked student');
    students.push({
      id: 'student_2',
      active: true,
      fullNameEnc: 'enc:Unlinked Learner',
      yearGroup: 'Year 7',
      enrolmentDate: day('2024-09-01'),
      createdAt: day('2024-09-01'),
      subjects: [],
    });
    guardians.push({
      id: 'guardian_head',
      userId: headUser.id,
      studentId: 'student_1',
      student: linkedStudent,
      createdAt: day('2024-09-01'),
    });

    await expect(makeCaller(headUser, db).childLog.listAccessibleStudents()).resolves.toHaveLength(
      2,
    );
    await expect(
      makeCaller(headUser, db).childLog.listAccessibleStudents({ linkedOnly: true }),
    ).resolves.toMatchObject([{ id: 'student_1', fullName: 'Jane Learner' }]);
  });

  it('returns drill-through data and sensitive behaviour to full admins', async () => {
    const { db } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'General drill-through note',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Sensitive drill-through note',
      sensitive: true,
    });

    const headView = await makeCaller(headUser, db).childLog.drillThrough({
      studentId: 'student_1',
    });
    expect(headView.metrics.meritBalances).toEqual({
      Spend: 10,
      Saving: 5,
      Investment: 2,
      ShopReserved: 0,
    });
    expect(headView.metrics.pacesCompletedThisAcademicYear).toBe(2);
    expect(headView.behaviour).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ visibility: 'General', note: 'Focused well' }),
        expect.objectContaining({ visibility: 'Sensitive', note: 'Sensitive behaviour' }),
      ]),
    );
    expect(headView.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'General drill-through note', sensitive: false }),
        expect.objectContaining({ note: 'Sensitive drill-through note', sensitive: true }),
      ]),
    );

    const principalView = await makeCaller(principalUser, db).childLog.drillThrough({
      studentId: 'student_1',
    });
    expect(principalView.behaviour).toEqual(headView.behaviour);
    expect(principalView.notes).toEqual(headView.notes);

    const taggedSensitiveView = await makeCaller(sensitiveViewerUser, db).childLog.drillThrough({
      studentId: 'student_1',
    });
    expect(taggedSensitiveView.behaviour).toEqual([
      expect.objectContaining({ visibility: 'General', note: 'Focused well' }),
    ]);
    expect(taggedSensitiveView.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: 'General drill-through note', sensitive: false }),
        expect.objectContaining({ note: 'Sensitive drill-through note', sensitive: true }),
      ]),
    );
  });

  it('allows tagged staff and linked adult accounts, and denies unlinked users', async () => {
    const { db, guardians } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Parent-visible note',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Parent-hidden note',
      sensitive: true,
    });

    await expect(
      makeCaller(taggedSupervisorUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).resolves.toMatchObject({ student: { id: 'student_1', fullName: 'Jane Learner' } });
    const parentView = await makeCaller(parentUser, db).childLog.drillThrough({
      studentId: 'student_1',
    });
    expect(parentView).toMatchObject({ student: { id: 'student_1', fullName: 'Jane Learner' } });
    expect(parentView.notes).toEqual([
      expect.objectContaining({ note: 'Parent-visible note', sensitive: false }),
    ]);
    guardians.push({
      id: 'guardian_support',
      userId: technicalSupportUser.id,
      studentId: 'student_1',
      student: guardians[0]?.student,
      createdAt: day('2024-09-01'),
    });
    await expect(
      makeCaller(technicalSupportUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).resolves.toMatchObject({ student: { id: 'student_1', fullName: 'Jane Learner' } });
    await expect(
      makeCaller(supervisorUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      makeCaller(unlinkedParentUser, db).childLog.drillThrough({ studentId: 'student_1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns a parent-safe daily discipline tracker that resets by the current day', async () => {
    const { behaviourEntries, db } = makeFakeDb();
    behaviourEntries.push(
      {
        id: 'behaviour_today_1',
        studentId: 'student_1',
        type: 'Demerit',
        category: 'Conduct',
        visibility: 'General',
        meritDelta: -1,
        recordedById: supervisorUser.id,
        createdAt: day('2026-04-30'),
        deletedAt: null,
        headCommentEnc: null,
        noteEnc: 'enc:Talking during study time',
        recordedBy: {
          id: supervisorUser.id,
          fullNameEnc: 'enc:Supervisor User',
          role: 'Supervisor',
        },
        seenAt: null,
        seenBy: null,
        seenById: null,
        student: undefined,
      },
      {
        id: 'behaviour_today_2',
        studentId: 'student_1',
        type: 'Demerit',
        category: 'Honesty',
        visibility: 'General',
        meritDelta: -2,
        recordedById: supervisorUser.id,
        createdAt: day('2026-04-30'),
        deletedAt: null,
        headCommentEnc: null,
        noteEnc: 'enc:Misleading answer corrected',
        recordedBy: {
          id: supervisorUser.id,
          fullNameEnc: 'enc:Supervisor User',
          role: 'Supervisor',
        },
        seenAt: null,
        seenBy: null,
        seenById: null,
        student: undefined,
      },
      {
        id: 'behaviour_today_sensitive',
        studentId: 'student_1',
        type: 'Demerit',
        category: 'Pastoral',
        visibility: 'Sensitive',
        meritDelta: -1,
        recordedById: headUser.id,
        createdAt: day('2026-04-30'),
        deletedAt: null,
        headCommentEnc: null,
        noteEnc: 'enc:Parent-hidden context',
        recordedBy: { id: headUser.id, fullNameEnc: 'enc:Head User', role: 'Head' },
        seenAt: null,
        seenBy: null,
        seenById: null,
        student: undefined,
      },
    );

    const parentView = await makeCaller(parentUser, db).childLog.drillThrough({
      studentId: 'student_1',
    });

    expect(parentView.discipline).toMatchObject({
      date: '2026-04-30',
      status: {
        demeritUnits: 3,
        stage: 2,
        stageLabel: 'Stage 2 - Reflection',
      },
    });
    expect(parentView.discipline.demerits).toEqual([
      expect.objectContaining({ id: 'behaviour_today_1', note: 'Talking during study time' }),
      expect.objectContaining({ id: 'behaviour_today_2', note: 'Misleading answer corrected' }),
    ]);
    expect(parentView.discipline.demerits.map((entry) => entry.id)).not.toContain(
      'behaviour_today_sensitive',
    );
    expect(parentView.discipline.demerits.map((entry) => entry.id)).not.toContain('behaviour_2');
  });

  it('lets Head review supervisor sensitive notes and marks with optional comments', async () => {
    const { behaviourEntries, db, notes, students } = makeFakeDb();
    const note = await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Sensitive family context',
      sensitive: true,
    });
    const mark = {
      id: 'behaviour_supervisor_sensitive',
      studentId: 'student_1',
      type: 'Demerit',
      category: 'Pastoral',
      visibility: 'Sensitive',
      meritDelta: -5,
      recordedById: supervisorUser.id,
      createdAt: day('2026-04-30'),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: 'enc:Sensitive demerit',
      recordedBy: { id: supervisorUser.id, fullNameEnc: 'enc:Supervisor User', role: 'Supervisor' },
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: students[0],
    } as (typeof behaviourEntries)[number];
    behaviourEntries.push(mark);

    const queue = await makeCaller(headUser, db).childLog.sensitiveReviewQueue();
    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: note.id, kind: 'note', body: 'Sensitive family context' }),
        expect.objectContaining({
          id: 'behaviour_supervisor_sensitive',
          kind: 'mark',
          body: 'Sensitive demerit',
          type: 'Demerit',
        }),
      ]),
    );

    await expect(
      makeCaller(headUser, db).childLog.reviewSensitiveItem({
        id: note.id,
        kind: 'note',
        comment: 'Thank you for flagging.',
      }),
    ).resolves.toMatchObject({ id: note.id, kind: 'note' });
    await expect(
      makeCaller(headUser, db).childLog.reviewSensitiveItem({
        id: 'behaviour_supervisor_sensitive',
        kind: 'mark',
      }),
    ).resolves.toMatchObject({ id: 'behaviour_supervisor_sensitive', kind: 'mark' });

    expect(notes[0]).toMatchObject({
      seenById: headUser.id,
      headCommentEnc: 'enc:Thank you for flagging.',
    });
    expect(mark).toMatchObject({ seenById: headUser.id, headCommentEnc: null });
  });

  it('includes Stage 4, Stage 5, and Serious Misconduct demerits in Head/HOD review', async () => {
    const { behaviourEntries, db, students } = makeFakeDb();
    const makePolicyDemerit = (
      index: number,
      input: Partial<StoredBehaviourEntry> = {},
    ): StoredBehaviourEntry => ({
      id: `behaviour_policy_${String(index)}`,
      studentId: 'student_1',
      type: 'Demerit',
      category: 'Conduct',
      visibility: 'General',
      meritDelta: -5,
      recordedById: headUser.id,
      createdAt: new Date(`2026-04-30T10:${String(index).padStart(2, '0')}:00.000Z`),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: null,
      recordedBy: { id: headUser.id, fullNameEnc: 'enc:Head User', role: headUser.role },
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: students[0],
      ...input,
    });
    behaviourEntries.push(
      ...Array.from({ length: 9 }, (_, index) => makePolicyDemerit(index + 1)),
      makePolicyDemerit(30, {
        id: 'behaviour_policy_serious',
        category: 'Serious Misconduct',
      }),
    );

    const queue = await makeCaller(hodUser, db).childLog.sensitiveReviewQueue();

    expect(queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'behaviour_policy_7',
          kind: 'mark',
          reviewReason: 'Policy escalation',
        }),
        expect.objectContaining({
          id: 'behaviour_policy_9',
          kind: 'mark',
          reviewReason: 'Policy escalation',
        }),
        expect.objectContaining({
          id: 'behaviour_policy_serious',
          kind: 'mark',
          category: 'Serious Misconduct',
          reviewReason: 'Policy escalation',
        }),
      ]),
    );
    expect(queue).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'behaviour_policy_6' })]),
    );

    await expect(
      makeCaller(headUser, db).childLog.reviewSensitiveItem({
        id: 'behaviour_policy_7',
        kind: 'mark',
        comment: 'Seen by Head.',
      }),
    ).resolves.toMatchObject({ id: 'behaviour_policy_7', kind: 'mark' });

    const reviewedQueue = await makeCaller(headUser, db).childLog.sensitiveReviewQueue();
    const reviewedEscalation = reviewedQueue.find(
      (item) => item.kind === 'mark' && item.id === 'behaviour_policy_7',
    );
    expect(reviewedEscalation?.seenAt).toBeInstanceOf(Date);
    expect(reviewedEscalation?.headComment).toBe('Seen by Head.');
    expect(
      reviewedQueue
        .filter(
          (item) =>
            item.kind === 'mark' &&
            item.reviewReason === 'Policy escalation' &&
            item.seenAt === null,
        )
        .map((item) => item.id),
    ).not.toContain('behaviour_policy_7');
  });

  it('returns supervisor history with all authored notes and only sensitive authored marks', async () => {
    const { behaviourEntries, db, students } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'General observation',
      sensitive: false,
    });
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Sensitive observation',
      sensitive: true,
    });
    behaviourEntries.push({
      id: 'behaviour_supervisor_sensitive_history',
      studentId: 'student_1',
      type: 'General',
      category: 'Misc',
      visibility: 'Sensitive',
      meritDelta: 0,
      recordedById: supervisorUser.id,
      createdAt: day('2026-04-30'),
      deletedAt: null,
      headCommentEnc: 'enc:Reviewed.',
      noteEnc: 'enc:Sensitive mark',
      recordedBy: { id: supervisorUser.id, fullNameEnc: 'enc:Supervisor User', role: 'Supervisor' },
      seenAt: day('2026-04-30'),
      seenBy: { id: headUser.id, fullNameEnc: 'enc:Head User', role: 'Head' },
      seenById: headUser.id,
      student: students[0],
    });
    behaviourEntries.push({
      id: 'behaviour_supervisor_sensitive_demerit_history',
      studentId: 'student_1',
      type: 'Demerit',
      category: 'Pastoral',
      visibility: 'Sensitive',
      meritDelta: -5,
      recordedById: supervisorUser.id,
      createdAt: day('2026-04-30'),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: 'enc:Sensitive demerit',
      recordedBy: { id: supervisorUser.id, fullNameEnc: 'enc:Supervisor User', role: 'Supervisor' },
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: students[0],
    });

    const history = await makeCaller(supervisorUser, db).childLog.supervisorNotesHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'note', body: 'General observation', sensitive: false }),
        expect.objectContaining({ kind: 'note', body: 'Sensitive observation', sensitive: true }),
        expect.objectContaining({
          id: 'behaviour_supervisor_sensitive_history',
          kind: 'mark',
          body: 'Sensitive mark',
          headComment: 'Reviewed.',
        }),
        expect.objectContaining({
          id: 'behaviour_supervisor_sensitive_demerit_history',
          kind: 'mark',
          body: 'Sensitive demerit',
          type: 'Demerit',
          sensitive: true,
        }),
      ]),
    );
    expect(history[0]?.notes).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ body: 'Focused well' })]),
    );
    const sensitiveMark = history[0]?.notes.find(
      (item) => item.id === 'behaviour_supervisor_sensitive_history',
    );
    const sensitiveDemerit = history[0]?.notes.find(
      (item) => item.id === 'behaviour_supervisor_sensitive_demerit_history',
    );
    expect(sensitiveMark?.author).toMatchObject({
      fullName: 'Supervisor User',
      role: 'Supervisor',
    });
    expect(sensitiveDemerit?.author).toMatchObject({
      fullName: 'Supervisor User',
      role: 'Supervisor',
    });
  });

  it('lets Head see supervisor-authored notes history and Head-authored test entries', async () => {
    const { behaviourEntries, db, students } = makeFakeDb();
    await makeCaller(supervisorUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Supervisor note for Head review',
      sensitive: false,
    });
    await makeCaller(headUser, db).childNotes.create({
      studentId: 'student_1',
      note: 'Head note for local check',
      sensitive: false,
    });
    behaviourEntries.push({
      id: 'behaviour_supervisor_sensitive_history_for_head',
      studentId: 'student_1',
      type: 'Demerit',
      category: 'Pastoral',
      visibility: 'Sensitive',
      meritDelta: -5,
      recordedById: supervisorUser.id,
      createdAt: day('2026-04-30'),
      deletedAt: null,
      headCommentEnc: null,
      noteEnc: 'enc:Supervisor sensitive demerit for Head',
      recordedBy: { id: supervisorUser.id, fullNameEnc: 'enc:Supervisor User', role: 'Supervisor' },
      seenAt: null,
      seenBy: null,
      seenById: null,
      student: students[0],
    });

    const history = await makeCaller(headUser, db).childLog.supervisorNotesHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: 'Supervisor note for Head review',
        }),
        expect.objectContaining({
          body: 'Supervisor sensitive demerit for Head',
          type: 'Demerit',
        }),
      ]),
    );
    expect(history[0]?.notes).toEqual(
      expect.arrayContaining([expect.objectContaining({ body: 'Head note for local check' })]),
    );
    const supervisorItems =
      history[0]?.notes.filter((item) => item.author.role === 'Supervisor') ?? [];
    expect(supervisorItems.length).toBeGreaterThanOrEqual(2);
    for (const item of supervisorItems) {
      expect(item.author).toMatchObject({ fullName: 'Supervisor User', role: 'Supervisor' });
    }
  });
});
