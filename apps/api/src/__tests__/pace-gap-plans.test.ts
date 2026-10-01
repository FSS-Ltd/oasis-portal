import { describe, expect, it, vi } from 'vitest';
import type { AppContext, RlsTx } from '../context.js';
import { reopenGapPlan } from '../pace/pace-gap-plans.js';

const HEAD = { id: 'head_1', role: 'Head', tags: [], requires2fa: false } as const;

describe('PACE gap plan review', () => {
  it('reopens only unresolved gaps, clears the review flag, and switches to the earliest gap', async () => {
    const plan = {
      id: 'gap_plan_1',
      studentId: 'student_1',
      subjectId: 'subject_1',
      jumpToPaceNumber: 1044,
      status: 'Active',
      version: 2,
      reviewRequiredAt: new Date('2026-04-20T09:00:00.000Z'),
      completedAt: null,
      cancelledAt: null,
      items: [
        { id: 'item_1023', paceNumber: 1023, removedAt: null },
        { id: 'item_1024', paceNumber: 1024, removedAt: null },
      ],
    };
    const updatePlan = vi.fn().mockResolvedValue({});
    const updateAssignment = vi.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      paceGapPlan: {
        findUnique: vi.fn().mockResolvedValue(plan),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: plan.id }]),
        update: updatePlan,
      },
      pacePolicy: { findUnique: vi.fn().mockResolvedValue({ passThreshold: 80 }) },
      paceProgress: {
        findMany: vi.fn().mockResolvedValue([{ paceNumber: 1023 }]),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
      paceRecord: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      student: { findUnique: vi.fn().mockResolvedValue({ id: plan.studentId, active: true }) },
      subject: { findUnique: vi.fn().mockResolvedValue({ active: true, code: 'ENG' }) },
      studentSubject: {
        findUnique: vi.fn().mockResolvedValue({ id: 'assignment_1', currentPaceNumber: 1044 }),
        update: updateAssignment,
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as RlsTx;
    const db = {
      $transaction: vi.fn(async (operation: (transaction: RlsTx) => Promise<unknown>) =>
        operation(tx),
      ),
    } as unknown as AppContext['db'];
    const ctx: AppContext = {
      db,
      user: HEAD,
      accountAccessState: 'active',
      requestId: 'request_1',
      withRls: async (operation) => operation(tx),
    };

    const result = await reopenGapPlan(ctx, { planId: plan.id, expectedVersion: 2 });

    expect(result).toMatchObject({ status: 'Active', currentPaceNumber: 1024, version: 3 });
    expect(updatePlan).toHaveBeenCalledWith({
      where: { id: plan.id },
      data: {
        status: 'Active',
        jumpToPaceNumber: 1044,
        reviewRequiredAt: null,
        completedAt: null,
        cancelledAt: null,
        version: { increment: 1 },
        updatedById: HEAD.id,
      },
    });
    expect(updateAssignment).toHaveBeenCalledWith({
      where: { studentId_subjectId: { studentId: plan.studentId, subjectId: plan.subjectId } },
      data: { currentPaceNumber: 1024 },
    });
  });
});
