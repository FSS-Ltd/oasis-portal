import { z } from 'zod';

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
  score: z.number().int().min(0).max(100),
  completedAt: z.coerce.date().optional(),
});

export type PaceRecordInput = z.infer<typeof paceRecordInput>;
