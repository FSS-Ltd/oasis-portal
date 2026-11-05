import { describe, expect, it } from 'vitest';
import { libraryLoanStatus } from '../library.js';

describe('library loan status', () => {
  it.each([
    ['2026-06-14', null, 'Overdue'],
    ['2026-06-15', null, 'Checked out'],
    ['2026-06-16', null, 'Checked out'],
    ['2026-06-14', new Date('2026-06-14T12:00:00Z'), 'Returned'],
  ] as const)('classifies due date %s with returned time %s as %s', (due, returned, expected) => {
    expect(libraryLoanStatus(new Date(`${due}T00:00:00Z`), returned, '2026-06-15')).toBe(expected);
  });
});
