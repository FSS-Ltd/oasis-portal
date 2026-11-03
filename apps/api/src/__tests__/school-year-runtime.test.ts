import { describe, expect, it, vi } from 'vitest';
import { createSchoolYearSynchronizer } from '../services/school-year-runtime.js';
import {
  SchoolYearReconciliationConflictError,
  type SchoolYearReconciliationDb,
  type SchoolYearReconciliationSummary,
} from '../services/school-year-reconciliation.js';

const beforeSeptember = new Date('2026-08-31T22:59:59Z');
const afterSeptember = new Date('2026-08-31T23:00:00Z');
const completed: SchoolYearReconciliationSummary = {
  academicYearStart: 2025,
  status: 'Completed',
  scannedCount: 2,
  updatedCount: 1,
  unchangedCount: 1,
  unavailableDobCount: 0,
  outsideSchoolAgeCount: 0,
};

function client(): SchoolYearReconciliationDb {
  return {
    $enc: { decrypt: (value) => value ?? null },
    $transaction: () => Promise.reject(new Error('The injected reconciler owns database access')),
  };
}

describe('school-year startup and boundary synchronization', () => {
  it('shares one startup operation and makes no idle database discovery reads', async () => {
    let finish: (summary: SchoolYearReconciliationSummary) => void = () => {};
    const reconcile = vi.fn(
      () =>
        new Promise<SchoolYearReconciliationSummary>((resolve) => {
          finish = resolve;
        }),
    );
    const ensure = createSchoolYearSynchronizer(reconcile);
    const db = client();
    const first = ensure(db, beforeSeptember);
    const concurrent = ensure(db, beforeSeptember);
    expect(concurrent).toBe(first);
    finish(completed);
    await first;
    await ensure(db, beforeSeptember);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('reconciles again only at the September boundary and isolates database clients', async () => {
    const reconcile = vi
      .fn<
        (db: SchoolYearReconciliationDb, asOf?: Date) => Promise<SchoolYearReconciliationSummary>
      >()
      .mockResolvedValue(completed);
    const ensure = createSchoolYearSynchronizer(reconcile);
    const live = client();
    const review = client();
    await ensure(live, beforeSeptember);
    await ensure(live, afterSeptember);
    await ensure(review, afterSeptember);
    await ensure(live, afterSeptember);
    expect(reconcile).toHaveBeenCalledTimes(3);
    expect(reconcile.mock.calls.map(([db]) => db)).toEqual([live, live, review]);
  });

  it('does not cache a failed catch-up and bounds conflicting update retries', async () => {
    const reconcile = vi
      .fn()
      .mockRejectedValueOnce(new SchoolYearReconciliationConflictError())
      .mockRejectedValueOnce(new SchoolYearReconciliationConflictError())
      .mockRejectedValueOnce(new SchoolYearReconciliationConflictError())
      .mockResolvedValue(completed);
    const ensure = createSchoolYearSynchronizer(reconcile);
    const db = client();
    await expect(ensure(db, afterSeptember)).rejects.toBeInstanceOf(
      SchoolYearReconciliationConflictError,
    );
    expect(reconcile).toHaveBeenCalledTimes(3);
    await expect(ensure(db, afterSeptember)).resolves.toEqual(completed);
    expect(reconcile).toHaveBeenCalledTimes(4);
  });

  it('does not retry decryption or other permanent failures', async () => {
    const reconcile = vi.fn().mockRejectedValue(new Error('Decryption failed'));
    const ensure = createSchoolYearSynchronizer(reconcile);
    await expect(ensure(client(), afterSeptember)).rejects.toThrow('Decryption failed');
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
