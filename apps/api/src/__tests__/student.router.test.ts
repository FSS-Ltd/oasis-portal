import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { createStudentRouter } from '../routers/student.js';
import { router } from '../trpc.js';
import {
  decryptTestValue as decrypt,
  encryptTestValue as encrypt,
} from './helpers/test-encryption.js';

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
const primarySupervisorUser: SessionUser = {
  id: 'ckuserprimarysup000000001',
  role: 'Supervisor',
  tags: ['supervisor-primary-students'],
  requires2fa: false,
};
const studentUser: SessionUser = {
  id: 'ckuserstudent00000000001',
  role: 'Student',
  tags: [],
  requires2fa: false,
};

const studentId = 'ckstudent000000000000001';
const subjectId = 'cksubject000000000000001';

interface StoredSubject {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface StoredAssignment {
  id: string;
  studentId: string;
  subjectId: string;
  currentPaceNumber: number;
}

interface StoredStudent {
  id: string;
  userId: string | null;
  fullNameEnc: string;
  nameBidx: string;
  dobEnc: string;
  addressEnc: string | null;
  yearGroup: string;
  enrolmentDate: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredStudentPortalSettings {
  studentId: string;
  parentAccountLocked: boolean;
  parentLockReasonEnc: string | null;
  headAcademicLocked: boolean;
  headAcademicLockReasonEnc: string | null;
  parentMeritShopBlocked: boolean;
  dailyUsageLimitMinutes: number | null;
  offLimitWeekdays: number[];
  childIconPhotoUrl: string | null;
}

interface StoredStudentPortalUsageMinute {
  studentId: string;
  minuteStartedAt: Date;
  sessionKey: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

interface StoredMeritLedger {
  id?: string;
  studentId: string;
  account: 'Spend' | 'Saving' | 'Investment' | 'ShopReserved';
  delta: number;
  reason?: string;
  relatedEntryId?: string;
  createdAt?: Date;
}

interface StoredPaceRecord {
  studentId: string;
  completedAt: Date | null;
  paceTestScore: number | null;
}

interface StoredAttendance {
  studentId: string;
  date: Date;
  status: 'Present' | 'Late' | 'Absent';
}

interface StoredClubSignup {
  studentId: string;
  status: 'Active' | 'Withdrawn';
  club: { active: boolean };
}

interface StoredShopItem {
  active: boolean;
}

interface StoredFaithCornerContent {
  id: string;
  weeklyTheme: string;
  memoryVerseReference: string;
  memoryVerseTextEnc: string;
  reflectionPromptEnc: string;
  verseOfDayReference: string | null;
  verseOfDayTextEnc: string | null;
  active: boolean;
  publishedAt: Date;
  createdAt: Date;
}

interface StoredStudentNotification {
  id: string;
  studentId: string;
  title: string;
  readAt: Date | null;
  createdAt: Date;
}

interface StudentRow extends StoredStudent {
  subjects: Array<StoredAssignment & { subject: StoredSubject }>;
}

type StudentSelect = Partial<Record<keyof StoredStudent, boolean>> & {
  portalSettings?: { select: { childIconPhotoUrl?: boolean } };
};

interface StoredYearGroupBand {
  id: string;
  name: string;
  standardYears: string[];
  colour: string;
  active: boolean;
}

interface StoredUser {
  id: string;
  emailBidx: string;
}

interface StoredUserInvitation {
  id: string;
  clerkInvitationId: string;
  role: 'Student';
  tags: string[];
  emailEnc: string;
  emailBidx: string;
  status: 'Pending' | 'Accepted' | 'Revoked';
  emailStatus: 'NotSent' | 'Sent' | 'Failed';
  emailMessageId: string | null;
  invitedById: string;
  studentId: string;
}

interface FakeDb {
  $enc: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
    blindIndex: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  userInvitation: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  student: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  yearGroupBand: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  studentPortalSettings: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  studentPortalUsageMinute: {
    count: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  meritLedger: { aggregate: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  paceRecord: { findMany: ReturnType<typeof vi.fn> };
  pacePolicy: { findUnique: ReturnType<typeof vi.fn> };
  attendance: { findMany: ReturnType<typeof vi.fn> };
  clubSignup: { count: ReturnType<typeof vi.fn> };
  faithCornerContent: { findFirst: ReturnType<typeof vi.fn> };
  faithCornerContentLike: {
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  faithCornerComment: { count: ReturnType<typeof vi.fn> };
  studentNotification: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  shopItem: { count: ReturnType<typeof vi.fn> };
  subject: { findUnique: ReturnType<typeof vi.fn> };
  studentSubject: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  staffShift: { findMany: ReturnType<typeof vi.fn> };
}

interface CallerOptions {
  onWithRls?: () => void;
}

function blindIndex(value: string): string {
  return `bidx:${value.trim().toLowerCase()}`;
}

function makeRow(
  student: StoredStudent,
  assignments: StoredAssignment[],
  subjects: StoredSubject[],
): StudentRow {
  return {
    ...student,
    subjects: assignments
      .filter((assignment) => assignment.studentId === student.id)
      .map((assignment) => {
        const subject = subjects.find((candidate) => candidate.id === assignment.subjectId);
        if (!subject) throw new Error('test subject missing');
        return { ...assignment, subject };
      }),
  };
}

function selectedStudent(
  student: StoredStudent,
  select: StudentSelect,
  portalSettings: StoredStudentPortalSettings[],
): Partial<StoredStudent> & { portalSettings?: { childIconPhotoUrl: string | null } | null } {
  const row: Partial<StoredStudent> & {
    portalSettings?: { childIconPhotoUrl: string | null } | null;
  } = {};
  if (select.id) row.id = student.id;
  if (select.userId) row.userId = student.userId;
  if (select.fullNameEnc) row.fullNameEnc = student.fullNameEnc;
  if (select.nameBidx) row.nameBidx = student.nameBidx;
  if (select.dobEnc) row.dobEnc = student.dobEnc;
  if (select.addressEnc) row.addressEnc = student.addressEnc;
  if (select.yearGroup) row.yearGroup = student.yearGroup;
  if (select.enrolmentDate) row.enrolmentDate = student.enrolmentDate;
  if (select.active) row.active = student.active;
  if (select.createdAt) row.createdAt = student.createdAt;
  if (select.updatedAt) row.updatedAt = student.updatedAt;
  if (select.portalSettings) {
    const settings = portalSettings.find((item) => item.studentId === student.id) ?? null;
    row.portalSettings = settings ? { childIconPhotoUrl: settings.childIconPhotoUrl } : null;
  }
  return row;
}

function makePortalSettings(
  input: Partial<StoredStudentPortalSettings> & Pick<StoredStudentPortalSettings, 'studentId'>,
): StoredStudentPortalSettings {
  return {
    parentAccountLocked: false,
    parentLockReasonEnc: null,
    headAcademicLocked: false,
    headAcademicLockReasonEnc: null,
    parentMeritShopBlocked: false,
    dailyUsageLimitMinutes: null,
    offLimitWeekdays: [],
    childIconPhotoUrl: null,
    ...input,
  };
}

function makeUsageMinute(
  input: Partial<StoredStudentPortalUsageMinute> &
    Pick<StoredStudentPortalUsageMinute, 'minuteStartedAt'>,
): StoredStudentPortalUsageMinute {
  return {
    studentId,
    sessionKey: null,
    firstSeenAt: input.minuteStartedAt,
    lastSeenAt: input.minuteStartedAt,
    ...input,
  };
}

function makeFaithCornerContent(
  input: Partial<StoredFaithCornerContent> & Pick<StoredFaithCornerContent, 'id' | 'weeklyTheme'>,
): StoredFaithCornerContent {
  return {
    memoryVerseReference: 'John 3:16',
    memoryVerseTextEnc: encrypt('Memory verse'),
    reflectionPromptEnc: encrypt('Reflection prompt'),
    verseOfDayReference: null,
    verseOfDayTextEnc: null,
    active: true,
    publishedAt: new Date('2026-06-03T09:00:00.000Z'),
    createdAt: new Date('2026-06-03T09:00:00.000Z'),
    ...input,
  };
}

function makeFakeDb(
  input: {
    attendance?: StoredAttendance[];
    clubSignups?: StoredClubSignup[];
    faithCornerContent?: StoredFaithCornerContent[];
    meritLedger?: StoredMeritLedger[];
    notifications?: StoredStudentNotification[];
    paceRecords?: StoredPaceRecord[];
    portalSettings?: Array<
      Partial<StoredStudentPortalSettings> & Pick<StoredStudentPortalSettings, 'studentId'>
    >;
    shopItems?: StoredShopItem[];
    usageMinutes?: Array<
      Partial<StoredStudentPortalUsageMinute> &
        Pick<StoredStudentPortalUsageMinute, 'minuteStartedAt'>
    >;
  } = {},
) {
  const students: StoredStudent[] = [];
  const users: StoredUser[] = [];
  const userInvitations: StoredUserInvitation[] = [];
  const attendance = input.attendance ?? [];
  const clubSignups = input.clubSignups ?? [];
  const faithCornerContent = input.faithCornerContent ?? [];
  const meritLedger = input.meritLedger ?? [];
  const notifications = input.notifications ?? [];
  const paceRecords = input.paceRecords ?? [];
  const portalSettings = (input.portalSettings ?? []).map(makePortalSettings);
  const shopItems = input.shopItems ?? [];
  const usageMinutes = (input.usageMinutes ?? []).map(makeUsageMinute);
  const subjects: StoredSubject[] = [
    { id: subjectId, code: 'MATH', name: 'Mathematics', active: true },
  ];
  const bands: StoredYearGroupBand[] = [
    {
      id: 'band_upper',
      name: 'Upper Primary',
      standardYears: ['Year 5', 'Year 6'],
      colour: '#5B90C5',
      active: true,
    },
    {
      id: 'band_secondary',
      name: 'Secondary',
      standardYears: ['Year 7', 'Year 8'],
      colour: '#7D1C2C',
      active: true,
    },
  ];
  const assignments: StoredAssignment[] = [];

  const db: FakeDb = {
    $enc: {
      encrypt: vi.fn(encrypt),
      decrypt: vi.fn(decrypt),
      blindIndex: vi.fn(blindIndex),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    user: {
      findUnique: vi.fn(({ where }: { where: { emailBidx?: string | null } }) =>
        Promise.resolve(
          where.emailBidx
            ? (users.find((user) => user.emailBidx === where.emailBidx) ?? null)
            : null,
        ),
      ),
    },
    userInvitation: {
      create: vi.fn(({ data }: { data: Omit<StoredUserInvitation, 'id'> }) => {
        const invitation: StoredUserInvitation = {
          id: `invite_${String(userInvitations.length + 1)}`,
          ...data,
        };
        userInvitations.push(invitation);
        return Promise.resolve({ id: invitation.id });
      }),
      findFirst: vi.fn(
        ({ where }: { where: { emailBidx: string; status: StoredUserInvitation['status'] } }) =>
          Promise.resolve(
            userInvitations.find(
              (invitation) =>
                invitation.emailBidx === where.emailBidx && invitation.status === where.status,
            ) ?? null,
          ),
      ),
      update: vi.fn(
        ({ data, where }: { data: Partial<StoredUserInvitation>; where: { id: string } }) => {
          const invitation = userInvitations.find((candidate) => candidate.id === where.id);
          if (!invitation) return Promise.resolve(null);
          Object.assign(invitation, data);
          return Promise.resolve({ id: invitation.id });
        },
      ),
    },
    student: {
      create: vi.fn(
        ({
          data,
          select,
        }: {
          data: Omit<StoredStudent, 'id' | 'userId' | 'active' | 'createdAt' | 'updatedAt'>;
          select?: { id?: boolean };
        }) => {
          const now = new Date('2026-04-27T10:00:00.000Z');
          const student: StoredStudent = {
            id: studentId,
            userId: null,
            active: true,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          students.push(student);
          return Promise.resolve(select?.id ? { id: student.id } : student);
        },
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<StoredStudent> }) => {
        const student = students.find((candidate) => candidate.id === where.id);
        if (!student) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Record not found', {
              code: 'P2025',
              clientVersion: 'test',
            }),
          );
        }
        Object.assign(student, data, { updatedAt: new Date('2026-04-27T11:00:00.000Z') });
        return Promise.resolve(student);
      }),
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: {
            active?: boolean;
            id?: { in: string[] };
            nameBidx?: string;
            yearGroup?: { in: string[] };
          };
        }) =>
          Promise.resolve(
            students
              .filter((student) => where?.active === undefined || student.active === where.active)
              .filter((student) => where?.id?.in === undefined || where.id.in.includes(student.id))
              .filter(
                (student) => where?.nameBidx === undefined || student.nameBidx === where.nameBidx,
              )
              .filter(
                (student) =>
                  where?.yearGroup?.in === undefined ||
                  where.yearGroup.in.includes(student.yearGroup),
              )
              .map((student) => makeRow(student, assignments, subjects)),
          ),
      ),
      findUnique: vi.fn(
        ({
          where,
          select,
        }: {
          where: { id?: string; userId?: string };
          select?: StudentSelect;
        }) => {
          const student = students.find(
            (candidate) =>
              (where.id !== undefined && candidate.id === where.id) ||
              (where.userId !== undefined && candidate.userId === where.userId),
          );
          if (!student) return Promise.resolve(null);
          if (select) return Promise.resolve(selectedStudent(student, select, portalSettings));
          return Promise.resolve(makeRow(student, assignments, subjects));
        },
      ),
    },
    yearGroupBand: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where?: { active?: boolean; name?: { in: string[] } };
        } = {}) =>
          Promise.resolve(
            bands
              .filter((band) => where?.active === undefined || band.active === where.active)
              .filter((band) => where?.name?.in === undefined || where.name.in.includes(band.name))
              .map(({ id, name, standardYears, colour, active }) => ({
                id,
                name,
                standardYears,
                colour,
                active,
              })),
          ),
      ),
      findFirst: vi.fn(
        ({
          where,
        }: {
          where: { active: boolean; name: { equals: string; mode: 'insensitive' } };
          select: { standardYears: true };
        }) => {
          const name = where.name.equals.toLowerCase();
          const band =
            bands.find(
              (candidate) =>
                candidate.active === where.active && candidate.name.toLowerCase() === name,
            ) ?? null;
          return Promise.resolve(band ? { standardYears: band.standardYears } : null);
        },
      ),
    },
    studentPortalSettings: {
      findUnique: vi.fn(({ where }: { where: { studentId: string } }) =>
        Promise.resolve(
          portalSettings.find((settings) => settings.studentId === where.studentId) ?? null,
        ),
      ),
    },
    studentPortalUsageMinute: {
      count: vi.fn(
        ({ where }: { where: { studentId: string; minuteStartedAt: { gte: Date; lt: Date } } }) =>
          Promise.resolve(
            usageMinutes.filter(
              (minute) =>
                minute.studentId === where.studentId &&
                minute.minuteStartedAt >= where.minuteStartedAt.gte &&
                minute.minuteStartedAt < where.minuteStartedAt.lt,
            ).length,
          ),
      ),
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { studentId_minuteStartedAt: { studentId: string; minuteStartedAt: Date } };
          create: StoredStudentPortalUsageMinute;
          update: Partial<Pick<StoredStudentPortalUsageMinute, 'lastSeenAt' | 'sessionKey'>>;
        }) => {
          const existing = usageMinutes.find(
            (minute) =>
              minute.studentId === where.studentId_minuteStartedAt.studentId &&
              minute.minuteStartedAt.getTime() ===
                where.studentId_minuteStartedAt.minuteStartedAt.getTime(),
          );
          if (existing) {
            Object.assign(existing, update);
            return Promise.resolve(existing);
          }
          usageMinutes.push(create);
          return Promise.resolve(create);
        },
      ),
    },
    meritLedger: {
      aggregate: vi.fn(
        ({ where }: { where: { studentId: string; account: StoredMeritLedger['account'] } }) =>
          Promise.resolve({
            _sum: {
              delta:
                meritLedger
                  .filter(
                    (row) => row.studentId === where.studentId && row.account === where.account,
                  )
                  .reduce((sum, row) => sum + row.delta, 0) || null,
            },
          }),
      ),
      findMany: vi.fn(
        ({
          take,
          where,
        }: {
          where: { studentId: string };
          select: { id: true; account: true; createdAt: true; delta: true; reason: true };
          orderBy: { createdAt: 'desc' };
          take: number;
        }) =>
          Promise.resolve(
            meritLedger
              .filter((row) => row.studentId === where.studentId)
              .map((row, index) => ({
                id: row.id ?? `ledger_${String(index)}`,
                account: row.account,
                createdAt: row.createdAt ?? new Date('2026-04-27T10:00:00.000Z'),
                delta: row.delta,
                reason: row.reason,
              }))
              .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
              .slice(0, take),
          ),
      ),
    },
    paceRecord: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            studentId: string;
            completedAt: { gte: Date };
            paceTestScore: { not: null };
          };
        }) =>
          Promise.resolve(
            paceRecords
              .filter(
                (row) =>
                  row.studentId === where.studentId &&
                  row.completedAt !== null &&
                  row.completedAt >= where.completedAt.gte &&
                  row.paceTestScore !== null,
              )
              .map((row) => ({ paceTestScore: row.paceTestScore })),
          ),
      ),
    },
    pacePolicy: {
      findUnique: vi.fn(() => Promise.resolve({ passThreshold: 80 })),
    },
    attendance: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: { studentId: string; date: { gte: Date; lt: Date } };
          select: { status: true };
        }) =>
          Promise.resolve(
            attendance
              .filter(
                (row) =>
                  row.studentId === where.studentId &&
                  row.date >= where.date.gte &&
                  row.date < where.date.lt,
              )
              .map((row) => ({ status: row.status })),
          ),
      ),
    },
    clubSignup: {
      count: vi.fn(
        ({ where }: { where: { studentId: string; status: 'Active'; club: { active: true } } }) =>
          Promise.resolve(
            clubSignups.filter(
              (signup) =>
                signup.studentId === where.studentId &&
                signup.status === where.status &&
                signup.club.active === where.club.active,
            ).length,
          ),
      ),
    },
    faithCornerContent: {
      findFirst: vi.fn(() => {
        const row =
          [...faithCornerContent]
            .filter((content) => content.active)
            .sort(
              (left, right) =>
                right.publishedAt.getTime() - left.publishedAt.getTime() ||
                right.createdAt.getTime() - left.createdAt.getTime(),
            )[0] ?? null;
        return Promise.resolve(
          row
            ? {
                id: row.id,
                weeklyTheme: row.weeklyTheme,
                memoryVerseReference: row.memoryVerseReference,
                memoryVerseTextEnc: row.memoryVerseTextEnc,
                reflectionPromptEnc: row.reflectionPromptEnc,
                verseOfDayReference: row.verseOfDayReference,
                verseOfDayTextEnc: row.verseOfDayTextEnc,
                publishedAt: row.publishedAt,
              }
            : null,
        );
      }),
    },
    faithCornerContentLike: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    faithCornerComment: {
      count: vi.fn().mockResolvedValue(0),
    },
    studentNotification: {
      count: vi.fn(({ where }: { where: { studentId: string; readAt?: null } }) =>
        Promise.resolve(
          notifications.filter(
            (notification) =>
              notification.studentId === where.studentId &&
              (where.readAt !== null || notification.readAt === null),
          ).length,
        ),
      ),
      findMany: vi.fn(
        ({
          take,
          where,
        }: {
          where: { studentId: string };
          select: { id: true; title: true; createdAt: true; readAt: true };
          orderBy: { createdAt: 'desc' };
          take: number;
        }) =>
          Promise.resolve(
            notifications
              .filter((notification) => notification.studentId === where.studentId)
              .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
              .slice(0, take),
          ),
      ),
    },
    shopItem: {
      count: vi.fn(({ where }: { where: { active: true } }) =>
        Promise.resolve(shopItems.filter((item) => item.active === where.active).length),
      ),
    },
    subject: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(subjects.find((subject) => subject.id === where.id) ?? null),
      ),
    },
    studentSubject: {
      create: vi.fn(({ data }: { data: Omit<StoredAssignment, 'id'> }) => {
        const existing = assignments.find(
          (assignment) =>
            assignment.studentId === data.studentId && assignment.subjectId === data.subjectId,
        );
        if (existing) {
          return Promise.reject(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          );
        }
        const assignment: StoredAssignment = { id: 'ckassignment000000000001', ...data };
        assignments.push(assignment);
        return Promise.resolve(assignment);
      }),
      delete: vi.fn(
        ({
          where,
        }: {
          where: { studentId_subjectId: { studentId: string; subjectId: string } };
        }) => {
          const index = assignments.findIndex(
            (candidate) =>
              candidate.studentId === where.studentId_subjectId.studentId &&
              candidate.subjectId === where.studentId_subjectId.subjectId,
          );
          if (index === -1) {
            return Promise.reject(
              new Prisma.PrismaClientKnownRequestError('Record not found', {
                code: 'P2025',
                clientVersion: 'test',
              }),
            );
          }
          const [assignment] = assignments.splice(index, 1);
          return Promise.resolve(assignment);
        },
      ),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { studentId_subjectId: { studentId: string; subjectId: string } };
          data: { currentPaceNumber: number };
        }) => {
          const assignment = assignments.find(
            (candidate) =>
              candidate.studentId === where.studentId_subjectId.studentId &&
              candidate.subjectId === where.studentId_subjectId.subjectId,
          );
          if (!assignment) {
            return Promise.reject(
              new Prisma.PrismaClientKnownRequestError('Record not found', {
                code: 'P2025',
                clientVersion: 'test',
              }),
            );
          }
          assignment.currentPaceNumber = data.currentPaceNumber;
          return Promise.resolve(assignment);
        },
      ),
      findMany: vi.fn(({ where }: { where: { studentId: string; subject: { active: true } } }) =>
        Promise.resolve(
          assignments
            .filter((assignment) => assignment.studentId === where.studentId)
            .map((assignment) => {
              const subject = subjects.find((candidate) => candidate.id === assignment.subjectId);
              if (!subject || subject.active !== where.subject.active) return null;
              return { ...assignment, subject };
            })
            .filter((assignment): assignment is StoredAssignment & { subject: StoredSubject } =>
              Boolean(assignment),
            ),
        ),
      ),
      findUnique: vi.fn(
        ({ where }: { where: { studentId_subjectId: { studentId: string; subjectId: string } } }) =>
          Promise.resolve(
            assignments.find(
              (assignment) =>
                assignment.studentId === where.studentId_subjectId.studentId &&
                assignment.subjectId === where.studentId_subjectId.subjectId,
            ) ?? null,
          ),
      ),
    },
    staffShift: {
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            yearGroupBand: bands[0],
          },
        ]),
      ),
    },
  };

  return {
    db,
    students,
    subjects,
    assignments,
    attendance,
    clubSignups,
    faithCornerContent,
    meritLedger,
    notifications,
    paceRecords,
    portalSettings,
    shopItems,
    usageMinutes,
    userInvitations,
    users,
  };
}

function makeCtx(user: SessionUser | null, db: FakeDb, options: CallerOptions = {}): AppContext {
  return {
    db: db as unknown as AppContext['db'],
    user,
    accountAccessState: user ? 'active' : 'unavailable',
    requestId: 'req_test',
    withRls: async <T>(fn: (tx: RlsTx) => Promise<T>) => {
      options.onWithRls?.();
      return fn(db as unknown as RlsTx);
    },
  } satisfies AppContext;
}

function makeCaller(user: SessionUser | null, db: FakeDb, options: CallerOptions = {}) {
  const appRouter = router({
    student: createStudentRouter({
      appUrl: 'https://portal.example.test',
      clerk: {
        createInvitation: vi.fn(() =>
          Promise.resolve({
            id: 'clerk_invite_student',
            emailAddress: 'jane@example.com',
            status: 'pending',
            url: 'https://accounts.example.test/invite',
          }),
        ),
        findInvitation: vi.fn(),
        revokeInvitation: vi.fn(),
      },
      emailClient: {
        send: vi.fn(() => Promise.resolve({ id: 'email_student_invite' })),
      },
    }),
  });
  return appRouter.createCaller(makeCtx(user, db, options));
}

function makeStudentCreateCaller(user: SessionUser | null, db: FakeDb) {
  const clerk = {
    createInvitation: vi.fn(() =>
      Promise.resolve({
        id: 'clerk_invite_student',
        emailAddress: 'jane@example.com',
        status: 'pending',
        url: 'https://accounts.example.test/invite',
      }),
    ),
    findInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
  };
  const emailClient = {
    send: vi.fn(() => Promise.resolve({ id: 'email_student_invite' })),
  };
  const appRouter = router({
    student: createStudentRouter({
      appUrl: 'https://portal.example.test',
      clerk,
      emailClient,
    }),
  });
  return {
    caller: appRouter.createCaller(makeCtx(user, db)),
    clerk,
    emailClient,
  };
}

async function createStudent(caller: ReturnType<typeof makeCaller>) {
  return caller.student.create({
    fullName: 'Jane Learner',
    email: 'jane@example.com',
    dob: new Date('2014-02-03T00:00:00.000Z'),
    yearGroup: 'Year 6',
    enrolmentDate: new Date('2026-04-27T00:00:00.000Z'),
    address: '12 Oasis Road',
  });
}

describe('student router CRUD', () => {
  it('create -> list stores encrypted PII and returns decrypted DTOs with one decrypt audit row', async () => {
    const { db, students } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(createStudent(caller)).resolves.toEqual({
      id: studentId,
      invitationEmailStatus: 'Sent',
    });

    expect(students[0]).toMatchObject({
      fullNameEnc: 'enc:Jane Learner',
      nameBidx: 'bidx:jane learner',
      dobEnc: 'enc:2014-02-03',
      addressEnc: 'enc:12 Oasis Road',
    });

    const rows = await caller.student.list({ search: ' Jane Learner ' });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: studentId,
      fullName: 'Jane Learner',
      dob: '2014-02-03',
      address: '12 Oasis Road',
      yearGroup: 'Year 6',
      active: true,
      subjects: [],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'Student',
        entityId: studentId,
        meta: { yearGroup: 'Year 6', invitationEmailStatus: 'Sent' },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        meta: { count: 1, source: 'student.list' },
      },
    });
  });

  it('creates a Clerk student invitation and stores email delivery state', async () => {
    const { db, userInvitations } = makeFakeDb();
    const { caller, clerk, emailClient } = makeStudentCreateCaller(headUser, db);

    await expect(createStudent(caller)).resolves.toEqual({
      id: studentId,
      invitationEmailStatus: 'Sent',
    });

    expect(clerk.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: 'jane@example.com',
        publicMetadata: { role: 'Student', tags: [] },
        redirectUrl: 'https://portal.example.test/post-sign-in',
        notify: false,
      }),
    );
    expect(emailClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
      }),
    );
    expect(userInvitations).toEqual([
      expect.objectContaining({
        clerkInvitationId: 'clerk_invite_student',
        role: 'Student',
        emailEnc: 'enc:jane@example.com',
        emailBidx: 'bidx:jane@example.com',
        emailStatus: 'Sent',
        emailMessageId: 'email_student_invite',
        studentId,
      }),
    ]);
  });

  it('keeps the student and marks the invitation failed when email delivery fails', async () => {
    const { db, students, userInvitations } = makeFakeDb();
    const { caller, emailClient } = makeStudentCreateCaller(headUser, db);
    emailClient.send.mockRejectedValueOnce(new Error('Resend down'));

    await expect(createStudent(caller)).resolves.toEqual({
      id: studentId,
      invitationEmailStatus: 'Failed',
    });

    expect(students).toHaveLength(1);
    expect(userInvitations).toEqual([
      expect.objectContaining({
        status: 'Pending',
        emailStatus: 'Failed',
        emailMessageId: null,
      }),
    ]);
  });

  it('allows Supervisor reads but denies Supervisor writes', async () => {
    const { db } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);

    const supervisorCaller = makeCaller(supervisorUser, db);
    await expect(supervisorCaller.student.list()).resolves.toHaveLength(1);
    await expect(supervisorCaller.student.byId({ id: studentId })).resolves.toMatchObject({
      id: studentId,
      fullName: 'Jane Learner',
    });

    await expect(createStudent(supervisorCaller)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      supervisorCaller.student.update({ id: studentId, yearGroup: 'Year 7' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      supervisorCaller.student.assignSubject({ studentId, subjectId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      supervisorCaller.student.setCurrentPace({ studentId, subjectId, currentPaceNumber: 1002 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lists primary children for primary-tagged Supervisors without exposing secondary children', async () => {
    const { db, students } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);
    students.push({
      id: 'ckstudentsecondary000001',
      userId: null,
      fullNameEnc: 'enc:Secondary Learner',
      nameBidx: 'bidx:secondary learner',
      dobEnc: 'enc:2012-02-03',
      addressEnc: null,
      yearGroup: 'Year 8',
      enrolmentDate: new Date('2026-04-27T00:00:00.000Z'),
      active: true,
      createdAt: new Date('2026-04-28T00:00:00.000Z'),
      updatedAt: new Date('2026-04-28T00:00:00.000Z'),
    });
    db.staffShift.findMany.mockResolvedValue([]);

    const rows = await makeCaller(primarySupervisorUser, db).student.list();

    expect(rows.map((row) => row.id)).toEqual([studentId]);
    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          yearGroup: { in: ['Year 5', 'Y5', 'Year 6', 'Y6'] },
        },
      }),
    );
  });

  it('keeps archived students visible to full-admin includeInactive and byId reads', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    await createStudent(caller);

    await expect(caller.student.update({ id: studentId, active: false })).resolves.toEqual({
      id: studentId,
    });
    await expect(caller.student.list()).resolves.toEqual([]);
    await expect(caller.student.list({ includeInactive: true })).resolves.toEqual([
      expect.objectContaining({
        id: studentId,
        fullName: 'Jane Learner',
        active: false,
      }),
    ]);
    await expect(caller.student.byId({ id: studentId })).resolves.toMatchObject({
      id: studentId,
      fullName: 'Jane Learner',
      active: false,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'Student',
        entityId: studentId,
        meta: { fields: ['active'] },
      },
    });
  });

  it('defaults the year group from date of birth when Head does not override it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    try {
      const { db, students } = makeFakeDb();
      const caller = makeCaller(headUser, db);

      await expect(
        caller.student.create({
          fullName: 'Default Year',
          email: 'default-year@example.com',
          dob: new Date('2014-08-31T00:00:00.000Z'),
          enrolmentDate: new Date('2026-04-27T00:00:00.000Z'),
        }),
      ).resolves.toEqual({ id: studentId, invitationEmailStatus: 'Sent' });

      expect(students[0]?.yearGroup).toBe('Year 7');
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: headUser.id,
          action: 'Create',
          entity: 'Student',
          entityId: studentId,
          meta: { yearGroup: 'Year 7', invitationEmailStatus: 'Sent' },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('student.me', () => {
  it('returns the active student profile linked to the signed-in Student user', async () => {
    const { db, students } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;

    const studentCaller = makeCaller(studentUser, db);

    await expect(studentCaller.student.me()).resolves.toEqual({
      id: studentId,
      userId: studentUser.id,
      fullName: 'Jane Learner',
      yearGroup: 'Year 6',
      enrolmentDate: new Date('2026-04-27T00:00:00.000Z'),
      active: true,
      academicScreensEnabled: false,
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: studentUser.id,
        action: 'DecryptPii',
        entity: 'Student',
        entityId: studentId,
        meta: { count: 1, source: 'student.me' },
      },
    });
  });

  it('enables academic screens for students in the configured Secondary band', async () => {
    const { db, students } = makeFakeDb();
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;
    storedStudent.yearGroup = 'Year 7';

    await expect(makeCaller(studentUser, db).student.me()).resolves.toMatchObject({
      id: studentId,
      yearGroup: 'Year 7',
      academicScreensEnabled: true,
    });
  });

  it('does not let non-Student roles or unlinked Student accounts load a profile', async () => {
    const { db } = makeFakeDb();

    await expect(makeCaller(supervisorUser, db).student.me()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(makeCaller(studentUser, db).student.me()).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'student profile not found',
    });
  });

  it('blocks locked Student users from loading their portal profile', async () => {
    const { db, students } = makeFakeDb({
      portalSettings: [{ studentId, headAcademicLocked: true }],
    });
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;

    await expect(makeCaller(studentUser, db).student.me()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Student portal is locked by Oasis Learning Centre for academic reasons.',
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: studentUser.id,
        action: 'PermissionDenied',
        entity: 'student.me',
        entityId: studentId,
        meta: {
          role: 'Student',
          reason: 'AccountLocked',
          lockSource: 'HeadAcademic',
        },
      },
    });
  });
});

describe('student.dashboard', () => {
  async function linkCreatedStudent(db: FakeDb, students: StoredStudent[]) {
    const headCaller = makeCaller(headUser, db);
    await createStudent(headCaller);
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;
    return headCaller;
  }

  it('returns student-safe dashboard summary data for the signed-in student', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00.000Z'));
    try {
      const { db, students } = makeFakeDb({
        attendance: [
          { studentId, date: new Date('2026-06-01T09:00:00.000Z'), status: 'Present' },
          { studentId, date: new Date('2026-06-02T09:00:00.000Z'), status: 'Late' },
        ],
        clubSignups: [{ studentId, status: 'Active', club: { active: true } }],
        faithCornerContent: [
          makeFaithCornerContent({
            id: 'faithdashboard000001',
            weeklyTheme: 'Walk in wisdom',
            memoryVerseReference: 'Proverbs 3:5',
            memoryVerseTextEnc: encrypt('Trust in the Lord.'),
            reflectionPromptEnc: encrypt('What does trust look like today?'),
          }),
        ],
        meritLedger: [
          { studentId, account: 'Spend', delta: 25 },
          { studentId, account: 'Saving', delta: 15 },
          { studentId, account: 'Investment', delta: 10 },
          { studentId, account: 'ShopReserved', delta: -5 },
        ],
        paceRecords: [
          { studentId, completedAt: new Date('2026-05-01T10:00:00.000Z'), paceTestScore: 85 },
          { studentId, completedAt: null, paceTestScore: null },
        ],
        portalSettings: [
          {
            studentId,
            childIconPhotoUrl: 'https://storage.example/student-icons/child.jpg',
          },
        ],
        shopItems: [{ active: true }, { active: false }],
      });
      const headCaller = await linkCreatedStudent(db, students);
      await headCaller.student.assignSubject({ studentId, subjectId, currentPaceNumber: 1034 });

      const dashboard = await makeCaller(studentUser, db).student.dashboard();

      expect(dashboard).toEqual({
        profile: {
          studentId,
          firstName: 'Jane',
          iconInitials: 'JA',
          childIconPhotoUrl: 'https://storage.example/student-icons/child.jpg',
          yearGroup: 'Year 6',
          yearGroupLabel: 'Year 6',
          ageBand: {
            id: 'band_upper',
            name: 'Upper Primary',
            colour: '#5B90C5',
          },
          academicScreensEnabled: false,
        },
        merits: {
          balances: {
            Spend: 25,
            Saving: 15,
            Investment: 10,
            ShopReserved: -5,
            TithePaid: 0,
            Given: 0,
          },
          totalMerits: 45,
          hasActivity: true,
        },
        pace: {
          assignedSubjectCount: 1,
          completedPaceCount: 1,
          currentPaces: [
            {
              subjectCode: 'MATH',
              subjectName: 'Mathematics',
              currentPaceNumber: 1034,
            },
          ],
        },
        attendance: {
          days: 30,
          total: 2,
          Present: 1,
          Late: 1,
          Absent: 0,
          attended: 2,
          attendanceRate: 100,
        },
        notifications: {
          count: 0,
          unreadCount: 0,
          latest: [],
        },
        shortcuts: {
          activeClubCount: 1,
          activeShopItemCount: 1,
        },
        faithCorner: {
          id: 'faithdashboard000001',
          weeklyTheme: 'Walk in wisdom',
          memoryVerse: {
            reference: 'Proverbs 3:5',
            text: 'Trust in the Lord.',
            translation: 'NKJV',
          },
          reflectionPrompt: 'What does trust look like today?',
          verseOfDay: null,
          publishedAt: new Date('2026-06-03T09:00:00.000Z'),
          likeCount: 0,
          commentCount: 0,
          likedByCurrentStudent: false,
          ready: true,
        },
      });
      expect(JSON.stringify(dashboard)).not.toContain('Learner');
      expect(JSON.stringify(dashboard)).not.toContain('2014-02-03');
      expect(JSON.stringify(dashboard)).not.toContain('12 Oasis Road');
      expect(JSON.stringify(dashboard)).not.toContain(supervisorUser.id);
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: studentUser.id,
          action: 'DecryptPii',
          entity: 'Student',
          entityId: studentId,
          meta: { count: 1, source: 'student.dashboard' },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns empty dashboard states when no activity exists', async () => {
    const { db, students } = makeFakeDb();
    await linkCreatedStudent(db, students);

    await expect(makeCaller(studentUser, db).student.dashboard()).resolves.toMatchObject({
      merits: {
        balances: {
          Spend: 0,
          Saving: 0,
          Investment: 0,
          ShopReserved: 0,
        },
        totalMerits: 0,
        hasActivity: false,
      },
      pace: {
        assignedSubjectCount: 0,
        completedPaceCount: 0,
        currentPaces: [],
      },
      attendance: {
        total: 0,
        Present: 0,
        Late: 0,
        Absent: 0,
        attendanceRate: null,
      },
      notifications: {
        count: 0,
        unreadCount: 0,
        latest: [],
      },
      shortcuts: {
        activeClubCount: 0,
        activeShopItemCount: 0,
      },
      faithCorner: {
        id: null,
        weeklyTheme: 'Faith Corner',
        memoryVerse: null,
        reflectionPrompt: null,
        verseOfDay: null,
        publishedAt: null,
        ready: false,
      },
    });
  });
});

describe('student.wallet', () => {
  async function linkCreatedStudent(db: FakeDb, students: StoredStudent[]) {
    await createStudent(makeCaller(headUser, db));
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;
  }

  it('returns student-safe wallet balances and ledger history', async () => {
    const { db, students } = makeFakeDb({
      meritLedger: [
        {
          id: 'ledger_merit',
          studentId,
          account: 'Spend',
          delta: 25,
          reason: 'Scripture Memory with supervisor private note',
          relatedEntryId: 'behaviour_sensitive',
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
        },
        {
          id: 'ledger_demerit',
          studentId,
          account: 'Spend',
          delta: -5,
          reason: 'Demerit: conduct',
          relatedEntryId: 'behaviour_demerit',
          createdAt: new Date('2026-06-02T10:00:00.000Z'),
        },
        {
          id: 'ledger_saving',
          studentId,
          account: 'Saving',
          delta: 10,
          reason: 'transfer:Spend:to:Saving',
          createdAt: new Date('2026-06-03T10:00:00.000Z'),
        },
      ],
    });
    await linkCreatedStudent(db, students);

    const wallet = await makeCaller(studentUser, db).student.wallet();

    expect(wallet).toEqual({
      studentId,
      balances: {
        Spend: 20,
        Saving: 10,
        Investment: 0,
        ShopReserved: 0,
        TithePaid: 0,
        Given: 0,
      },
      totalMerits: 30,
      history: [
        {
          id: 'ledger_saving',
          account: 'Saving',
          createdAt: new Date('2026-06-03T10:00:00.000Z'),
          amount: 10,
          reason: 'transfer:Spend:to:Saving',
        },
        {
          id: 'ledger_demerit',
          account: 'Spend',
          createdAt: new Date('2026-06-02T10:00:00.000Z'),
          amount: -5,
          reason: 'Demerit: conduct',
        },
        {
          id: 'ledger_merit',
          account: 'Spend',
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
          amount: 25,
          reason: 'Scripture Memory with supervisor private note',
        },
      ],
    });
    expect(JSON.stringify(wallet.history)).not.toContain('behaviour_sensitive');
  });

  it('returns empty wallet history when no ledger activity exists', async () => {
    const { db, students } = makeFakeDb();
    await linkCreatedStudent(db, students);

    await expect(makeCaller(studentUser, db).student.wallet()).resolves.toMatchObject({
      balances: {
        Spend: 0,
        Saving: 0,
        Investment: 0,
        ShopReserved: 0,
        TithePaid: 0,
        Given: 0,
      },
      totalMerits: 0,
      history: [],
    });
  });
});

describe('student portal usage limits', () => {
  async function linkCreatedStudent(db: FakeDb, students: StoredStudent[]) {
    await createStudent(makeCaller(headUser, db));
    const storedStudent = students[0];
    if (!storedStudent) throw new Error('test student missing');
    storedStudent.userId = studentUser.id;
  }

  it('records heartbeat minutes for students without configured limits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students, usageMinutes } = makeFakeDb();
      const withRls = vi.fn();
      await linkCreatedStudent(db, students);

      await expect(
        makeCaller(studentUser, db, { onWithRls: withRls }).student.heartbeat({
          sessionKey: 'mobile-session-1',
        }),
      ).resolves.toMatchObject({
        studentId,
        usage: {
          allowed: true,
          blockedWindow: null,
          blockedReason: null,
          daily: { limitMinutes: null, usedMinutes: 1, remainingMinutes: null },
          offLimitWeekdays: [],
        },
      });
      expect(usageMinutes).toHaveLength(1);
      expect(usageMinutes[0]).toMatchObject({
        studentId,
        minuteStartedAt: new Date('2026-06-03T10:15:00.000Z'),
        sessionKey: 'mobile-session-1',
      });
      expect(withRls).toHaveBeenCalledTimes(1);
      expect(db.studentPortalUsageMinute.count).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows student portal access while usage remains under configured limits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students } = makeFakeDb({
        portalSettings: [
          {
            studentId,
            dailyUsageLimitMinutes: 10,
            offLimitWeekdays: [],
          },
        ],
        usageMinutes: [
          { minuteStartedAt: new Date('2026-06-03T10:10:00.000Z') },
          { minuteStartedAt: new Date('2026-06-03T09:10:00.000Z') },
        ],
      });
      await linkCreatedStudent(db, students);

      await expect(makeCaller(studentUser, db).student.me()).resolves.toMatchObject({
        id: studentId,
        fullName: 'Jane Learner',
      });
      await expect(makeCaller(studentUser, db).student.portalUsage()).resolves.toMatchObject({
        studentId,
        usage: {
          allowed: true,
          daily: { limitMinutes: 10, usedMinutes: 2, remainingMinutes: 8 },
          offLimitWeekdays: [],
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads portal usage status with one RLS read', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students } = makeFakeDb({
        portalSettings: [{ studentId, dailyUsageLimitMinutes: 10, offLimitWeekdays: [] }],
        usageMinutes: [{ minuteStartedAt: new Date('2026-06-03T10:10:00.000Z') }],
      });
      const withRls = vi.fn();
      await linkCreatedStudent(db, students);

      await expect(
        makeCaller(studentUser, db, { onWithRls: withRls }).student.portalUsage(),
      ).resolves.toMatchObject({
        studentId,
        usage: {
          allowed: true,
          daily: { limitMinutes: 10, usedMinutes: 1, remainingMinutes: 9 },
          offLimitWeekdays: [],
        },
      });
      expect(withRls).toHaveBeenCalledTimes(1);
      expect(db.studentPortalUsageMinute.count).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks student portal access on an off-limit weekday before recording usage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students, usageMinutes } = makeFakeDb({
        portalSettings: [{ studentId, dailyUsageLimitMinutes: 2, offLimitWeekdays: [3] }],
        usageMinutes: [
          { minuteStartedAt: new Date('2026-06-03T10:05:00.000Z') },
          { minuteStartedAt: new Date('2026-06-03T10:10:00.000Z') },
        ],
      });
      await linkCreatedStudent(db, students);

      await expect(makeCaller(studentUser, db).student.heartbeat()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Student portal is off limits today.',
      });
      expect(usageMinutes).toHaveLength(2);
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: studentUser.id,
          action: 'PermissionDenied',
          entity: 'student.heartbeat',
          entityId: studentId,
          meta: {
            role: 'Student',
            reason: 'OffLimitDay',
            weekday: '3',
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('blocks student portal access when the daily usage limit is reached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const daily = makeFakeDb({
        portalSettings: [{ studentId, dailyUsageLimitMinutes: 2 }],
        usageMinutes: [
          { minuteStartedAt: new Date('2026-06-03T08:05:00.000Z') },
          { minuteStartedAt: new Date('2026-06-03T09:10:00.000Z') },
        ],
      });
      await linkCreatedStudent(daily.db, daily.students);
      await expect(makeCaller(studentUser, daily.db).student.me()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Daily student portal usage limit reached.',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps account locks ahead of usage-limit denials', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T10:15:30.000Z'));
    try {
      const { db, students } = makeFakeDb({
        portalSettings: [{ studentId, headAcademicLocked: true, dailyUsageLimitMinutes: 1 }],
        usageMinutes: [{ minuteStartedAt: new Date('2026-06-03T10:05:00.000Z') }],
      });
      await linkCreatedStudent(db, students);

      await expect(makeCaller(studentUser, db).student.me()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'Student portal is locked by Oasis Learning Centre for academic reasons.',
      });
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: studentUser.id,
          action: 'PermissionDenied',
          entity: 'student.me',
          entityId: studentId,
          meta: {
            role: 'Student',
            reason: 'AccountLocked',
            lockSource: 'HeadAcademic',
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('student subject assignment', () => {
  it('assignSubject creates once, is idempotent, and setCurrentPace updates the assignment', async () => {
    const { db } = makeFakeDb();
    const caller = makeCaller(headUser, db);
    await createStudent(caller);

    await expect(caller.student.assignSubject({ studentId, subjectId })).resolves.toEqual({
      created: true,
      assignmentId: 'ckassignment000000000001',
      currentPaceNumber: 1001,
    });
    await expect(
      caller.student.assignSubject({ studentId, subjectId, currentPaceNumber: 1007 }),
    ).resolves.toEqual({
      created: false,
      assignmentId: 'ckassignment000000000001',
      currentPaceNumber: 1001,
    });
    await expect(
      caller.student.setCurrentPace({ studentId, subjectId, currentPaceNumber: 1008 }),
    ).resolves.toEqual({
      assignmentId: 'ckassignment000000000001',
      currentPaceNumber: 1008,
    });
    await expect(caller.student.unassignSubject({ studentId, subjectId })).resolves.toEqual({
      assignmentId: 'ckassignment000000000001',
      studentId,
      subjectId,
    });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Create',
        entity: 'StudentSubject',
        entityId: 'ckassignment000000000001',
        meta: { studentId, subjectId, currentPaceNumber: 1001 },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Update',
        entity: 'StudentSubject',
        entityId: 'ckassignment000000000001',
        meta: { studentId, subjectId, currentPaceNumber: 1008 },
      },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: headUser.id,
        action: 'Delete',
        entity: 'StudentSubject',
        entityId: 'ckassignment000000000001',
        meta: {
          studentId,
          subjectId,
          previousPaceNumber: 1008,
          historicalPaceRecordsPreserved: true,
        },
      },
    });
  });

  it('rejects missing student, missing subject, inactive subject, and missing pace assignment', async () => {
    const { db, subjects } = makeFakeDb();
    const caller = makeCaller(headUser, db);

    await expect(caller.student.assignSubject({ studentId, subjectId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'student not found',
    });

    await createStudent(caller);
    await expect(
      caller.student.assignSubject({ studentId, subjectId: 'cksubjectmissing0000001' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'subject not found' });

    const existingSubject = subjects[0];
    if (!existingSubject) throw new Error('test subject missing');
    subjects[0] = { ...existingSubject, active: false };
    await expect(caller.student.assignSubject({ studentId, subjectId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'subject is inactive',
    });

    await expect(
      caller.student.setCurrentPace({ studentId, subjectId, currentPaceNumber: 1002 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'student subject not found' });
    await expect(caller.student.unassignSubject({ studentId, subjectId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'student subject not found',
    });
  });
});
