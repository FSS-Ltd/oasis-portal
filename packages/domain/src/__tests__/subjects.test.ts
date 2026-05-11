import { describe, expect, it } from 'vitest';
import {
  paceNumberToAceLevel,
  paceProgressStatusForYear,
  paceRecordInput,
} from '../subjects.js';

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

  it('accepts decimal percentage scores', () => {
    expect(
      paceRecordInput.parse({
        studentId: 'student_1',
        subjectId: 'subject_1',
        paceNumber: 1001,
        testType: 'SelfTest',
        score: 97.5,
      }).score,
    ).toBe(97.5);
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

describe('PACE level status helpers', () => {
  it('maps long and short PACE numbering to ACE levels', () => {
    expect(paceNumberToAceLevel(1001)).toBe(1);
    expect(paceNumberToAceLevel(1012)).toBe(1);
    expect(paceNumberToAceLevel(1013)).toBe(2);
    expect(paceNumberToAceLevel(1144)).toBe(12);
    expect(paceNumberToAceLevel(1)).toBe(1);
    expect(paceNumberToAceLevel(13)).toBe(2);
    expect(paceNumberToAceLevel(144)).toBe(12);
    expect(paceNumberToAceLevel(1145)).toBeNull();
  });

  it('computes behind, on-track, ahead, and unavailable status text', () => {
    expect(paceProgressStatusForYear(1001, 'Year 1')).toMatchObject({
      status: 'On Track',
      detail: 'Testing at Level 1',
      tone: 'blue',
    });
    expect(paceProgressStatusForYear(1001, 'Reception')).toMatchObject({
      status: 'Ahead',
      detail: 'Testing at Level 1',
      tone: 'green',
    });
    expect(paceProgressStatusForYear(1001, 'Year 3')).toMatchObject({
      status: 'Behind',
      detail: 'Testing at Level 1',
      tone: 'amber',
    });
    expect(paceProgressStatusForYear(1025, 'Year 3')).toMatchObject({
      status: 'On Track',
      detail: 'Testing at Level 3',
      tone: 'blue',
    });
    expect(paceProgressStatusForYear(1049, 'Year 3')).toMatchObject({
      status: 'Ahead',
      detail: 'Testing at Level 5',
      tone: 'green',
    });
    expect(paceProgressStatusForYear(1023, 'Y5')).toMatchObject({
      status: 'Behind',
      detail: 'Testing at Level 2',
      tone: 'amber',
    });
    expect(paceProgressStatusForYear(2000, 'Year 3')).toMatchObject({
      status: 'Unavailable',
      detail: 'Status unavailable',
      tone: 'grey',
    });
  });
});
