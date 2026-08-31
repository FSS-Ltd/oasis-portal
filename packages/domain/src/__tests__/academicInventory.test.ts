import { describe, expect, it } from 'vitest';
import {
  availablePacesAhead,
  bulkPaceInventoryOrderInput,
  currentStudentPaceSupplyInput,
  deleteDiagnosticResultInput,
  diagnosticResultInput,
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
  });

  it('keeps diagnostics as validated Level 1–5 Pass/Fail reference records', () => {
    const base = { studentId: 'student_1', subjectId: 'subject_1', outcome: 'Pass' as const };
    expect(diagnosticResultInput.parse({ ...base, level: 2 }).outcome).toBe('Pass');
    expect(diagnosticResultInput.safeParse({ ...base, level: 0 }).success).toBe(false);
    expect(diagnosticResultInput.safeParse({ ...base, level: 6 }).success).toBe(false);
    expect(diagnosticResultInput.safeParse({ ...base, level: 2, outcome: 'Unknown' }).success).toBe(false);
  });

  it('validates bounded, non-duplicate student-specific supply and bulk order PACEs', () => {
    const base = { studentId: 'student_1', subjectId: 'subject_1' };
    expect(bulkPaceInventoryOrderInput.safeParse({ ...base, paceNumbers: [1001, 1144] }).success)
      .toBe(true);
    expect(currentStudentPaceSupplyInput.safeParse({ ...base, paceNumbers: [1001, 1144] }).success)
      .toBe(true);
    expect(bulkPaceInventoryOrderInput.safeParse({ ...base, paceNumbers: [1000] }).success).toBe(false);
    expect(currentStudentPaceSupplyInput.safeParse({ ...base, paceNumbers: [1145] }).success).toBe(false);
    expect(bulkPaceInventoryOrderInput.safeParse({ ...base, paceNumbers: [1001, 1001] }).success)
      .toBe(false);
    expect(currentStudentPaceSupplyInput.safeParse({ ...base, paceNumbers: [1001, 1001] }).success)
      .toBe(false);
    expect(deleteDiagnosticResultInput.safeParse({ diagnosticId: 'diagnostic_1' }).success).toBe(true);
    expect(deleteDiagnosticResultInput.safeParse({ diagnosticId: ' ' }).success).toBe(false);
  });

  it('rejects non-positive order PACE values and quantities', () => {
    expect(paceInventoryOrderInput.safeParse({ paceNumber: 0, quantity: 1 }).success).toBe(false);
    expect(paceInventoryOrderInput.safeParse({ paceNumber: 1001, quantity: 0 }).success).toBe(false);
  });

  it('rejects invalid order statuses', () => {
    expect(paceInventoryStatusInput.safeParse({ orderId: 'order_1', status: 'Cancelled' }).success).toBe(false);
  });
});
