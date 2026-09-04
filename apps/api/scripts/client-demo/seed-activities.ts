import { dayOffset, enc } from './helpers.js';
import type { SeedContext } from './types.js';

export async function seedActivitiesDemoData(ctx: SeedContext): Promise<void> {
  await seedClubs(ctx);
  await seedShop(ctx);
  await seedHomework(ctx);
  await seedFaithCorner(ctx);
  await seedCommunity(ctx);
}

async function seedClubs(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent, siblingStudent } = ctx;

  await db.club.create({
    data: {
      id: 'clientdemo_club_choir',
      name: 'Demo Choir',
      description: 'Synthetic club used for client demo signups and attendance.',
      schedule: 'Tuesdays after centre',
      scheduleStartDate: dayOffset(7),
      scheduleStartMinute: 15 * 60 + 30,
      scheduleEndMinute: 16 * 60 + 30,
      scheduleFrequency: 'Weekly',
      capacity: 18,
      iconKey: 'music',
      accentColor: '#7c4dff',
      createdById: 'clientdemo_user_clubs_admin',
      yearGroupBands: {
        create: {
          yearGroupBandId: 'clientdemo_band_upper_primary',
        },
      },
    },
  });

  await db.clubLeadAssignment.create({
    data: {
      id: 'clientdemo_club_choir_lead',
      clubId: 'clientdemo_club_choir',
      userId: 'clientdemo_user_clubs_lead',
      assignedById: 'clientdemo_user_clubs_admin',
    },
  });

  await db.clubSignup.createMany({
    data: [
      {
        id: 'clientdemo_club_signup_primary',
        clubId: 'clientdemo_club_choir',
        studentId: primaryStudent.id,
        signedUpByUserId: 'clientdemo_user_parent',
        status: 'Active',
      },
      {
        id: 'clientdemo_club_signup_sibling',
        clubId: 'clientdemo_club_choir',
        studentId: siblingStudent.id,
        signedUpByUserId: 'clientdemo_user_parent',
        status: 'Pending',
      },
    ],
  });

  await db.clubNotification.create({
    data: {
      id: 'clientdemo_club_notification_choir',
      clubId: 'clientdemo_club_choir',
      title: 'Demo choir rehearsal',
      bodyEnc: enc('Please bring the demo lyric sheet next session.'),
      sentById: 'clientdemo_user_clubs_lead',
    },
  });

  await db.clubAttendance.create({
    data: {
      id: 'clientdemo_club_attendance_primary',
      clubId: 'clientdemo_club_choir',
      studentId: primaryStudent.id,
      sessionDate: dayOffset(-6),
      status: 'Present',
      recordedById: 'clientdemo_user_clubs_lead',
    },
  });
}

async function seedShop(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent } = ctx;

  await db.shopItem.createMany({
    data: [
      {
        id: 'clientdemo_shop_item_notebook',
        name: 'Demo Notebook',
        category: 'Stationery',
        blurb: 'A synthetic shop item for reservation workflows.',
        description: 'A lined notebook used only in the demo environment.',
        priceExVat: 10,
        vatRatePct: 20,
        priceIncVat: 12,
        stockCount: 24,
        lowStockThreshold: 5,
        createdById: 'clientdemo_user_shopkeeper',
      },
      {
        id: 'clientdemo_shop_item_reward',
        name: 'Demo Reward Token',
        category: 'Recognition',
        blurb: 'A recognition reward for student portal demonstrations.',
        description: 'Synthetic recognition reward.',
        priceExVat: 20,
        vatRatePct: 0,
        priceIncVat: 20,
        stockCount: 8,
        lowStockThreshold: 3,
        createdById: 'clientdemo_user_shopkeeper',
      },
    ],
  });

  await db.shopReservation.create({
    data: {
      id: 'clientdemo_shop_reservation_primary',
      studentId: primaryStudent.id,
      reservedById: 'clientdemo_user_student',
      status: 'Ready',
      totalPriceMerits: 12,
    },
  });

  await db.shopReservationLine.create({
    data: {
      id: 'clientdemo_shop_reservation_line_primary',
      reservationId: 'clientdemo_shop_reservation_primary',
      itemId: 'clientdemo_shop_item_notebook',
      unitsReserved: 1,
      unitPriceMerits: 12,
      totalPriceMerits: 12,
    },
  });
}

async function seedHomework(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent, now } = ctx;

  await db.homeworkAssignment.create({
    data: {
      id: 'clientdemo_homework_assignment_math',
      title: 'Demo Maths corrections',
      descriptionEnc: enc('Complete corrections for the synthetic PACE exercise.'),
      dueDate: dayOffset(5),
      submissionMethod: 'UploadImage',
      allYearGroupBands: false,
      createdById: 'clientdemo_user_supervisor',
    },
  });

  await db.homeworkAssignmentBand.create({
    data: {
      assignmentId: 'clientdemo_homework_assignment_math',
      yearGroupBandId: 'clientdemo_band_upper_primary',
    },
  });

  await db.homeworkSubmission.create({
    data: {
      id: 'clientdemo_homework_submission_primary',
      assignmentId: 'clientdemo_homework_assignment_math',
      studentId: primaryStudent.id,
      submittedAt: dayOffset(-1),
      reviewedAt: now,
      reviewedById: 'clientdemo_user_supervisor',
      scorePercent: 92,
      commentsEnc: enc('Clear corrections and good working shown.'),
      meritAmount: 5,
    },
  });
}

async function seedFaithCorner(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent, now } = ctx;

  await db.faithCornerContent.create({
    data: {
      id: 'clientdemo_faith_week',
      weeklyTheme: 'Courage in small choices',
      memoryVerseReference: 'Joshua 1:9',
      memoryVerseTextEnc: enc('Synthetic verse text for demo review only.'),
      reflectionPromptEnc: enc('Where did you show courage in your learning this week?'),
      verseOfDayReference: 'Psalm 23:1',
      verseOfDayTextEnc: enc('Synthetic verse of the day text.'),
      createdById: 'clientdemo_user_pastor',
      updatedById: 'clientdemo_user_pastor',
    },
  });

  await db.faithCornerContentLike.create({
    data: { contentId: 'clientdemo_faith_week', studentId: primaryStudent.id },
  });

  await db.faithCornerComment.create({
    data: {
      id: 'clientdemo_faith_comment_primary',
      contentId: 'clientdemo_faith_week',
      studentId: primaryStudent.id,
      bodyEnc: enc('I showed courage by asking for help with Maths.'),
      status: 'Approved',
      reviewedById: 'clientdemo_user_pastor',
      reviewedAt: now,
    },
  });
}

async function seedCommunity(ctx: SeedContext): Promise<void> {
  const { db, plan, primaryStudent, now } = ctx;

  await db.communityGroup.create({
    data: {
      id: 'clientdemo_community_group_primary',
      title: 'Demo Student Encouragement',
      descriptionEnc: enc('A synthetic student community group for portal messaging.'),
      isCentral: true,
      isPublic: true,
      createdById: 'clientdemo_user_head_parent',
      updatedById: 'clientdemo_user_head_parent',
    },
  });

  await db.communityGroupMember.createMany({
    data: plan.students.map((student) => ({
      groupId: 'clientdemo_community_group_primary',
      studentId: student.id,
      updatedById: 'clientdemo_user_head_parent',
      updatedAt: now,
    })),
  });

  await db.communityMessage.create({
    data: {
      id: 'clientdemo_community_message_primary',
      groupId: 'clientdemo_community_group_primary',
      senderStudentId: primaryStudent.id,
      bodyEnc: enc('Welcome to the demo community space.'),
    },
  });
}
