import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  compileStudentReport,
  DEFAULT_REPORT_SECTIONS,
  paceProgressStatusForYear,
  resolveReportPeriod,
  type CompiledReport,
} from '@oasis/domain';
import { generateStudentReportPdf } from '../reports/student-report-pdf.js';

const now = new Date('2026-08-17T12:00:00.000Z');

describe('generateStudentReportPdf', () => {
  it('renders selected sections, statuses, progress comment, and ungrouped PACE ids', async () => {
    const generated = await generateStudentReportPdf({ report: fullReport(), generatedAt: now });
    const text = await extractPdfText(generated.bytes);

    expect(Buffer.from(generated.bytes).subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(generated.fileName).toBe('Jane-Learner-2025-26-Academic-Year-report.pdf');
    expect(generated.mimeType).toBe('application/pdf');
    expect(text).toContain('Student Progress Report');
    expect(text).toContain('PACE Progress');
    expect(text).toContain('1025');
    expect(text).not.toContain('1,025');
    expect(text).toContain('On Track');
    expect(text).toContain('Progress Comment');
    expect(text).toContain('Jane is making steady progress.');
  });

  it('omits hidden sections and creates numbered continuation pages', async () => {
    const generated = await generateStudentReportPdf({ report: longReport(), generatedAt: now });
    const pdf = await PDFDocument.load(generated.bytes);
    const text = await extractPdfText(generated.bytes);
    const samplePath = process.env['REPORT_PDF_SAMPLE_PATH'];
    if (samplePath) {
      mkdirSync(dirname(samplePath), { recursive: true });
      writeFileSync(samplePath, generated.bytes);
    }

    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(text).not.toContain('Behaviour Notes');
    expect(text).toContain(`Page 1 of ${String(pdf.getPageCount())}`);
    expect(text).toContain(
      `Page ${String(pdf.getPageCount())} of ${String(pdf.getPageCount())}`,
    );
  });

  it('generates safely when user-entered text contains unsupported standard-font glyphs', async () => {
    const report = fullReport();
    report.studentDisplayName = 'Ade 😊 学生';
    report.headSummary = 'Consistent effort 😊 across every subject.';
    const firstNote = report.notes[0];
    if (!firstNote) throw new Error('expected a report note fixture');
    report.notes = [{
      ...firstNote,
      note: 'Family note: 学生 is progressing well.',
    }];

    const generated = await generateStudentReportPdf({ report, generatedAt: now });
    const text = await extractPdfText(generated.bytes);

    expect(Buffer.from(generated.bytes).subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(text).toContain('Consistent effort');
    expect(text).toContain('is progressing well.');
  });

  it('keeps a section heading with its first content row', async () => {
    const report = fullReport();
    report.sections = {
      attendance: true,
      paceProgress: true,
      paceStatus: true,
      behaviourSummary: false,
      behaviourNotes: false,
      generalNotes: false,
      meritActivity: false,
      balances: false,
      progressComment: true,
    };
    const firstPace = report.paces[0];
    if (!firstPace) throw new Error('expected a PACE fixture');
    report.paces = Array.from({ length: 15 }, (_, index) => ({
      ...firstPace,
      subjectCode: `SUB${String(index + 1)}`,
      subjectName: `Subject ${String(index + 1)}`,
    }));
    report.headSummary = 'The first progress-comment line stays with its heading.';

    const generated = await generateStudentReportPdf({ report, generatedAt: now });
    const pages = await extractPdfPageTexts(generated.bytes);
    const headingPage = pages.findIndex((page) => page.includes('Progress Comment'));

    expect(headingPage).toBeGreaterThanOrEqual(0);
    expect(pages[headingPage]).toContain('The first progress-comment line');
  });

  it('does not create a continuation page solely for a trailing note separator', async () => {
    const report = fullReport();
    report.sections = {
      attendance: false,
      paceProgress: false,
      paceStatus: false,
      behaviourSummary: false,
      behaviourNotes: false,
      generalNotes: true,
      meritActivity: false,
      balances: false,
      progressComment: false,
    };
    report.notes = [
      {
        id: 'note_boundary',
        origin: 'Report',
        createdAt: '2026-06-02T12:00:00.000Z',
        note: Array.from({ length: 37 }, (_, index) => `Line ${String(index + 1)}`).join('\n'),
      },
    ];

    const generated = await generateStudentReportPdf({ report, generatedAt: now });
    const pdf = await PDFDocument.load(generated.bytes);

    expect(pdf.getPageCount()).toBe(1);
  });

  it('keeps the Merit Activity heading and header with a tall first row', async () => {
    const report = fullReport();
    report.sections = {
      attendance: true,
      paceProgress: true,
      paceStatus: true,
      behaviourSummary: false,
      behaviourNotes: false,
      generalNotes: false,
      meritActivity: true,
      balances: false,
      progressComment: false,
    };
    const firstPace = report.paces[0];
    if (!firstPace) throw new Error('expected a PACE fixture');
    report.paces = Array.from({ length: 12 }, (_, index) => ({
      ...firstPace,
      subjectCode: `SUB${String(index + 1)}`,
      subjectName: `Subject ${String(index + 1)}`,
    }));
    report.meritActivity = [
      {
        account: 'Spend',
        createdAt: '2026-06-03T12:00:00.000Z',
        delta: 35,
        reason: `Boundary merit reason ${'with substantial wrapped detail '.repeat(14)}`,
      },
    ];

    const generated = await generateStudentReportPdf({ report, generatedAt: now });
    const pages = await extractPdfPageTexts(generated.bytes);
    const headingPage = pages.findIndex((page) => page.includes('Merit Activity'));

    expect(headingPage).toBeGreaterThanOrEqual(0);
    expect(pages[headingPage]).toContain('Boundary merit reason');
  });
});

function fullReport(): CompiledReport {
  return compileStudentReport({
    studentId: 'student_1',
    studentDisplayName: 'Jane Learner',
    period: resolveReportPeriod({ type: 'AcademicYear', startYear: 2025 }).snapshot,
    sections: DEFAULT_REPORT_SECTIONS,
    attendance: { total: 100, present: 94, absent: 4, late: 2 },
    paces: [
      {
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        currentPace: 1025,
        pacesCompletedThisTerm: 8,
        averageTestScore: 91,
        status: paceProgressStatusForYear(1025, 'Year 3'),
      },
    ],
    behaviour: {
      meritsEarned: 35,
      demeritsCount: 1,
      demeritsMerits: 5,
      generalEntries: [
        {
          id: 'behaviour_1',
          origin: 'Source',
          createdAt: new Date('2026-06-01T12:00:00.000Z'),
          category: 'Character',
          note: 'Shows initiative and helps other learners.',
        },
      ],
    },
    notes: [
      {
        id: 'note_1',
        origin: 'Source',
        createdAt: new Date('2026-06-02T12:00:00.000Z'),
        note: 'Reading confidence has improved.',
      },
    ],
    ledgerRows: [
      {
        account: 'Spend',
        delta: 35,
        reason: 'Merit: Academic Excellence',
        createdAt: new Date('2026-06-03T12:00:00.000Z'),
      },
    ],
    headSummary: 'Jane is making steady progress.',
  });
}

function longReport(): CompiledReport {
  const report = fullReport();
  return {
    ...report,
    sections: { ...report.sections, behaviourNotes: false },
    behaviour: { ...report.behaviour, generalEntries: [] },
    notes: Array.from({ length: 60 }, (_, index) => ({
      id: `long_note_${String(index)}`,
      origin: 'Report' as const,
      createdAt: new Date(Date.UTC(2026, 5, (index % 28) + 1)).toISOString(),
      note: `Progress note ${String(index + 1)} with enough detail to verify wrapped multi-page layout.`,
    })),
  };
}

interface PdfTextItem {
  str: string;
}

interface PdfTextContent {
  items: PdfTextItem[];
}

interface PdfPageProxy {
  getTextContent: () => Promise<PdfTextContent>;
}

interface PdfDocumentProxy {
  destroy: () => Promise<void> | void;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  numPages: number;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocumentProxy>;
}

interface PdfJsModule {
  getDocument: (input: {
    data: Uint8Array;
    disableFontFace: boolean;
    isEvalSupported: boolean;
    useSystemFonts: boolean;
  }) => PdfLoadingTask;
}

function ensurePdfDomFallbacks(): void {
  if (!('DOMMatrix' in globalThis)) {
    class TestDOMMatrix {
      inverse(): this {
        return this;
      }
      multiply(): this {
        return this;
      }
      multiplySelf(): this {
        return this;
      }
      preMultiplySelf(): this {
        return this;
      }
      scale(): this {
        return this;
      }
      scaleSelf(): this {
        return this;
      }
      translate(): this {
        return this;
      }
      translateSelf(): this {
        return this;
      }
    }
    Object.defineProperty(globalThis, 'DOMMatrix', { configurable: true, value: TestDOMMatrix });
  }

  if (!('ImageData' in globalThis)) {
    class TestImageData {
      colorSpace: PredefinedColorSpace = 'srgb';
      data: Uint8ClampedArray;
      height: number;
      width: number;

      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    Object.defineProperty(globalThis, 'ImageData', { configurable: true, value: TestImageData });
  }

  if (!('Path2D' in globalThis)) {
    class TestPath2D {
      addPath(): void {}
    }
    Object.defineProperty(globalThis, 'Path2D', { configurable: true, value: TestPath2D });
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  return (await extractPdfPageTexts(bytes)).join('\n');
}

async function extractPdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  ensurePdfDomFallbacks();
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  const pdf = await pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}
