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

export function requiresPaceReorder(
  currentPaceNumber: number,
  availablePaceNumbers: readonly number[],
): boolean {
  return availablePacesAhead(currentPaceNumber, availablePaceNumbers).length <= 2;
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
