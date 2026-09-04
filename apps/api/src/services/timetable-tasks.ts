import { countTimetableProgress, timetableReminderAt } from '@oasis/domain';
import { loadTeachingTerms, type TimetableTermDb } from './timetable-terms.js';

export interface StoredTimetableTask {
  completedAt: Date | null;
  dueAt: Date;
  ownerId: string;
  reminderAt: Date;
  timetableTermKey: string;
  title: string;
}

interface TaskUpsertInput {
  create: StoredTimetableTask;
  update: Omit<StoredTimetableTask, 'ownerId' | 'timetableTermKey'>;
  where: {
    ownerId_timetableTermKey: { ownerId: string; timetableTermKey: string };
  };
}

export interface TimetableTaskDb extends TimetableTermDb {
  personalTask: { upsert(input: TaskUpsertInput): Promise<StoredTimetableTask> };
  student: {
    findMany(input: {
      select: { id: true };
      where: { active: true };
    }): Promise<Array<{ id: string }>>;
  };
  studentTimetablePublication: {
    findMany(input: {
      select: { studentId: true; termKey: true };
      where: { studentId: { in: string[] }; termKey: { in: string[] } };
    }): Promise<Array<{ studentId: string; termKey: string }>>;
  };
  user: {
    findMany(input: {
      select: { id: true };
      where: { active: true; role: 'Head' };
    }): Promise<Array<{ id: string }>>;
  };
}

export interface TimetableTaskSyncSummary {
  heads: number;
  terms: number;
  updated: number;
}

export async function syncTimetableTasks({
  asOf = new Date(),
  db,
  headIds,
}: {
  asOf?: Date;
  db: TimetableTaskDb;
  headIds?: readonly string[];
}): Promise<TimetableTaskSyncSummary> {
  const [terms, heads, students] = await Promise.all([
    loadTeachingTerms(db),
    headIds
      ? Promise.resolve(headIds.map((id) => ({ id })))
      : db.user.findMany({ where: { role: 'Head', active: true }, select: { id: true } }),
    db.student.findMany({ where: { active: true }, select: { id: true } }),
  ]);
  const studentIds = students.map((student) => student.id);
  const publications =
    terms.length === 0 || studentIds.length === 0
      ? []
      : await db.studentTimetablePublication.findMany({
          where: { termKey: { in: terms.map((term) => term.key) }, studentId: { in: studentIds } },
          select: { termKey: true, studentId: true },
        });
  let updated = 0;

  for (const term of terms) {
    const progress = countTimetableProgress(
      studentIds,
      publications
        .filter((publication) => publication.termKey === term.key)
        .map((publication) => publication.studentId),
    );
    const reminderAt = timetableReminderAt(term.startsOn);
    const title = `Complete ${term.label} timetables · ${String(progress.done)}/${String(progress.total)} done`;
    const completedAt = progress.total > 0 && progress.done === progress.total ? asOf : null;

    for (const head of heads) {
      await db.personalTask.upsert({
        where: {
          ownerId_timetableTermKey: { ownerId: head.id, timetableTermKey: term.key },
        },
        create: {
          ownerId: head.id,
          timetableTermKey: term.key,
          title,
          dueAt: reminderAt,
          reminderAt,
          completedAt,
        },
        update: { title, dueAt: reminderAt, reminderAt, completedAt },
      });
      updated += 1;
    }
  }

  return { heads: heads.length, terms: terms.length, updated };
}
