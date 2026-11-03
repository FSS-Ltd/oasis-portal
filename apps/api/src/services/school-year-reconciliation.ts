import {
  academicYearStart,
  OUTSIDE_SCHOOL_AGE_LABEL,
  resolveSchoolYearForDob,
  SCHOOL_AGE_UNAVAILABLE_LABEL,
} from '@oasis/domain';

const RECONCILIATION_ENTITY = 'SchoolYearReconciliation';
const RECONCILIATION_SOURCE = 'student.schoolYearReconciliation';

interface SchoolYearRow {
  id: string;
  dobEnc: string;
  yearGroup: string;
}

interface SchoolYearReconciliationTx {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  student: {
    findMany(input: {
      where: { yearGroupOverride: null };
      select: { id: true; dobEnc: true; yearGroup: true };
      orderBy: { id: 'asc' };
    }): Promise<SchoolYearRow[]>;
    updateMany(input: {
      where: { id: string; dobEnc: string; yearGroup: string; yearGroupOverride: null };
      data: { yearGroup: string };
    }): Promise<{ count: number }>;
  };
  auditLog: {
    findFirst(input: {
      where: {
        entity: string;
        entityId: { startsWith: string; gte: string };
        action: 'Update';
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(input: {
      data: {
        userId: null;
        action: 'DecryptPii' | 'Update';
        entity: string;
        entityId?: string;
        meta: Record<string, string | number>;
      };
    }): Promise<unknown>;
  };
}

export interface SchoolYearReconciliationDb {
  $enc: { decrypt(value: string | null | undefined): string | null };
  $transaction<T>(
    run: (tx: SchoolYearReconciliationTx) => Promise<T>,
    options?: { maxWait: number; timeout: number },
  ): Promise<T>;
}

export interface SchoolYearReconciliationSummary {
  academicYearStart: number;
  status: 'Completed' | 'AlreadyCompleted';
  scannedCount: number;
  updatedCount: number;
  unchangedCount: number;
  unavailableDobCount: number;
  outsideSchoolAgeCount: number;
}

export class SchoolYearReconciliationConflictError extends Error {
  constructor() {
    super('A student changed during school-year reconciliation. Retry the reconciliation.');
    this.name = 'SchoolYearReconciliationConflictError';
  }
}

export async function reconcileStudentSchoolYears(
  db: SchoolYearReconciliationDb,
  asOf: Date = new Date(),
): Promise<SchoolYearReconciliationSummary> {
  const year = academicYearStart(asOf).getUTCFullYear();
  const markerId = `v2:${String(year)}`;

  return db.$transaction(
    async (tx) => {
      // Schema scopes the lock as well as the durable marker to the selected tenant.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(current_schema() || ':oasis:school-year-reconciliation'), ${0}::integer)`;
      const existing = await tx.auditLog.findFirst({
        where: {
          entity: RECONCILIATION_ENTITY,
          entityId: { startsWith: 'v2:', gte: markerId },
          action: 'Update',
        },
        select: { id: true },
      });
      const summary: SchoolYearReconciliationSummary = {
        academicYearStart: year,
        status: existing ? 'AlreadyCompleted' : 'Completed',
        scannedCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        unavailableDobCount: 0,
        outsideSchoolAgeCount: 0,
      };
      if (existing) return summary;

      const students = await tx.student.findMany({
        where: { yearGroupOverride: null },
        select: { id: true, dobEnc: true, yearGroup: true },
        orderBy: { id: 'asc' },
      });
      summary.scannedCount = students.length;
      for (const student of students) {
        // Decryption errors must abort the transaction, rather than overwrite valid cohorts.
        const dob = db.$enc.decrypt(student.dobEnc);
        const yearGroup = resolveSchoolYearForDob(dob, asOf);
        if (yearGroup === SCHOOL_AGE_UNAVAILABLE_LABEL) summary.unavailableDobCount++;
        if (yearGroup === OUTSIDE_SCHOOL_AGE_LABEL) summary.outsideSchoolAgeCount++;
        if (yearGroup === student.yearGroup) {
          summary.unchangedCount++;
          continue;
        }

        const updated = await tx.student.updateMany({
          where: {
            id: student.id,
            dobEnc: student.dobEnc,
            yearGroup: student.yearGroup,
            yearGroupOverride: null,
          },
          data: { yearGroup },
        });
        if (updated.count !== 1) throw new SchoolYearReconciliationConflictError();
        summary.updatedCount++;
      }

      if (students.length > 0) {
        await tx.auditLog.create({
          data: {
            userId: null,
            action: 'DecryptPii',
            entity: 'Student',
            meta: { source: RECONCILIATION_SOURCE, count: students.length },
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: null,
          action: 'Update',
          entity: RECONCILIATION_ENTITY,
          entityId: markerId,
          meta: { source: RECONCILIATION_SOURCE, ...summary },
        },
      });
      return summary;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}
