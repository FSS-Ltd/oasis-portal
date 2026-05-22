import { describe, expect, it } from 'vitest';
import {
  calculateSchoolFeeDiscounts,
  calculateSchoolFeeFamilyDiscounts,
  invoiceTotalPence,
  lineItemTotalPence,
  parseSchoolFeeInvoiceText,
  schoolFeeDiscountChildIndexPresetCode,
  schoolFeeInvoiceDisplayStatus,
} from '../invoice.js';

describe('school fee invoice totals', () => {
  it('calculates line and invoice totals in pence', () => {
    expect(
      lineItemTotalPence({
        description: 'PACE workbooks',
        quantity: 5,
        unitAmountPence: 750,
      }),
    ).toBe(3750);
    expect(
      invoiceTotalPence([
        { description: 'Tuition', quantity: 1, unitAmountPence: 42000 },
        { description: 'Lunch programme', quantity: 1, unitAmountPence: 6500 },
      ]),
    ).toBe(48500);
  });

  it('rejects empty invoices and invalid line amounts', () => {
    expect(() => invoiceTotalPence([])).toThrow(/line item/);
    expect(() =>
      lineItemTotalPence({ description: 'Tuition', quantity: 0, unitAmountPence: 42000 }),
    ).toThrow(/quantity/);
    expect(() =>
      lineItemTotalPence({ description: 'Tuition', quantity: 1, unitAmountPence: -1 }),
    ).toThrow(/unit amount/);
  });
});

describe('school fee invoice display status', () => {
  it('derives overdue only for unpaid invoices past their due date', () => {
    const now = new Date('2026-05-18T12:00:00.000Z');

    expect(schoolFeeInvoiceDisplayStatus('Unpaid', '2026-05-17', now)).toBe('Overdue');
    expect(schoolFeeInvoiceDisplayStatus('Unpaid', '2026-05-18', now)).toBe('Unpaid');
    expect(schoolFeeInvoiceDisplayStatus('PaymentPending', '2026-05-17', now)).toBe(
      'PaymentPending',
    );
    expect(schoolFeeInvoiceDisplayStatus('Paid', '2026-05-17', now)).toBe('Paid');
    expect(schoolFeeInvoiceDisplayStatus('Draft', '2026-05-17', now)).toBe('Draft');
  });
});

describe('school fee invoice discounts', () => {
  it('applies a single discount in full', () => {
    const result = calculateSchoolFeeDiscounts(98_000, [
      {
        label: 'Fountain Church Member',
        kind: 'Preset',
        percentBps: 1000,
        amountPence: null,
      },
    ]);

    expect(result.discountAmountPence).toBe(9_800);
    expect(result.totalAmountPence).toBe(88_200);
    expect(result.discounts[0]?.appliedAmountPence).toBe(9_800);
  });

  it('applies the largest discount in full and 25% of additional discounts', () => {
    const result = calculateSchoolFeeDiscounts(98_000, [
      { label: 'Sibling discount', kind: 'Preset', percentBps: 2500, amountPence: null },
      {
        label: 'Church Leaders / Oasis Supervisors',
        kind: 'Preset',
        percentBps: 2000,
        amountPence: null,
      },
      {
        label: 'Fountain Church Volunteers / Oasis Parent Volunteers / Tithers',
        kind: 'Preset',
        percentBps: 1500,
        amountPence: null,
      },
    ]);

    expect(result.discountAmountPence).toBe(33_075);
    expect(result.totalAmountPence).toBe(64_925);
    expect(result.discounts.map((discount) => discount.appliedAmountPence)).toEqual([
      24_500, 4_900, 3_675,
    ]);
  });

  it('combines manual percent and fixed discounts in the same calculation', () => {
    const result = calculateSchoolFeeDiscounts(98_000, [
      { label: 'Manual bursary', kind: 'ManualFixed', percentBps: null, amountPence: 12_000 },
      { label: 'Manual hardship', kind: 'ManualPercent', percentBps: 1000, amountPence: null },
    ]);

    expect(result.discountAmountPence).toBe(14_450);
    expect(result.totalAmountPence).toBe(83_550);
  });

  it('excludes parent opted-out discounts from totals', () => {
    const result = calculateSchoolFeeDiscounts(98_000, [
      {
        label: 'Sibling discount',
        kind: 'Preset',
        percentBps: 2500,
        amountPence: null,
        optedOut: true,
      },
      {
        label: 'Fountain Church Member',
        kind: 'Preset',
        percentBps: 1000,
        amountPence: null,
      },
    ]);

    expect(result.discountAmountPence).toBe(9_800);
    expect(result.totalAmountPence).toBe(88_200);
    expect(result.discounts.map((discount) => discount.appliedAmountPence)).toEqual([0, 9_800]);
  });

  it('caps discounts so totals cannot go below zero', () => {
    const result = calculateSchoolFeeDiscounts(10_000, [
      { label: 'Manual bursary', kind: 'ManualFixed', percentBps: null, amountPence: 20_000 },
      { label: 'Manual hardship', kind: 'ManualFixed', percentBps: null, amountPence: 20_000 },
    ]);

    expect(result.discountAmountPence).toBe(10_000);
    expect(result.totalAmountPence).toBe(0);
  });

  it('applies sibling discounts only to additional children', () => {
    const result = calculateSchoolFeeFamilyDiscounts({
      subtotalAmountPence: 49_000,
      studentCount: 2,
      childLineAmountsPence: [24_500, 24_500],
      discounts: [
        {
          label: 'Sibling discount',
          kind: 'Preset',
          presetCode: 'sibling',
          percentBps: 2500,
          amountPence: null,
        },
        {
          label: 'Church Leaders / Oasis Supervisors',
          kind: 'Preset',
          presetCode: 'church-leader',
          percentBps: 2000,
          amountPence: null,
        },
      ],
    });

    expect(result.discountAmountPence).toBe(12_250);
    expect(result.totalAmountPence).toBe(36_750);
    expect(result.discounts.map((discount) => discount.appliedAmountPence)).toEqual([6_125, 6_125]);
    expect(
      result.childBreakdowns.map((child) =>
        child.discounts.map((discount) => discount.appliedAmountPence),
      ),
    ).toEqual([
      [0, 4_900],
      [6_125, 1_225],
    ]);
  });

  it('applies child-scoped manual discounts only to the selected child', () => {
    const result = calculateSchoolFeeFamilyDiscounts({
      subtotalAmountPence: 49_000,
      studentCount: 2,
      childLineAmountsPence: [24_500, 24_500],
      discounts: [
        {
          label: 'Manual bursary',
          kind: 'ManualFixed',
          presetCode: schoolFeeDiscountChildIndexPresetCode(1),
          percentBps: null,
          amountPence: 5_000,
        },
        {
          label: 'Manual support',
          kind: 'ManualPercent',
          presetCode: schoolFeeDiscountChildIndexPresetCode(0),
          percentBps: 1000,
          amountPence: null,
        },
      ],
    });

    expect(result.discountAmountPence).toBe(7_450);
    expect(result.totalAmountPence).toBe(41_550);
    expect(
      result.childBreakdowns.map((child) =>
        child.discounts.map((discount) => discount.appliedAmountPence),
      ),
    ).toEqual([
      [0, 2_450],
      [5_000, 0],
    ]);
  });

  it('rejects sibling discounts for a single child', () => {
    expect(() =>
      calculateSchoolFeeFamilyDiscounts({
        subtotalAmountPence: 24_500,
        studentCount: 1,
        childLineAmountsPence: [24_500],
        discounts: [
          {
            label: 'Sibling discount',
            kind: 'Preset',
            presetCode: 'sibling',
            percentBps: 2500,
            amountPence: null,
          },
        ],
      }),
    ).toThrow(/sibling discount/);
  });
});

describe('parseSchoolFeeInvoiceText', () => {
  it('extracts common invoice metadata and selectable line items', () => {
    const parsed = parseSchoolFeeInvoiceText(`
      Invoice No: INV-2026-067
      Issued: 24 Apr 2026
      Due date: 15 May 2026
      Spring Term 2
      Spring Term 2 tuition Y9 £420.00
      PACE workbooks x5 £37.50
      Lunch programme half term £65.00
      Total £522.50
    `);

    expect(parsed).toMatchObject({
      invoiceNumber: 'INV-2026-067',
      issuedOn: '2026-04-24',
      dueOn: '2026-05-15',
      term: 'Spring Term 2',
      totalAmountPence: 52250,
    });
    expect(parsed.lineItems).toEqual([
      { description: 'Spring Term 2 tuition Y9', quantity: 1, unitAmountPence: 42000 },
      { description: 'PACE workbooks x5', quantity: 5, unitAmountPence: 750 },
      { description: 'Lunch programme half term', quantity: 1, unitAmountPence: 6500 },
    ]);
  });

  it('falls back to one total line when individual rows cannot be parsed', () => {
    const parsed = parseSchoolFeeInvoiceText(`
      INV-2026-099
      Balance due: £483.00
    `);

    expect(parsed.invoiceNumber).toBe('INV-2026-099');
    expect(parsed.lineItems).toEqual([
      { description: 'Imported invoice total', quantity: 1, unitAmountPence: 48300 },
    ]);
  });

  it('does not treat invoice headings as invoice numbers', () => {
    const parsed = parseSchoolFeeInvoiceText(`
      Oasis Learning Centre
      School Fee Invoice
      Invoice No: INV-2026-067
      Total 522.50
    `);

    expect(parsed.invoiceNumber).toBe('INV-2026-067');
  });
});
