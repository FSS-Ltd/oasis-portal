import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { Role, SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import type { EmailClient } from '../lib/email.js';
import { createClubRouter } from '../routers/club.js';
import { router } from '../trpc.js';

const headUser: SessionUser = {
  id: 'chead000000000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const clubsAdminUser: SessionUser = {
  id: 'cclubsadmin0000000001',
  role: 'ClubsAdmin',
  tags: [],
  requires2fa: false,
};
const clubsLeadUser: SessionUser = {
  id: 'cclubslead0000000001',
  role: 'ClubsLead',
  tags: [],
  requires2fa: false,
};
const parentUser: SessionUser = {
  id: 'cparent000000000000001',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const otherParentUser: SessionUser = {
  id: 'cparent000000000000002',
  role: 'Parent',
  tags: [],
  requires2fa: false,
};
const supervisorUser: SessionUser = {
  id: 'csupervisor00000000001',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};
const technicalSupportUser: SessionUser = {
  id: 'csupport0000000000001',
  role: 'TechnicalSupport',
  tags: [],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'cstudentuser0000000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

type ClubSignupStatus = 'Active' | 'Withdrawn';

interface StoredClub {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  scheduleStartDate: Date | null;
  scheduleStartMinute: number | null;
  scheduleEndMinute: number | null;
  scheduleFrequency: 'Weekly' | null;
  capacity: number | null;
  iconKey: string | null;
  accentColor: string | null;
  active: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredStudent {
  id: string;
  fullNameEnc: string;
  yearGroup: string;
  active: boolean;
}

interface StoredGuardian {
  userId: string;
  studentId: string;
}

interface StoredUser {
  id: string;
  role: Role;
  active: boolean;
  fullNameEnc: string;
  emailEnc: string;
}

interface StoredSignup {
  id: string;
  clubId: string;
  studentId: string;
  signedUpByUserId: string;
  status: ClubSignupStatus;
  createdAt: Date;
  withdrawnAt: Date | null;
}

interface StoredClubNotification {
  id: string;
  clubId: string;
  title: string;
  bodyEnc: string;
  sentById: string;
  sentAt: Date;
}

interface StoredLeadAssignment {
  id: string;
  clubId: string;
  userId: string;
  assignedById: string;
  createdAt: Date;
}

interface StoredClubAttendance {
  id: string;
  clubId: string;
  studentId: string;
  sessionDate: Date;
  status: 'Present' | 'Absent' | 'Late';
  recordedById: string;
  updatedAt: Date;
}

interface FakeClubFindManyArgs {
  where?: { active?: boolean };
  include?: FakeClubInclude;
}

interface FakeClubFindUniqueArgs {
  where: { id: string };
  include?: FakeClubInclude;
  select?: {
    active?: true;
    id?: true;
    leadAssignments?: object;
    name?: true;
    signups?: object;
  };
}

interface FakeClubInclude {
  signups?: {
    where?: { status?: ClubSignupStatus; student?: { active?: boolean } };
    select?: { studentId?: true };
    include?: { student?: { select: { id: true; fullNameEnc: true; yearGroup: true } } };
    orderBy?: { createdAt: 'desc' };
  };
  leadAssignments?: {
    orderBy?: { createdAt: 'asc' };
    select?: {
      user?: {
        select: {
          active?: true;
          emailEnc?: true;
          fullNameEnc?: true;
          id?: true;
        };
      };
    };
  };
}

interface FakeClubCreateArgs {
  data: {
    name: string;
    description: string | null;
    schedule: string | null;
    scheduleStartDate: Date | null;
    scheduleStartMinute: number | null;
    scheduleEndMinute: number | null;
    scheduleFrequency: 'Weekly' | null;
    capacity: number | null;
    iconKey: string | null;
    accentColor: string | null;
    active: boolean;
    createdById: string;
  };
  include: FakeClubInclude;
}

interface FakeClubUpdateArgs {
  where: { id: string };
  data: Partial<
    Pick<
      StoredClub,
      | 'name'
      | 'description'
      | 'schedule'
      | 'scheduleStartDate'
      | 'scheduleStartMinute'
      | 'scheduleEndMinute'
      | 'scheduleFrequency'
      | 'capacity'
      | 'iconKey'
      | 'accentColor'
      | 'active'
    >
  >;
  include: FakeClubInclude;
}

interface FakeSignupCreateArgs {
  data: {
    clubId: string;
    studentId: string;
    signedUpByUserId: string;
    status: ClubSignupStatus;
  };
}

interface FakeSignupFindFirstArgs {
  where: {
    clubId: string;
    studentId: string;
    status: ClubSignupStatus;
    student?: { active?: boolean };
  };
  select?: { id?: true };
}

interface FakeSignupUpdateArgs {
  where: { id: string };
  data: Pick<StoredSignup, 'status' | 'withdrawnAt'>;
}

interface FakeStudentFindUniqueArgs {
  where: { id: string };
}

interface FakeStudentFindManyArgs {
  where?: { active?: boolean };
}

interface FakeUserFindManyArgs {
  where?: {
    active?: boolean;
    id?: { in: string[] };
    role?: Role;
  };
  select?: {
    clubLeadAssignments?: unknown;
  };
}

interface FakeGuardianFindManyArgs {
  where: { userId: string; student?: { active?: boolean } };
  orderBy?: { createdAt: 'desc' };
  select?: {
    studentId?: true;
    student?: { select: { id: true; fullNameEnc: true; yearGroup: true } };
  };
}

interface FakeGuardianFindUniqueArgs {
  where: { userId_studentId: { userId: string; studentId: string } };
}

interface FakeAuditCreateArgs {
  data: {
    userId: string;
    action: 'Create' | 'Update' | 'DecryptPii';
    entity:
      | 'Club'
      | 'ClubAttendance'
      | 'ClubLeadAssignment'
      | 'ClubSignup'
      | 'Student'
      | 'User'
      | 'ClubNotification'
      | 'Email';
    entityId?: string | null;
    meta?: Record<string, unknown>;
  };
}

interface FakeClubNotificationCreateArgs {
  data: {
    clubId: string;
    title: string;
    bodyEnc: string;
    sentById: string;
  };
}

interface FakeClubNotificationFindManyArgs {
  where: {
    club?: {
      active?: boolean;
      signups?: {
        some: {
          status: ClubSignupStatus;
          studentId: { in: string[] };
          student?: { active?: boolean };
        };
      };
    };
    clubId?: string;
  };
  orderBy?: { sentAt: 'desc' };
  take?: number;
}

interface FakeClubLeadAssignmentFindUniqueArgs {
  where: { clubId_userId: { clubId: string; userId: string } };
}

interface FakeClubLeadAssignmentFindManyArgs {
  where?: { club?: { active?: boolean }; userId?: string };
}

interface FakeClubLeadAssignmentDeleteManyArgs {
  where: { clubId: string; userId: { notIn: string[] } };
}

interface FakeClubLeadAssignmentCreateManyArgs {
  data: Array<{ assignedById: string; clubId: string; userId: string }>;
  skipDuplicates?: boolean;
}

interface FakeClubAttendanceFindManyArgs {
  where: { clubId: string; sessionDate: Date };
}

interface FakeClubAttendanceUpsertArgs {
  where: {
    clubId_studentId_sessionDate: { clubId: string; sessionDate: Date; studentId: string };
  };
  update: { recordedById: string; status: StoredClubAttendance['status'] };
  create: {
    clubId: string;
    recordedById: string;
    sessionDate: Date;
    status: StoredClubAttendance['status'];
    studentId: string;
  };
}

interface FakeDb {
  $enc: {
    encrypt: (value: string) => string;
    decrypt: (value: string | null | undefined) => string | null;
  };
  $transaction: ReturnType<typeof vi.fn>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  club: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  clubSignup: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  clubLeadAssignment: {
    createMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  clubAttendance: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  clubNotification: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  student: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  user: { findMany: ReturnType<typeof vi.fn> };
  guardian: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  clubs: StoredClub[];
  students: StoredStudent[];
  guardians: StoredGuardian[];
  users: StoredUser[];
  signups: StoredSignup[];
  leadAssignments: StoredLeadAssignment[];
  attendance: StoredClubAttendance[];
  notifications: StoredClubNotification[];
}

function encrypt(value: string): string {
  return `enc:${value}`;
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^enc:/u, '');
}

function makeClub(input: Partial<StoredClub> & Pick<StoredClub, 'id' | 'name'>): StoredClub {
  return {
    description: null,
    schedule: null,
    scheduleStartDate: null,
    scheduleStartMinute: null,
    scheduleEndMinute: null,
    scheduleFrequency: null,
    capacity: null,
    iconKey: null,
    accentColor: null,
    active: true,
    createdById: headUser.id,
    createdAt: new Date('2026-05-11T08:00:00.000Z'),
    updatedAt: new Date('2026-05-11T08:00:00.000Z'),
    ...input,
  };
}

function makeStudent(
  input: Partial<StoredStudent> & Pick<StoredStudent, 'id' | 'fullNameEnc'>,
): StoredStudent {
  return {
    yearGroup: 'Year 7',
    active: true,
    ...input,
  };
}

function makeSignup(
  input: Partial<StoredSignup> & Pick<StoredSignup, 'id' | 'clubId' | 'studentId'>,
) {
  return {
    signedUpByUserId: parentUser.id,
    status: 'Active',
    createdAt: new Date('2026-05-11T09:00:00.000Z'),
    withdrawnAt: null,
    ...input,
  } satisfies StoredSignup;
}

function makeNotification(
  input: Partial<StoredClubNotification> & Pick<StoredClubNotification, 'id' | 'clubId' | 'title'>,
): StoredClubNotification {
  return {
    bodyEnc: encrypt('Notification body'),
    sentById: clubsAdminUser.id,
    sentAt: new Date('2026-05-11T14:00:00.000Z'),
    ...input,
  };
}

function makeUser(input: Pick<StoredUser, 'id' | 'role'> & Partial<StoredUser>): StoredUser {
  const label = input.role === 'Parent' ? 'Parent Guardian' : `${input.role} User`;
  return {
    active: true,
    fullNameEnc: encrypt(label),
    emailEnc: encrypt(`${input.id}@example.com`),
    ...input,
  };
}

const defaultClubId = 'cclub000000000000000001';
const inactiveClubId = 'cclub000000000000000002';
const linkedStudentId = 'cstudent000000000000001';
const otherStudentId = 'cstudent000000000000002';

const defaultUsers = [
  makeUser({ id: headUser.id, role: headUser.role, fullNameEnc: encrypt('Head User') }),
  makeUser({
    id: clubsAdminUser.id,
    role: clubsAdminUser.role,
    fullNameEnc: encrypt('Clubs Admin'),
  }),
  makeUser({
    id: clubsLeadUser.id,
    role: clubsLeadUser.role,
    fullNameEnc: encrypt('Clubs Lead'),
  }),
  makeUser({ id: parentUser.id, role: parentUser.role, fullNameEnc: encrypt('Jane Parent') }),
  makeUser({
    id: otherParentUser.id,
    role: otherParentUser.role,
    fullNameEnc: encrypt('Other Parent'),
  }),
  makeUser({
    id: supervisorUser.id,
    role: supervisorUser.role,
    fullNameEnc: encrypt('Supervisor User'),
  }),
];

function makeFakeDb(
  input: {
    clubs?: StoredClub[];
    students?: StoredStudent[];
    guardians?: StoredGuardian[];
    users?: StoredUser[];
    signups?: StoredSignup[];
    leadAssignments?: StoredLeadAssignment[];
    attendance?: StoredClubAttendance[];
    notifications?: StoredClubNotification[];
  } = {},
): FakeDb {
  const clubs = input.clubs ?? [
    makeClub({ id: defaultClubId, name: 'Choir', capacity: 2 }),
    makeClub({ id: inactiveClubId, name: 'Chess', active: false }),
  ];
  const students = input.students ?? [
    makeStudent({ id: linkedStudentId, fullNameEnc: encrypt('Linked Learner') }),
    makeStudent({ id: otherStudentId, fullNameEnc: encrypt('Other Learner'), yearGroup: 'Year 8' }),
  ];
  const guardians = input.guardians ?? [{ userId: parentUser.id, studentId: linkedStudentId }];
  const users = input.users ?? defaultUsers;
  const signups = input.signups ?? [];
  const leadAssignments = input.leadAssignments ?? [];
  const attendance = input.attendance ?? [];
  const notifications = input.notifications ?? [];

  const db = {
    $enc: { encrypt, decrypt },
    $transaction: vi.fn(),
    auditLog: {
      create: vi.fn((args: FakeAuditCreateArgs) => Promise.resolve(args)),
    },
    club: {
      findMany: vi.fn((args: FakeClubFindManyArgs = {}) =>
        Promise.resolve(
          clubs
            .filter((club) => args.where?.active === undefined || club.active === args.where.active)
            .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
            .map((club) =>
              withIncludedSignups(club, args.include, signups, students, leadAssignments, users),
            ),
        ),
      ),
      findUnique: vi.fn((args: FakeClubFindUniqueArgs) => {
        const club = clubs.find((candidate) => candidate.id === args.where.id);
        if (!club) return Promise.resolve(null);
        if (args.select?.leadAssignments) {
          return Promise.resolve({
            id: club.id,
            leadAssignments: leadAssignments
              .filter((assignment) => assignment.clubId === club.id)
              .map((assignment) => ({ userId: assignment.userId })),
          });
        }
        if (args.select?.id && !args.select.signups) {
          return Promise.resolve({
            id: club.id,
            ...(args.select.active ? { active: club.active } : {}),
          });
        }
        if (args.select?.signups) {
          if (args.select.name) {
            return Promise.resolve(
              withNotificationRecipients(club, signups, students, guardians, users),
            );
          }
          return Promise.resolve({
            id: club.id,
            signups: signups
              .filter((signup) => signup.clubId === club.id && signup.status === 'Active')
              .map((signup) => ({ studentId: signup.studentId })),
          });
        }
        return Promise.resolve(withIncludedSignups(club, args.include, signups, students));
      }),
      create: vi.fn((args: FakeClubCreateArgs) => {
        const club: StoredClub = {
          id: `cclubcreated000000000${String(clubs.length + 1).padStart(3, '0')}`,
          createdAt: new Date('2026-05-11T10:00:00.000Z'),
          updatedAt: new Date('2026-05-11T10:00:00.000Z'),
          ...args.data,
        };
        clubs.push(club);
        return Promise.resolve(withIncludedSignups(club, args.include, signups, students));
      }),
      update: vi.fn((args: FakeClubUpdateArgs) => {
        const index = clubs.findIndex((club) => club.id === args.where.id);
        if (index === -1) throw new Error('club not found');
        const current = clubs[index];
        if (!current) throw new Error('club not found');
        const updated: StoredClub = {
          ...current,
          ...args.data,
          updatedAt: new Date('2026-05-11T11:00:00.000Z'),
        };
        clubs[index] = updated;
        return Promise.resolve(withIncludedSignups(updated, args.include, signups, students));
      }),
    },
    clubSignup: {
      create: vi.fn((args: FakeSignupCreateArgs) => {
        const activeDuplicate = signups.some(
          (signup) =>
            signup.clubId === args.data.clubId &&
            signup.studentId === args.data.studentId &&
            signup.status === 'Active',
        );
        if (activeDuplicate) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        const signup: StoredSignup = {
          id: `csignup000000000000${String(signups.length + 1).padStart(5, '0')}`,
          createdAt: new Date('2026-05-11T12:00:00.000Z'),
          withdrawnAt: null,
          ...args.data,
        };
        signups.push(signup);
        return Promise.resolve(signup);
      }),
      findFirst: vi.fn((args: FakeSignupFindFirstArgs) =>
        Promise.resolve(
          signups.find(
            (signup) =>
              signup.clubId === args.where.clubId &&
              signup.studentId === args.where.studentId &&
              signup.status === args.where.status &&
              (args.where.student?.active === undefined ||
                students.find((student) => student.id === signup.studentId)?.active ===
                  args.where.student.active),
          ) ?? null,
        ),
      ),
      update: vi.fn((args: FakeSignupUpdateArgs) => {
        const signup = signups.find((candidate) => candidate.id === args.where.id);
        if (!signup) throw new Error('signup not found');
        signup.status = args.data.status;
        signup.withdrawnAt = args.data.withdrawnAt;
        return Promise.resolve(signup);
      }),
    },
    clubLeadAssignment: {
      findUnique: vi.fn((args: FakeClubLeadAssignmentFindUniqueArgs) => {
        const assignment = leadAssignments.find(
          (candidate) =>
            candidate.clubId === args.where.clubId_userId.clubId &&
            candidate.userId === args.where.clubId_userId.userId,
        );
        if (!assignment) return Promise.resolve(null);
        const club = clubs.find((candidate) => candidate.id === assignment.clubId);
        return Promise.resolve({ club: { active: club?.active ?? false } });
      }),
      findMany: vi.fn((args: FakeClubLeadAssignmentFindManyArgs = {}) =>
        Promise.resolve(
          leadAssignments
            .filter(
              (assignment) =>
                args.where?.userId === undefined || assignment.userId === args.where.userId,
            )
            .filter((assignment) => {
              const club = clubs.find((candidate) => candidate.id === assignment.clubId);
              return (
                args.where?.club?.active === undefined || club?.active === args.where.club.active
              );
            })
            .map((assignment) => {
              const club = clubs.find((candidate) => candidate.id === assignment.clubId);
              if (!club) throw new Error('club not found');
              return {
                club: withIncludedSignups(
                  club,
                  {
                    signups: {
                      where: { status: 'Active', student: { active: true } },
                      select: { studentId: true },
                    },
                  },
                  signups,
                  students,
                ),
              };
            }),
        ),
      ),
      deleteMany: vi.fn((args: FakeClubLeadAssignmentDeleteManyArgs) => {
        for (let index = leadAssignments.length - 1; index >= 0; index -= 1) {
          const assignment = leadAssignments[index];
          if (
            assignment &&
            assignment.clubId === args.where.clubId &&
            !args.where.userId.notIn.includes(assignment.userId)
          ) {
            leadAssignments.splice(index, 1);
          }
        }
        return Promise.resolve({ count: 0 });
      }),
      createMany: vi.fn((args: FakeClubLeadAssignmentCreateManyArgs) => {
        for (const row of args.data) {
          if (
            args.skipDuplicates &&
            leadAssignments.some(
              (assignment) => assignment.clubId === row.clubId && assignment.userId === row.userId,
            )
          ) {
            continue;
          }
          leadAssignments.push({
            id: `cleadassign000000${String(leadAssignments.length + 1).padStart(6, '0')}`,
            createdAt: new Date('2026-05-11T12:30:00.000Z'),
            ...row,
          });
        }
        return Promise.resolve({ count: args.data.length });
      }),
    },
    clubAttendance: {
      findMany: vi.fn((args: FakeClubAttendanceFindManyArgs) =>
        Promise.resolve(
          attendance.filter(
            (row) =>
              row.clubId === args.where.clubId &&
              row.sessionDate.getTime() === args.where.sessionDate.getTime(),
          ),
        ),
      ),
      upsert: vi.fn((args: FakeClubAttendanceUpsertArgs) => {
        const existing = attendance.find(
          (row) =>
            row.clubId === args.where.clubId_studentId_sessionDate.clubId &&
            row.studentId === args.where.clubId_studentId_sessionDate.studentId &&
            row.sessionDate.getTime() ===
              args.where.clubId_studentId_sessionDate.sessionDate.getTime(),
        );
        if (existing) {
          existing.status = args.update.status;
          existing.recordedById = args.update.recordedById;
          existing.updatedAt = new Date('2026-05-11T15:00:00.000Z');
          return Promise.resolve(existing);
        }
        const row: StoredClubAttendance = {
          id: `cattendance000000${String(attendance.length + 1).padStart(6, '0')}`,
          updatedAt: new Date('2026-05-11T15:00:00.000Z'),
          ...args.create,
        };
        attendance.push(row);
        return Promise.resolve(row);
      }),
    },
    clubNotification: {
      create: vi.fn((args: FakeClubNotificationCreateArgs) => {
        const notification: StoredClubNotification = {
          id: `cnotification000000${String(notifications.length + 1).padStart(6, '0')}`,
          sentAt: new Date('2026-05-11T14:00:00.000Z'),
          ...args.data,
        };
        notifications.push(notification);
        return Promise.resolve({
          id: notification.id,
          clubId: notification.clubId,
          title: notification.title,
          sentAt: notification.sentAt,
        });
      }),
      findMany: vi.fn((args: FakeClubNotificationFindManyArgs) => {
        const allowedClubIds =
          args.where.club === undefined
            ? null
            : new Set(
                clubs
                  .filter(
                    (club) =>
                      args.where.club?.active === undefined ||
                      club.active === args.where.club.active,
                  )
                  .filter((club) =>
                    signups.some((signup) => {
                      const student = students.find(
                        (candidate) => candidate.id === signup.studentId,
                      );
                      const some = args.where.club?.signups?.some;
                      return (
                        signup.clubId === club.id &&
                        (!some ||
                          (signup.status === some.status &&
                            some.studentId.in.includes(signup.studentId) &&
                            (some.student?.active === undefined ||
                              student?.active === some.student.active)))
                      );
                    }),
                  )
                  .map((club) => club.id),
              );
        const rows = notifications
          .filter(
            (notification) =>
              (args.where.clubId === undefined || notification.clubId === args.where.clubId) &&
              (allowedClubIds === null || allowedClubIds.has(notification.clubId)),
          )
          .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
          .slice(0, args.take);

        return Promise.resolve(
          rows.map((notification) => {
            const sentBy = users.find((user) => user.id === notification.sentById);
            const club = clubs.find((candidate) => candidate.id === notification.clubId);
            const linkedStudentIds = args.where.club?.signups?.some.studentId.in;
            if (!sentBy) throw new Error('sender not found');
            if (!club) throw new Error('club not found');

            return {
              id: notification.id,
              clubId: notification.clubId,
              title: notification.title,
              bodyEnc: notification.bodyEnc,
              sentAt: notification.sentAt,
              club: {
                name: club.name,
                signups: signups
                  .filter(
                    (signup) =>
                      signup.clubId === club.id &&
                      signup.status === 'Active' &&
                      (linkedStudentIds === undefined ||
                        linkedStudentIds.includes(signup.studentId)),
                  )
                  .map((signup) => {
                    const student = students.find((candidate) => candidate.id === signup.studentId);
                    if (!student) throw new Error('student not found');
                    return { student: { fullNameEnc: student.fullNameEnc } };
                  }),
              },
              sentBy: { fullNameEnc: sentBy.fullNameEnc },
            };
          }),
        );
      }),
    },
    student: {
      findMany: vi.fn((args: FakeStudentFindManyArgs = {}) =>
        Promise.resolve(
          students
            .filter(
              (student) => args.where?.active === undefined || student.active === args.where.active,
            )
            .sort((a, b) => a.yearGroup.localeCompare(b.yearGroup))
            .map((student) => ({
              id: student.id,
              fullNameEnc: student.fullNameEnc,
              yearGroup: student.yearGroup,
            })),
        ),
      ),
      findUnique: vi.fn((args: FakeStudentFindUniqueArgs) =>
        Promise.resolve(students.find((student) => student.id === args.where.id) ?? null),
      ),
    },
    user: {
      findMany: vi.fn((args: FakeUserFindManyArgs = {}) =>
        Promise.resolve(
          users
            .filter((user) => args.where?.active === undefined || user.active === args.where.active)
            .filter((user) => args.where?.role === undefined || user.role === args.where.role)
            .filter(
              (user) => args.where?.id?.in === undefined || args.where.id.in.includes(user.id),
            )
            .map((user) => ({
              id: user.id,
              role: user.role,
              fullNameEnc: user.fullNameEnc,
              emailEnc: user.emailEnc,
              clubLeadAssignments:
                args.select?.clubLeadAssignments === undefined
                  ? undefined
                  : leadAssignments
                      .filter((assignment) => assignment.userId === user.id)
                      .map((assignment) => {
                        const club = clubs.find((candidate) => candidate.id === assignment.clubId);
                        if (!club) throw new Error('lead club not found');
                        return {
                          club: {
                            id: club.id,
                            active: club.active,
                            name: club.name,
                          },
                        };
                      }),
            })),
        ),
      ),
    },
    guardian: {
      findMany: vi.fn((args: FakeGuardianFindManyArgs) =>
        Promise.resolve(
          guardians
            .filter((guardian) => guardian.userId === args.where.userId)
            .filter((guardian) => {
              const student = students.find((candidate) => candidate.id === guardian.studentId);
              return (
                args.where.student?.active === undefined ||
                student?.active === args.where.student.active
              );
            })
            .map((guardian) => {
              if (args.select?.student) {
                const student = students.find((candidate) => candidate.id === guardian.studentId);
                if (!student) throw new Error('student not found');
                return {
                  student: {
                    id: student.id,
                    fullNameEnc: student.fullNameEnc,
                    yearGroup: student.yearGroup,
                  },
                };
              }
              return { studentId: guardian.studentId };
            }),
        ),
      ),
      findUnique: vi.fn((args: FakeGuardianFindUniqueArgs) => {
        const guardian = guardians.find(
          (candidate) =>
            candidate.userId === args.where.userId_studentId.userId &&
            candidate.studentId === args.where.userId_studentId.studentId,
        );
        if (!guardian) return Promise.resolve(null);
        const student = students.find((candidate) => candidate.id === guardian.studentId);
        if (!student) return Promise.resolve(null);
        return Promise.resolve({ student: { id: student.id, active: student.active } });
      }),
    },
    clubs,
    students,
    guardians,
    users,
    signups,
    leadAssignments,
    attendance,
    notifications,
  } satisfies FakeDb;

  db.$transaction.mockImplementation(async <T>(fn: (tx: FakeDb) => Promise<T>) => fn(db));

  return db;
}

function withIncludedSignups(
  club: StoredClub,
  include: FakeClubInclude | undefined,
  signups: StoredSignup[],
  students: StoredStudent[],
  leadAssignments: StoredLeadAssignment[] = [],
  users: StoredUser[] = [],
) {
  const included: StoredClub & {
    leadAssignments?: Array<{ user: StoredUser }>;
    signups?: Array<StoredSignup & { student?: StoredStudent }>;
  } = { ...club };

  if (include?.signups) {
    const status = include.signups.where?.status;
    const active = include.signups.where?.student?.active;
    included.signups = signups
      .filter((signup) => signup.clubId === club.id && (!status || signup.status === status))
      .filter((signup) => {
        const student = students.find((candidate) => candidate.id === signup.studentId);
        return active === undefined || student?.active === active;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((signup) => {
        const student = students.find((candidate) => candidate.id === signup.studentId);
        return student ? { ...signup, student } : signup;
      });
  }

  if (include?.leadAssignments) {
    included.leadAssignments = leadAssignments
      .filter((assignment) => assignment.clubId === club.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((assignment) => {
        const user = users.find((candidate) => candidate.id === assignment.userId);
        if (!user) throw new Error('lead user not found');
        return { user };
      });
  }

  return included;
}

function withNotificationRecipients(
  club: StoredClub,
  signups: StoredSignup[],
  students: StoredStudent[],
  guardians: StoredGuardian[],
  users: StoredUser[],
) {
  return {
    id: club.id,
    name: club.name,
    active: club.active,
    signups: signups
      .filter((signup) => {
        const student = students.find((candidate) => candidate.id === signup.studentId);
        return signup.clubId === club.id && signup.status === 'Active' && student?.active === true;
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((signup) => {
        const student = students.find((candidate) => candidate.id === signup.studentId);
        if (!student) throw new Error('student not found');

        return {
          student: {
            id: student.id,
            fullNameEnc: student.fullNameEnc,
            guardians: guardians
              .filter((guardian) => guardian.studentId === student.id)
              .map((guardian) => {
                const user = users.find(
                  (candidate) => candidate.id === guardian.userId && candidate.active,
                );
                if (!user) return null;
                return {
                  user: {
                    id: user.id,
                    role: user.role,
                    fullNameEnc: user.fullNameEnc,
                    emailEnc: user.emailEnc,
                  },
                };
              })
              .filter((guardian): guardian is NonNullable<typeof guardian> => guardian !== null),
          },
        };
      }),
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

function makeFakeEmailClient(result = { id: 'email_123' }) {
  const send = vi.fn<EmailClient['send']>().mockResolvedValue(result);
  const client: EmailClient = { send };
  return { client, send };
}

function makeCaller(user: SessionUser | null, db = makeFakeDb(), email = makeFakeEmailClient()) {
  const appRouter = router({ club: createClubRouter({ emailClient: email.client }) });
  return { caller: appRouter.createCaller(makeCtx(user, db)), db, email };
}

function auditEntities(
  db: FakeDb,
): Array<{ action: string; entity: string; entityId: string | null }> {
  return db.auditLog.create.mock.calls.map(([args]) => {
    const audit = args as FakeAuditCreateArgs;
    return {
      action: audit.data.action,
      entity: audit.data.entity,
      entityId: audit.data.entityId ?? null,
    };
  });
}

function auditCreateArgs(db: FakeDb): FakeAuditCreateArgs[] {
  return db.auditLog.create.mock.calls.map(([args]) => args as FakeAuditCreateArgs);
}

describe('club management', () => {
  it('allows full-admin and ClubsAdmin users to create, update, and deactivate clubs', async () => {
    const { caller: headCaller, db } = makeCaller(headUser);
    const created = await headCaller.club.create({
      name: '  Coding Club  ',
      description: '  Tuesdays  ',
      schedule: {
        startDate: new Date('2026-05-15T00:00:00.000Z'),
        startMinute: 930,
        endMinute: 990,
        frequency: 'Weekly',
      },
      capacity: 12,
    });

    expect(created).toMatchObject({
      name: 'Coding Club',
      description: 'Tuesdays',
      schedule: {
        startDate: '2026-05-15',
        startMinute: 930,
        endMinute: 990,
        frequency: 'Weekly',
      },
      scheduleLabel: 'Weekly from 2026-05-15, 15:30-16:30',
      capacity: 12,
      active: true,
      activeSignupCount: 0,
    });

    const clubsAdminCaller = makeCaller(clubsAdminUser, db).caller;
    await expect(
      clubsAdminCaller.club.update({
        id: created.id,
        name: 'STEM Club',
        description: null,
        schedule: null,
        capacity: null,
      }),
    ).resolves.toMatchObject({
      name: 'STEM Club',
      description: null,
      schedule: null,
      scheduleLabel: null,
      capacity: null,
    });

    await expect(
      clubsAdminCaller.club.update({ id: created.id, active: false }),
    ).resolves.toMatchObject({ active: false });

    expect(auditEntities(db)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'Create', entity: 'Club', entityId: created.id }),
        expect.objectContaining({ action: 'Update', entity: 'Club', entityId: created.id }),
      ]),
    );
  });

  it.each([parentUser, supervisorUser, studentUser, technicalSupportUser])(
    'blocks %s from managing clubs',
    async (user) => {
      const { caller } = makeCaller(user);

      await expect(caller.club.create({ name: 'Choir' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );

  it('prevents lowering capacity below the active signup count', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: defaultClubId,
          studentId: otherStudentId,
        }),
      ],
    });
    const { caller } = makeCaller(headUser, db);

    await expect(caller.club.update({ id: defaultClubId, capacity: 1 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'capacity cannot be below active signup count',
    });
  });
});

describe('club.managementList', () => {
  it('returns club manager rows with assigned lead summaries and audits lead PII decrypt', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
      leadAssignments: [
        {
          id: 'cleadassign000000000001',
          assignedById: headUser.id,
          clubId: defaultClubId,
          createdAt: new Date('2026-05-11T12:30:00.000Z'),
          userId: clubsLeadUser.id,
        },
      ],
    });

    await expect(makeCaller(headUser, db).caller.club.managementList()).resolves.toEqual([
      expect.objectContaining({
        id: defaultClubId,
        activeSignupCount: 1,
        assignedLeads: [
          {
            id: clubsLeadUser.id,
            active: true,
            fullName: 'Clubs Lead',
            email: `${clubsLeadUser.id}@example.com`,
          },
        ],
      }),
      expect.objectContaining({
        id: inactiveClubId,
        assignedLeads: [],
      }),
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { source: 'club.managementList', count: 1 },
      },
    });
  });

  it.each([parentUser, supervisorUser])('blocks %s from manager club rows', async (user) => {
    await expect(makeCaller(user).caller.club.managementList()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('club.list', () => {
  it('returns all clubs for club managers and active clubs with own signup state for parents', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: defaultClubId,
          studentId: otherStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000003',
          clubId: inactiveClubId,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(makeCaller(headUser, db).caller.club.list()).resolves.toHaveLength(2);
    await expect(makeCaller(clubsAdminUser, db).caller.club.list()).resolves.toHaveLength(2);
    await expect(makeCaller(parentUser, db).caller.club.list()).resolves.toEqual([
      expect.objectContaining({
        id: defaultClubId,
        active: true,
        activeSignupCount: 2,
        signedUpStudentIds: [linkedStudentId],
      }),
    ]);
  });

  it.each([supervisorUser, studentUser, technicalSupportUser])(
    'blocks %s from listing clubs',
    async (user) => {
      await expect(makeCaller(user).caller.club.list()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );
});

describe('club.linkedChildSignupContext', () => {
  it('returns active clubs and linked children for parent, supervisor, and ClubsAdmin guardians', async () => {
    const db = makeFakeDb({
      guardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: supervisorUser.id, studentId: linkedStudentId },
        { userId: clubsAdminUser.id, studentId: linkedStudentId },
      ],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: inactiveClubId,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(
      makeCaller(parentUser, db).caller.club.linkedChildSignupContext(),
    ).resolves.toEqual({
      children: [{ id: linkedStudentId, fullName: 'Linked Learner', yearGroup: 'Year 7' }],
      clubs: [
        expect.objectContaining({
          id: defaultClubId,
          active: true,
          activeSignupCount: 1,
          signedUpStudentIds: [linkedStudentId],
        }),
      ],
    });
    await expect(
      makeCaller(supervisorUser, db).caller.club.linkedChildSignupContext(),
    ).resolves.toMatchObject({
      children: [{ id: linkedStudentId }],
      clubs: [expect.objectContaining({ id: defaultClubId })],
    });
    await expect(
      makeCaller(clubsAdminUser, db).caller.club.linkedChildSignupContext(),
    ).resolves.toMatchObject({
      children: [{ id: linkedStudentId }],
      clubs: [expect.objectContaining({ id: defaultClubId })],
    });
  });

  it('blocks roles that cannot use linked-child club signup', async () => {
    await expect(
      makeCaller(studentUser).caller.club.linkedChildSignupContext(),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('club.signUp', () => {
  it('allows a parent to sign up their linked active child and audits the signup', async () => {
    const { caller, db } = makeCaller(parentUser);

    const signup = await caller.club.signUp({ clubId: defaultClubId, studentId: linkedStudentId });

    expect(signup).toMatchObject({
      clubId: defaultClubId,
      studentId: linkedStudentId,
      signedUpByUserId: parentUser.id,
      status: 'Active',
    });
    expect(auditEntities(db)).toEqual([
      expect.objectContaining({ action: 'Create', entity: 'ClubSignup', entityId: signup.id }),
    ]);
  });

  it('accepts valid linked student ids that are not CUID-shaped', async () => {
    const externalStudentId = 'student_2026_alpha';
    const db = makeFakeDb({
      guardians: [{ userId: parentUser.id, studentId: externalStudentId }],
      students: [
        makeStudent({ id: externalStudentId, fullNameEnc: encrypt('External Id Learner') }),
      ],
    });

    await expect(
      makeCaller(parentUser, db).caller.club.signUp({
        clubId: defaultClubId,
        studentId: externalStudentId,
      }),
    ).resolves.toMatchObject({
      clubId: defaultClubId,
      studentId: externalStudentId,
      status: 'Active',
    });
  });

  it('blocks parent signup for an unrelated child', async () => {
    const { caller } = makeCaller(parentUser);

    await expect(
      caller.club.signUp({ clubId: defaultClubId, studentId: otherStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows full-admin users to sign up any active student', async () => {
    const { caller } = makeCaller(headUser);

    await expect(
      caller.club.signUp({ clubId: defaultClubId, studentId: otherStudentId }),
    ).resolves.toMatchObject({
      studentId: otherStudentId,
      signedUpByUserId: headUser.id,
      status: 'Active',
    });
  });

  it('allows a supervisor to sign up a linked active child', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: supervisorUser.id, studentId: linkedStudentId }],
    });

    await expect(
      makeCaller(supervisorUser, db).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      signedUpByUserId: supervisorUser.id,
      status: 'Active',
    });
  });

  it('blocks supervisor signup for an unrelated child', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: supervisorUser.id, studentId: linkedStudentId }],
    });

    await expect(
      makeCaller(supervisorUser, db).caller.club.signUp({
        clubId: defaultClubId,
        studentId: otherStudentId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows re-sign after a withdrawn historical signup', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
          status: 'Withdrawn',
          withdrawnAt: new Date('2026-05-11T13:00:00.000Z'),
        }),
      ],
    });

    await expect(
      makeCaller(parentUser, db).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      clubId: defaultClubId,
      studentId: linkedStudentId,
      status: 'Active',
    });
    expect(db.signups).toHaveLength(2);
    expect(db.signups.map((signup) => signup.status)).toEqual(['Withdrawn', 'Active']);
  });

  it('allows a ClubsAdmin user to sign up a linked active child', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: clubsAdminUser.id, studentId: linkedStudentId }],
    });

    await expect(
      makeCaller(clubsAdminUser, db).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      studentId: linkedStudentId,
      signedUpByUserId: clubsAdminUser.id,
      status: 'Active',
    });
  });

  it('allows ClubsAdmin signup for an unrelated active child', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: clubsAdminUser.id, studentId: linkedStudentId }],
    });

    await expect(
      makeCaller(clubsAdminUser, db).caller.club.signUp({
        clubId: defaultClubId,
        studentId: otherStudentId,
      }),
    ).resolves.toMatchObject({
      studentId: otherStudentId,
      signedUpByUserId: clubsAdminUser.id,
      status: 'Active',
    });
  });

  it('rejects duplicate active signups and full clubs', async () => {
    const duplicateDb = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
    });
    await expect(
      makeCaller(parentUser, duplicateDb).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student is already signed up for this club',
    });

    const fullDb = makeFakeDb({
      clubs: [makeClub({ id: defaultClubId, name: 'Choir', capacity: 1 })],
      signups: [
        makeSignup({
          id: 'csignup000000000000002',
          clubId: defaultClubId,
          studentId: otherStudentId,
        }),
      ],
    });
    await expect(
      makeCaller(parentUser, fullDb).caller.club.signUp({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'club is at capacity',
    });
  });
});

describe('club.withdraw', () => {
  it('withdraws an active linked-child signup without deleting history', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
    });
    const { caller } = makeCaller(parentUser, db);

    const result = await caller.club.withdraw({
      clubId: defaultClubId,
      studentId: linkedStudentId,
    });

    expect(result).toMatchObject({
      id: 'csignup000000000000001',
      clubId: defaultClubId,
      studentId: linkedStudentId,
      status: 'Withdrawn',
      withdrawn: true,
    });
    expect(result.withdrawnAt).toBeInstanceOf(Date);
    expect(db.signups).toHaveLength(1);
    expect(db.signups[0]).toMatchObject({ status: 'Withdrawn' });
    expect(auditEntities(db)).toEqual([
      expect.objectContaining({
        action: 'Update',
        entity: 'ClubSignup',
        entityId: 'csignup000000000000001',
      }),
    ]);
  });

  it('is idempotent for authorized callers when there is no active signup', async () => {
    const { caller, db } = makeCaller(parentUser);

    await expect(
      caller.club.withdraw({ clubId: defaultClubId, studentId: linkedStudentId }),
    ).resolves.toMatchObject({
      clubId: defaultClubId,
      studentId: linkedStudentId,
      withdrawn: false,
      withdrawnAt: null,
    });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('denies withdrawal for unrelated parents', async () => {
    const { caller } = makeCaller(otherParentUser);

    await expect(
      caller.club.withdraw({ clubId: defaultClubId, studentId: linkedStudentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows a supervisor to withdraw a linked-child signup', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: supervisorUser.id, studentId: linkedStudentId }],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          signedUpByUserId: supervisorUser.id,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(
      makeCaller(supervisorUser, db).caller.club.withdraw({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      id: 'csignup000000000000001',
      status: 'Withdrawn',
      withdrawn: true,
    });
  });

  it('allows a ClubsAdmin user to withdraw a linked-child signup', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: clubsAdminUser.id, studentId: linkedStudentId }],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          signedUpByUserId: clubsAdminUser.id,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(
      makeCaller(clubsAdminUser, db).caller.club.withdraw({
        clubId: defaultClubId,
        studentId: linkedStudentId,
      }),
    ).resolves.toMatchObject({
      id: 'csignup000000000000001',
      status: 'Withdrawn',
      withdrawn: true,
    });
  });

  it('allows ClubsAdmin users to withdraw any active club signup', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: clubsAdminUser.id, studentId: linkedStudentId }],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: otherStudentId,
        }),
      ],
    });

    await expect(
      makeCaller(clubsAdminUser, db).caller.club.withdraw({
        clubId: defaultClubId,
        studentId: otherStudentId,
      }),
    ).resolves.toMatchObject({
      id: 'csignup000000000000001',
      status: 'Withdrawn',
      withdrawn: true,
    });
  });
});

describe('club manager assignments', () => {
  it('lists student assignment candidates and lead candidates for club managers', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
      leadAssignments: [
        {
          id: 'cleadassign000000000001',
          assignedById: headUser.id,
          clubId: defaultClubId,
          createdAt: new Date('2026-05-11T12:30:00.000Z'),
          userId: clubsLeadUser.id,
        },
      ],
    });
    const caller = makeCaller(clubsAdminUser, db).caller;

    await expect(caller.club.studentCandidates({ clubId: defaultClubId })).resolves.toEqual([
      expect.objectContaining({
        id: linkedStudentId,
        fullName: 'Linked Learner',
        signedUp: true,
      }),
      expect.objectContaining({
        id: otherStudentId,
        fullName: 'Other Learner',
        signedUp: false,
      }),
    ]);

    await expect(caller.club.leadCandidates({ clubId: defaultClubId })).resolves.toEqual([
      expect.objectContaining({
        assignedClubNames: [],
        id: clubsLeadUser.id,
        fullName: 'Clubs Lead',
        role: 'ClubsLead',
        selected: true,
      }),
    ]);
  });

  it('sets club lead assignments only for active ClubsLead users', async () => {
    const inactiveLead = makeUser({
      id: 'cclubslead0000000002',
      active: false,
      role: 'ClubsLead',
    });
    const supervisorLead = makeUser({
      id: 'csupervisor00000000002',
      role: 'Supervisor',
    });
    const db = makeFakeDb({
      users: [...defaultUsers, inactiveLead, supervisorLead],
      leadAssignments: [
        {
          id: 'cleadassign000000000001',
          assignedById: headUser.id,
          clubId: defaultClubId,
          createdAt: new Date('2026-05-11T12:30:00.000Z'),
          userId: inactiveLead.id,
        },
      ],
    });
    const caller = makeCaller(clubsAdminUser, db).caller;

    await expect(
      caller.club.setLeadAssignments({ clubId: defaultClubId, userIds: [clubsLeadUser.id] }),
    ).resolves.toEqual({ clubId: defaultClubId, userIds: [clubsLeadUser.id] });
    expect(db.leadAssignments).toEqual([
      expect.objectContaining({ clubId: defaultClubId, userId: clubsLeadUser.id }),
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: clubsAdminUser.id,
        action: 'Update',
        entity: 'ClubLeadAssignment',
        entityId: defaultClubId,
        meta: {
          source: 'club.setLeadAssignments',
          clubId: defaultClubId,
          leadCount: 1,
        },
      },
    });

    await expect(
      caller.club.setLeadAssignments({ clubId: defaultClubId, userIds: [inactiveLead.id] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      caller.club.setLeadAssignments({ clubId: defaultClubId, userIds: [supervisorLead.id] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('blocks parents from assignment candidate and lead assignment procedures', async () => {
    const caller = makeCaller(parentUser).caller;

    await expect(caller.club.studentCandidates({ clubId: defaultClubId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.club.leadCandidates({ clubId: defaultClubId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller.club.setLeadAssignments({ clubId: defaultClubId, userIds: [clubsLeadUser.id] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('club.roster', () => {
  it('returns minimal active signup student identity and audits PII decrypt', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: defaultClubId,
          studentId: otherStudentId,
          status: 'Withdrawn',
          withdrawnAt: new Date('2026-05-11T13:00:00.000Z'),
        }),
      ],
    });
    const { caller } = makeCaller(clubsAdminUser, db);

    await expect(caller.club.roster({ clubId: defaultClubId })).resolves.toEqual({
      clubId: defaultClubId,
      signups: [
        expect.objectContaining({
          id: 'csignup000000000000001',
          studentId: linkedStudentId,
          studentName: 'Linked Learner',
          yearGroup: 'Year 7',
        }),
      ],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: clubsAdminUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { source: 'club.roster', clubId: defaultClubId, count: 1 },
      },
    });
  });

  it('allows Head users to read club rosters', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(
      makeCaller(headUser, db).caller.club.roster({ clubId: defaultClubId }),
    ).resolves.toEqual({
      clubId: defaultClubId,
      signups: [
        expect.objectContaining({
          id: 'csignup000000000000001',
          studentId: linkedStudentId,
          studentName: 'Linked Learner',
        }),
      ],
    });
  });

  it('allows ClubsLead users to read only assigned active club rosters', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
      leadAssignments: [
        {
          id: 'cleadassign000000000001',
          assignedById: headUser.id,
          clubId: defaultClubId,
          createdAt: new Date('2026-05-11T12:30:00.000Z'),
          userId: clubsLeadUser.id,
        },
      ],
    });

    await expect(makeCaller(clubsLeadUser, db).caller.club.leadClubs()).resolves.toEqual([
      expect.objectContaining({
        id: defaultClubId,
        active: true,
        activeSignupCount: 1,
      }),
    ]);
    await expect(
      makeCaller(clubsLeadUser, db).caller.club.roster({ clubId: defaultClubId }),
    ).resolves.toEqual({
      clubId: defaultClubId,
      signups: [expect.objectContaining({ studentId: linkedStudentId })],
    });
    await expect(
      makeCaller(clubsLeadUser, db).caller.club.roster({ clubId: inactiveClubId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it.each([parentUser, supervisorUser, studentUser, technicalSupportUser])(
    'blocks %s from roster reads',
    async (user) => {
      await expect(
        makeCaller(user).caller.club.roster({ clubId: defaultClubId }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );
});

describe('club attendance for leads', () => {
  it('allows assigned ClubsLead users to mark attendance for active club signups only', async () => {
    const sessionDate = new Date('2026-05-12T00:00:00.000Z');
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
      leadAssignments: [
        {
          id: 'cleadassign000000000001',
          assignedById: headUser.id,
          clubId: defaultClubId,
          createdAt: new Date('2026-05-11T12:30:00.000Z'),
          userId: clubsLeadUser.id,
        },
      ],
    });
    const caller = makeCaller(clubsLeadUser, db).caller;

    await expect(
      caller.club.markAttendance({
        clubId: defaultClubId,
        date: sessionDate,
        studentId: linkedStudentId,
        status: 'Present',
      }),
    ).resolves.toMatchObject({
      clubId: defaultClubId,
      studentId: linkedStudentId,
      status: 'Present',
      recordedById: clubsLeadUser.id,
    });
    await expect(
      caller.club.attendanceForSession({ clubId: defaultClubId, date: sessionDate }),
    ).resolves.toMatchObject({
      clubId: defaultClubId,
      students: [expect.objectContaining({ studentId: linkedStudentId, status: 'Present' })],
    });
    await expect(
      caller.club.markAttendance({
        clubId: defaultClubId,
        date: sessionDate,
        studentId: otherStudentId,
        status: 'Present',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('club.notifications', () => {
  it('allows club managers to read recent notification history without body or recipient PII', async () => {
    const db = makeFakeDb({
      notifications: [
        makeNotification({
          id: 'cnotification000000000001',
          clubId: defaultClubId,
          title: 'Older update',
          bodyEnc: encrypt('Older private body'),
          sentById: headUser.id,
          sentAt: new Date('2026-05-11T13:00:00.000Z'),
        }),
        makeNotification({
          id: 'cnotification000000000002',
          clubId: defaultClubId,
          title: 'Latest update',
          bodyEnc: encrypt('Latest private body'),
          sentById: clubsAdminUser.id,
          sentAt: new Date('2026-05-11T15:00:00.000Z'),
        }),
        makeNotification({
          id: 'cnotification000000000003',
          clubId: inactiveClubId,
          title: 'Other club update',
        }),
      ],
    });

    const result = await makeCaller(clubsAdminUser, db).caller.club.notifications({
      clubId: defaultClubId,
    });

    expect(result).toEqual([
      {
        id: 'cnotification000000000002',
        clubId: defaultClubId,
        title: 'Latest update',
        sentAt: new Date('2026-05-11T15:00:00.000Z'),
        sentByName: 'Clubs Admin',
      },
      {
        id: 'cnotification000000000001',
        clubId: defaultClubId,
        title: 'Older update',
        sentAt: new Date('2026-05-11T13:00:00.000Z'),
        sentByName: 'Head User',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('private body');
    expect(JSON.stringify(result)).not.toContain('Jane Parent');
    expect(db.clubNotification.findMany).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: clubsAdminUser.id,
        action: 'DecryptPii',
        entity: 'User',
        meta: { source: 'club.notifications', clubId: defaultClubId, count: 2 },
      },
    });
  });

  it('allows Head users to read club notification history', async () => {
    const db = makeFakeDb({
      notifications: [
        makeNotification({
          id: 'cnotification000000000001',
          clubId: defaultClubId,
          title: 'Head visible update',
        }),
      ],
    });

    await expect(
      makeCaller(headUser, db).caller.club.notifications({ clubId: defaultClubId }),
    ).resolves.toMatchObject([{ title: 'Head visible update', sentByName: 'Clubs Admin' }]);
  });

  it('allows assigned ClubsLead users to read assigned club notification history', async () => {
    const db = makeFakeDb({
      notifications: [
        makeNotification({
          id: 'cnotification000000000001',
          clubId: defaultClubId,
          title: 'Lead visible update',
        }),
      ],
      leadAssignments: [
        {
          id: 'cleadassign000000000001',
          assignedById: headUser.id,
          clubId: defaultClubId,
          createdAt: new Date('2026-05-11T12:30:00.000Z'),
          userId: clubsLeadUser.id,
        },
      ],
    });

    await expect(
      makeCaller(clubsLeadUser, db).caller.club.notifications({ clubId: defaultClubId }),
    ).resolves.toMatchObject([{ title: 'Lead visible update', sentByName: 'Clubs Admin' }]);
    await expect(
      makeCaller(clubsLeadUser, db).caller.club.notifications({ clubId: inactiveClubId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it.each([parentUser, supervisorUser])('blocks %s from notification history', async (user) => {
    await expect(
      makeCaller(user).caller.club.notifications({ clubId: defaultClubId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('club.myClubNotices', () => {
  it('shows parent notices only for active clubs their active children are signed up to', async () => {
    const db = makeFakeDb({
      notifications: [
        makeNotification({
          id: 'cnotification000000000001',
          bodyEnc: encrypt('Choir starts at 4pm.'),
          clubId: defaultClubId,
          title: 'Choir update',
        }),
        makeNotification({
          id: 'cnotification000000000002',
          bodyEnc: encrypt('Chess private update.'),
          clubId: inactiveClubId,
          title: 'Inactive update',
        }),
      ],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: inactiveClubId,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(makeCaller(parentUser, db).caller.club.myClubNotices()).resolves.toEqual([
      {
        id: 'cnotification000000000001',
        body: 'Choir starts at 4pm.',
        clubId: defaultClubId,
        clubName: 'Choir',
        sentAt: new Date('2026-05-11T14:00:00.000Z'),
        sentByName: 'Clubs Admin',
        studentName: 'Linked Learner',
        title: 'Choir update',
      },
    ]);
  });

  it.each([
    ['Supervisor', supervisorUser],
    ['ClubsAdmin', clubsAdminUser],
  ] as const)(
    'shows club notices to %s users with linked signed-up children',
    async (_role, user) => {
      const db = makeFakeDb({
        guardians: [{ userId: user.id, studentId: linkedStudentId }],
        notifications: [
          makeNotification({
            id: 'cnotification000000000003',
            bodyEnc: encrypt('Drama rehearsal moves to room 2.'),
            clubId: defaultClubId,
            sentById: clubsLeadUser.id,
            title: 'Room update',
          }),
        ],
        signups: [
          makeSignup({
            id: 'csignup000000000000003',
            clubId: defaultClubId,
            studentId: linkedStudentId,
          }),
        ],
      });

      await expect(makeCaller(user, db).caller.club.myClubNotices()).resolves.toEqual([
        {
          id: 'cnotification000000000003',
          body: 'Drama rehearsal moves to room 2.',
          clubId: defaultClubId,
          clubName: 'Choir',
          sentAt: new Date('2026-05-11T14:00:00.000Z'),
          sentByName: 'Clubs Lead',
          studentName: 'Linked Learner',
          title: 'Room update',
        },
      ]);
    },
  );
});

describe('club.notify', () => {
  it('allows ClubsAdmin users to notify active signup guardians and stores encrypted body', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: parentUser.id, studentId: linkedStudentId }],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
    });
    const { caller, email } = makeCaller(clubsAdminUser, db);

    await expect(
      caller.club.notify({
        clubId: defaultClubId,
        title: '  Bring water  ',
        body: '  Please bring a labelled water bottle.  ',
      }),
    ).resolves.toEqual({
      id: 'cnotification000000000001',
      clubId: defaultClubId,
      title: 'Bring water',
      sentAt: new Date('2026-05-11T14:00:00.000Z'),
      recipientCount: 1,
      sentCount: 1,
      failedCount: 0,
    });

    expect(db.notifications).toEqual([
      expect.objectContaining({
        bodyEnc: 'enc:Please bring a labelled water bottle.',
        sentById: clubsAdminUser.id,
        title: 'Bring water',
      }),
    ]);
    const sentEmail = email.send.mock.calls[0]?.[0];
    if (!sentEmail) throw new Error('expected notification email');
    expect(sentEmail.to).toBe(`${parentUser.id}@example.com`);
    expect(sentEmail.subject).toBe('Oasis Portal club notification');
    expect(sentEmail.text).toContain('Please bring a labelled water bottle.');

    const notificationAudit = auditCreateArgs(db).find(
      (args) => args.data.entity === 'ClubNotification' && args.data.action === 'Create',
    );
    expect(notificationAudit?.data).toMatchObject({
      entityId: 'cnotification000000000001',
      meta: {
        clubId: defaultClubId,
        recipientCount: 1,
        source: 'club.notify',
      },
    });
    const emailAudit = auditCreateArgs(db).find((args) => args.data.entity === 'Email');
    expect(emailAudit?.data).toMatchObject({
      entity: 'Email',
      meta: {
        clubId: defaultClubId,
        emailStatus: 'Sent',
        notificationId: 'cnotification000000000001',
        source: 'club.notify.email',
        toUserId: parentUser.id,
      },
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('Jane Parent');
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(
      'Please bring a labelled water bottle.',
    );
  });

  it('allows Head users to send club notifications', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
    });

    await expect(
      makeCaller(headUser, db).caller.club.notify({
        clubId: defaultClubId,
        title: 'Choir update',
        body: 'Practice starts at 4pm.',
      }),
    ).resolves.toMatchObject({
      recipientCount: 1,
      sentCount: 1,
      failedCount: 0,
    });
  });

  it('allows assigned ClubsLead users to send club notifications', async () => {
    const db = makeFakeDb({
      guardians: [{ userId: parentUser.id, studentId: linkedStudentId }],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
      leadAssignments: [
        {
          id: 'cleadassign000000000001',
          assignedById: headUser.id,
          clubId: defaultClubId,
          createdAt: new Date('2026-05-11T12:30:00.000Z'),
          userId: clubsLeadUser.id,
        },
      ],
    });

    await expect(
      makeCaller(clubsLeadUser, db).caller.club.notify({
        clubId: defaultClubId,
        title: 'Club lead update',
        body: 'Practice starts at 4pm.',
      }),
    ).resolves.toMatchObject({
      recipientCount: 1,
      sentCount: 1,
      failedCount: 0,
    });
    expect(db.notifications).toEqual([
      expect.objectContaining({
        sentById: clubsLeadUser.id,
        title: 'Club lead update',
      }),
    ]);
  });

  it('rejects inactive clubs before storing or sending notification email', async () => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: inactiveClubId,
          studentId: linkedStudentId,
        }),
      ],
    });
    const { caller, email } = makeCaller(clubsAdminUser, db);

    await expect(
      caller.club.notify({
        clubId: inactiveClubId,
        title: 'Inactive update',
        body: 'This should not send.',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'club is inactive',
    });
    expect(db.notifications).toHaveLength(0);
    expect(email.send).not.toHaveBeenCalled();
  });

  it.each([parentUser, supervisorUser])('blocks %s from sending notifications', async (user) => {
    const db = makeFakeDb({
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
      ],
    });
    const { caller, email } = makeCaller(user, db);

    await expect(
      caller.club.notify({
        clubId: defaultClubId,
        title: 'Choir update',
        body: 'Practice starts at 4pm.',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.notifications).toHaveLength(0);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('stores and audits notification attempts with no recipients without sending email', async () => {
    const db = makeFakeDb({ signups: [] });
    const { caller, email } = makeCaller(clubsAdminUser, db);

    await expect(
      caller.club.notify({
        clubId: defaultClubId,
        title: 'No roster yet',
        body: 'No one is signed up yet.',
      }),
    ).resolves.toMatchObject({
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
    });
    expect(db.notifications).toHaveLength(1);
    expect(email.send).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: clubsAdminUser.id,
        action: 'Create',
        entity: 'ClubNotification',
        entityId: 'cnotification000000000001',
        meta: {
          source: 'club.notify',
          clubId: defaultClubId,
          recipientCount: 0,
        },
      },
    });
  });

  it('dedupes guardians linked to more than one signed-up child', async () => {
    const db = makeFakeDb({
      guardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: parentUser.id, studentId: otherStudentId },
      ],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: defaultClubId,
          studentId: otherStudentId,
        }),
      ],
    });
    const { caller, email } = makeCaller(clubsAdminUser, db);

    await expect(
      caller.club.notify({
        clubId: defaultClubId,
        title: 'Family update',
        body: 'Shared club update.',
      }),
    ).resolves.toMatchObject({
      recipientCount: 1,
      sentCount: 1,
      failedCount: 0,
    });
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0]?.[0].text).toContain('Linked Learner, Other Learner');
  });

  it('audits email failures and returns partial counts without throwing', async () => {
    const db = makeFakeDb({
      guardians: [
        { userId: parentUser.id, studentId: linkedStudentId },
        { userId: otherParentUser.id, studentId: otherStudentId },
      ],
      signups: [
        makeSignup({
          id: 'csignup000000000000001',
          clubId: defaultClubId,
          studentId: linkedStudentId,
        }),
        makeSignup({
          id: 'csignup000000000000002',
          clubId: defaultClubId,
          studentId: otherStudentId,
        }),
      ],
    });
    const failingEmail = makeFakeEmailClient();
    failingEmail.send
      .mockResolvedValueOnce({ id: 'email_sent' })
      .mockRejectedValueOnce(new Error('resend unavailable'));
    const { caller } = makeCaller(clubsAdminUser, db, failingEmail);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        caller.club.notify({
          clubId: defaultClubId,
          title: 'Partial update',
          body: 'One email provider call fails.',
        }),
      ).resolves.toMatchObject({
        recipientCount: 2,
        sentCount: 1,
        failedCount: 1,
      });
    } finally {
      errorSpy.mockRestore();
    }

    const failureAudit = auditCreateArgs(db).find(
      (args) =>
        args.data.entity === 'ClubNotification' &&
        args.data.action === 'Update' &&
        args.data.meta?.['emailStatus'] === 'Failed',
    );
    expect(failureAudit?.data).toMatchObject({
      entityId: 'cnotification000000000001',
      meta: {
        clubId: defaultClubId,
        emailStatus: 'Failed',
        source: 'club.notify.email',
        toUserId: otherParentUser.id,
      },
    });
  });
});
