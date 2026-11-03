import { describe, expect, it } from 'vitest';
import { createSchoolYearSynchronizer } from '../services/school-year-runtime.js';
import {
  reconcileStudentSchoolYears,
  SchoolYearReconciliationConflictError,
  type SchoolYearReconciliationDb,
} from '../services/school-year-reconciliation.js';

interface StudentRow {
  id: string;
  dobEnc: string;
  yearGroup: string;
  yearGroupOverride: string | null;
  active: boolean;
  ageBandId: string | null;
}

interface AuditRow {
  id: string;
  action: 'DecryptPii' | 'Update';
  entity: string;
  entityId?: string;
  meta: object;
}

function makeDb(
  initialStudents: StudentRow[],
  conflictOnId?: string,
  beforeUpdate?: (rows: StudentRow[]) => void,
) {
  let students = structuredClone(initialStudents);
  let audits: AuditRow[] = [];
  const db: SchoolYearReconciliationDb = {
    $enc: {
      decrypt(value) {
        if (value === 'broken:key') throw new Error('Unable to decrypt');
        return !value || value === 'enc:' ? null : value.replace(/^enc:/u, '');
      },
    },
    async $transaction(run) {
      const pendingStudents = structuredClone(students);
      const pendingAudits = structuredClone(audits);
      const result = await run({
        $executeRaw: () => Promise.resolve(0),
        student: {
          findMany: ({ where }) =>
            Promise.resolve(
              structuredClone(
                pendingStudents.filter((row) => row.yearGroupOverride === where.yearGroupOverride),
              ),
            ),
          updateMany({ where, data }) {
            beforeUpdate?.(students);
            if (where.id === conflictOnId) return Promise.resolve({ count: 0 });
            const current = students.find((row) => row.id === where.id);
            const row = pendingStudents.find(
              (student) =>
                student.id === where.id &&
                student.dobEnc === where.dobEnc &&
                student.yearGroup === where.yearGroup &&
                student.yearGroupOverride === where.yearGroupOverride &&
                current?.yearGroupOverride === where.yearGroupOverride,
            );
            if (!row) return Promise.resolve({ count: 0 });
            row.yearGroup = data.yearGroup;
            return Promise.resolve({ count: 1 });
          },
        },
        auditLog: {
          findFirst({ where }) {
            return Promise.resolve(
              pendingAudits.find(
                (audit) =>
                  audit.entity === where.entity &&
                  audit.entityId?.startsWith(where.entityId.startsWith) &&
                  audit.entityId >= where.entityId.gte &&
                  audit.action === where.action,
              ) ?? null,
            );
          },
          create({ data }) {
            const audit = { ...data, id: `audit_${String(pendingAudits.length)}` };
            pendingAudits.push(audit);
            return Promise.resolve(audit);
          },
        },
      });
      students = pendingStudents;
      audits = pendingAudits;
      return result;
    },
  };
  return { db, students: () => students, audits: () => audits };
}

function student(id: string, dob: string, yearGroup: string, active = true): StudentRow {
  return {
    id,
    dobEnc: `enc:${dob}`,
    yearGroup,
    yearGroupOverride: null,
    active,
    ageBandId: 'assigned_band',
  };
}

const november = new Date('2026-11-03T12:00:00.000Z');

describe('reconcileStudentSchoolYears', () => {
  it('preserves manual placement across September without reading the overridden DOB', async () => {
    const manual = {
      ...student('manual', '', 'Year 3'),
      dobEnc: 'broken:key',
      yearGroupOverride: 'Year 3',
    };
    const store = makeDb([student('automatic', '2014-09-01', 'Year 3'), manual]);

    await reconcileStudentSchoolYears(store.db, new Date('2026-08-31T22:59:59.999Z'));
    const september = await reconcileStudentSchoolYears(
      store.db,
      new Date('2026-08-31T23:00:00.000Z'),
    );

    expect(store.students().map((row) => row.yearGroup)).toEqual(['Year 7', 'Year 3']);
    expect(store.students()[1]).toEqual(manual);
    expect(september.scannedCount).toBe(1);
  });

  it('does not clobber an override chosen after the automatic cohort scan', async () => {
    const initial = [student('child', '2014-09-01', 'Year 3')];
    const store = makeDb(initial, undefined, (rows) => {
      const child = rows[0];
      if (child) child.yearGroupOverride = 'Year 3';
    });

    await expect(reconcileStudentSchoolYears(store.db, november)).rejects.toBeInstanceOf(
      SchoolYearReconciliationConflictError,
    );

    expect(store.students()[0]).toMatchObject({
      yearGroup: 'Year 3',
      yearGroupOverride: 'Year 3',
    });
    expect(store.audits()).toEqual([]);
  });

  it('resumes annual automatic progression after a manual placement is reset', async () => {
    const store = makeDb([
      { ...student('child', '2014-09-01', 'Year 3'), yearGroupOverride: 'Year 3' },
    ]);
    await reconcileStudentSchoolYears(store.db, november);
    const child = store.students()[0];
    if (!child) throw new Error('Student fixture is missing');
    // The reset mutation immediately stores the current DOB cohort before annual work resumes.
    child.yearGroupOverride = null;
    child.yearGroup = 'Year 7';

    await reconcileStudentSchoolYears(store.db, new Date('2027-09-01T12:00:00.000Z'));

    expect(store.students()[0]).toMatchObject({
      yearGroup: 'Year 8',
      yearGroupOverride: null,
    });
  });

  it('applies the override-aware policy despite a historical v1 completion marker', async () => {
    const store = makeDb([student('child', '2014-09-01', 'Year 3')]);
    store.audits().push({
      id: 'legacy_marker',
      action: 'Update',
      entity: 'SchoolYearReconciliation',
      entityId: 'v1:2026',
      meta: {},
    });

    const summary = await reconcileStudentSchoolYears(store.db, november);

    expect(summary.status).toBe('Completed');
    expect(store.students()[0]?.yearGroup).toBe('Year 7');
    expect(store.audits().some((audit) => audit.entityId === 'v2:2026')).toBe(true);
  });

  it('aligns all stored cohorts including inactive children and marks unavailable ages truthfully', async () => {
    const store = makeDb([
      student('secondary', '2014-09-01', 'Year 3'),
      student('inactive', '2018-01-01', 'Year 1', false),
      student('missing', '', 'Year 6'),
      student('invalid', '2020-02-30', 'Year 6'),
      student('young', '2025-01-01', 'Year 6'),
      student('old', '2000-01-01', 'Year 6'),
      student('unchanged', '2017-01-01', 'Year 5'),
    ]);

    const summary = await reconcileStudentSchoolYears(store.db, november);

    expect(store.students().map((row) => row.yearGroup)).toEqual([
      'Year 7',
      'Year 4',
      'DOB required',
      'DOB required',
      'Outside school age',
      'Outside school age',
      'Year 5',
    ]);
    expect(store.students().every((row) => row.ageBandId === 'assigned_band')).toBe(true);
    expect(store.students()[1]?.active).toBe(false);
    expect(summary).toMatchObject({
      academicYearStart: 2026,
      status: 'Completed',
      scannedCount: 7,
      updatedCount: 6,
      unchangedCount: 1,
      unavailableDobCount: 2,
      outsideSchoolAgeCount: 2,
    });
    expect(store.audits().map((audit) => audit.action)).toEqual(['DecryptPii', 'Update']);
    expect(JSON.stringify(store.audits())).not.toContain('2014-09-01');
    expect(JSON.stringify(store.audits())).not.toContain('secondary');
  });

  it('uses its durable completion marker when the same academic year runs again', async () => {
    const store = makeDb([student('child', '2014-09-01', 'Year 3')]);
    await reconcileStudentSchoolYears(store.db, november);
    const firstAudit = structuredClone(store.audits());

    const repeated = await reconcileStudentSchoolYears(store.db, november);

    expect(repeated.status).toBe('AlreadyCompleted');
    expect(store.students()[0]?.yearGroup).toBe('Year 7');
    expect(store.audits()).toEqual(firstAudit);
  });

  it('advances at September midnight in London, before UTC midnight', async () => {
    const store = makeDb([student('child', '2014-09-01', 'Year 3')]);
    const before = await reconcileStudentSchoolYears(
      store.db,
      new Date('2026-08-31T22:59:59.999Z'),
    );
    expect(before.academicYearStart).toBe(2025);
    expect(store.students()[0]?.yearGroup).toBe('Year 6');

    const after = await reconcileStudentSchoolYears(store.db, new Date('2026-08-31T23:00:00.000Z'));
    expect(after.academicYearStart).toBe(2026);
    expect(store.students()[0]?.yearGroup).toBe('Year 7');
    expect(store.audits().filter((audit) => audit.action === 'Update')).toHaveLength(2);
  });

  it('ignores an older delayed run after the next academic year has completed', async () => {
    const store = makeDb([student('child', '2014-09-01', 'Year 3')]);
    await reconcileStudentSchoolYears(store.db, november);
    const completedAudits = structuredClone(store.audits());

    const delayed = await reconcileStudentSchoolYears(
      store.db,
      new Date('2026-08-31T22:59:59.999Z'),
    );

    expect(delayed.status).toBe('AlreadyCompleted');
    expect(delayed.scannedCount).toBe(0);
    expect(store.students()[0]?.yearGroup).toBe('Year 7');
    expect(store.audits()).toEqual(completedAudits);
  });

  it('rolls back earlier changes and the marker when a DOB edit races the scan', async () => {
    const initial = [
      student('first', '2014-09-01', 'Year 3'),
      student('racing', '2018-01-01', 'Year 1'),
    ];
    const store = makeDb(initial, 'racing');

    await expect(reconcileStudentSchoolYears(store.db, november)).rejects.toBeInstanceOf(
      SchoolYearReconciliationConflictError,
    );

    expect(store.students()).toEqual(initial);
    expect(store.audits()).toEqual([]);
  });

  it('aborts the run without replacing data when DOB decryption fails', async () => {
    const initial = [
      student('first', '2014-09-01', 'Year 3'),
      { ...student('broken', '', 'Year 6'), dobEnc: 'broken:key' },
    ];
    const store = makeDb(initial);

    await expect(reconcileStudentSchoolYears(store.db, november)).rejects.toThrow(
      'Unable to decrypt',
    );

    expect(store.students()).toEqual(initial);
    expect(store.audits()).toEqual([]);
  });

  it('catches up after an authorized DOB replacement repairs a failed startup', async () => {
    const store = makeDb([
      student('current', '2014-09-01', 'Year 3'),
      { ...student('former', '', 'Year 6', false), dobEnc: 'broken:key' },
    ]);
    const ensure = createSchoolYearSynchronizer();
    await expect(ensure(store.db, november)).rejects.toThrow('Unable to decrypt');
    const repaired = store.students().find((row) => row.id === 'former');
    if (!repaired) throw new Error('Former-student fixture is missing');
    repaired.dobEnc = 'enc:1987-01-02';
    repaired.yearGroup = 'Outside school age';

    await expect(ensure(store.db, november)).resolves.toMatchObject({ status: 'Completed' });
    expect(store.students().map((row) => row.yearGroup)).toEqual(['Year 7', 'Outside school age']);
    expect(store.audits().filter((row) => row.entity === 'SchoolYearReconciliation')).toHaveLength(
      1,
    );
  });

  it('keeps completion markers isolated between database tenants', async () => {
    const live = makeDb([student('same_id', '2014-09-01', 'Year 3')]);
    const review = makeDb([student('same_id', '2018-01-01', 'Year 1')]);
    await reconcileStudentSchoolYears(live.db, november);

    const reviewSummary = await reconcileStudentSchoolYears(review.db, november);

    expect(reviewSummary.status).toBe('Completed');
    expect(live.students()[0]?.yearGroup).toBe('Year 7');
    expect(review.students()[0]?.yearGroup).toBe('Year 4');
    expect(review.audits()).toHaveLength(2);
  });
});
