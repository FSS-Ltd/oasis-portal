import { describe, expect, it } from 'vitest';
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
  ageBandId: 'band_primary',
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
        ageBand: { id: 'band_primary', name: 'Primary', colour: '#2F8F6B' },
        progress: { done: 0, total: 1 },
        ownTimetableChildren: [],
        schedule: null,
        defaultSlots: scheduleInput.slots,
        children: [
          {
            id: 'student_1',
            firstName: 'Taleyah',
            fullName: 'Taleyah Dolphy',
            ageBandId: 'band_primary',
            status: 'Draft' as const,
            latestPublicationId: null,
          },
        ],
      }),
    saveSchedule: (_ctx, input) =>
      Promise.resolve({
        id: 'schedule_1',
        termKey: input.termKey,
        ageBandId: input.ageBandId,
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
          ageBandId: 'band_primary',
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
    publish: () => Promise.reject(new Error('not used in this test')),
    publishedForParent: () => Promise.resolve(null),
    publishedForStudent: () => Promise.resolve(null),
    publicationForHead: () => Promise.resolve(null),
    downloadPdf: () => Promise.reject(new Error('not used in this test')),
    setOwnTimetable: () => Promise.resolve(),
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
        ageBandId: 'band_primary',
      }),
    ).resolves.toMatchObject({ children: [{ firstName: 'Taleyah' }] });

    await expect(caller(supervisor).timetable.saveSchedule(scheduleInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lets only Heads exclude a child from the timetable workflow', async () => {
    await expect(
      caller(head).timetable.setOwnTimetable({ studentId: 'student_1', followsOwnTimetable: true }),
    ).resolves.toBeUndefined();
    await expect(
      caller(supervisor).timetable.setOwnTimetable({
        studentId: 'student_1',
        followsOwnTimetable: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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
