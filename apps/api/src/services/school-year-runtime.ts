import { academicYearStart } from '@oasis/domain';
import {
  reconcileStudentSchoolYears,
  SchoolYearReconciliationConflictError,
  type SchoolYearReconciliationDb,
  type SchoolYearReconciliationSummary,
} from './school-year-reconciliation.js';

type Reconcile = typeof reconcileStudentSchoolYears;
type PendingReconciliation = { year: number; promise: Promise<SchoolYearReconciliationSummary> };

async function reconcileWithRetry(
  reconcile: Reconcile,
  db: SchoolYearReconciliationDb,
  asOf: Date,
): Promise<SchoolYearReconciliationSummary> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await reconcile(db, asOf);
    } catch (error) {
      if (!(error instanceof SchoolYearReconciliationConflictError) || attempt === 3) throw error;
    }
  }
}

/** One startup catch-up per tenant/client and academic year, with no idle database reads. */
export function createSchoolYearSynchronizer(
  reconcile: Reconcile = reconcileStudentSchoolYears,
): (db: SchoolYearReconciliationDb, asOf?: Date) => Promise<SchoolYearReconciliationSummary> {
  const pending = new WeakMap<SchoolYearReconciliationDb, PendingReconciliation>();
  return function ensureSchoolYearsCurrent(
    db: SchoolYearReconciliationDb,
    asOf: Date = new Date(),
  ): Promise<SchoolYearReconciliationSummary> {
    const year = academicYearStart(asOf).getUTCFullYear();
    const previous = pending.get(db);
    if (previous && previous.year >= year) return previous.promise;
    const run = () => reconcileWithRetry(reconcile, db, asOf);
    const promise = previous ? previous.promise.catch(() => undefined).then(run) : run();
    pending.set(db, { year, promise });
    void promise.catch(() => {
      if (pending.get(db)?.promise === promise) pending.delete(db);
    });
    return promise;
  };
}

export const ensureSchoolYearsCurrent = createSchoolYearSynchronizer();
