import { TRPCError } from '@trpc/server';
import type { AppContext } from '../context.js';

interface DeleteManyDelegate {
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

interface DeleteStudentDelegate {
  delete(args: { where: { id: string } }): Promise<{ id: string }>;
  findUnique(args: {
    where: { id: string };
    select: { id: true; active: true; userId: true };
  }): Promise<{ id: string; active: boolean; userId: string | null } | null>;
}

interface SchoolFeeInvoiceDelegate {
  updateMany(args: {
    where: { studentId: string };
    data: { studentId: null };
  }): Promise<{ count: number }>;
}

interface StudentUserDelegate {
  update(args: {
    where: { id: string };
    data: { active: false };
    select: { id: true };
  }): Promise<{ id: string }>;
}

interface AuditLogDelegate {
  create(args: {
    data: {
      userId: string;
      action: 'Delete';
      entity: 'Student';
      entityId: string;
      meta: { source: 'student.deleteArchived'; deactivatedUserId: string | null };
    };
  }): Promise<unknown>;
}

interface DeleteArchivedStudentTx {
  attendance: DeleteManyDelegate;
  auditLog: AuditLogDelegate;
  behaviourEntry: DeleteManyDelegate;
  childNote: DeleteManyDelegate;
  clubAttendance: DeleteManyDelegate;
  clubSignup: DeleteManyDelegate;
  guardian: DeleteManyDelegate;
  incidentReportParentCopy: DeleteManyDelegate;
  incidentReportStudent: DeleteManyDelegate;
  investmentAccount: DeleteManyDelegate;
  investmentTransaction: DeleteManyDelegate;
  meritLedger: DeleteManyDelegate;
  paceAdvancementApproval: DeleteManyDelegate;
  paceProgress: DeleteManyDelegate;
  paceRecord: DeleteManyDelegate;
  permissionSlipAnswer: DeleteManyDelegate;
  permissionSlipRecipient: DeleteManyDelegate;
  schoolFeeInvoice: SchoolFeeInvoiceDelegate;
  schoolFeeInvoiceStudent: DeleteManyDelegate;
  shopPurchase: DeleteManyDelegate;
  shopReservation: DeleteManyDelegate;
  student: DeleteStudentDelegate;
  studentRegistrationConsent: DeleteManyDelegate;
  studentRegistrationProfile: DeleteManyDelegate;
  studentSubject: DeleteManyDelegate;
  termReport: DeleteManyDelegate;
  titheConfig: DeleteManyDelegate;
  titheRun: DeleteManyDelegate;
  user: StudentUserDelegate;
}

export type DeleteArchivedStudentDb = Pick<AppContext['db'], '$transaction'>;

export interface DeleteArchivedStudentInput {
  actorUserId: string;
  studentId: string;
}

export interface DeleteArchivedStudentResult {
  id: string;
  deleted: true;
  deactivatedUserId: string | null;
}

export async function deleteArchivedStudent(
  db: DeleteArchivedStudentDb,
  input: DeleteArchivedStudentInput,
): Promise<DeleteArchivedStudentResult> {
  return db.$transaction(async (tx: DeleteArchivedStudentTx) => {
    const student = await tx.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, active: true, userId: true },
    });
    if (!student) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'student not found' });
    }
    if (student.active) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'student must be archived before deletion',
      });
    }

    const byStudent = { studentId: student.id };
    await tx.schoolFeeInvoice.updateMany({
      where: byStudent,
      data: { studentId: null },
    });
    await tx.schoolFeeInvoiceStudent.deleteMany({ where: byStudent });
    await tx.permissionSlipAnswer.deleteMany({ where: byStudent });
    await tx.permissionSlipRecipient.deleteMany({ where: byStudent });
    await tx.incidentReportParentCopy.deleteMany({ where: byStudent });
    await tx.incidentReportStudent.deleteMany({ where: byStudent });
    await tx.termReport.deleteMany({ where: byStudent });

    await tx.studentRegistrationConsent.deleteMany({
      where: { profile: byStudent },
    });
    await tx.studentRegistrationProfile.deleteMany({ where: byStudent });

    await tx.meritLedger.deleteMany({ where: byStudent });
    await tx.behaviourEntry.deleteMany({ where: byStudent });
    await tx.childNote.deleteMany({ where: byStudent });
    await tx.paceAdvancementApproval.deleteMany({ where: byStudent });
    await tx.paceProgress.deleteMany({ where: byStudent });
    await tx.paceRecord.deleteMany({ where: byStudent });
    await tx.attendance.deleteMany({ where: byStudent });
    await tx.studentSubject.deleteMany({ where: byStudent });

    await tx.titheConfig.deleteMany({ where: byStudent });
    await tx.titheRun.deleteMany({ where: byStudent });
    await tx.investmentTransaction.deleteMany({ where: byStudent });
    await tx.investmentAccount.deleteMany({ where: byStudent });
    await tx.shopPurchase.deleteMany({ where: byStudent });
    await tx.shopReservation.deleteMany({ where: byStudent });
    await tx.clubAttendance.deleteMany({ where: byStudent });
    await tx.clubSignup.deleteMany({ where: byStudent });
    await tx.guardian.deleteMany({ where: byStudent });

    const deactivatedUser = student.userId
      ? await tx.user.update({
          where: { id: student.userId },
          data: { active: false },
          select: { id: true },
        })
      : null;

    await tx.student.delete({ where: { id: student.id } });
    await tx.auditLog.create({
      data: {
        userId: input.actorUserId,
        action: 'Delete',
        entity: 'Student',
        entityId: student.id,
        meta: {
          source: 'student.deleteArchived',
          deactivatedUserId: deactivatedUser?.id ?? null,
        },
      },
    });

    const result: DeleteArchivedStudentResult = {
      id: student.id,
      deleted: true,
      deactivatedUserId: deactivatedUser?.id ?? null,
    };
    return result;
  });
}
