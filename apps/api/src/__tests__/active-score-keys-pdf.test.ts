import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { ActiveScoreKeyReport } from '@oasis/domain';
import { generateActiveScoreKeysPdf } from '../reports/active-score-keys-pdf.js';

describe('generateActiveScoreKeysPdf', () => {
  it('renders a branded, paginated A4 report with all rows and repeated headings', async () => {
    const report: ActiveScoreKeyReport = {
      generatedAt: new Date('2026-09-30T13:30:00.000Z'),
      activeKeyCount: 40,
      subjectCount: 2,
      rows: Array.from({ length: 40 }, (_, index) => ({
        subjectId: index % 2 === 0 ? 'math' : 'english',
        subjectCode: index % 2 === 0 ? 'MATH' : 'ENG',
        subjectName: index % 2 === 0 ? 'Mathematics' : 'English and Literature',
        paceNumber: 1001 + index,
        childCount: index + 1,
      })),
    };

    const result = await generateActiveScoreKeysPdf(report);
    const document = await PDFDocument.load(result.bytes);
    const pages = document.getPages();

    expect(Buffer.from(result.bytes).subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileName).toMatch(/^oasis-active-score-keys-20260930T133000Z\.pdf$/u);
    expect(document.getTitle()).toBe('Oasis Active Score Keys');
    expect(document.getAuthor()).toBe('Oasis Learning Centre');
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages[0]?.getWidth()).toBeCloseTo(595.28, 1);
    expect(pages[0]?.getHeight()).toBeCloseTo(841.89, 1);
    expect(result.bytes.byteLength).toBeGreaterThan(20_000);
  });

  it('renders an empty report with zero totals and the empty state', async () => {
    const report: ActiveScoreKeyReport = {
      generatedAt: new Date('2026-09-30T13:30:00.000Z'),
      activeKeyCount: 0,
      subjectCount: 0,
      rows: [],
    };
    const result = await generateActiveScoreKeysPdf(report);
    const document = await PDFDocument.load(result.bytes);

    expect(document.getPageCount()).toBe(1);
    expect(result.bytes.byteLength).toBeGreaterThan(10_000);
  });

  it('wraps unbroken subject names and rejects a row taller than a page', async () => {
    const row = {
      subjectId: 'mathematics',
      subjectCode: 'MATH',
      subjectName: 'Mathematics'.repeat(18),
      paceNumber: 1029,
      childCount: 4,
    };
    const report: ActiveScoreKeyReport = {
      generatedAt: new Date('2026-09-30T13:30:00.000Z'),
      activeKeyCount: 1,
      subjectCount: 1,
      rows: [row],
    };

    const result = await generateActiveScoreKeysPdf(report);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
    await expect(
      generateActiveScoreKeysPdf({
        ...report,
        rows: [{ ...row, subjectName: 'M'.repeat(3000) }],
      }),
    ).rejects.toThrow('A subject name is too long to fit on a score-key report page.');
  });
});
