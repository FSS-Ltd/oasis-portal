import type { PrismaClient } from '@prisma/client';
import type { ClientDemoPlan } from './plan.js';

const CLIENT_DEMO_ID_PREFIX = 'clientdemo_';

type CountCheck = {
  label: string;
  expected: number;
  readActual: () => Promise<number>;
};

export type CompletedCountCheck = {
  label: string;
  expected: number;
  actual: number;
};

export type ClientDemoDatabaseVerificationSummary = {
  checks: CompletedCountCheck[];
  checkedUsers: number;
  checkedStudents: number;
};

export async function verifyClientDemoDatabase(
  db: PrismaClient,
  plan: ClientDemoPlan,
): Promise<ClientDemoDatabaseVerificationSummary> {
  const failures: string[] = [];
  const checks = await runCountChecks(buildCountChecks(db, plan));

  for (const check of checks) {
    if (check.actual !== check.expected) {
      failures.push(
        `${check.label}: expected ${String(check.expected)}, found ${String(check.actual)}.`,
      );
    }
  }

  failures.push(...(await verifyNoLiveIdentityRows(db)));
  failures.push(...(await verifyPlannedUsers(db, plan)));
  failures.push(...(await verifyPlannedStudents(db, plan)));

  if (failures.length > 0) {
    throw new Error(`Client demo database verification failed:\n${failures.join('\n')}`);
  }

  return {
    checks,
    checkedUsers: plan.users.length,
    checkedStudents: plan.students.length,
  };
}

function buildCountChecks(db: PrismaClient, plan: ClientDemoPlan): CountCheck[] {
  const userIds = plan.users.map((user) => user.id);
  const studentIds = plan.students.map((student) => student.id);
  const primaryStudentId = 'clientdemo_student_primary';

  return [
    {
      label: 'demo users',
      expected: plan.users.length,
      readActual: () => db.user.count({ where: { id: { in: userIds } } }),
    },
    {
      label: 'demo students',
      expected: plan.students.length,
      readActual: () => db.student.count({ where: { id: { in: studentIds } } }),
    },
    {
      label: 'head-parent guardian links',
      expected: plan.students.length,
      readActual: () =>
        db.guardian.count({
          where: { userId: 'clientdemo_user_head_parent', studentId: { in: studentIds } },
        }),
    },
    {
      label: 'parent guardian links',
      expected: plan.students.length,
      readActual: () =>
        db.guardian.count({
          where: { userId: 'clientdemo_user_parent', studentId: { in: studentIds } },
        }),
    },
    {
      label: 'student portal settings',
      expected: plan.students.length,
      readActual: () =>
        db.studentPortalSettings.count({ where: { studentId: { in: studentIds } } }),
    },
    {
      label: 'subjects',
      expected: 3,
      readActual: () =>
        db.subject.count({
          where: {
            id: {
              in: [
                'clientdemo_subject_math',
                'clientdemo_subject_english',
                'clientdemo_subject_science',
              ],
            },
          },
        }),
    },
    {
      label: 'year group bands',
      expected: 1,
      readActual: () => db.yearGroupBand.count({ where: { id: 'clientdemo_band_upper_primary' } }),
    },
    {
      label: 'student subjects',
      expected: 3,
      readActual: () => db.studentSubject.count({ where: { studentId: { in: studentIds } } }),
    },
    {
      label: 'pace records',
      expected: 2,
      readActual: () => db.paceRecord.count({ where: { studentId: { in: studentIds } } }),
    },
    {
      label: 'pace progress rows',
      expected: 2,
      readActual: () => db.paceProgress.count({ where: { studentId: { in: studentIds } } }),
    },
    {
      label: 'student attendance rows',
      expected: 3,
      readActual: () => db.attendance.count({ where: { studentId: { in: studentIds } } }),
    },
    {
      label: 'staff attendance rows',
      expected: 2,
      readActual: () =>
        db.staffAttendance.count({
          where: {
            id: {
              in: [
                'clientdemo_staff_attendance_supervisor',
                'clientdemo_staff_attendance_clubs_lead',
              ],
            },
          },
        }),
    },
    {
      label: 'behaviour entries',
      expected: 3,
      readActual: () => db.behaviourEntry.count({ where: { studentId: { in: studentIds } } }),
    },
    {
      label: 'child notes',
      expected: 1,
      readActual: () =>
        db.childNote.count({ where: { id: 'clientdemo_childnote_primary_pastoral' } }),
    },
    {
      label: 'merit ledger rows',
      expected: 4,
      readActual: () => db.meritLedger.count({ where: { studentId: { in: studentIds } } }),
    },
    {
      label: 'tithe config rows',
      expected: 1,
      readActual: () => db.titheConfig.count({ where: { studentId: primaryStudentId } }),
    },
    {
      label: 'tithe run rows',
      expected: 1,
      readActual: () => db.titheRun.count({ where: { id: 'clientdemo_tithe_primary_week' } }),
    },
    {
      label: 'investment account rows',
      expected: 1,
      readActual: () => db.investmentAccount.count({ where: { studentId: primaryStudentId } }),
    },
    {
      label: 'investment instruments',
      expected: 1,
      readActual: () =>
        db.investmentInstrument.count({ where: { id: 'clientdemo_instrument_oasis_index' } }),
    },
    {
      label: 'market data snapshots',
      expected: 1,
      readActual: () =>
        db.marketDataSnapshot.count({ where: { id: 'clientdemo_market_snapshot_oasis_index' } }),
    },
    {
      label: 'investment holdings',
      expected: 1,
      readActual: () =>
        db.investmentHolding.count({ where: { id: 'clientdemo_holding_primary_oasis_index' } }),
    },
    {
      label: 'staff notices',
      expected: 1,
      readActual: () => db.staffNotice.count({ where: { id: 'clientdemo_staff_notice_week' } }),
    },
    {
      label: 'staff notice reads',
      expected: 1,
      readActual: () =>
        db.staffNoticeRead.count({ where: { noticeId: 'clientdemo_staff_notice_week' } }),
    },
    {
      label: 'calendar events',
      expected: 1,
      readActual: () => db.calendarEvent.count({ where: { id: 'clientdemo_calendar_trip' } }),
    },
    {
      label: 'permission slips',
      expected: 1,
      readActual: () => db.permissionSlip.count({ where: { id: 'clientdemo_permission_trip' } }),
    },
    {
      label: 'permission slip recipients',
      expected: 2,
      readActual: () =>
        db.permissionSlipRecipient.count({ where: { slipId: 'clientdemo_permission_trip' } }),
    },
    {
      label: 'permission slip answers',
      expected: 1,
      readActual: () =>
        db.permissionSlipAnswer.count({ where: { slipId: 'clientdemo_permission_trip' } }),
    },
    {
      label: 'parent-staff message threads',
      expected: 1,
      readActual: () =>
        db.messageThread.count({ where: { id: 'clientdemo_thread_parent_supervisor' } }),
    },
    {
      label: 'parent-staff messages',
      expected: 2,
      readActual: () =>
        db.message.count({ where: { threadId: 'clientdemo_thread_parent_supervisor' } }),
    },
    {
      label: 'incident reports',
      expected: 1,
      readActual: () => db.incidentReport.count({ where: { id: 'clientdemo_incident_primary' } }),
    },
    {
      label: 'incident parent copies',
      expected: 1,
      readActual: () =>
        db.incidentReportParentCopy.count({
          where: { id: 'clientdemo_incident_parent_copy_primary' },
        }),
    },
    {
      label: 'clubs',
      expected: 1,
      readActual: () => db.club.count({ where: { id: 'clientdemo_club_choir' } }),
    },
    {
      label: 'club signups',
      expected: 2,
      readActual: () => db.clubSignup.count({ where: { clubId: 'clientdemo_club_choir' } }),
    },
    {
      label: 'club notifications',
      expected: 1,
      readActual: () =>
        db.clubNotification.count({ where: { id: 'clientdemo_club_notification_choir' } }),
    },
    {
      label: 'club attendance',
      expected: 1,
      readActual: () =>
        db.clubAttendance.count({ where: { id: 'clientdemo_club_attendance_primary' } }),
    },
    {
      label: 'shop items',
      expected: 2,
      readActual: () =>
        db.shopItem.count({ where: { id: { startsWith: 'clientdemo_shop_item_' } } }),
    },
    {
      label: 'shop reservations',
      expected: 1,
      readActual: () =>
        db.shopReservation.count({ where: { id: 'clientdemo_shop_reservation_primary' } }),
    },
    {
      label: 'homework assignments',
      expected: 1,
      readActual: () =>
        db.homeworkAssignment.count({ where: { id: 'clientdemo_homework_assignment_math' } }),
    },
    {
      label: 'homework submissions',
      expected: 1,
      readActual: () =>
        db.homeworkSubmission.count({ where: { id: 'clientdemo_homework_submission_primary' } }),
    },
    {
      label: 'faith corner content',
      expected: 1,
      readActual: () => db.faithCornerContent.count({ where: { id: 'clientdemo_faith_week' } }),
    },
    {
      label: 'faith corner comments',
      expected: 1,
      readActual: () =>
        db.faithCornerComment.count({ where: { id: 'clientdemo_faith_comment_primary' } }),
    },
    {
      label: 'community groups',
      expected: 1,
      readActual: () =>
        db.communityGroup.count({ where: { id: 'clientdemo_community_group_primary' } }),
    },
    {
      label: 'community group members',
      expected: 2,
      readActual: () =>
        db.communityGroupMember.count({ where: { groupId: 'clientdemo_community_group_primary' } }),
    },
    {
      label: 'community messages',
      expected: 1,
      readActual: () =>
        db.communityMessage.count({ where: { id: 'clientdemo_community_message_primary' } }),
    },
    {
      label: 'school fee invoices',
      expected: 1,
      readActual: () => db.schoolFeeInvoice.count({ where: { id: 'clientdemo_invoice_primary' } }),
    },
    {
      label: 'school fee invoice line items',
      expected: 1,
      readActual: () =>
        db.schoolFeeInvoiceLineItem.count({ where: { invoiceId: 'clientdemo_invoice_primary' } }),
    },
    {
      label: 'school fee invoice discounts',
      expected: 1,
      readActual: () =>
        db.schoolFeeInvoiceDiscount.count({ where: { id: 'clientdemo_invoice_primary_discount' } }),
    },
    {
      label: 'term reports',
      expected: 1,
      readActual: () => db.termReport.count({ where: { id: 'clientdemo_term_report_primary' } }),
    },
    {
      label: 'student notifications',
      expected: 2,
      readActual: () => db.studentNotification.count({ where: { studentId: primaryStudentId } }),
    },
    {
      label: 'audit marker',
      expected: 1,
      readActual: () => db.auditLog.count({ where: { id: 'clientdemo_audit_seed' } }),
    },
  ];
}

async function runCountChecks(checks: CountCheck[]): Promise<CompletedCountCheck[]> {
  const completedChecks: CompletedCountCheck[] = [];

  for (const check of checks) {
    completedChecks.push({
      label: check.label,
      expected: check.expected,
      actual: await check.readActual(),
    });
  }

  return completedChecks;
}

async function verifyNoLiveIdentityRows(db: PrismaClient): Promise<string[]> {
  const [nonDemoUsers, nonDemoStudents] = await Promise.all([
    db.user.count({ where: { NOT: { id: { startsWith: CLIENT_DEMO_ID_PREFIX } } } }),
    db.student.count({ where: { NOT: { id: { startsWith: CLIENT_DEMO_ID_PREFIX } } } }),
  ]);
  const failures: string[] = [];

  if (nonDemoUsers > 0) {
    failures.push(`Demo database contains ${String(nonDemoUsers)} non-demo user row(s).`);
  }
  if (nonDemoStudents > 0) {
    failures.push(`Demo database contains ${String(nonDemoStudents)} non-demo student row(s).`);
  }

  return failures;
}

async function verifyPlannedUsers(db: PrismaClient, plan: ClientDemoPlan): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { id: { in: plan.users.map((user) => user.id) } },
    select: { id: true, role: true, active: true, clerkId: true, tags: true },
  });
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const failures: string[] = [];

  for (const expected of plan.users) {
    const row = rowsById.get(expected.id);
    if (!row) {
      failures.push(`Missing database user ${expected.id}.`);
      continue;
    }
    if (row.role !== expected.role) {
      failures.push(
        `Database user ${expected.id} has role ${row.role}, expected ${expected.role}.`,
      );
    }
    if (!row.active) {
      failures.push(`Database user ${expected.id} is not active.`);
    }
    if (!row.clerkId) {
      failures.push(`Database user ${expected.id} is missing a Clerk id.`);
    }
    if (!sameStringSet(row.tags, expected.tags)) {
      failures.push(
        `Database user ${expected.id} has tags ${row.tags.join(',')}, expected ${expected.tags.join(',')}.`,
      );
    }
  }

  return failures;
}

async function verifyPlannedStudents(db: PrismaClient, plan: ClientDemoPlan): Promise<string[]> {
  const rows = await db.student.findMany({
    where: { id: { in: plan.students.map((student) => student.id) } },
    select: { id: true, userId: true, active: true },
  });
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const failures: string[] = [];

  for (const expected of plan.students) {
    const row = rowsById.get(expected.id);
    if (!row) {
      failures.push(`Missing database student ${expected.id}.`);
      continue;
    }
    if (!row.active) {
      failures.push(`Database student ${expected.id} is not active.`);
    }
    if (row.userId !== expected.userId) {
      failures.push(
        `Database student ${expected.id} has login ${String(row.userId)}, expected ${String(expected.userId)}.`,
      );
    }
  }

  return failures;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightValues = new Set(right);
  return left.every((value) => rightValues.has(value));
}
