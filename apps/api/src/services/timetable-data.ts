import { TRPCError } from '@trpc/server';
import {
  DEFAULT_TIMETABLE_SLOTS,
  TIMETABLE_DAYS,
  countTimetableProgress,
  firstNameFromFullName,
  timetableColourForSubject,
  type TimetableColour,
} from '@oasis/domain';
import type { AppContext } from '../context.js';
import { decryptRequiredText } from '../lib/encrypted-text.js';
import type {
  StudentTimetableDraftView,
  TimetableHeadWorkspace,
  TimetableScheduleView,
  TimetableSubjectView,
} from '../routers/timetable.js';
import { requireTeachingTerm } from './timetable-terms.js';

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

type DraftEntry = {
  day: (typeof TIMETABLE_DAYS)[number];
  slotId: string;
  subjectId: string;
};

type TimetableSlotReference = {
  id: string;
  kind: 'Lesson' | 'Break';
  position: number;
};

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}

function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

export function customSubjectCodeBase(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 13)
    .replace(/-+$/gu, '');
  return `CUSTOM-${slug || 'SUBJECT'}`;
}

function subjectView(subject: {
  active: boolean;
  code: string;
  id: string;
  name: string;
  timetableColour: TimetableColour;
}): TimetableSubjectView {
  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    colour: timetableColourForSubject(subject),
  };
}

function decryptedStudentName(ctx: AuthedContext, encrypted: string): string {
  return decryptRequiredText({ decrypt: ctx.db.$enc.decrypt }, encrypted, 'student name');
}

function remapLegacyDraftEntries(
  entries: readonly DraftEntry[],
  legacySlots: readonly TimetableSlotReference[],
  currentSlots: readonly TimetableSlotReference[],
): DraftEntry[] {
  const currentLessonSlots = [...currentSlots]
    .filter((slot) => slot.kind === 'Lesson')
    .sort((left, right) => left.position - right.position);
  const legacyLessonSlots = [...legacySlots]
    .filter((slot) => slot.kind === 'Lesson')
    .sort((left, right) => left.position - right.position);
  const currentSlotIdByLegacySlotId = new Map(
    legacyLessonSlots.map(
      (slot, lessonIndex) => [slot.id, currentLessonSlots[lessonIndex]?.id] as const,
    ),
  );

  return entries.flatMap((entry) => {
    if (!currentSlotIdByLegacySlotId.has(entry.slotId)) return [entry];
    const currentSlotId = currentSlotIdByLegacySlotId.get(entry.slotId);
    return currentSlotId ? [{ ...entry, slotId: currentSlotId }] : [];
  });
}

export async function loadHeadTimetableWorkspace(
  ctx: AuthedContext,
  input: { termKey: string; ageBandId: string },
): Promise<TimetableHeadWorkspace> {
  const term = await requireTeachingTerm(ctx.db, input.termKey);
  const data = await ctx.withRls(async (db) => {
    const schedule = await db.timetableAgeGroupSchedule.findUnique({
      where: {
        termKey_ageBandId: {
          termKey: input.termKey,
          ageBandId: input.ageBandId,
        },
      },
      include: { slots: { orderBy: { position: 'asc' } } },
    });
    const [ageBand, students] = await Promise.all([
      db.yearGroupBand.findFirst({
        where: { id: input.ageBandId, active: true },
        select: { id: true, name: true, colour: true },
      }),
      db.student.findMany({
        where: { active: true, ageBandId: input.ageBandId },
        select: {
          id: true,
          fullNameEnc: true,
          followsOwnTimetable: true,
        },
      }),
    ]);
    if (!ageBand) notFound('Age band not found');
    const studentIds = students
      .filter((student) => !student.followsOwnTimetable)
      .map((student) => student.id);
    const [publications, drafts] = await Promise.all([
      studentIds.length === 0
        ? Promise.resolve([])
        : db.studentTimetablePublication.findMany({
            where: { studentId: { in: studentIds }, termKey: input.termKey },
            select: { id: true, studentId: true, publishedAt: true },
            orderBy: { publishedAt: 'desc' },
          }),
      studentIds.length === 0
        ? Promise.resolve([])
        : db.studentTimetable.findMany({
            where: { studentId: { in: studentIds }, termKey: input.termKey },
            select: { studentId: true },
          }),
    ]);
    return { ageBand, schedule, students, publications, drafts };
  });

  const latestPublicationByStudent = new Map<string, string>();
  for (const publication of data.publications) {
    if (!latestPublicationByStudent.has(publication.studentId)) {
      latestPublicationByStudent.set(publication.studentId, publication.id);
    }
  }
  const draftStudents = new Set(data.drafts.map((draft) => draft.studentId));
  const childSummaries = data.students
    .map((student) => {
      const fullName = decryptedStudentName(ctx, student.fullNameEnc);
      const latestPublicationId = latestPublicationByStudent.get(student.id) ?? null;
      return {
        id: student.id,
        fullName,
        firstName: firstNameFromFullName(fullName),
        ageBandId: input.ageBandId,
        latestPublicationId,
        status: student.followsOwnTimetable
          ? ('N/A' as const)
          : latestPublicationId
            ? ('Published' as const)
            : draftStudents.has(student.id)
              ? ('Draft' as const)
              : ('NotStarted' as const),
      };
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
  const children = childSummaries.filter((child) => child.status !== 'N/A');
  const ownTimetableChildren = childSummaries.filter((child) => child.status === 'N/A');

  return {
    ageBand: data.ageBand,
    term,
    progress: countTimetableProgress(
      children.map((child) => child.id),
      [...latestPublicationByStudent.keys()],
    ),
    schedule: data.schedule
      ? {
          id: data.schedule.id,
          termKey: data.schedule.termKey,
          ageBandId: input.ageBandId,
          updatedAt: data.schedule.updatedAt,
          slots: data.schedule.slots,
        }
      : null,
    defaultSlots: DEFAULT_TIMETABLE_SLOTS,
    children,
    ownTimetableChildren,
  };
}

export async function loadStudentTimetableDraft(
  ctx: AuthedContext,
  input: { studentId: string; termKey: string },
): Promise<StudentTimetableDraftView> {
  await requireTeachingTerm(ctx.db, input.termKey);
  const data = await ctx.withRls(async (db) => {
    const student = await db.student.findFirst({
      where: { id: input.studentId, active: true },
      select: {
        id: true,
        fullNameEnc: true,
        followsOwnTimetable: true,
        ageBand: { select: { id: true, active: true } },
        subjects: {
          where: { subject: { active: true } },
          include: { subject: true },
          orderBy: { subject: { name: 'asc' } },
        },
      },
    });
    if (!student) notFound('Student not found');
    const ageBand = student.ageBand;
    if (!ageBand?.active || student.followsOwnTimetable) {
      badRequest('This child is not assigned to the Head timetable workflow');
    }
    const [timetable, currentSchedule] = await Promise.all([
      db.studentTimetable.findUnique({
        where: { studentId_termKey: { studentId: input.studentId, termKey: input.termKey } },
        include: {
          schedule: { select: { slots: { select: { id: true, kind: true, position: true } } } },
          entries: { orderBy: [{ day: 'asc' }, { slot: { position: 'asc' } }] },
          publications: {
            select: { id: true, publishedAt: true },
            orderBy: { publishedAt: 'desc' },
          },
        },
      }),
      db.timetableAgeGroupSchedule.findUnique({
        where: { termKey_ageBandId: { termKey: input.termKey, ageBandId: ageBand.id } },
        select: { id: true, slots: { select: { id: true, kind: true, position: true } } },
      }),
    ]);
    return { student, timetable, currentSchedule, ageBandId: ageBand.id };
  });

  const fullName = decryptedStudentName(ctx, data.student.fullNameEnc);
  const entries =
    data.timetable && data.currentSchedule && data.timetable.scheduleId !== data.currentSchedule.id
      ? remapLegacyDraftEntries(
          data.timetable.entries,
          data.timetable.schedule.slots,
          data.currentSchedule.slots,
        )
      : (data.timetable?.entries ?? []);
  return {
    student: {
      id: data.student.id,
      fullName,
      firstName: firstNameFromFullName(fullName),
      ageBandId: data.ageBandId,
    },
    timetableId: data.timetable?.id ?? null,
    entries,
    publishedVersions: data.timetable?.publications ?? [],
    subjects: data.student.subjects.map(({ subject }) => subjectView(subject)),
    latestPublication: data.timetable?.publications[0] ?? null,
  };
}

export async function saveTimetableSchedule(
  ctx: AuthedContext,
  input: {
    termKey: string;
    ageBandId: string;
    slots: Array<{
      id?: string;
      kind: 'Lesson' | 'Break';
      label: string;
      startMinutes: number;
      endMinutes: number;
    }>;
  },
): Promise<TimetableScheduleView> {
  const duplicateIds = input.slots
    .map((slot) => slot.id)
    .filter((id): id is string => Boolean(id))
    .filter((id, position, ids) => ids.indexOf(id) !== position);
  if (duplicateIds.length > 0) badRequest('A timetable slot cannot be used twice');

  return ctx.withRls(async (db) => {
    const existing = await db.timetableAgeGroupSchedule.findUnique({
      where: {
        termKey_ageBandId: {
          termKey: input.termKey,
          ageBandId: input.ageBandId,
        },
      },
      include: { slots: true },
    });
    const existingIds = new Set(existing?.slots.map((slot) => slot.id) ?? []);
    const unknownId = input.slots.find((slot) => slot.id && !existingIds.has(slot.id));
    if (unknownId) badRequest('The timetable changed. Refresh before saving slot changes.');

    const schedule = await db.timetableAgeGroupSchedule.upsert({
      where: {
        termKey_ageBandId: {
          termKey: input.termKey,
          ageBandId: input.ageBandId,
        },
      },
      create: {
        termKey: input.termKey,
        ageBandId: input.ageBandId,
        updatedById: ctx.user.id,
      },
      update: { updatedById: ctx.user.id },
    });

    if (existing) {
      await db.timetableScheduleSlot.updateMany({
        where: { scheduleId: schedule.id },
        data: { position: { increment: 100 } },
      });
      const retainedIds = input.slots
        .map((slot) => slot.id)
        .filter((id): id is string => Boolean(id));
      await db.timetableScheduleSlot.deleteMany({
        where: { scheduleId: schedule.id, id: { notIn: retainedIds } },
      });
    }

    const slots = [];
    for (const [position, slot] of input.slots.entries()) {
      const data = {
        kind: slot.kind,
        label: slot.label.trim(),
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        position,
      };
      const saved = slot.id
        ? await db.timetableScheduleSlot.update({ where: { id: slot.id }, data })
        : await db.timetableScheduleSlot.create({ data: { ...data, scheduleId: schedule.id } });
      slots.push(saved);
    }

    await db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: existing ? 'Update' : 'Create',
        entity: 'TimetableAgeGroupSchedule',
        entityId: schedule.id,
        meta: {
          source: 'timetable.saveSchedule',
          termKey: input.termKey,
          ageBandId: input.ageBandId,
          slotCount: slots.length,
        },
      },
    });

    return {
      id: schedule.id,
      termKey: schedule.termKey,
      ageBandId: input.ageBandId,
      updatedAt: schedule.updatedAt,
      slots,
    };
  });
}

export async function saveStudentTimetableDraft(
  ctx: AuthedContext,
  input: {
    studentId: string;
    termKey: string;
    scheduleId: string;
    scheduleUpdatedAt: Date;
    entries: Array<{ day: (typeof TIMETABLE_DAYS)[number]; slotId: string; subjectId: string }>;
  },
) {
  await requireTeachingTerm(ctx.db, input.termKey);
  return ctx.withRls(async (db) => {
    const student = await db.student.findFirst({
      where: { id: input.studentId, active: true },
      select: {
        id: true,
        ageBandId: true,
        followsOwnTimetable: true,
        subjects: { where: { subject: { active: true } }, select: { subjectId: true } },
      },
    });
    if (!student) notFound('Student not found');
    if (!student.ageBandId || student.followsOwnTimetable) {
      badRequest('This child is not assigned to the Head timetable workflow');
    }
    const schedule = await db.timetableAgeGroupSchedule.findUnique({
      where: { termKey_ageBandId: { termKey: input.termKey, ageBandId: student.ageBandId } },
      include: { slots: true },
    });
    if (!schedule) badRequest('Save the age-group times before creating child timetables');
    if (
      schedule.id !== input.scheduleId ||
      schedule.updatedAt.getTime() !== input.scheduleUpdatedAt.getTime()
    ) {
      badRequest('The shared timetable changed. Refresh before saving this child’s timetable.');
    }

    const lessonSlotIds = new Set(
      schedule.slots.filter((slot) => slot.kind === 'Lesson').map((slot) => slot.id),
    );
    let entries = input.entries;
    if (entries.some((entry) => !lessonSlotIds.has(entry.slotId))) {
      const existingTimetable = await db.studentTimetable.findUnique({
        where: { studentId_termKey: { studentId: student.id, termKey: input.termKey } },
        select: {
          scheduleId: true,
          schedule: {
            select: {
              slots: { select: { id: true, kind: true, position: true } },
            },
          },
        },
      });
      if (existingTimetable && existingTimetable.scheduleId !== schedule.id) {
        entries = remapLegacyDraftEntries(
          entries,
          existingTimetable.schedule.slots,
          schedule.slots,
        );
      }
    }
    const assignedSubjectIds = new Set(student.subjects.map((subject) => subject.subjectId));
    const entryKeys = new Set<string>();
    for (const entry of entries) {
      if (!lessonSlotIds.has(entry.slotId)) badRequest('A selected lesson slot is unavailable');
      if (!assignedSubjectIds.has(entry.subjectId)) {
        badRequest('A selected subject is not assigned to this child');
      }
      const key = `${entry.day}:${entry.slotId}`;
      if (entryKeys.has(key)) badRequest('A lesson period can contain only one subject');
      entryKeys.add(key);
    }

    const timetable = await db.studentTimetable.upsert({
      where: { studentId_termKey: { studentId: student.id, termKey: input.termKey } },
      create: {
        studentId: student.id,
        termKey: input.termKey,
        ageBandId: student.ageBandId,
        scheduleId: schedule.id,
        updatedById: ctx.user.id,
      },
      update: { ageBandId: student.ageBandId, scheduleId: schedule.id, updatedById: ctx.user.id },
    });
    await db.studentTimetableEntry.deleteMany({ where: { timetableId: timetable.id } });
    if (entries.length > 0) {
      await db.studentTimetableEntry.createMany({
        data: entries.map((entry) => ({ ...entry, timetableId: timetable.id })),
      });
    }
    await db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'StudentTimetable',
        entityId: timetable.id,
        meta: {
          source: 'timetable.saveDraft',
          studentId: student.id,
          termKey: input.termKey,
          assignedPeriodCount: entries.length,
        },
      },
    });

    return {
      timetableId: timetable.id,
      entries,
      unassignedLessonCount: lessonSlotIds.size * TIMETABLE_DAYS.length - entries.length,
    };
  });
}

function suffixedSubjectCode(base: string, index: number): string {
  if (index === 1) return base;
  const suffix = `-${String(index)}`;
  return `${base.slice(0, 20 - suffix.length).replace(/-+$/gu, '')}${suffix}`;
}

export async function createAndAssignTimetableSubject(
  ctx: AuthedContext,
  input: { studentId: string; name: string },
): Promise<TimetableSubjectView> {
  return ctx.withRls(async (db) => {
    const student = await db.student.findFirst({
      where: { id: input.studentId, active: true },
      select: { id: true },
    });
    if (!student) notFound('Student not found');

    const name = input.name.trim();
    let subject = await db.subject.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    let created = false;
    if (!subject) {
      const base = customSubjectCodeBase(name);
      const existing = await db.subject.findMany({
        where: { code: { startsWith: base.slice(0, 14) } },
        select: { code: true },
      });
      const used = new Set(existing.map(({ code }) => code));
      let index = 1;
      while (used.has(suffixedSubjectCode(base, index))) index += 1;
      const code = suffixedSubjectCode(base, index);
      subject = await db.subject.create({
        data: {
          code,
          name,
          timetableColour: timetableColourForSubject({ code, name }),
        },
      });
      created = true;
    } else {
      const timetableColour = timetableColourForSubject(subject);
      if (!subject.active || subject.timetableColour !== timetableColour) {
        subject = await db.subject.update({
          where: { id: subject.id },
          data: { active: true, timetableColour },
        });
      }
    }

    await db.studentSubject.upsert({
      where: { studentId_subjectId: { studentId: student.id, subjectId: subject.id } },
      create: { studentId: student.id, subjectId: subject.id },
      update: {},
    });
    await db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: created ? 'Create' : 'Update',
        entity: 'Subject',
        entityId: subject.id,
        meta: {
          source: 'timetable.createAndAssignSubject',
          studentId: student.id,
          reused: !created,
        },
      },
    });
    return subjectView(subject);
  });
}
