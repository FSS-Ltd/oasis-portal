import { TRPCError } from '@trpc/server';
import type { Prisma } from '@oasis/db';
import {
  TIMETABLE_DAYS,
  firstNameFromFullName,
  type TimetableColour,
  type TimetableDay,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { decryptRequiredText } from '../lib/encrypted-text.js';
import type {
  TimetablePublicationEntryView,
  TimetablePublicationView,
} from '../routers/timetable.js';
import { registrationLevelForStudent } from './timetable-data.js';
import { requireTeachingTerm } from './timetable-terms.js';

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

interface SnapshotSlot {
  endMinutes: number;
  id: string;
  kind: 'Lesson' | 'Break';
  label: string;
  position: number;
  startMinutes: number;
}

interface SnapshotDraftEntry {
  day: TimetableDay;
  slotId: string;
  subject: {
    id: string;
    name: string;
    timetableColour: TimetableColour;
  };
  subjectId: string;
}

type PublicationWithEntries = Prisma.StudentTimetablePublicationGetPayload<{
  include: { entries: true };
}>;

export function buildPublicationEntries(
  slots: readonly SnapshotSlot[],
  draftEntries: readonly SnapshotDraftEntry[],
): { entries: TimetablePublicationEntryView[]; unassignedLessonCount: number } {
  const assignmentByPeriod = new Map(
    draftEntries.map((entry) => [`${entry.day}:${entry.slotId}`, entry] as const),
  );
  let unassignedLessonCount = 0;
  const entries: TimetablePublicationEntryView[] = [];

  for (const day of TIMETABLE_DAYS) {
    for (const slot of [...slots].sort((left, right) => left.position - right.position)) {
      const assignment =
        slot.kind === 'Lesson' ? assignmentByPeriod.get(`${day}:${slot.id}`) : undefined;
      if (slot.kind === 'Lesson' && !assignment) unassignedLessonCount += 1;
      entries.push({
        day,
        slotPosition: slot.position,
        slotKind: slot.kind,
        slotLabel: slot.label,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        subjectId: assignment?.subjectId ?? null,
        subjectName: assignment?.subject.name ?? null,
        subjectColour: assignment?.subject.timetableColour ?? null,
      });
    }
  }

  return { entries, unassignedLessonCount };
}

export function requireUnassignedAcknowledgement(
  unassignedLessonCount: number,
  acknowledged: boolean,
): void {
  if (unassignedLessonCount === 0 || acknowledged) return;
  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: `${String(unassignedLessonCount)} lesson periods have no subject. You can still publish after acknowledging this suggestion.`,
  });
}

function publicationView(
  ctx: AuthedContext,
  row: PublicationWithEntries,
): TimetablePublicationView {
  return {
    id: row.id,
    studentId: row.studentId,
    studentFirstName: decryptRequiredText(
      { decrypt: ctx.db.$enc.decrypt },
      row.studentFirstNameEnc,
      'student first name',
    ),
    termKey: row.termKey,
    termLabel: row.termLabel,
    termStartsOn: row.termStartsOn,
    termEndsOn: row.termEndsOn,
    registrationLevel: row.registrationLevel,
    publishedAt: row.publishedAt,
    entries: [...row.entries]
      .sort(
        (left, right) =>
          TIMETABLE_DAYS.indexOf(left.day) - TIMETABLE_DAYS.indexOf(right.day) ||
          left.slotPosition - right.slotPosition,
      )
      .map((entry) => ({
        day: entry.day,
        slotPosition: entry.slotPosition,
        slotKind: entry.slotKind,
        slotLabel: entry.slotLabel,
        startMinutes: entry.startMinutes,
        endMinutes: entry.endMinutes,
        subjectId: entry.subjectId,
        subjectName: entry.subjectName,
        subjectColour: entry.subjectColour,
      })),
  };
}

export async function publishStudentTimetable(
  ctx: AuthedContext,
  input: { acknowledgeUnassigned: boolean; studentId: string; termKey: string },
): Promise<{ publication: TimetablePublicationView; unassignedLessonCount: number }> {
  const term = await requireTeachingTerm(ctx.db, input.termKey);
  const result = await ctx.withRls(async (db) => {
    const timetable = await db.studentTimetable.findUnique({
      where: { studentId_termKey: { studentId: input.studentId, termKey: input.termKey } },
      include: {
        student: {
          select: {
            active: true,
            fullNameEnc: true,
            yearGroup: true,
            registrationProfile: { select: { registrationLevel: true } },
          },
        },
        schedule: { include: { slots: { orderBy: { position: 'asc' } } } },
        entries: { include: { subject: true } },
      },
    });
    if (!timetable || !timetable.student.active) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Student timetable not found' });
    }
    const currentLevel = registrationLevelForStudent(
      timetable.student.registrationProfile?.registrationLevel,
      timetable.student.yearGroup,
    );
    if (
      currentLevel !== timetable.registrationLevel ||
      currentLevel !== timetable.schedule.registrationLevel
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The child’s age group changed. Refresh the timetable before publishing.',
      });
    }
    if (timetable.schedule.termKey !== input.termKey || timetable.schedule.slots.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The timetable schedule is unavailable for this term',
      });
    }
    if (timetable.entries.some((entry) => !entry.subject.active)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'One or more selected subjects are no longer active',
      });
    }

    const snapshot = buildPublicationEntries(timetable.schedule.slots, timetable.entries);
    requireUnassignedAcknowledgement(snapshot.unassignedLessonCount, input.acknowledgeUnassigned);
    const fullName = decryptRequiredText(
      { decrypt: ctx.db.$enc.decrypt },
      timetable.student.fullNameEnc,
      'student name',
    );
    const firstName = firstNameFromFullName(fullName);
    const publication = await db.studentTimetablePublication.create({
      data: {
        timetableId: timetable.id,
        studentId: input.studentId,
        termKey: input.termKey,
        termLabel: term.label,
        termStartsOn: term.startsOn,
        termEndsOn: term.endsOn,
        registrationLevel: currentLevel,
        studentFirstNameEnc: ctx.db.$enc.encrypt(firstName),
        publishedById: ctx.user.id,
        entries: { create: snapshot.entries },
      },
      include: { entries: true },
    });
    await db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Create',
        entity: 'StudentTimetablePublication',
        entityId: publication.id,
        meta: {
          source: 'timetable.publish',
          studentId: input.studentId,
          termKey: input.termKey,
          unassignedLessonCount: snapshot.unassignedLessonCount,
        },
      },
    });
    return { publication, unassignedLessonCount: snapshot.unassignedLessonCount };
  });

  return {
    publication: publicationView(ctx, result.publication),
    unassignedLessonCount: result.unassignedLessonCount,
  };
}

const publicationInclude: Prisma.StudentTimetablePublicationInclude = {
  entries: { orderBy: [{ day: 'asc' }, { slotPosition: 'asc' }] },
};

export async function findPublishedTimetableForParent(
  ctx: AuthedContext,
  input: { studentId: string; termKey?: string },
): Promise<TimetablePublicationView | null> {
  const row = await ctx.withRls((db) =>
    db.studentTimetablePublication.findFirst({
      where: {
        studentId: input.studentId,
        ...(input.termKey ? { termKey: input.termKey } : {}),
        student: {
          active: true,
          guardians: { some: { userId: ctx.user.id } },
        },
      },
      include: publicationInclude,
      orderBy: { publishedAt: 'desc' },
    }),
  );
  return row ? publicationView(ctx, row) : null;
}

export async function findPublishedTimetableForStudent(
  ctx: AuthedContext,
  input: { termKey?: string },
): Promise<TimetablePublicationView | null> {
  const row = await ctx.withRls((db) =>
    db.studentTimetablePublication.findFirst({
      where: {
        ...(input.termKey ? { termKey: input.termKey } : {}),
        student: { active: true, userId: ctx.user.id },
      },
      include: publicationInclude,
      orderBy: { publishedAt: 'desc' },
    }),
  );
  return row ? publicationView(ctx, row) : null;
}

export async function findPublishedTimetableForHead(
  ctx: AuthedContext,
  input: { publicationId: string },
): Promise<TimetablePublicationView | null> {
  const row = await ctx.withRls((db) =>
    db.studentTimetablePublication.findUnique({
      where: { id: input.publicationId },
      include: publicationInclude,
    }),
  );
  return row ? publicationView(ctx, row) : null;
}
