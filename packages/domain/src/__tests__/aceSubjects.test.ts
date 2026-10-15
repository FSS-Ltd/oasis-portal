import { describe, expect, it } from 'vitest';
import { ACE_SUBJECT_CODES } from '../academicInventory.js';

describe('ACE inventory subjects', () => {
  it('recognises original and production PACE subject codes', () => {
    expect(ACE_SUBJECT_CODES).toEqual([
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
    ]);
  });
});
