import { TRPCError } from '@trpc/server';
import {
  DEFAULT_TIMETABLE_SLOTS,
  REGISTRATION_LEVELS,
  TIMETABLE_DAYS,
  countTimetableProgress,
  firstNameFromFullName,
  timetableColourForSubject,
  type TimetableColour,
  type TimetableRegistrationLevel,
} from '@oasis/domain';
import type { AppContext, RlsTx } from '../context.js';
import { decryptRequiredText } from '../lib/encrypted-text.js';
import type {
  StudentTimetableDraftView,
  TimetableHeadWorkspace,
  TimetableScheduleView,
  TimetableSubjectView,
} from '../routers/timetable.js';
import { requireTeachingTerm } from './timetable-terms.js';

type AuthedContext = AppContext & { user: NonNullable<AppContext['user']> };

const VALID_LEVELS = new Set<string>(REGISTRATION_LEVELS);

function badRequest(message: string): never {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
}

function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

export function registrationLevelForStudent(
  profileLevel: string | null | undefined,
  yearGroup: string,
): TimetableRegistrationLevel {
  if (profileLevel && VALID_LEVELS.has(profileLevel)) {
    return profileLevel as TimetableRegistrationLevel;
  }

  const normalised = yearGroup.trim().toLowerCase();
  if (normalised === 'abc' || normalised === 'nursery' || normalised === 'reception') return 'ABC';
  const numericLevel = /(?:year|level|y)\s*(\d{1,2})/u.exec(normalised)?.[1];
  if (numericLevel && Number(numericLevel) >= 7) return 'Secondary';
  return 'Primary';
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

type TimetableStudentForTimetableDraft = {
  isOwnTimetable: boolean;
  registrationLevel: TimetableRegistrationLevel;
  student: {
    active: boolean;
    fullNameEnc: string;
    id: string;
    subjects: Array<{
      subject: {
        active: boolean;
        code: string;
        id: string;
        name: string;
        timetableColour: TimetableColour;
      };
    }>;
  };
};

async function loadTimetableMemberForStudent(
  db: RlsTx,
  studentId: string,
): Promise<TimetableStudentForTimetableDraft> {
  const record = await db.timetableAgeGroupMembership.findUnique({
    where: { studentId },
    select: {
      isOwnTimetable: true,
      registrationLevel: true,
      student: {
        select: {
          active: true,
          fullNameEnc: true,
          id: true,
          subjects: {
            where: { subject: { active: true } },
            orderBy: { subject: { name: 'asc' } },
            select: {
              subject: {
                select: {
                  active: true,
                  code: true,
                  id: true,
                  name: true,
                  timetableColour: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!record?.student || !record.student.active) {
    notFound('Student not found');
  }
  if (record.isOwnTimetable) {
    badRequest('This child follows their own timetable and cannot be edited here');
  }

  return {
    isOwnTimetable: record.isOwnTimetable,
    registrationLevel: record.registrationLevel,
    student: {
      active: record.student.active,
      fullNameEnc: record.student.fullNameEnc,
      id: record.student.id,
      subjects: record.student.subjects,
    },
  };
}

type TimetableMembershipInput = {
  isOwnTimetable: boolean;
  registrationLevel?: TimetableRegistrationLevel;
  studentId: string;
};

export async function setTimetableMembership(
  ctx: AuthedContext,
  input: TimetableMembershipInput,
): Promise<void> {
  if (!input.isOwnTimetable && !input.registrationLevel) {
    badRequest('A target registration level is required to reassign a child');
  }

  return ctx.withRls(async (db) => {
    const student = await db.student.findFirst({
      where: { id: input.studentId, active: true },
      select: {
        id: true,
        yearGroup: true,
        registrationProfile: { select: { registrationLevel: true } },
        timetableAgeGroupMembership: { select: { registrationLevel: true } },
      },
    });
    if (!student) notFound('Student not found');

    const registrationLevel =
      input.registrationLevel ??
      student.timetableAgeGroupMembership?.registrationLevel ??
      registrationLevelForStudent(student.registrationProfile?.registrationLevel, student.yearGroup);

    await db.timetableAgeGroupMembership.upsert({
      where: { studentId: input.studentId },
      create: {
        studentId: input.studentId,
        isOwnTimetable: input.isOwnTimetable,
        registrationLevel,
      },
      update: {
        isOwnTimetable: input.isOwnTimetable,
        ...(input.isOwnTimetable ? {} : { registrationLevel }),
      },
    });

    await db.auditLog.create({
      data: {
        userId: ctx.user.id,
        action: 'Update',
        entity: 'TimetableAgeGroupMembership',
        entityId: input.studentId,
        meta: {
          source: 'timetable.setMembership',
          studentId: input.studentId,
          registrationLevel: input.isOwnTimetable ? null : registrationLevel,
          isOwnTimetable: input.isOwnTimetable,
        },
      },
    });
  });
}

export async function loadHeadTimetableWorkspace(
  ctx: AuthedContext,
  input: { termKey: string; registrationLevel: TimetableRegistrationLevel },
): Promise<TimetableHeadWorkspace> {
  const term = await requireTeachingTerm(ctx.db, input.termKey);
  const data = await ctx.withRls(async (db) => {
    const schedule = await db.timetableAgeGroupSchedule.findUnique({
      where: {
        termKey_registrationLevel: {
          termKey: input.termKey,
          registrationLevel: input.registrationLevel,
        },
      },
      include: { slots: { orderBy: { position: 'asc' } } },
    });
    const memberships = await db.timetableAgeGroupMembership.findMany({
      where: {
        registrationLevel: input.registrationLevel,
        student: { active: true },
      },
      select: {
        isOwnTimetable: true,
        student: {
          select: {
            id: true,
            fullNameEnc: true,
            registrationProfile: { select: { registrationLevel: true } },
            yearGroup: true,
          },
        },
      },
    });
    const studentIds = memberships
      .filter((membership) => !membership.isOwnTimetable)
      .map((membership) => membership.student.id);
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
    return { schedule, memberships, publications, drafts };
  });

  const latestPublicationByStudent = new Map<string, string>();
  for (const publication of data.publications) {
    if (!latestPublicationByStudent.has(publication.studentId)) {
      latestPublicationByStudent.set(publication.studentId, publication.id);
    }
  }
  const draftStudents = new Set(data.drafts.map((draft) => draft.studentId));
  const childGroups = data.memberships;
  const assignedStudentIds = childGroups
    .filter((child) => !child.isOwnTimetable)
    .map((child) => child.student.id);
  const childSummaries = childGroups
    .map((student) => {
      const fullName = decryptedStudentName(ctx, student.student.fullNameEnc);
      const latestPublicationId = latestPublicationByStudent.get(student.student.id) ?? null;
      return {
        id: student.student.id,
        fullName,
        firstName: firstNameFromFullName(fullName),
        registrationLevel: input.registrationLevel,
        latestPublicationId,
        status: student.isOwnTimetable
          ? ('N/A' as const)
          : latestPublicationId
            ? ('Published' as const)
            : draftStudents.has(student.student.id)
              ? ('Draft' as const)
              : ('NotStarted' as const),
      };
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
  const children = childSummaries.filter((child) => child.status !== 'N/A');
  const ownTimetableChildren = childSummaries.filter((child) => child.status === 'N/A');

  return {
    term,
    registrationLevel: input.registrationLevel,
    progress: countTimetableProgress(
      assignedStudentIds,
      [...latestPublicationByStudent.keys()],
    ),
    schedule: data.schedule
      ? {
          id: data.schedule.id,
          termKey: data.schedule.termKey,
          registrationLevel: data.schedule.registrationLevel,
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
    const membership = await loadTimetableMemberForStudent(db, input.studentId);
    const timetable = await db.studentTimetable.findUnique({
      where: { studentId_termKey: { studentId: input.studentId, termKey: input.termKey } },
      include: {
        entries: { orderBy: [{ day: 'asc' }, { slot: { position: 'asc' } }] },
        publications: {
          select: { id: true, publishedAt: true },
          orderBy: { publishedAt: 'desc' },
          take: 1,
        },
      },
    });
    return { membership, timetable };
  });

  const fullName = decryptedStudentName(ctx, data.membership.student.fullNameEnc);
  return {
    student: {
      id: data.membership.student.id,
      fullName,
      firstName: firstNameFromFullName(fullName),
      registrationLevel: data.membership.registrationLevel,
    },
    timetableId: data.timetable?.id ?? null,
    entries:
      data.timetable?.entries.map((entry) => ({
        day: entry.day,
        slotId: entry.slotId,
        subjectId: entry.subjectId,
      })) ?? [],
    subjects: data.membership.student.subjects.map(({ subject }) => subjectView(subject)),
    latestPublication: data.timetable?.publications[0] ?? null,
  };
}

export async function saveTimetableSchedule(
  ctx: AuthedContext,
  input: {
    termKey: string;
    registrationLevel: TimetableRegistrationLevel;
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
        termKey_registrationLevel: {
          termKey: input.termKey,
          registrationLevel: input.registrationLevel,
        },
      },
      include: { slots: true },
    });
    const existingIds = new Set(existing?.slots.map((slot) => slot.id) ?? []);
    const unknownId = input.slots.find((slot) => slot.id && !existingIds.has(slot.id));
    if (unknownId) badRequest('The timetable changed. Refresh before saving slot changes.');

    const schedule = await db.timetableAgeGroupSchedule.upsert({
      where: {
        termKey_registrationLevel: {
          termKey: input.termKey,
          registrationLevel: input.registrationLevel,
        },
      },
      create: {
        termKey: input.termKey,
        registrationLevel: input.registrationLevel,
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
          registrationLevel: input.registrationLevel,
          slotCount: slots.length,
        },
      },
    });

    return {
      id: schedule.id,
      termKey: schedule.termKey,
      registrationLevel: schedule.registrationLevel,
      slots,
    };
  });
}

export async function saveStudentTimetableDraft(
  ctx: AuthedContext,
  input: {
    studentId: string;
    termKey: string;
    entries: Array<{ day: (typeof TIMETABLE_DAYS)[number]; slotId: string; subjectId: string }>;
  },
) {
  await requireTeachingTerm(ctx.db, input.termKey);
  return ctx.withRls(async (db) => {
    const membership = await loadTimetableMemberForStudent(db, input.studentId);
    const student = membership.student;
    const registrationLevel = membership.registrationLevel;
    const schedule = await db.timetableAgeGroupSchedule.findUnique({
      where: { termKey_registrationLevel: { termKey: input.termKey, registrationLevel } },
      include: { slots: true },
    });
    if (!schedule) badRequest('Save the age-group times before creating child timetables');

    const lessonSlotIds = new Set(
      schedule.slots.filter((slot) => slot.kind === 'Lesson').map((slot) => slot.id),
    );
    const assignedSubjectIds = new Set(student.subjects.map(({ subject }) => subject.id));
    const entryKeys = new Set<string>();
    for (const entry of input.entries) {
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
        registrationLevel,
        scheduleId: schedule.id,
        updatedById: ctx.user.id,
      },
      update: { registrationLevel, scheduleId: schedule.id, updatedById: ctx.user.id },
    });
    await db.studentTimetableEntry.deleteMany({ where: { timetableId: timetable.id } });
    if (input.entries.length > 0) {
      await db.studentTimetableEntry.createMany({
        data: input.entries.map((entry) => ({ ...entry, timetableId: timetable.id })),
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
          assignedPeriodCount: input.entries.length,
        },
      },
    });

    return {
      timetableId: timetable.id,
      entries: input.entries,
      unassignedLessonCount: lessonSlotIds.size * TIMETABLE_DAYS.length - input.entries.length,
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
