import { describe, expect, it } from 'vitest';
import {
  diagnosticResultInput,
  firstPaceNumberForDiagnosticLevel,
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
});
