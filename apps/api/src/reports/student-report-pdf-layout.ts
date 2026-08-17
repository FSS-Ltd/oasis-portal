import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import type { GenerateStudentReportPdfInput } from './student-report-pdf.js';

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 42;
export const CONTENT_BOTTOM = 68;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
export const NAVY = rgb(0.106, 0.169, 0.369);
export const CRIMSON = rgb(0.49, 0.11, 0.173);
export const BLUE_GREY = rgb(0.353, 0.416, 0.541);
export const MUTED = rgb(0.533, 0.6, 0.733);
export const BORDER = rgb(0.867, 0.89, 0.941);
export const PALE_BLUE = rgb(0.961, 0.973, 1);
export const PALE_GREEN = rgb(0.91, 0.969, 0.937);
export const PALE_AMBER = rgb(1, 0.961, 0.855);
export const WHITE = rgb(1, 1, 1);

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export interface PdfContext {
  document: PDFDocument;
  fonts: PdfFonts;
  input: GenerateStudentReportPdfInput;
  logo: PDFImage | null;
  page: PDFPage;
  y: number;
}

interface WrappedTextOptions {
  color?: RGB;
  font?: PDFFont;
  lineHeight?: number;
  maxWidth?: number;
  size?: number;
  x?: number;
}

export function createPage(
  document: PDFDocument,
  fonts: PdfFonts,
  logo: PDFImage | null,
  input: GenerateStudentReportPdfInput,
  continuation: boolean,
): PDFPage {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  page.drawRectangle({
    x: PAGE_WIDTH - 164,
    y: PAGE_HEIGHT - 8,
    width: 164,
    height: 8,
    color: CRIMSON,
  });

  if (logo) {
    const dimensions = logo.scale(0.15);
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - 91,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  const textX = logo ? MARGIN + 68 : MARGIN;
  drawText(page, 'OASIS LEARNING CENTRE', textX, PAGE_HEIGHT - 44, 13, fonts.bold, NAVY);
  drawText(page, 'Student Progress Report', textX, PAGE_HEIGHT - 62, 9, fonts.bold, CRIMSON);
  drawRightText(
    page,
    input.report.period.label,
    PAGE_WIDTH - MARGIN,
    PAGE_HEIGHT - 44,
    10,
    fonts.bold,
    CRIMSON,
  );
  drawRightText(
    page,
    `${formatDateKey(input.report.period.from)} - ${formatDateKey(input.report.period.to)}`,
    PAGE_WIDTH - MARGIN,
    PAGE_HEIGHT - 61,
    8.5,
    fonts.regular,
    BLUE_GREY,
  );

  if (continuation) {
    drawText(page, input.report.studentDisplayName, MARGIN, PAGE_HEIGHT - 110, 17, fonts.bold, NAVY);
    drawRightText(
      page,
      'Continued',
      PAGE_WIDTH - MARGIN,
      PAGE_HEIGHT - 108,
      9,
      fonts.bold,
      MUTED,
    );
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - 126 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 126 },
      color: BORDER,
      thickness: 1,
    });
    return page;
  }

  page.drawRectangle({
    x: MARGIN,
    y: 676,
    width: CONTENT_WIDTH,
    height: 72,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  drawText(page, 'STUDENT', MARGIN + 14, 723, 7.5, fonts.bold, MUTED);
  drawText(
    page,
    trimToWidth(input.report.studentDisplayName, fonts.bold, 18, 270),
    MARGIN + 14,
    697,
    18,
    fonts.bold,
    NAVY,
  );
  drawText(page, 'REPORT PERIOD', 356, 723, 7.5, fonts.bold, MUTED);
  drawText(
    page,
    trimToWidth(input.report.period.label, fonts.bold, 11, 183),
    356,
    703,
    11,
    fonts.bold,
    NAVY,
  );
  drawText(
    page,
    `Generated ${formatDate(input.generatedAt)}`,
    356,
    686,
    8,
    fonts.regular,
    BLUE_GREY,
  );
  return page;
}

export function ensureSpace(context: PdfContext, requiredHeight: number): void {
  if (context.y - requiredHeight >= CONTENT_BOTTOM) return;
  context.page = createPage(
    context.document,
    context.fonts,
    context.logo,
    context.input,
    true,
  );
  context.y = 690;
}

export function drawSectionHeading(context: PdfContext, title: string): void {
  ensureSpace(context, 42);
  drawText(context.page, title, MARGIN, context.y, 15, context.fonts.bold, NAVY);
  context.y -= 9;
  context.page.drawLine({
    start: { x: MARGIN, y: context.y },
    end: { x: PAGE_WIDTH - MARGIN, y: context.y },
    color: BORDER,
    thickness: 1,
  });
  context.y -= 20;
}

export function drawWrappedText(
  context: PdfContext,
  value: string,
  options: WrappedTextOptions = {},
): void {
  const font = options.font ?? context.fonts.regular;
  const size = options.size ?? 9;
  const lineHeight = options.lineHeight ?? 14;
  const x = options.x ?? MARGIN;
  const maxWidth = options.maxWidth ?? PAGE_WIDTH - MARGIN - x;
  const color = options.color ?? BLUE_GREY;
  for (const line of wrapText(value, font, size, maxWidth)) {
    ensureSpace(context, lineHeight);
    if (line) drawText(context.page, line, x, context.y, size, font, color);
    context.y -= lineHeight;
  }
}

export function drawEmptyState(context: PdfContext, label: string): void {
  ensureSpace(context, 32);
  context.page.drawRectangle({
    x: MARGIN,
    y: context.y - 24,
    width: CONTENT_WIDTH,
    height: 28,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 0.5,
  });
  drawText(context.page, label, MARGIN + 10, context.y - 14, 8.5, context.fonts.regular, BLUE_GREY);
  context.y -= 48;
}

export function drawAllFooters(document: PDFDocument, fonts: PdfFonts): void {
  const pages = document.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: 50 },
      end: { x: PAGE_WIDTH - MARGIN, y: 50 },
      color: BORDER,
      thickness: 0.8,
    });
    drawText(
      page,
      'Confidential student progress report',
      MARGIN,
      31,
      8,
      fonts.regular,
      BLUE_GREY,
    );
    drawRightText(
      page,
      `Page ${String(index + 1)} of ${String(pages.length)}`,
      PAGE_WIDTH - MARGIN,
      31,
      8,
      fonts.regular,
      BLUE_GREY,
    );
  });
}

export function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/u)) {
    const words = paragraph.split(/\s+/u).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const rawWord of words) {
      for (const word of splitWord(rawWord, font, size, maxWidth)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function drawText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB,
): void {
  page.drawText(value, { x, y, size, font, color });
}

export function drawRightText(
  page: PDFPage,
  value: string,
  right: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB,
): void {
  drawText(page, value, right - font.widthOfTextAtSize(value, size), y, size, font, color);
}

export function drawCentredText(
  page: PDFPage,
  value: string,
  x: number,
  width: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB,
): void {
  const textWidth = font.widthOfTextAtSize(value, size);
  drawText(page, value, x + (width - textWidth) / 2, y, size, font, color);
}

export function trimToWidth(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}...`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

export function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9._-]/gu, '-')
      .replace(/-+/gu, '-')
      .replace(/^-|-$/gu, '') || 'student'
  );
}

export function loadLogoBytes(): Uint8Array | null {
  const candidates = [
    join(process.cwd(), 'apps/web/public/oasis-logo-email.png'),
    join(process.cwd(), 'public/oasis-logo-email.png'),
    join(process.cwd(), '../../apps/web/public/oasis-logo-email.png'),
    join(process.cwd(), 'design/oasis-logo.png'),
    join(process.cwd(), '../../design/oasis-logo.png'),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  return logoPath ? readFileSync(logoPath) : null;
}

function splitWord(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return [value];
  const segments: string[] = [];
  let segment = '';
  for (const character of value) {
    const next = `${segment}${character}`;
    if (segment && font.widthOfTextAtSize(next, size) > maxWidth) {
      segments.push(segment);
      segment = character;
    } else {
      segment = next;
    }
  }
  if (segment) segments.push(segment);
  return segments;
}

function formatDateKey(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return formatDate(new Date(Date.UTC(year, month - 1, day)));
}
