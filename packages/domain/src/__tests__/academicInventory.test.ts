import { describe, expect, it } from 'vitest';
import {
  availablePacesAhead,
  bulkPaceInventoryOrderInput,
  currentStudentPaceSupplyInput,
  deleteDiagnosticResultInput,
  derivePacePlacement,
  diagnosticLevelsFor,
  placementFromLevels,
  firstPaceOfLevel,
  recommendedStartPace,
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

  it('stops alerting once every PACE left to order is covered', () => {
    expect(requiresPaceReorder(1010, [1011, 1012, 1013], 134)).toBe(false);
    expect(requiresPaceReorder(1010, [1011, 1012], 134)).toBe(true);
    expect(requiresPaceReorder(1142, [1143], 2)).toBe(true);
    expect(requiresPaceReorder(1142, [1143, 1144], 2)).toBe(false);
    expect(requiresPaceReorder(1143, [1144], 1)).toBe(false);
    expect(requiresPaceReorder(1143, [], 1)).toBe(true);
  });

  it('validates a level sitting: Pass or Fail per level, unique, within the assessed range', () => {
    const sitting = (test: 'Reading' | 'WordBuilding', levels: Array<[number, string]>) =>
      diagnosticResultInput.safeParse({
        studentId: 'student_1',
        test,
        levelResults: levels.map(([level, outcome]) => ({ level, outcome })),
      }).success;
    expect(
      sitting('Reading', [
        [1, 'Pass'],
        [2, 'Pass'],
        [3, 'Fail'],
      ]),
    ).toBe(true);
    expect(sitting('Reading', [[8, 'Fail']])).toBe(true);
    expect(
      sitting('WordBuilding', [
        [2, 'Pass'],
        [9, 'Fail'],
      ]),
    ).toBe(true);
    expect(sitting('Reading', [])).toBe(false);
    expect(sitting('Reading', [[9, 'Pass']])).toBe(false);
    expect(sitting('Reading', [[0, 'Pass']])).toBe(false);
    expect(sitting('WordBuilding', [[1, 'Pass']])).toBe(false);
    expect(sitting('WordBuilding', [[10, 'Pass']])).toBe(false);
    expect(
      sitting('Reading', [
        [2, 'Pass'],
        [2, 'Fail'],
      ]),
    ).toBe(false);
    expect(sitting('Reading', [[2, 'Maybe']])).toBe(false);
  });

  it('lists the levels each test assesses', () => {
    expect(diagnosticLevelsFor('Reading')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(diagnosticLevelsFor('WordBuilding')).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('places a level sitting at the first PACE of the first level failed', () => {
    // Worked examples from the placement map.
    expect(placementFromLevels('Reading', [1, 2, 3], [4])).toEqual({
      firstFailedLevel: 4,
      recommendedStartPace: 1037,
      review: null,
    });
    expect(placementFromLevels('WordBuilding', [2], [3])).toEqual({
      firstFailedLevel: 3,
      recommendedStartPace: 1025,
      review: null,
    });
    // The lowest failed level wins, whatever order the levels arrive in.
    expect(placementFromLevels('Reading', [1, 2], [6, 4, 5]).recommendedStartPace).toBe(1037);
    expect(placementFromLevels('Reading', [], [1]).recommendedStartPace).toBe(1001);
  });

  it('flags a sitting for manual review when every level passes or results conflict', () => {
    expect(placementFromLevels('Reading', [1, 2, 3, 4, 5, 6, 7, 8], [])).toEqual({
      firstFailedLevel: null,
      recommendedStartPace: null,
      review: 'allPassed',
    });
    // Passing a level above one that was failed is inconsistent: still shows the first fail.
    expect(placementFromLevels('Reading', [1, 3], [2])).toEqual({
      firstFailedLevel: 2,
      recommendedStartPace: 1013,
      review: 'conflict',
    });
    expect(placementFromLevels('WordBuilding', [], [])).toEqual({
      firstFailedLevel: null,
      recommendedStartPace: null,
      review: 'allPassed',
    });
  });

  it('begins at the first PACE of the first level failed', () => {
    expect(firstPaceOfLevel(1)).toBe(1001);
    expect(firstPaceOfLevel(9)).toBe(1097);
    // Worked examples from the placement map: pass 3 / fail 4 begins at 1037, not 1040.
    expect(recommendedStartPace('Reading', 4, 'Fail')).toBe(1037);
    expect(recommendedStartPace('WordBuilding', 3, 'Fail')).toBe(1025);
    expect(recommendedStartPace('WordBuilding', 9, 'Fail')).toBe(1097);
    // A pass does not place the student; the first failed level does.
    expect(recommendedStartPace('Reading', 3, 'Pass')).toBeNull();
    // Levels a test does not assess never produce a recommendation.
    expect(recommendedStartPace('WordBuilding', 1, 'Fail')).toBeNull();
    expect(recommendedStartPace('Reading', 9, 'Fail')).toBeNull();
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
