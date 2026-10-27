import { z } from 'zod';

export const ACE_SUBJECT_CODES = [
  'MATH',
  'ENG',
  'WB',
  'LIT',
  'SOC',
  'SCI',
  'ANSCI',
  'BIBLE',
  'MA',
  'EN',
  'CWL',
  'AS',
  'BS',
  'CUSTOM-WORD-BUILDING',
] as const;

export const paceInventoryOrderStatus = z.enum(['Ordered', 'InTransit', 'Delivered']);

export const paceInventoryOrderInput = z.object({
  paceNumber: z.number().int().min(1001).max(1144),
  quantity: z.number().int().min(1),
});

export const paceInventoryStatusInput = z.object({
  orderId: z.string().trim().min(1),
  status: paceInventoryOrderStatus,
});

export const markPaceOrdersInTransitInput = z.object({
  orderIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .superRefine((orderIds, ctx) => {
      if (new Set(orderIds).size !== orderIds.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'orderIds must be unique' });
      }
    }),
});

export const markPaceOrdersDeliveredInput = markPaceOrdersInTransitInput;

export const diagnosticOutcome = z.enum(['Pass', 'Fail']);

export const diagnosticResultInput = z.object({
  studentId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  level: z.number().int().min(1).max(5),
  outcome: diagnosticOutcome,
});

export const PACE_CATALOGUE = Array.from({ length: 144 }, (_, index) => 1001 + index);

export function paceLevelForNumber(paceNumber: number): number {
  return Math.floor((paceNumber - 1001) / 12) + 1;
}

export function availablePacesAhead(
  currentPaceNumber: number,
  paceNumbers: readonly number[],
): number[] {
  return [...new Set(paceNumbers)]
    .filter((paceNumber) => paceNumber > currentPaceNumber)
    .sort((left, right) => left - right);
}

export const PACE_REORDER_THRESHOLD = 3;

/**
 * True while fewer than three PACEs ahead of the current one are covered. Pass every
 * supplied or on-order PACE as `coveredPaceNumbers`. `remainingInCatalogue` caps the
 * threshold near the end of the catalogue, where fewer than three PACEs are left to order.
 */
export function requiresPaceReorder(
  currentPaceNumber: number,
  coveredPaceNumbers: readonly number[],
  remainingInCatalogue: number = PACE_REORDER_THRESHOLD,
): boolean {
  const coveredCount = availablePacesAhead(currentPaceNumber, coveredPaceNumbers).length;
  return (
    currentPaceNumber < 1144 &&
    coveredCount < Math.min(PACE_REORDER_THRESHOLD, remainingInCatalogue)
  );
}

const studentPaceNumbersInput = z
  .object({
    studentId: z.string().trim().min(1),
    subjectId: z.string().trim().min(1),
    paceNumbers: z.array(z.number().int().min(1001).max(1144)).min(1),
  })
  .superRefine(({ paceNumbers }, ctx) => {
    if (new Set(paceNumbers).size !== paceNumbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'paceNumbers must not contain duplicates',
        path: ['paceNumbers'],
      });
    }
  });

export const bulkPaceInventoryOrderInput = studentPaceNumbersInput;

export const currentStudentPaceSupplyInput = studentPaceNumbersInput;

export const deleteDiagnosticResultInput = z.object({
  diagnosticId: z.string().trim().min(1),
});
