import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  createAndAssignTimetableSubject,
  customSubjectCodeBase,
  registrationLevelForStudent,
  setTimetableMembership,
} from '../services/timetable-data.js';

const head: SessionUser = { id: 'head_1', role: 'Head', tags: [], requires2fa: false };

describe('registrationLevelForStudent', () => {
  it('uses a valid registration profile before the year-group fallback', () => {
    expect(registrationLevelForStudent('ABC', 'Year 8')).toBe('ABC');
    expect(registrationLevelForStudent('Primary', 'Year 8')).toBe('Primary');
    expect(registrationLevelForStudent('Secondary', 'Reception')).toBe('Secondary');
  });

  it('maps legacy year groups when a registration profile is missing', () => {
    expect(registrationLevelForStudent(null, 'Nursery')).toBe('ABC');
    expect(registrationLevelForStudent(undefined, 'Reception')).toBe('ABC');
    expect(registrationLevelForStudent('', 'Year 6')).toBe('Primary');
    expect(registrationLevelForStudent('Legacy', 'Y7')).toBe('Secondary');
    expect(registrationLevelForStudent(null, 'Level 11')).toBe('Secondary');
  });
});

describe('customSubjectCodeBase', () => {
  it('creates a stable catalogue code that fits the existing 20-character boundary', () => {
    expect(customSubjectCodeBase(' French conversation ')).toBe('CUSTOM-FRENCH-CONVER');
    expect(customSubjectCodeBase('Art & Design')).toBe('CUSTOM-ART-DESIGN');
    expect(customSubjectCodeBase('日本語')).toBe('CUSTOM-SUBJECT');
  });
});

describe('createAndAssignTimetableSubject', () => {
  it('uses the canonical colour when an added subject has a recognised name', async () => {
    const db = {
      student: { findFirst: vi.fn().mockResolvedValue({ id: 'student_1' }) },
      subject: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(({ data }) => Promise.resolve({ id: 'subject_1', active: true, ...data })),
      },
      studentSubject: { upsert: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const ctx = {
      db: {},
      user: head,
      withRls: (operation: (tx: never) => Promise<unknown>) => operation(db as never),
    } as unknown as AppContext & { user: SessionUser };

    await expect(
      createAndAssignTimetableSubject(ctx, { studentId: 'student_1', name: 'Maths' }),
    ).resolves.toMatchObject({ colour: 'Yellow' });
    expect(db.subject.create).toHaveBeenCalledWith({
      data: {
        code: 'CUSTOM-MATHS',
        name: 'Maths',
        timetableColour: 'Yellow',
      },
    });
  });
});

describe('setTimetableMembership', () => {
  it('marks a child N/A while preserving their group, then restores them to a selected group', async () => {
    const db = {
      student: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'student_1',
          yearGroup: 'Year 4',
          registrationProfile: { registrationLevel: 'Primary' },
          timetableAgeGroupMembership: { registrationLevel: 'Primary' },
        }),
      },
      timetableAgeGroupMembership: { upsert: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const ctx = {
      db: {},
      user: head,
      withRls: (operation: (tx: never) => Promise<unknown>) => operation(db as never),
    } as unknown as AppContext & { user: SessionUser };

    await setTimetableMembership(ctx, { studentId: 'student_1', isOwnTimetable: true });
    expect(db.timetableAgeGroupMembership.upsert).toHaveBeenLastCalledWith({
      where: { studentId: 'student_1' },
      create: {
        studentId: 'student_1',
        isOwnTimetable: true,
        registrationLevel: 'Primary',
      },
      update: { isOwnTimetable: true },
    });

    await setTimetableMembership(ctx, {
      studentId: 'student_1',
      isOwnTimetable: false,
      registrationLevel: 'Secondary',
    });
    expect(db.timetableAgeGroupMembership.upsert).toHaveBeenLastCalledWith({
      where: { studentId: 'student_1' },
      create: {
        studentId: 'student_1',
        isOwnTimetable: false,
        registrationLevel: 'Secondary',
      },
      update: { isOwnTimetable: false, registrationLevel: 'Secondary' },
    });
  });
});
