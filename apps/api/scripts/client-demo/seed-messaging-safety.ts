import { dayOffset, enc } from './helpers.js';
import type { SeedContext } from './types.js';

export async function seedMessagingSafetyDemoData(ctx: SeedContext): Promise<void> {
  await seedStaffNotice(ctx);
  await seedPermissionSlip(ctx);
  await seedParentStaffMessages(ctx);
  await seedIncident(ctx);
}

async function seedStaffNotice(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;

  await db.staffNotice.create({
    data: {
      id: 'clientdemo_staff_notice_week',
      title: 'Demo week priorities',
      bodyEnc: enc('Focus on PACE check-ins, permission slip responses, and club attendance.'),
      audience: 'Both',
      postedById: 'clientdemo_user_head_parent',
      expiresAt: dayOffset(14),
    },
  });

  await db.staffNoticeRead.create({
    data: {
      noticeId: 'clientdemo_staff_notice_week',
      userId: 'clientdemo_user_supervisor',
      readAt: now,
    },
  });
}

async function seedPermissionSlip(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent, siblingStudent } = ctx;

  await db.calendarEvent.create({
    data: {
      id: 'clientdemo_calendar_trip',
      title: 'Demo museum learning trip',
      descriptionEnc: enc('Synthetic trip event linked to a permission slip.'),
      audience: 'Parents',
      category: 'Trips',
      startDate: dayOffset(21),
      endDate: dayOffset(21),
      startTimeMinutes: 9 * 60,
      endTimeMinutes: 15 * 60,
      createdById: 'clientdemo_user_head_parent',
    },
  });

  await db.permissionSlip.create({
    data: {
      id: 'clientdemo_permission_trip',
      title: 'Museum learning trip consent',
      category: 'SchoolTrip',
      descriptionEnc: enc('Consent and packed lunch confirmation for the demo trip.'),
      eventDate: dayOffset(21),
      deadline: dayOffset(10),
      departureTimeMinutes: 9 * 60,
      returnTimeMinutes: 15 * 60,
      locationEnc: enc('Demo City Museum'),
      transportEnc: enc('Minibus'),
      costEnc: enc('GBP 4.50'),
      consentTextEnc: enc('I consent to my child attending the demo learning trip.'),
      requireMedical: true,
      requireEmergencyContact: true,
      requirePayment: true,
      recipientLabel: 'Demo family',
      calendarEventId: 'clientdemo_calendar_trip',
      createdById: 'clientdemo_user_head_parent',
    },
  });

  await db.permissionSlipQuestion.create({
    data: {
      id: 'clientdemo_permission_trip_question_lunch',
      slipId: 'clientdemo_permission_trip',
      position: 1,
      labelEnc: enc('Does your child need a centre-provided packed lunch?'),
      required: true,
    },
  });

  await db.permissionSlipBringItem.createMany({
    data: [
      {
        id: 'clientdemo_permission_trip_item_water',
        slipId: 'clientdemo_permission_trip',
        position: 1,
        labelEnc: enc('Water bottle'),
      },
      {
        id: 'clientdemo_permission_trip_item_coat',
        slipId: 'clientdemo_permission_trip',
        position: 2,
        labelEnc: enc('Waterproof coat'),
      },
    ],
  });

  await db.permissionSlipRecipient.createMany({
    data: [
      {
        slipId: 'clientdemo_permission_trip',
        studentId: primaryStudent.id,
        position: 1,
        responseStatus: 'Signed',
        signatureSource: 'ParentPortal',
        parentNameEnc: enc('Priya Demo Parent'),
        signedAt: dayOffset(-1),
        medicalInfoEnc: enc('No demo medical notes.'),
        emergencyContactEnc: enc('Priya Demo Parent, 07000 000000'),
        parentRespondedById: 'clientdemo_user_parent',
        paymentStatus: 'PaymentPending',
        parentMarkedPaidAt: dayOffset(-1),
        parentMarkedPaidById: 'clientdemo_user_parent',
      },
      {
        slipId: 'clientdemo_permission_trip',
        studentId: siblingStudent.id,
        position: 2,
        responseStatus: 'Pending',
        paymentStatus: 'Unpaid',
      },
    ],
  });

  await db.permissionSlipAnswer.create({
    data: {
      questionId: 'clientdemo_permission_trip_question_lunch',
      slipId: 'clientdemo_permission_trip',
      studentId: primaryStudent.id,
      answerEnc: enc('No, packed lunch from home.'),
    },
  });
}

async function seedParentStaffMessages(ctx: SeedContext): Promise<void> {
  const { db } = ctx;

  await db.messageThread.create({
    data: {
      id: 'clientdemo_thread_parent_supervisor',
      kind: 'ParentStaff',
      parentId: 'clientdemo_user_parent',
      supervisorId: 'clientdemo_user_supervisor',
      subject: 'Demo weekly check-in',
    },
  });

  await db.messageThreadParticipant.createMany({
    data: [
      { threadId: 'clientdemo_thread_parent_supervisor', userId: 'clientdemo_user_parent' },
      { threadId: 'clientdemo_thread_parent_supervisor', userId: 'clientdemo_user_supervisor' },
    ],
  });

  await db.message.createMany({
    data: [
      {
        id: 'clientdemo_message_parent_checkin',
        threadId: 'clientdemo_thread_parent_supervisor',
        senderId: 'clientdemo_user_parent',
        bodyEnc: enc('Could we keep an eye on Ava settling into morning study?'),
        createdAt: dayOffset(-2),
      },
      {
        id: 'clientdemo_message_supervisor_reply',
        threadId: 'clientdemo_thread_parent_supervisor',
        senderId: 'clientdemo_user_supervisor',
        bodyEnc: enc('Yes, she has had two calm starts this week and completed her checklist.'),
        createdAt: dayOffset(-1),
      },
    ],
  });
}

async function seedIncident(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent } = ctx;

  await db.incidentReport.create({
    data: {
      id: 'clientdemo_incident_primary',
      reportNumber: 'DEMO-INC-001',
      type: 'AccidentFirstAid',
      severity: 'Low',
      confidentiality: 'ParentViewableAfterSignOff',
      status: 'SignedOff',
      occurredAt: dayOffset(-8),
      locationEnc: enc('Demo playground'),
      activityEnc: enc('Outdoor break'),
      factualAccountEnc: enc('Student tripped during a demo scenario and was checked by staff.'),
      immediateActionsEnc: enc('Area checked, parent notified, no further action required.'),
      injurySustained: true,
      bodyAreaEnc: enc('Left knee'),
      firstAidGiven: true,
      firstAiderId: 'clientdemo_user_supervisor',
      parentCarerNotified: true,
      parentNotifiedAt: dayOffset(-8),
      parentVisibilityRequested: true,
      recordedById: 'clientdemo_user_supervisor',
      signedOffById: 'clientdemo_user_head_parent',
      signedOffAt: dayOffset(-7),
    },
  });

  await db.incidentReportStudent.create({
    data: { reportId: 'clientdemo_incident_primary', studentId: primaryStudent.id, position: 1 },
  });

  await db.incidentReportStaff.create({
    data: {
      id: 'clientdemo_incident_staff_supervisor',
      reportId: 'clientdemo_incident_primary',
      userId: 'clientdemo_user_supervisor',
      kind: 'StaffInvolved',
      roleLabelEnc: enc('First aider'),
      position: 1,
    },
  });

  await db.incidentReportParentCopy.create({
    data: {
      id: 'clientdemo_incident_parent_copy_primary',
      reportId: 'clientdemo_incident_primary',
      studentId: primaryStudent.id,
      status: 'Shared',
      parentSummaryEnc: enc(
        'Minor playground trip. First aid given and child returned to learning.',
      ),
      redactionsEnc: enc('Staff-only notes removed.'),
      sharingReasonEnc: enc('Parent-visible signed-off first aid incident.'),
      generatedById: 'clientdemo_user_head_parent',
      generatedAt: dayOffset(-7),
      sharedById: 'clientdemo_user_head_parent',
      sharedAt: dayOffset(-7),
    },
  });

  await db.incidentReportParentRecipient.createMany({
    data: [
      {
        copyId: 'clientdemo_incident_parent_copy_primary',
        guardianId: 'clientdemo_user_parent',
        acknowledgedAt: dayOffset(-6),
      },
      {
        copyId: 'clientdemo_incident_parent_copy_primary',
        guardianId: 'clientdemo_user_head_parent',
      },
    ],
  });

  await db.incidentReportEvent.create({
    data: {
      id: 'clientdemo_incident_event_signed_off',
      reportId: 'clientdemo_incident_primary',
      actorId: 'clientdemo_user_head_parent',
      type: 'SignedOff',
      noteEnc: enc('Demo incident signed off for parent visibility.'),
      meta: { demo: true },
    },
  });
}
