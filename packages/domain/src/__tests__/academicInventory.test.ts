import { describe, expect, it } from 'vitest';
import {
  diagnosticResultInput,
  firstPaceNumberForDiagnosticLevel,
  paceInventoryOrderInput,
  paceInventoryStatusInput,
  requiresPaceReorder,
} from '../academicInventory.js';

describe('academic inventory', () => {
  it('places a failed Level 2 diagnostic at PACE 1013', () => {
    expect(firstPaceNumberForDiagnosticLevel(2)).toBe(1013);
    expect(diagnosticResultInput.parse({
      studentId: 'student_1', subjectId: 'subject_1', level: 2, outcome: 'Fail',
    }).outcome).toBe('Fail');
  });

  it('alerts at two PACEs remaining but not three', () => {
    expect(requiresPaceReorder(1011, 1013)).toBe(true);
    expect(requiresPaceReorder(1010, 1013)).toBe(false);
  });

  it('rejects diagnostic levels outside 1 through 5', () => {
    const base = { studentId: 'student_1', subjectId: 'subject_1', outcome: 'Pass' as const };
    expect(diagnosticResultInput.safeParse({ ...base, level: 0 }).success).toBe(false);
    expect(diagnosticResultInput.safeParse({ ...base, level: 6 }).success).toBe(false);
  });

  it('rejects non-positive order PACE values and quantities', () => {
    expect(paceInventoryOrderInput.safeParse({ paceNumber: 0, quantity: 1 }).success).toBe(false);
    expect(paceInventoryOrderInput.safeParse({ paceNumber: 1001, quantity: 0 }).success).toBe(false);
  });

  it('rejects invalid order statuses', () => {
    expect(paceInventoryStatusInput.safeParse({ orderId: 'order_1', status: 'Cancelled' }).success).toBe(false);
  });
});
