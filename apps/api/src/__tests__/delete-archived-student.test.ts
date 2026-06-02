import { describe, expect, it, vi } from 'vitest';
import { deleteArchivedStudent } from '../students/delete-archived-student.js';

function delegate() {
  return {
    delete: vi.fn().mockResolvedValue({ id: 'student_1' }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: 'student_user_1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
}

function makeTx() {
  return {
    attendance: delegate(),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    behaviourEntry: delegate(),
    childNote: delegate(),
    clubAttendance: delegate(),
    clubSignup: delegate(),
    guardian: delegate(),
    incidentReportParentCopy: delegate(),
    incidentReportStudent: delegate(),
    investmentAccount: delegate(),
    investmentTransaction: delegate(),
    meritLedger: delegate(),
    paceAdvancementApproval: delegate(),
    paceProgress: delegate(),
    paceRecord: delegate(),
    permissionSlipAnswer: delegate(),
    permissionSlipRecipient: delegate(),
    schoolFeeInvoice: delegate(),
    schoolFeeInvoiceStudent: delegate(),
    shopPurchase: delegate(),
    shopReservation: delegate(),
    student: delegate(),
    studentRegistrationConsent: delegate(),
    studentRegistrationProfile: delegate(),
    studentSubject: delegate(),
    termReport: delegate(),
    titheConfig: delegate(),
    titheRun: delegate(),
    user: delegate(),
  };
}

function makeDb(tx = makeTx()) {
  return {
    tx,
    db: {
      $transaction: vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) => callback(tx)),
    },
  };
}

describe('deleteArchivedStudent', () => {
  it('rejects active students before deleting linked records', async () => {
    const { db, tx } = makeDb();
    tx.student.findUnique.mockResolvedValue({ id: 'student_1', active: true, userId: null });

    await expect(
      deleteArchivedStudent(db, { actorUserId: 'support_1', studentId: 'student_1' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'student must be archived before deletion',
    });

    expect(tx.student.delete).not.toHaveBeenCalled();
    expect(tx.guardian.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('cascades archived student-owned records, preserves invoice records, and audits deletion', async () => {
    const { db, tx } = makeDb();
    tx.student.findUnique.mockResolvedValue({
      id: 'student_1',
      active: false,
      userId: 'student_user_1',
    });

    await expect(
      deleteArchivedStudent(db, { actorUserId: 'support_1', studentId: 'student_1' }),
    ).resolves.toEqual({
      id: 'student_1',
      deleted: true,
      deactivatedUserId: 'student_user_1',
    });

    expect(tx.schoolFeeInvoice.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'student_1' },
      data: { studentId: null },
    });
    expect(tx.schoolFeeInvoiceStudent.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 'student_1' },
    });
    expect(tx.studentRegistrationConsent.deleteMany).toHaveBeenCalledWith({
      where: { profile: { studentId: 'student_1' } },
    });
    expect(tx.permissionSlipAnswer.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 'student_1' },
    });
    expect(tx.meritLedger.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 'student_1' },
    });
    expect(tx.behaviourEntry.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 'student_1' },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'student_user_1' },
      data: { active: false },
      select: { id: true },
    });
    expect(tx.student.delete).toHaveBeenCalledWith({ where: { id: 'student_1' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'support_1',
        action: 'Delete',
        entity: 'Student',
        entityId: 'student_1',
        meta: {
          source: 'student.deleteArchived',
          deactivatedUserId: 'student_user_1',
        },
      },
    });
  });
});
