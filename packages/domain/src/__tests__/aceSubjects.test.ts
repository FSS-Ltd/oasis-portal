import { describe, expect, it } from 'vitest';
import { ACE_SUBJECT_CODES } from '../academicInventory.js';

describe('ACE inventory subjects', () => {
  it('lists exactly the eight supported ACE subjects', () => {
    expect(ACE_SUBJECT_CODES).toEqual(['MATH', 'ENG', 'WB', 'LIT', 'SOC', 'SCI', 'ANSCI', 'BIBLE']);
  });
});
