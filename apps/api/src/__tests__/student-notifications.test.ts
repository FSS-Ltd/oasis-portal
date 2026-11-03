import { describe, expect, it, vi } from 'vitest';
import type { RlsTx } from '../context.js';
import { encryptTestValue } from './helpers/test-encryption.js';
import {
  createStudentNotification,
  createStudentNotifications,
} from '../services/student-notifications.js';

// Real push implementation would use these root delegates. Persistence helpers must not.
function fixture() {
  const rootRead = vi
    .fn()
    .mockRejectedValue(new Error('root read while transaction owns connection'));
  const ctx = {
    db: {
      $enc: { encrypt: encryptTestValue },
      student: { findMany: rootRead },
      pushDeviceToken: { findMany: rootRead },
    },
    user: null,
  };
  const tx = {
    studentNotification: {
      create: vi.fn().mockResolvedValue({ id: 'notice' }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  // Prisma delegates expose many methods; this fixture implements only the writes under test.
  return {
    ctx,
    tx,
    db: tx as unknown as Pick<RlsTx, 'auditLog' | 'studentNotification'>,
    rootRead,
  };
}

const notification = {
  studentId: 'student',
  kind: 'MeritAward' as const,
  title: 'Merits awarded',
  body: 'You received merits.',
};

describe('student notification persistence', () => {
  it('creates a single notification and audit using only the transaction client', async () => {
    const { ctx, tx, db, rootRead } = fixture();
    await expect(createStudentNotification(ctx, db, notification)).resolves.toEqual({
      id: 'notice',
    });
    expect(tx.studentNotification.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(rootRead).not.toHaveBeenCalled();
  });

  it('creates batch notifications and audit without acquiring a root connection', async () => {
    const { ctx, tx, db, rootRead } = fixture();
    await expect(
      createStudentNotifications(ctx, db, {
        notifications: [notification],
        auditSource: 'test',
      }),
    ).resolves.toEqual({ count: 1 });
    expect(tx.studentNotification.createMany).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(rootRead).not.toHaveBeenCalled();
  });
});
