import type { ActiveScoreKeyReport, ActiveScoreKeyRow, ActiveScoreKeyScope } from '@oasis/domain';
import type { RlsTx } from '../context.js';

export async function loadActiveScoreKeyReport(
  tx: RlsTx,
  scope: ActiveScoreKeyScope = 'all',
): Promise<ActiveScoreKeyReport> {
  const studentFilter =
    scope === 'all'
      ? { active: true }
      : {
          active: true,
          registrationProfile: {
            is: {
              registrationLevel: scope === 'abc-primary' ? { in: ['ABC', 'Primary'] } : 'Secondary',
            },
          },
        };
  const assignments = await tx.studentSubject.groupBy({
    by: ['subjectId', 'currentPaceNumber'],
    where: {
      student: studentFilter,
      subject: { active: true },
    },
    _count: { _all: true },
  });

  const subjectIds = [...new Set(assignments.map((assignment) => assignment.subjectId))];
  const subjects = subjectIds.length
    ? await tx.subject.findMany({
        where: { id: { in: subjectIds }, active: true },
        select: { id: true, code: true, name: true },
      })
    : [];
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
  const rows: ActiveScoreKeyRow[] = assignments.flatMap((assignment) => {
    const subject = subjectsById.get(assignment.subjectId);
    return subject
      ? [
          {
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            paceNumber: assignment.currentPaceNumber,
            childCount: assignment._count._all,
          },
        ]
      : [];
  });
  const collator = new Intl.Collator('en-GB');
  rows.sort(
    (left, right) =>
      collator.compare(left.subjectName, right.subjectName) ||
      collator.compare(left.subjectCode, right.subjectCode) ||
      left.paceNumber - right.paceNumber ||
      left.subjectId.localeCompare(right.subjectId),
  );

  return {
    scope,
    generatedAt: new Date(),
    activeKeyCount: rows.length,
    subjectCount: new Set(rows.map((row) => row.subjectId)).size,
    rows,
  };
}
