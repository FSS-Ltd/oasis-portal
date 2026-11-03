import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DatabaseModule from '@oasis/db';

const { live, review, synchronize } = vi.hoisted(() => ({
  live: { user: { findUnique: vi.fn() } },
  review: { user: { findUnique: vi.fn() } },
  synchronize: vi.fn(),
}));

vi.mock('@oasis/db', async (importOriginal) => ({
  ...(await importOriginal<typeof DatabaseModule>()),
  prisma: live,
  getReviewPrisma: () => Promise.resolve(review),
}));
vi.mock('../services/school-year-runtime.js', () => ({ ensureSchoolYearsCurrent: synchronize }));

import { createContext } from '../context.js';

const user = { id: 'staff', role: 'Supervisor', tags: [], active: true };
const summary = {
  academicYearStart: 2026,
  status: 'Completed',
  scannedCount: 0,
  updatedCount: 0,
  unchangedCount: 0,
  unavailableDobCount: 0,
  outsideSchoolAgeCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  live.user.findUnique.mockResolvedValue(user);
  review.user.findUnique.mockResolvedValue(null);
  synchronize.mockResolvedValue(summary);
});

describe('school-year reconciliation at the authenticated read boundary', () => {
  it('waits for catch-up before returning a context that can read students and reports', async () => {
    let entered: () => void = () => {};
    let finish: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    synchronize.mockImplementation(() => {
      entered();
      return gate;
    });
    let returned = false;
    const result = createContext({ headers: new Headers(), clerkUserId: 'clerk-staff' }).then(
      (context) => {
        returned = true;
        return context;
      },
    );
    await started;
    expect(returned).toBe(false);
    finish();
    const context = await result;
    expect(context.db).toBe(live);
    expect(synchronize).toHaveBeenCalledWith(live);
  });

  it('does not run privileged maintenance for anonymous, deactivated, or 2FA-pending sessions', async () => {
    await createContext({ headers: new Headers() });
    live.user.findUnique.mockResolvedValue({ ...user, active: false });
    await createContext({ headers: new Headers(), clerkUserId: 'inactive' });
    live.user.findUnique.mockResolvedValue({ ...user, role: 'Head' });
    await createContext({
      headers: new Headers(),
      clerkUserId: 'head',
      enforceTwoFactor: true,
      twoFactorSatisfied: false,
    });
    expect(synchronize).not.toHaveBeenCalled();
  });

  it('keeps health and authorized repair contexts available after a reconciliation failure', async () => {
    synchronize.mockRejectedValue(new Error('Unreadable DOB ciphertext'));
    await expect(createContext({ headers: new Headers(), clerkUserId: 'staff' })).rejects.toThrow(
      'Unreadable DOB ciphertext',
    );
    const context = await createContext({
      headers: new Headers(),
      clerkUserId: 'staff',
      skipSchoolYearSync: true,
    });
    expect(context.user?.id).toBe('staff');
    expect(synchronize).toHaveBeenCalledTimes(1);
  });

  it('uses only the admitted review tenant, and never uses a disallowed tenant', async () => {
    live.user.findUnique.mockResolvedValue(null);
    review.user.findUnique.mockResolvedValue(user);
    await createContext({ headers: new Headers(), clerkUserId: 'review-staff' });
    expect(synchronize).not.toHaveBeenCalled();
    const context = await createContext({
      headers: new Headers(),
      clerkUserId: 'review-staff',
      allowReviewTenant: true,
    });
    expect(context.db).toBe(review);
    expect(synchronize).toHaveBeenCalledWith(review);
    expect(synchronize).not.toHaveBeenCalledWith(live);
  });
});
