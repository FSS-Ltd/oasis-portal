import { describe, expect, it } from 'vitest';
import {
  invoiceTotalPence,
  lineItemTotalPence,
  parseSchoolFeeInvoiceText,
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
    expect(schoolFeeInvoiceDisplayStatus('Paid', '2026-05-17', now)).toBe('Paid');
    expect(schoolFeeInvoiceDisplayStatus('Draft', '2026-05-17', now)).toBe('Draft');
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
