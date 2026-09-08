import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  createAndAssignTimetableSubject,
  customSubjectCodeBase,
} from '../services/timetable-data.js';

const head: SessionUser = { id: 'head_1', role: 'Head', tags: [], requires2fa: false };

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
