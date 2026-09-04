import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { TimetablePublicationView } from '../routers/timetable.js';
import { generateTimetablePdf } from '../reports/timetable-pdf.js';

const publication: TimetablePublicationView = {
  id: 'publication_1',
  studentId: 'student_1',
  studentFirstName: 'Taleyah',
  termKey: '2026-27-term-1',
  termLabel: 'Term 1',
  termStartsOn: new Date('2026-09-08T00:00:00.000Z'),
  termEndsOn: new Date('2026-10-16T00:00:00.000Z'),
  registrationLevel: 'Primary',
  publishedAt: new Date('2026-09-04T20:00:00.000Z'),
  entries: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'].flatMap((day) => [
    {
      day: day as 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday',
      slotPosition: 0,
      slotKind: 'Lesson' as const,
      slotLabel: 'Lesson 1',
      startMinutes: 540,
      endMinutes: 570,
      subjectId: 'subject_math',
      subjectName: day === 'Tuesday' ? 'Mathematics' : 'Literature & Creative Writing',
      subjectColour: day === 'Tuesday' ? ('Yellow' as const) : ('PaleRed' as const),
    },
    {
      day: day as 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday',
      slotPosition: 1,
      slotKind: 'Break' as const,
      slotLabel: 'Break',
      startMinutes: 570,
      endMinutes: 600,
      subjectId: null,
      subjectName: null,
      subjectColour: null,
    },
  ]),
};

describe('generateTimetablePdf', () => {
  it('creates a one-page A4 landscape timetable with child, term, subjects, and vertical break text', async () => {
    const generated = await generateTimetablePdf(publication);
    const document = await PDFDocument.load(generated.bytes);
    const [page] = document.getPages();
    const text = await extractPdfText(generated.bytes);

    expect(Buffer.from(generated.bytes).subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(generated.fileName).toBe('Taleyah-Term-1-timetable.pdf');
    expect(generated.mimeType).toBe('application/pdf');
    expect(document.getPageCount()).toBe(1);
    expect(page?.getWidth()).toBeGreaterThan(page?.getHeight() ?? 0);
    expect(text).toContain('OASIS LEARNING CENTRE TIMETABLE');
    expect(text).toContain('TALEYAH');
    expect(text).toContain('Term 1');
    expect(text).toContain('8 Sept 2026');
    expect(text).toContain('16 Oct 2026');
    expect(text).toContain('TUESDAY');
    expect(text).toContain('MATHEMATICS');
    expect(text).toContain('B. R. E. A. K.');
    expect(text.match(/B\. R\. E\. A\. K\./g)).toHaveLength(1);
  });
});

interface PdfTextItem {
  str: string;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  installPdfDomFallbacks();
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    getDocument(input: {
      data: Uint8Array;
      disableFontFace: boolean;
      isEvalSupported: boolean;
      useSystemFonts: boolean;
    }): {
      promise: Promise<{
        destroy(): Promise<void> | void;
        getPage(pageNumber: number): Promise<{
          getTextContent(): Promise<{ items: PdfTextItem[] }>;
        }>;
        numPages: number;
      }>;
    };
  };
  const pdf = await pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages.join('\n');
  } finally {
    await pdf.destroy();
  }
}

function installPdfDomFallbacks(): void {
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
      readonly data = new Uint8ClampedArray(0);
      readonly height = 0;
      readonly width = 0;
    }
    Object.defineProperty(globalThis, 'ImageData', {
      configurable: true,
      value: TestImageData,
    });
  }
  if (!('Path2D' in globalThis)) {
    Object.defineProperty(globalThis, 'Path2D', {
      configurable: true,
      value: class TestPath2D {
        addPath(): void {}
      },
    });
  }
}
