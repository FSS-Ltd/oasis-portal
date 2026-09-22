import { describe, expect, it } from 'vitest';
import {
  libraryBarcodeSchema,
  libraryBookDraftSchema,
  libraryLondonDateKey,
  libraryReminderStageFor,
} from '../library.js';

describe('library barcode validation', () => {
  it('trims a barcode without losing leading zeroes', () => {
    expect(libraryBarcodeSchema.parse(' 001234567890 ')).toBe('001234567890');
  });

  it('rejects non-numeric and oversized barcodes', () => {
    expect(() => libraryBarcodeSchema.parse('ABC-123')).toThrow();
    expect(() => libraryBarcodeSchema.parse('1'.repeat(65))).toThrow();
  });
});

describe('library book quantities', () => {
  const cover = {
    fileName: 'cover.png',
    mimeType: 'image/png' as const,
    sizeBytes: 1,
    storageBucket: 'shop-item-photos',
    storagePath: 'library-books/user/cover.png',
  };

  it('accepts one or more copies', () => {
    expect(
      libraryBookDraftSchema.parse({
        author: 'Author',
        barcode: '123',
        cover,
        quantity: 3,
        title: 'Title',
      }).quantity,
    ).toBe(3);
  });

  it('defaults to one copy', () => {
    expect(
      libraryBookDraftSchema.parse({
        author: 'Author',
        barcode: '123',
        cover,
        title: 'Title',
      }).quantity,
    ).toBe(1);
  });

  it('rejects zero or fractional copy counts', () => {
    const draft = { author: 'Author', barcode: '123', cover, title: 'Title' };

    expect(() => libraryBookDraftSchema.parse({ ...draft, quantity: 0 })).toThrow();
    expect(() => libraryBookDraftSchema.parse({ ...draft, quantity: 1.5 })).toThrow();
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
