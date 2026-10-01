import { z } from 'zod';

export const PACE_GAP_MIN = 1001;
export const PACE_GAP_MAX = 1144;

export const paceGapPaceNumber = z.number().int().min(PACE_GAP_MIN).max(PACE_GAP_MAX);

export const paceGapAssignmentInput = z.object({
  studentId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
});

const paceGapSelection = z
  .array(paceGapPaceNumber)
  .min(1)
  .superRefine((numbers, context) => {
    if (new Set(numbers).size !== numbers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Gap PACEs must be unique.',
      });
    }
  });

function requireDestinationAfterGaps(
  input: { jumpToPaceNumber: number; paceNumbers: readonly number[] },
  context: z.RefinementCtx,
): void {
  if (input.paceNumbers.some((paceNumber) => paceNumber >= input.jumpToPaceNumber)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The jump destination must be higher than every gap PACE.',
      path: ['jumpToPaceNumber'],
    });
  }
}

export const createPaceGapPlanInput = paceGapAssignmentInput
  .extend({
    paceNumbers: paceGapSelection,
    jumpToPaceNumber: paceGapPaceNumber,
    expectedCurrentPaceNumber: paceGapPaceNumber,
  })
  .superRefine(requireDestinationAfterGaps);

export const updatePaceGapPlanInput = z
  .object({
    planId: z.string().trim().min(1),
    expectedVersion: z.number().int().positive(),
    remainingPaceNumbers: paceGapSelection,
    jumpToPaceNumber: paceGapPaceNumber,
  })
  .superRefine((input, context) => {
    requireDestinationAfterGaps(
      { jumpToPaceNumber: input.jumpToPaceNumber, paceNumbers: input.remainingPaceNumbers },
      context,
    );
  });

export const resolvePaceGapPlanInput = z.object({
  planId: z.string().trim().min(1),
  expectedVersion: z.number().int().positive(),
});

export type CreatePaceGapPlanInput = z.infer<typeof createPaceGapPlanInput>;
export type UpdatePaceGapPlanInput = z.infer<typeof updatePaceGapPlanInput>;

export function sortPaceNumbers(paceNumbers: readonly number[]): number[] {
  return [...new Set(paceNumbers)].sort((left, right) => left - right);
}

export function nextPaceAfterGap(
  completedPaceNumber: number,
  remainingPaceNumbers: readonly number[],
  jumpToPaceNumber: number,
): number {
  return (
    sortPaceNumbers(remainingPaceNumbers).find((paceNumber) => paceNumber > completedPaceNumber) ??
    jumpToPaceNumber
  );
}
