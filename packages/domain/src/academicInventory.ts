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

export const DIAGNOSTIC_TESTS = ['Math', 'English', 'WordBuilding', 'Reading'] as const;
export const diagnosticTest = z.enum(DIAGNOSTIC_TESTS);
export type DiagnosticTest = z.infer<typeof diagnosticTest>;

/** Math and English are scored on the PACE chart; the other tests use Level 1-10 Pass/Fail. */
export const DIAGNOSTIC_CHART_TESTS = ['Math', 'English'] as const;
export const DIAGNOSTIC_LEVEL_MAX = 10;

export function isDiagnosticChartTest(test: DiagnosticTest | null | undefined): boolean {
  return test === 'Math' || test === 'English';
}

const diagnosticPaceNumber = z.number().int().min(1001).max(1144);

const diagnosticLevelInput = z.object({
  studentId: z.string().trim().min(1),
  test: z.enum(['WordBuilding', 'Reading']),
  level: z.number().int().min(1).max(DIAGNOSTIC_LEVEL_MAX),
  outcome: diagnosticOutcome,
});

const diagnosticChartInput = z
  .object({
    studentId: z.string().trim().min(1),
    test: z.enum(DIAGNOSTIC_CHART_TESTS),
    attemptedPaceNumbers: z.array(diagnosticPaceNumber).min(1),
    circledPaceNumbers: z.array(diagnosticPaceNumber),
  })
  .superRefine(({ attemptedPaceNumbers, circledPaceNumbers }, ctx) => {
    if (new Set(attemptedPaceNumbers).size !== attemptedPaceNumbers.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'attemptedPaceNumbers must not contain duplicates',
        path: ['attemptedPaceNumbers'],
      });
    }
    const attempted = new Set(attemptedPaceNumbers);
    if (
      new Set(circledPaceNumbers).size !== circledPaceNumbers.length ||
      circledPaceNumbers.some((paceNumber) => !attempted.has(paceNumber))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'circledPaceNumbers must be unique and among the attempted PACEs',
        path: ['circledPaceNumbers'],
      });
    }
  });

export const diagnosticResultInput = z.union([diagnosticChartInput, diagnosticLevelInput]);
export type DiagnosticResultInput = z.infer<typeof diagnosticResultInput>;

export interface PacePlacement {
  /** Circled PACEs below the performance level, to be completed before moving on. */
  learningGaps: number[];
  /** The PACE the student advances from; null when the whole catalogue was passed. */
  performanceLevelPace: number | null;
}

/**
 * Reads a PACE chart the way the printed diagnostic does. Three circled PACEs in a row
 * (adjacent attempts) end the test and the student advances from the first of them.
 * Without such a run the student advances from the PACE after the last one passed.
 */
export function derivePacePlacement(
  attemptedPaceNumbers: readonly number[],
  circledPaceNumbers: readonly number[],
): PacePlacement {
  const attempted = [...new Set(attemptedPaceNumbers)].sort((left, right) => left - right);
  const circled = new Set(circledPaceNumbers);
  let performanceLevelPace: number | null = null;
  for (let index = 0; index + 2 < attempted.length; index += 1) {
    const [first, second, third] = [attempted[index], attempted[index + 1], attempted[index + 2]];
    if (
      first !== undefined &&
      second !== undefined &&
      third !== undefined &&
      circled.has(first) &&
      circled.has(second) &&
      circled.has(third)
    ) {
      performanceLevelPace = first;
      break;
    }
  }
  if (performanceLevelPace === null) {
    const passed = attempted.filter((paceNumber) => !circled.has(paceNumber));
    const lastPassed = passed.length ? Math.max(...passed) : null;
    const next = lastPassed === null ? attempted[0] : lastPassed + 1;
    performanceLevelPace = next !== undefined && next <= 1144 ? next : null;
  }
  const boundary = performanceLevelPace ?? Number.POSITIVE_INFINITY;
  return {
    learningGaps: attempted.filter(
      (paceNumber) => circled.has(paceNumber) && paceNumber < boundary,
    ),
    performanceLevelPace,
  };
}

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
  const remainingCount = availablePacesAhead(currentPaceNumber, availablePaceNumbers).length;
  return currentPaceNumber < 1144 && remainingCount <= 2;
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
