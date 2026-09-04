import { describe, expect, it } from 'vitest';
import { customSubjectCodeBase, registrationLevelForStudent } from '../services/timetable-data.js';

describe('registrationLevelForStudent', () => {
  it('uses a valid registration profile before the year-group fallback', () => {
    expect(registrationLevelForStudent('ABC', 'Year 8')).toBe('ABC');
    expect(registrationLevelForStudent('Primary', 'Year 8')).toBe('Primary');
    expect(registrationLevelForStudent('Secondary', 'Reception')).toBe('Secondary');
  });

  it('maps legacy year groups when a registration profile is missing', () => {
    expect(registrationLevelForStudent(null, 'Nursery')).toBe('ABC');
    expect(registrationLevelForStudent(undefined, 'Reception')).toBe('ABC');
    expect(registrationLevelForStudent('', 'Year 6')).toBe('Primary');
    expect(registrationLevelForStudent('Legacy', 'Y7')).toBe('Secondary');
    expect(registrationLevelForStudent(null, 'Level 11')).toBe('Secondary');
  });
});

describe('customSubjectCodeBase', () => {
  it('creates a stable catalogue code that fits the existing 20-character boundary', () => {
    expect(customSubjectCodeBase(' French conversation ')).toBe('CUSTOM-FRENCH-CONVER');
    expect(customSubjectCodeBase('Art & Design')).toBe('CUSTOM-ART-DESIGN');
    expect(customSubjectCodeBase('日本語')).toBe('CUSTOM-SUBJECT');
  });
});
