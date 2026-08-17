import { dayOffset, enc, encodedJson } from './helpers.js';
import type { SeedContext } from './types.js';

export async function seedFinanceReportDemoData(ctx: SeedContext): Promise<void> {
  await seedSchoolFees(ctx);
  await seedTermReport(ctx);
  await seedStudentNotifications(ctx);
  await seedAuditMarker(ctx);
}

async function seedSchoolFees(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent } = ctx;

  await db.schoolFeeInvoice.create({
    data: {
      id: 'clientdemo_invoice_primary',
      invoiceNumber: 'DEMO-INV-001',
      studentId: primaryStudent.id,
      status: 'PaymentPending',
      schoolYear: 2026,
      billingCadence: 'Term',
      familyLabelEnc: enc('Demo family'),
      term: '2026-Summer',
      issuedOn: dayOffset(-14),
      dueOn: dayOffset(14),
      subtotalAmountPence: 35000,
      discountAmountPence: 3500,
      totalAmountPence: 31500,
      discountExplanationEnc: enc('Demo sibling discount applied.'),
      originalFileNameEnc: enc('demo-invoice.pdf'),
      fileSizeBytes: 1280,
      pdfBytesEnc: enc('Synthetic PDF bytes placeholder for demo environment.'),
      extractedTextEnc: enc('Demo invoice extracted text.'),
      createdById: 'clientdemo_user_head_parent',
      parentMarkedPaidAt: dayOffset(-1),
      parentMarkedPaidById: 'clientdemo_user_parent',
    },
  });

  await db.schoolFeeInvoiceLineItem.create({
    data: {
      id: 'clientdemo_invoice_primary_line_tuition',
      invoiceId: 'clientdemo_invoice_primary',
      position: 1,
      descriptionEnc: enc('Summer term learning fees'),
      quantity: 1,
      unitAmountPence: 35000,
      totalAmountPence: 35000,
    },
  });

  await db.schoolFeeInvoiceStudent.create({
    data: { invoiceId: 'clientdemo_invoice_primary', studentId: primaryStudent.id, position: 1 },
  });

  await db.schoolFeeInvoiceDiscount.create({
    data: {
      id: 'clientdemo_invoice_primary_discount',
      invoiceId: 'clientdemo_invoice_primary',
      position: 1,
      labelEnc: enc('Demo sibling discount'),
      kind: 'Preset',
      presetCode: 'DEMO-SIBLING',
      percentBps: 1000,
      baseAmountPence: 35000,
      appliedAmountPence: 3500,
    },
  });
}

async function seedTermReport(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent } = ctx;

  await db.termReport.create({
    data: {
      id: 'clientdemo_term_report_primary',
      studentId: primaryStudent.id,
      periodKey: '2026-Summer',
      periodType: 'Term',
      periodLabel: 'Summer 2026',
      periodStart: new Date('2026-04-01T00:00:00.000Z'),
      periodEnd: new Date('2026-08-31T00:00:00.000Z'),
      status: 'Sent',
      compiledJsonEnc: encodedJson({
        demo: true,
        attendance: 'Mostly present',
        pace: 'Maths PACE 1007 complete',
        behaviour: 'Positive learning habits',
      }),
      sentAt: dayOffset(-2),
    },
  });
}

async function seedStudentNotifications(ctx: SeedContext): Promise<void> {
  const { db, primaryStudent } = ctx;

  await db.studentNotification.createMany({
    data: [
      {
        id: 'clientdemo_notification_primary_merit',
        studentId: primaryStudent.id,
        kind: 'MeritAward',
        title: 'Merits awarded',
        bodyEnc: enc('You earned 15 demo merits for completing Maths PACE 1007.'),
        sourceEntity: 'BehaviourEntry',
        sourceId: 'clientdemo_behaviour_primary_merit',
        createdById: 'clientdemo_user_supervisor',
      },
      {
        id: 'clientdemo_notification_primary_club',
        studentId: primaryStudent.id,
        kind: 'ClubNotice',
        title: 'Choir update',
        bodyEnc: enc('Demo choir has a rehearsal next Tuesday.'),
        sourceEntity: 'ClubNotification',
        sourceId: 'clientdemo_club_notification_choir',
        createdById: 'clientdemo_user_clubs_lead',
      },
    ],
  });
}

async function seedAuditMarker(ctx: SeedContext): Promise<void> {
  const { db, plan } = ctx;

  await db.auditLog.create({
    data: {
      id: 'clientdemo_audit_seed',
      userId: 'clientdemo_user_head_parent',
      action: 'Create',
      entity: 'ClientDemoSeed',
      entityId: 'clientdemo',
      meta: { demo: true, coverage: plan.coverage },
    },
  });
}
