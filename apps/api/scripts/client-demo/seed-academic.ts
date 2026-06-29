import { dayOffset, decimal, enc } from './helpers.js';
import type { SeedContext } from './types.js';

export async function seedAcademicDemoData(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent, siblingStudent } = ctx;

  await db.studentSubject.createMany({
    data: [
      {
        id: 'clientdemo_student_subject_primary_math',
        studentId: primaryStudent.id,
        subjectId: 'clientdemo_subject_math',
        currentPaceNumber: 1008,
      },
      {
        id: 'clientdemo_student_subject_primary_english',
        studentId: primaryStudent.id,
        subjectId: 'clientdemo_subject_english',
        currentPaceNumber: 1011,
      },
      {
        id: 'clientdemo_student_subject_sibling_science',
        studentId: siblingStudent.id,
        subjectId: 'clientdemo_subject_science',
        currentPaceNumber: 1004,
      },
    ],
  });

  await db.paceRecord.createMany({
    data: [
      {
        id: 'clientdemo_pace_record_primary_math_1007',
        studentId: primaryStudent.id,
        subjectId: 'clientdemo_subject_math',
        paceNumber: 1007,
        selfTestScore: 88,
        paceTestScore: 91,
        completedAt: dayOffset(-3),
        recordedById: 'clientdemo_user_supervisor',
      },
      {
        id: 'clientdemo_pace_record_sibling_science_1003',
        studentId: siblingStudent.id,
        subjectId: 'clientdemo_subject_science',
        paceNumber: 1003,
        selfTestScore: 76,
        paceTestScore: 82,
        completedAt: dayOffset(-5),
        recordedById: 'clientdemo_user_supervisor',
      },
    ],
  });

  await db.paceProgress.createMany({
    data: [
      {
        id: 'clientdemo_pace_progress_primary_math_1007',
        studentId: primaryStudent.id,
        subjectId: 'clientdemo_subject_math',
        paceNumber: 1007,
        startedAt: dayOffset(-10),
        completedAt: dayOffset(-3),
        completedByRecordId: 'clientdemo_pace_record_primary_math_1007',
        finalTestAttempts: 1,
      },
      {
        id: 'clientdemo_pace_progress_primary_english_1011',
        studentId: primaryStudent.id,
        subjectId: 'clientdemo_subject_english',
        paceNumber: 1011,
        startedAt: dayOffset(-2),
        finalTestAttempts: 0,
      },
    ],
  });

  await db.attendance.createMany({
    data: [
      {
        id: 'clientdemo_attendance_primary_today',
        studentId: primaryStudent.id,
        date: dayOffset(0),
        status: 'Present',
        recordedById: 'clientdemo_user_supervisor',
      },
      {
        id: 'clientdemo_attendance_primary_late',
        studentId: primaryStudent.id,
        date: dayOffset(-1),
        status: 'Late',
        recordedById: 'clientdemo_user_supervisor',
      },
      {
        id: 'clientdemo_attendance_sibling_absent',
        studentId: siblingStudent.id,
        date: dayOffset(-1),
        status: 'Absent',
        absenceReason: 'Sick',
        recordedById: 'clientdemo_user_supervisor',
      },
    ],
  });

  await db.staffAttendance.createMany({
    data: [
      {
        id: 'clientdemo_staff_attendance_supervisor',
        staffUserId: 'clientdemo_user_supervisor',
        date: dayOffset(0),
        status: 'Present',
        recordedById: 'clientdemo_user_head_parent',
      },
      {
        id: 'clientdemo_staff_attendance_clubs_lead',
        staffUserId: 'clientdemo_user_clubs_lead',
        date: dayOffset(0),
        status: 'Present',
        recordedById: 'clientdemo_user_head_parent',
      },
    ],
  });

  await db.behaviourEntry.createMany({
    data: [
      {
        id: 'clientdemo_behaviour_primary_merit',
        studentId: primaryStudent.id,
        type: 'Merit',
        category: 'PACE completion',
        noteEnc: enc('Completed Maths PACE 1007 with strong independent correction.'),
        visibility: 'General',
        meritDelta: 15,
        recordedById: 'clientdemo_user_supervisor',
        paceRecordId: 'clientdemo_pace_record_primary_math_1007',
      },
      {
        id: 'clientdemo_behaviour_primary_general_note',
        studentId: primaryStudent.id,
        type: 'General',
        category: 'Pastoral note',
        noteEnc: enc('Settled well after lunch and helped a younger student organise work.'),
        visibility: 'General',
        meritDelta: 0,
        recordedById: 'clientdemo_user_pastor',
      },
      {
        id: 'clientdemo_behaviour_sibling_demerit',
        studentId: siblingStudent.id,
        type: 'Demerit',
        category: 'Focus',
        noteEnc: enc('Needed a reset reminder during independent study.'),
        visibility: 'Sensitive',
        meritDelta: -3,
        recordedById: 'clientdemo_user_supervisor',
      },
    ],
  });

  await db.childNote.create({
    data: {
      id: 'clientdemo_childnote_primary_pastoral',
      studentId: primaryStudent.id,
      noteEnc: enc('Parent asked for encouragement around morning routines.'),
      sensitive: false,
      createdById: 'clientdemo_user_pastor',
    },
  });

  await seedMeritEconomy(ctx);
}

async function seedMeritEconomy(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent, siblingStudent, now } = ctx;

  await db.meritLedger.createMany({
    data: [
      {
        id: 'clientdemo_ledger_primary_merit',
        studentId: primaryStudent.id,
        account: 'Spend',
        delta: 15,
        reason: 'PACE completion merit',
        relatedEntryId: 'clientdemo_behaviour_primary_merit',
      },
      {
        id: 'clientdemo_ledger_primary_shop_hold',
        studentId: primaryStudent.id,
        account: 'ShopReserved',
        delta: 12,
        reason: 'Reservation hold',
      },
      {
        id: 'clientdemo_ledger_primary_tithe',
        studentId: primaryStudent.id,
        account: 'TithePaid',
        delta: 5,
        reason: 'Weekly tithe demo',
      },
      {
        id: 'clientdemo_ledger_sibling_balance',
        studentId: siblingStudent.id,
        account: 'Spend',
        delta: 24,
        reason: 'Starter demo balance',
      },
    ],
  });

  await db.titheConfig.create({
    data: {
      studentId: primaryStudent.id,
      percentage: 10,
      cadence: 'Weekly',
      mode: 'Percentage',
      lastRunAt: dayOffset(-2),
    },
  });

  await db.titheRun.create({
    data: {
      id: 'clientdemo_tithe_primary_week',
      studentId: primaryStudent.id,
      cadence: 'Weekly',
      periodStart: dayOffset(-7),
      periodEnd: dayOffset(-1),
      grossMerits: 50,
      titheAmount: 5,
    },
  });

  await db.investmentAccount.create({
    data: { studentId: primaryStudent.id, units: decimal('3.250000') },
  });

  await db.investmentInstrument.create({
    data: {
      id: 'clientdemo_instrument_oasis_index',
      symbol: 'ODI',
      provider: 'demo',
      providerSymbol: 'OASIS_DEMO_INDEX',
      displayName: 'Oasis Demo Index',
      kind: 'fund',
      exchangeMic: 'XLON',
      sourceCurrency: 'GBP',
      riskBand: 'Balanced',
      category: 'Demo',
      summary: 'Synthetic index used only for client demo investment screens.',
      themeColor: '#2f7d6d',
      enabled: true,
      sortOrder: 1,
    },
  });

  await db.marketDataSnapshot.create({
    data: {
      id: 'clientdemo_market_snapshot_oasis_index',
      instrumentId: 'clientdemo_instrument_oasis_index',
      provider: 'demo',
      providerTimestamp: now,
      serverFetchedAt: now,
      sourceCurrency: 'GBP',
      sourcePrice: decimal('10.000000'),
      gbpConversionRate: decimal('1.000000'),
      gbpPrice: decimal('10.000000'),
      previousCloseGbp: decimal('9.750000'),
      dayChangePct: decimal('0.025641'),
      rawPayloadHash: 'clientdemo-market-snapshot',
    },
  });

  await db.investmentHolding.create({
    data: {
      id: 'clientdemo_holding_primary_oasis_index',
      studentId: primaryStudent.id,
      instrumentId: 'clientdemo_instrument_oasis_index',
      units: decimal('3.250000'),
      costBasisMerits: 32,
    },
  });
}
