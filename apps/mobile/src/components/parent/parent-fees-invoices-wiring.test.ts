import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(import.meta.dirname, '../../..');

function readMobile(relativePath: string): string {
  return readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('parent fees and invoices mobile wiring', () => {
  it('adds focused production parent fees invoice files', () => {
    for (const file of [
      'parent-fees-invoices-screen.tsx',
      'parent-fees-invoices-detail.tsx',
      'parent-fees-invoices-list.tsx',
      'parent-fees-invoices-utils.ts',
    ]) {
      expect(existsSync(path.join(mobileRoot, 'src/components/parent', file))).toBe(true);
    }
  });

  it('wires the parent portal fees route to the production screen', () => {
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(portal).toMatch(/ParentFeesInvoicesScreen/);
    expect(portal).toMatch(/'fees'/);
    expect(portal).toMatch(/route === 'fees'/);
    expect(portal).toMatch(/api\.invoice\.listParent\.useQuery/);
    expect(portal).toMatch(/parentInvoices\.refetch/);
    expect(portal).toMatch(/label: 'Fees'/);
    expect(portal).toMatch(/icon: 'fees'/);
  });

  it('uses parent-safe invoice APIs and excludes staff finance administration', () => {
    const screen = readMobile('src/components/parent/parent-fees-invoices-screen.tsx');
    const detail = readMobile('src/components/parent/parent-fees-invoices-detail.tsx');
    const portal = readMobile('src/components/parent/parent-portal-screen.tsx');

    expect(detail).toMatch(/api\.invoice\.parentMarkPaid\.useMutation/);
    expect(detail).toMatch(/api\.invoice\.downloadPdf\.useQuery/);
    expect(detail).toMatch(/utils\.invoice\.listParent\.invalidate/);

    for (const source of [screen, detail, portal]) {
      expect(source).not.toMatch(/invoice\.listAdmin/);
      expect(source).not.toMatch(/invoice\.uploadDraft/);
      expect(source).not.toMatch(/invoice\.publishDraft/);
      expect(source).not.toMatch(/invoice\.createGenerated/);
      expect(source).not.toMatch(/invoice\.updateGenerated/);
      expect(source).not.toMatch(/invoice\.markPaid/);
      expect(source).not.toMatch(/invoice\.confirmPayment/);
      expect(source).not.toMatch(/invoice\.rejectPayment/);
      expect(source).not.toMatch(/invoice\.delete/);
      expect(source).not.toMatch(/invoice\.listBillableFamilies/);
      expect(source).not.toMatch(/invoice\.studentFinanceSummary/);
      expect(source).not.toMatch(/setDiscountOptOut/);
    }
  });

  it('keeps balance, invoice detail, payment, discount, and download states visible', () => {
    const source = [
      'src/components/parent/parent-fees-invoices-screen.tsx',
      'src/components/parent/parent-fees-invoices-detail.tsx',
      'src/components/parent/parent-fees-invoices-list.tsx',
      'src/components/parent/parent-fees-invoices-utils.ts',
    ]
      .map(readMobile)
      .join('\n');

    for (const text of [
      'Fees/Invoices',
      'Current Balance',
      'Fee cycle',
      'Outstanding',
      'Overdue',
      'Awaiting confirmation',
      'Paid',
      'Unpaid',
      'Discounts',
      'Line items',
      'Payment instructions',
      'Download PDF',
      'Preparing PDF',
      'PDF unavailable',
      'Payment required',
      'Mark as paid',
      'Payment sent for confirmation.',
      'Payment could not be marked paid.',
      'Loading fees',
      'Fees unavailable',
      'No invoices match this view.',
      'No linked invoice balance',
    ]) {
      expect(source).toContain(text);
    }
  });
});
