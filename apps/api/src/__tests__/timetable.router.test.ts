import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import { makeTestContext } from './helpers/test-context.js';
import { createTimetableRouter, type TimetableRouterDeps } from '../routers/timetable.js';
import { router } from '../trpc.js';

const head: SessionUser = { id: 'user_head', role: 'Head', tags: [], requires2fa: false };
const parent: SessionUser = { id: 'user_parent', role: 'Parent', tags: [], requires2fa: false };
const supervisor: SessionUser = {
  id: 'user_supervisor',
  role: 'Supervisor',
  tags: [],
  requires2fa: false,
};

const term = {
  key: '2026-27-term-1',
  academicYearLabel: '2026/27',
  number: 1,
  label: 'Term 1',
  startsOn: new Date('2026-09-08T00:00:00.000Z'),
  endsOn: new Date('2026-10-16T00:00:00.000Z'),
};

const scheduleInput = {
  termKey: term.key,
  registrationLevel: 'Primary' as const,
  slots: [
    { kind: 'Break' as const, label: 'Morning break', startMinutes: 540, endMinutes: 555 },
    { kind: 'Lesson' as const, label: 'Lesson 1', startMinutes: 555, endMinutes: 600 },
  ],
};

function dependencies(): TimetableRouterDeps {
  return {
    loadTeachingTerms: () => Promise.resolve([term]),
    requireTeachingTerm: () => Promise.resolve(term),
    loadHeadWorkspace: () =>
      Promise.resolve({
        term,
        registrationLevel: 'Primary',
        progress: { done: 0, total: 1 },
        schedule: null,
        defaultSlots: scheduleInput.slots,
        ownTimetableChildren: [],
        children: [
          {
            id: 'student_1',
            firstName: 'Taleyah',
            fullName: 'Taleyah Dolphy',
            registrationLevel: 'Primary',
            status: 'Draft' as const,
            latestPublicationId: null,
          },
        ],
      }),
    saveSchedule: (_ctx, input) =>
      Promise.resolve({
        id: 'schedule_1',
        termKey: input.termKey,
        registrationLevel: input.registrationLevel,
        slots: input.slots.map((slot, position) => ({
          ...slot,
          id: `slot_${String(position)}`,
          position,
        })),
      }),
    loadStudentDraft: () =>
      Promise.resolve({
        student: {
          id: 'student_1',
          firstName: 'Taleyah',
          fullName: 'Taleyah Dolphy',
          registrationLevel: 'Primary',
        },
        timetableId: null,
        entries: [],
        subjects: [],
        latestPublication: null,
      }),
    saveDraft: (_ctx, input) =>
      Promise.resolve({
        timetableId: 'timetable_1',
        entries: input.entries,
        unassignedLessonCount: 7,
      }),
    createAndAssignSubject: (_ctx, input) =>
      Promise.resolve({
        id: 'subject_french',
        code: 'CUSTOM-FRENCH',
        name: input.name,
        colour: 'Grey' as const,
      }),
    setMembership: () => Promise.resolve(),
    publish: () => Promise.reject(new Error('not used in this test')),
    publishedForParent: () => Promise.resolve(null),
    publishedForStudent: () => Promise.resolve(null),
    publicationForHead: () => Promise.resolve(null),
    downloadPdf: () => Promise.reject(new Error('not used in this test')),
  };
}

function caller(user: SessionUser | null, deps = dependencies()) {
  const db = {};
  return router({ timetable: createTimetableRouter(deps) }).createCaller(
    makeTestContext({ db, rls: { kind: 'db', db }, user }),
  );
}

describe('timetable router Head workspace', () => {
  it('lets authenticated portal readers list the existing teaching terms', async () => {
    await expect(caller(parent).timetable.terms()).resolves.toEqual([term]);
  });

  it('lets any authenticated linked-child portal call the guardian-scoped published reader', async () => {
    await expect(
      caller(supervisor).timetable.publishedForParent({
        studentId: 'student_1',
        termKey: term.key,
      }),
    ).resolves.toBeNull();
    await expect(
      caller(null).timetable.publishedForParent({
        studentId: 'student_1',
        termKey: term.key,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('allows only Heads to load and change the management workspace', async () => {
    await expect(
      caller(head).timetable.headWorkspace({
        termKey: term.key,
        registrationLevel: 'Primary',
      }),
    ).resolves.toMatchObject({ children: [{ firstName: 'Taleyah' }] });

    await expect(caller(supervisor).timetable.saveSchedule(scheduleInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller(supervisor).timetable.setMembership({
        studentId: 'student_1',
        isOwnTimetable: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets Heads mark a child N/A and requires a group when restoring them', async () => {
    const deps = dependencies();
    const setMembership = vi.fn().mockResolvedValue(undefined);
    deps.setMembership = setMembership;

    await caller(head, deps).timetable.setMembership({
      studentId: 'student_1',
      isOwnTimetable: true,
    });
    expect(setMembership).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ studentId: 'student_1', isOwnTimetable: true }),
    );
    await expect(
      caller(head, deps).timetable.setMembership({
        studentId: 'student_1',
        isOwnTimetable: false,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('accepts a break in any position and rejects overlapping slots', async () => {
    await expect(caller(head).timetable.saveSchedule(scheduleInput)).resolves.toMatchObject({
      slots: [
        { kind: 'Break', position: 0 },
        { kind: 'Lesson', position: 1 },
      ],
    });

    await expect(
      caller(head).timetable.saveSchedule({
        ...scheduleInput,
        slots: [
          { kind: 'Lesson', label: 'Lesson 1', startMinutes: 540, endMinutes: 600 },
          { kind: 'Break', label: 'Break', startMinutes: 590, endMinutes: 610 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('saves sparse child drafts and adds a reusable grey subject', async () => {
    await expect(
      caller(head).timetable.saveDraft({
        termKey: term.key,
        studentId: 'student_1',
        entries: [{ day: 'Tuesday', slotId: 'slot_1', subjectId: 'subject_math' }],
      }),
    ).resolves.toMatchObject({ unassignedLessonCount: 7 });

    await expect(
      caller(head).timetable.createAndAssignSubject({ studentId: 'student_1', name: ' French ' }),
    ).resolves.toEqual({
      id: 'subject_french',
      code: 'CUSTOM-FRENCH',
      name: 'French',
      colour: 'Grey',
    });
  });
});
