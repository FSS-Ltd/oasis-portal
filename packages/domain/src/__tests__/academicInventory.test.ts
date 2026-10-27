import { describe, expect, it } from 'vitest';
import {
  availablePacesAhead,
  bulkPaceInventoryOrderInput,
  currentStudentPaceSupplyInput,
  deleteDiagnosticResultInput,
  derivePacePlacement,
  diagnosticResultInput,
  markPaceOrdersInTransitInput,
  markPaceOrdersDeliveredInput,
  PACE_CATALOGUE,
  paceInventoryOrderInput,
  paceInventoryStatusInput,
  paceLevelForNumber,
  requiresPaceReorder,
} from '../academicInventory.js';

describe('academic inventory', () => {
  it('provides the deterministic PACE catalogue and level mapping', () => {
    expect(PACE_CATALOGUE).toHaveLength(144);
    expect(PACE_CATALOGUE[0]).toBe(1001);
    expect(PACE_CATALOGUE.at(-1)).toBe(1144);
    expect(PACE_CATALOGUE.filter((paceNumber) => paceLevelForNumber(paceNumber) === 2)).toEqual(
      Array.from({ length: 12 }, (_, index) => 1013 + index),
    );
    expect(paceLevelForNumber(1013)).toBe(2);
  });

  it('alerts when two or fewer available PACEs remain ahead of progress', () => {
    expect(availablePacesAhead(1010, [1009, 1010, 1011, 1012])).toEqual([1011, 1012]);
    expect(requiresPaceReorder(1010, [1011, 1012])).toBe(true);
    expect(requiresPaceReorder(1010, [1011, 1012, 1013])).toBe(false);
    expect(requiresPaceReorder(1010, [])).toBe(true);
    expect(requiresPaceReorder(1144, [])).toBe(false);
  });

  it('validates Word Building and Reading as Level 1–10 Pass/Fail records', () => {
    const base = { studentId: 'student_1', outcome: 'Pass' as const };
    for (const test of ['WordBuilding', 'Reading'] as const) {
      expect(diagnosticResultInput.parse({ ...base, test, level: 10 }).test).toBe(test);
      expect(diagnosticResultInput.safeParse({ ...base, test, level: 0 }).success).toBe(false);
      expect(diagnosticResultInput.safeParse({ ...base, test, level: 11 }).success).toBe(false);
      expect(
        diagnosticResultInput.safeParse({ ...base, test, level: 2, outcome: 'Maybe' }).success,
      ).toBe(false);
    }
  });

  it('validates Math and English as PACE charts with circled PACEs among the attempted', () => {
    const chart = {
      studentId: 'student_1',
      test: 'Math' as const,
      attemptedPaceNumbers: [1001, 1002, 1003],
      circledPaceNumbers: [1002],
    };
    expect(diagnosticResultInput.parse(chart).test).toBe('Math');
    expect(diagnosticResultInput.safeParse({ ...chart, test: 'English' }).success).toBe(true);
    expect(diagnosticResultInput.safeParse({ ...chart, circledPaceNumbers: [] }).success).toBe(
      true,
    );
    expect(diagnosticResultInput.safeParse({ ...chart, circledPaceNumbers: [1004] }).success).toBe(
      false,
    );
    expect(diagnosticResultInput.safeParse({ ...chart, attemptedPaceNumbers: [] }).success).toBe(
      false,
    );
    expect(
      diagnosticResultInput.safeParse({ ...chart, attemptedPaceNumbers: [1001, 1001] }).success,
    ).toBe(false);
    expect(
      diagnosticResultInput.safeParse({ ...chart, attemptedPaceNumbers: [1000] }).success,
    ).toBe(false);
    expect(diagnosticResultInput.safeParse({ ...chart, level: 3, outcome: 'Pass' }).success).toBe(
      true,
    );
  });

  it('derives gaps and performance level from the PDF example chart', () => {
    const attempted = Array.from({ length: 17 }, (_, index) => 1001 + index);
    expect(derivePacePlacement(attempted, [1008, 1015, 1016, 1017])).toEqual({
      learningGaps: [1008],
      performanceLevelPace: 1015,
    });
  });

  it('starts after the last passed PACE when testing stops without three circled in a row', () => {
    const attempted = Array.from({ length: 26 }, (_, index) => 1001 + index);
    expect(derivePacePlacement(attempted, [])).toEqual({
      learningGaps: [],
      performanceLevelPace: 1027,
    });
    expect(derivePacePlacement(attempted, [1005, 1010])).toEqual({
      learningGaps: [1005, 1010],
      performanceLevelPace: 1027,
    });
    // Two trailing circles are not a run: the student restarts after the last pass.
    expect(derivePacePlacement([1001, 1002, 1003, 1004], [1003, 1004])).toEqual({
      learningGaps: [],
      performanceLevelPace: 1003,
    });
  });

  it('only counts adjacent circled attempts as a run and handles edge cases', () => {
    // 1004 is not attempted, so 1003, 1005, 1006 are adjacent attempts: a run from 1003.
    expect(derivePacePlacement([1001, 1002, 1003, 1005, 1006], [1003, 1005, 1006])).toEqual({
      learningGaps: [],
      performanceLevelPace: 1003,
    });
    // Circles broken by a pass do not form a run.
    expect(derivePacePlacement([1001, 1002, 1003, 1004, 1005], [1001, 1002, 1004, 1005])).toEqual({
      learningGaps: [1001, 1002],
      performanceLevelPace: 1004,
    });
    // Nothing passed: start from the first attempted PACE.
    expect(derivePacePlacement([1001, 1002], [1001, 1002])).toEqual({
      learningGaps: [],
      performanceLevelPace: 1001,
    });
    // Passing the last PACE completes the catalogue.
    expect(derivePacePlacement([1143, 1144], [])).toEqual({
      learningGaps: [],
      performanceLevelPace: null,
    });
    // Unsorted input is sorted first.
    expect(derivePacePlacement([1003, 1001, 1002], [1002])).toEqual({
      learningGaps: [1002],
      performanceLevelPace: 1004,
    });
  });

  it('validates bounded, non-duplicate student-specific supply and bulk order PACEs', () => {
    const base = { studentId: 'student_1', subjectId: 'subject_1' };
    expect(
      bulkPaceInventoryOrderInput.safeParse({ ...base, paceNumbers: [1001, 1144] }).success,
    ).toBe(true);
    expect(
      currentStudentPaceSupplyInput.safeParse({ ...base, paceNumbers: [1001, 1144] }).success,
    ).toBe(true);
    expect(bulkPaceInventoryOrderInput.safeParse({ ...base, paceNumbers: [1000] }).success).toBe(
      false,
    );
    expect(currentStudentPaceSupplyInput.safeParse({ ...base, paceNumbers: [1145] }).success).toBe(
      false,
    );
    expect(
      bulkPaceInventoryOrderInput.safeParse({ ...base, paceNumbers: [1001, 1001] }).success,
    ).toBe(false);
    expect(
      currentStudentPaceSupplyInput.safeParse({ ...base, paceNumbers: [1001, 1001] }).success,
    ).toBe(false);
    expect(deleteDiagnosticResultInput.safeParse({ diagnosticId: 'diagnostic_1' }).success).toBe(
      true,
    );
    expect(deleteDiagnosticResultInput.safeParse({ diagnosticId: ' ' }).success).toBe(false);
  });

  it('rejects non-positive order PACE values and quantities', () => {
    expect(paceInventoryOrderInput.safeParse({ paceNumber: 0, quantity: 1 }).success).toBe(false);
    expect(paceInventoryOrderInput.safeParse({ paceNumber: 1001, quantity: 0 }).success).toBe(
      false,
    );
  });

  it('rejects invalid order statuses', () => {
    expect(
      paceInventoryStatusInput.safeParse({ orderId: 'order_1', status: 'Cancelled' }).success,
    ).toBe(false);
  });

  it('requires unique, nonblank order IDs for bulk transit', () => {
    expect(markPaceOrdersInTransitInput.parse({ orderIds: [' order_1 ', 'order_2'] })).toEqual({
      orderIds: ['order_1', 'order_2'],
    });
    for (const orderIds of [[], [' '], ['order_1', 'order_1'], ['order_1', ' order_1 ']]) {
      expect(markPaceOrdersInTransitInput.safeParse({ orderIds }).success).toBe(false);
      expect(markPaceOrdersDeliveredInput.safeParse({ orderIds }).success).toBe(false);
    }
  });
});
