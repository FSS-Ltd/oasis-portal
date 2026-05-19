import { z } from 'zod';
import { expectedPaceLevelForYear } from './schoolYears.js';

// ---------------------------------------------------------------------------
// Subject management
// ---------------------------------------------------------------------------

export const createSubjectInput = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'code must be alphanumeric with optional - or _')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1).max(100),
});

export type CreateSubjectInput = z.infer<typeof createSubjectInput>;

export const updateSubjectInput = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(100).optional(),
});

export type UpdateSubjectInput = z.infer<typeof updateSubjectInput>;

export const deactivateSubjectInput = z.object({
  id: z.string().cuid(),
});

export type DeactivateSubjectInput = z.infer<typeof deactivateSubjectInput>;

// ---------------------------------------------------------------------------
// PACE policy
// ---------------------------------------------------------------------------

export const updatePacePolicyInput = z
  .object({
    dailyTestLimitEnabled: z.boolean().optional(),
    maxTestsPerStudentPerDay: z.number().int().min(1).max(20).optional(),
    samePaceSameDayBlockEnabled: z.boolean().optional(),
    passThreshold: z.number().int().min(1).max(100).optional(),
  })
  .refine((v) => Object.values(v).some((f) => f !== undefined), {
    message: 'at least one field must be provided',
  });

export type UpdatePacePolicyInput = z.infer<typeof updatePacePolicyInput>;

// ---------------------------------------------------------------------------
// PACE record write
// ---------------------------------------------------------------------------

export const paceRecordInput = z.object({
  studentId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  paceNumber: z.number().int().positive(),
  testType: z.enum(['SelfTest', 'FinalTest']),
  score: z.number().min(0).max(100),
  completedAt: z.coerce.date().optional(),
});

export type PaceRecordInput = z.infer<typeof paceRecordInput>;

export const paceUpdateRecordInput = z.object({
  recordId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1).optional(),
  paceNumber: z.number().int().positive().optional(),
  score: z.number().min(0).max(100),
  completedAt: z.coerce.date(),
  startedAt: z.coerce.date(),
});

export type PaceUpdateRecordInput = z.infer<typeof paceUpdateRecordInput>;

export type PaceProgressStatus = 'Behind' | 'On Track' | 'Ahead' | 'Unavailable';
export type PaceProgressStatusTone = 'amber' | 'blue' | 'green' | 'grey';

export interface PaceProgressStatusResult {
  status: PaceProgressStatus;
  tone: PaceProgressStatusTone;
  testingLevel: number | null;
  testingLevelLabel: string | null;
  detail: string;
}

export function paceNumberToAceLevel(paceNumber: number): number | null {
  if (!Number.isInteger(paceNumber) || paceNumber <= 0) return null;

  if (paceNumber >= 1001 && paceNumber <= 1144) {
    return Math.floor((paceNumber - 1001) / 12) + 1;
  }

  if (paceNumber >= 1 && paceNumber <= 144) {
    return Math.floor((paceNumber - 1) / 12) + 1;
  }

  return null;
}

export function paceProgressStatusForYear(
  paceNumber: number,
  yearGroup: string,
): PaceProgressStatusResult {
  const testingLevel = paceNumberToAceLevel(paceNumber);
  if (testingLevel === null) {
    return {
      status: 'Unavailable',
      tone: 'grey',
      testingLevel: null,
      testingLevelLabel: null,
      detail: 'Status unavailable',
    };
  }

  const testingLevelLabel = `Testing at Level ${String(testingLevel)}`;
  const expectedLevel = expectedPaceLevelForYear(yearGroup);
  if (expectedLevel === null) {
    return {
      status: 'Unavailable',
      tone: 'grey',
      testingLevel,
      testingLevelLabel,
      detail: testingLevelLabel,
    };
  }

  if (testingLevel > expectedLevel) {
    return {
      status: 'Ahead',
      tone: 'green',
      testingLevel,
      testingLevelLabel,
      detail: testingLevelLabel,
    };
  }

  if (testingLevel < expectedLevel) {
    return {
      status: 'Behind',
      tone: 'amber',
      testingLevel,
      testingLevelLabel,
      detail: testingLevelLabel,
    };
  }

  return {
    status: 'On Track',
    tone: 'blue',
    testingLevel,
    testingLevelLabel,
    detail: testingLevelLabel,
  };
}
