import { describe, expect, it } from 'vitest';
import { paceRecordInput } from '../subjects.js';

describe('paceRecordInput', () => {
  it('accepts non-empty database ids without requiring CUID format', () => {
    expect(
      paceRecordInput.parse({
        studentId: 'student_1',
        subjectId: 'subject_1',
        paceNumber: 1001,
        testType: 'SelfTest',
        score: 88,
      }),
    ).toMatchObject({
      studentId: 'student_1',
      subjectId: 'subject_1',
    });
  });

  it('rejects empty identifiers', () => {
    expect(
      paceRecordInput.safeParse({
        studentId: '',
        subjectId: 'subject_1',
        paceNumber: 1001,
        testType: 'SelfTest',
        score: 88,
      }).success,
    ).toBe(false);
  });
});
