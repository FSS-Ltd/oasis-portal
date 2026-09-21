import { describe, expect, it } from 'vitest';
import { libraryBarcodeSchema, libraryLondonDateKey, libraryReminderStageFor } from '../library.js';

describe('library barcode validation', () => {
  it('trims a barcode without losing leading zeroes', () => {
    expect(libraryBarcodeSchema.parse(' 001234567890 ')).toBe('001234567890');
  });

  it('rejects non-numeric and oversized barcodes', () => {
    expect(() => libraryBarcodeSchema.parse('ABC-123')).toThrow();
    expect(() => libraryBarcodeSchema.parse('1'.repeat(65))).toThrow();
  });
});

describe('library reminders', () => {
  it('uses Europe/London calendar dates at DST boundaries', () => {
    const asOf = new Date('2026-03-29T22:30:00.000Z');
    expect(libraryLondonDateKey(asOf)).toBe('2026-03-29');
    expect(libraryReminderStageFor(new Date('2026-03-31T00:00:00.000Z'), asOf)).toBe(
      'DueInTwoDays',
    );
  });

  it('selects the due and one-day overdue stages only', () => {
    const dueOn = new Date('2026-10-26T00:00:00.000Z');
    expect(libraryReminderStageFor(dueOn, new Date('2026-10-26T12:00:00.000Z'))).toBe('DueToday');
    expect(libraryReminderStageFor(dueOn, new Date('2026-10-27T12:00:00.000Z'))).toBe(
      'OverdueOneDay',
    );
    expect(libraryReminderStageFor(dueOn, new Date('2026-10-28T12:00:00.000Z'))).toBeNull();
  });
});
