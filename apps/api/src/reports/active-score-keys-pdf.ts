import { Buffer } from 'node:buffer';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import {
  ACTIVE_SCORE_KEY_SCOPE_LABELS,
  type ActiveScoreKeyReport,
  type ActiveScoreKeyRow,
} from '@oasis/domain';
import { drawText, loadLogoBytes, safeFileName } from './student-report-pdf-layout.js';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const NAVY = rgb(0.106, 0.169, 0.369);
const CRIMSON = rgb(0.49, 0.11, 0.173);
const TEXT = rgb(0.09, 0.12, 0.18);
const MUTED = rgb(0.35, 0.4, 0.49);
const BORDER = rgb(0.84, 0.87, 0.92);
const ALTERNATE = rgb(0.96, 0.97, 0.99);
const COLUMNS = [231.28, 90, 90, 100] as const;
const ROW_FONT_SIZE = 10;
const LINE_HEIGHT = 13;
const ROW_PADDING = 10;
const TABLE_TOP = 626;
const TABLE_BOTTOM = 64;
const MAX_ROW_HEIGHT = TABLE_TOP - TABLE_BOTTOM - 27;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

export interface GeneratedActiveScoreKeysPdf {
  bytes: Uint8Array;
  fileName: string;
  mimeType: 'application/pdf';
}

export async function generateActiveScoreKeysPdf(
  report: ActiveScoreKeyReport,
): Promise<GeneratedActiveScoreKeysPdf> {
  const logoBytes = loadLogoBytes();
  if (!logoBytes) throw new Error('Oasis report logo could not be loaded.');

  const document = await PDFDocument.create();
  document.setTitle('Oasis Active Score Keys');
  document.setAuthor('Oasis Learning Centre');
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await document.embedPng(Buffer.from(logoBytes));
  const rows = report.rows.map((row) => prepareRow(row, fonts));
  if (rows.some((row) => row.height > MAX_ROW_HEIGHT)) {
    throw new Error('A subject name is too long to fit on a score-key report page.');
  }
  const pages: PDFPage[] = [];
  let page = addPage(document, pages, fonts, logo, report, true);
  let y = TABLE_TOP;
  y = drawColumnHeaders(page, fonts, y);

  if (rows.length === 0) {
    if (y - 52 < TABLE_BOTTOM) {
      page = addPage(document, pages, fonts, logo, report, false);
      y = drawColumnHeaders(page, fonts, TABLE_TOP);
    }
    drawText(
      page,
      'No active score keys are currently needed.',
      MARGIN + 10,
      y - 32,
      11,
      fonts.regular,
      MUTED,
    );
  } else {
    rows.forEach((row, index) => {
      if (y - row.height < TABLE_BOTTOM) {
        page = addPage(document, pages, fonts, logo, report, false);
        y = drawColumnHeaders(page, fonts, TABLE_TOP);
      }
      y = drawRow(page, fonts, row, y, index % 2 === 1);
    });
  }

  pages.forEach((item, index) => {
    const label = `Page ${String(index + 1)} of ${String(pages.length)}`;
    const width = fonts.regular.widthOfTextAtSize(label, 8);
    drawText(item, label, PAGE_WIDTH - MARGIN - width, 34, 8, fonts.regular, MUTED);
  });

  const stamp = report.generatedAt
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'Z');
  return {
    bytes: await document.save(),
    fileName: `oasis-active-score-keys-${safeFileName(stamp)}.pdf`,
    mimeType: 'application/pdf',
  };
}

interface PreparedRow {
  cells: readonly string[];
  subjectLines: string[];
  height: number;
}

function prepareRow(row: ActiveScoreKeyRow, fonts: Fonts): PreparedRow {
  const subjectLines = wrapText(row.subjectName, fonts.regular, ROW_FONT_SIZE, COLUMNS[0] - 16);
  return {
    cells: [
      row.subjectName,
      String(row.paceNumber),
      String(row.paceNumber),
      String(row.childCount),
    ],
    subjectLines,
    height: Math.max(subjectLines.length * LINE_HEIGHT + ROW_PADDING, 31),
  };
}

function addPage(
  document: PDFDocument,
  pages: PDFPage[],
  fonts: Fonts,
  logo: PDFImage,
  report: ActiveScoreKeyReport,
  firstPage: boolean,
): PDFPage {
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  page.drawRectangle({
    x: PAGE_WIDTH - 164,
    y: PAGE_HEIGHT - 8,
    width: 164,
    height: 8,
    color: CRIMSON,
  });
  const scale = Math.min(60 / logo.width, 48 / logo.height);
  const logoWidth = logo.width * scale;
  const logoHeight = logo.height * scale;
  page.drawImage(logo, {
    x: MARGIN,
    y: PAGE_HEIGHT - 60 - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });
  const title = firstPage ? 'Active Score Keys' : 'Active Score Keys · continued';
  drawText(page, 'OASIS LEARNING CENTRE', MARGIN + 72, PAGE_HEIGHT - 31, 9, fonts.bold, NAVY);
  drawText(page, title, MARGIN + 72, PAGE_HEIGHT - 54, firstPage ? 18 : 14, fonts.bold, CRIMSON);
  drawText(
    page,
    `${ACTIVE_SCORE_KEY_SCOPE_LABELS[report.scope]} · As of ${formatLondonDateTime(report.generatedAt)}`,
    MARGIN + 72,
    PAGE_HEIGHT - 73,
    8,
    fonts.regular,
    MUTED,
  );

  if (firstPage) {
    drawSummaryCard(page, fonts, 'ACTIVE SCORE KEYS', String(report.activeKeyCount), MARGIN, 684);
    drawSummaryCard(page, fonts, 'SUBJECTS', String(report.subjectCount), MARGIN + 261, 684);
  }
  return page;
}

function drawSummaryCard(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string,
  x: number,
  top: number,
): void {
  page.drawRectangle({
    x,
    y: top - 52,
    width: 250,
    height: 52,
    color: ALTERNATE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  drawText(page, label, x + 10, top - 16, 7.5, fonts.bold, MUTED);
  drawText(page, value, x + 10, top - 39, 15, fonts.bold, NAVY);
}

function drawColumnHeaders(page: PDFPage, fonts: Fonts, top: number): number {
  const height = 27;
  page.drawRectangle({ x: MARGIN, y: top - height, width: CONTENT_WIDTH, height, color: NAVY });
  let x = MARGIN;
  ['Subject', 'Current PACE', 'Score Key', 'Children'].forEach((heading, index) => {
    drawText(page, heading, x + 8, top - 18, 9, fonts.bold, rgb(1, 1, 1));
    x += COLUMNS[index] ?? 0;
  });
  return top - height;
}

function drawRow(
  page: PDFPage,
  fonts: Fonts,
  row: PreparedRow,
  top: number,
  alternate: boolean,
): number {
  const bottom = top - row.height;
  page.drawRectangle({
    x: MARGIN,
    y: bottom,
    width: CONTENT_WIDTH,
    height: row.height,
    color: alternate ? ALTERNATE : rgb(1, 1, 1),
  });
  page.drawLine({
    start: { x: MARGIN, y: bottom },
    end: { x: PAGE_WIDTH - MARGIN, y: bottom },
    color: BORDER,
    thickness: 0.6,
  });
  let x = MARGIN;
  row.cells.forEach((cell, index) => {
    const lines = index === 0 ? row.subjectLines : [cell];
    lines.forEach((line, lineIndex) => {
      drawText(
        page,
        line,
        x + 8,
        top - 16 - lineIndex * LINE_HEIGHT,
        ROW_FONT_SIZE,
        fonts.regular,
        TEXT,
      );
    });
    x += COLUMNS[index] ?? 0;
  });
  return bottom;
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.trim().split(/\s+/u);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (current) lines.push(current);
      current = '';
      let fragment = '';
      for (const character of Array.from(word)) {
        const candidate = fragment + character;
        if (fragment && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = candidate;
        }
      }
      current = fragment;
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function formatLondonDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(value);
}
