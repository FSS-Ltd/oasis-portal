import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { TimetableColour } from '@oasis/domain';
import type {
  TimetablePublicationEntryView,
  TimetablePublicationView,
} from '../routers/timetable.js';
import {
  drawCentredText,
  drawRightText,
  drawText,
  loadLogoBytes,
  safeFileName,
  wrapText,
} from './student-report-pdf-layout.js';

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 27;
const NAVY = rgb(0.075, 0.157, 0.302);
const CRIMSON = rgb(0.45, 0.075, 0.125);
const COPPER = rgb(0.72, 0.36, 0.24);
const TEXT = rgb(0.075, 0.09, 0.12);
const MUTED = rgb(0.35, 0.39, 0.47);
const BORDER = rgb(0.11, 0.14, 0.19);
const HEADER_FILL = rgb(0.965, 0.91, 0.855);
const DAY_FILL = rgb(0.98, 0.945, 0.91);
const EMPTY_FILL = rgb(0.975, 0.98, 0.985);

const SUBJECT_FILLS: Record<TimetableColour, RGB> = {
  Yellow: rgb(1, 0.91, 0.36),
  Red: rgb(0.95, 0.53, 0.54),
  PaleRed: rgb(0.98, 0.72, 0.71),
  Purple: rgb(0.82, 0.61, 0.9),
  DarkBlue: rgb(0.48, 0.65, 0.83),
  LightBlue: rgb(0.7, 0.9, 0.94),
  Green: rgb(0.47, 0.82, 0.32),
  Brown: rgb(0.72, 0.55, 0.38),
  Grey: rgb(0.82, 0.84, 0.87),
};

export interface GeneratedTimetablePdf {
  bytes: Uint8Array;
  fileName: string;
  mimeType: 'application/pdf';
}

interface Fonts {
  bold: PDFFont;
  regular: PDFFont;
}

export async function generateTimetablePdf(
  publication: TimetablePublicationView,
): Promise<GeneratedTimetablePdf> {
  const document = await PDFDocument.create();
  document.setTitle(`${publication.studentFirstName} ${publication.termLabel} timetable`);
  document.setAuthor('Oasis Learning Centre');
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  await drawHeader(document, page, fonts, publication);
  drawTimetableGrid(page, fonts, publication.entries);
  drawFooter(page, fonts, publication.publishedAt);

  return {
    bytes: await document.save(),
    fileName: `${safeFileName(publication.studentFirstName)}-${safeFileName(publication.termLabel)}-timetable.pdf`,
    mimeType: 'application/pdf',
  };
}

async function drawHeader(
  document: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  publication: TimetablePublicationView,
): Promise<void> {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  page.drawRectangle({
    x: PAGE_WIDTH - 190,
    y: PAGE_HEIGHT - 8,
    width: 190,
    height: 8,
    color: CRIMSON,
  });
  const logoBytes = loadLogoBytes();
  if (logoBytes) {
    const image = await document.embedPng(logoBytes).catch(() => null);
    if (image) {
      const size = image.scale(0.18);
      page.drawImage(image, {
        x: PAGE_WIDTH - MARGIN - size.width,
        y: PAGE_HEIGHT - 100,
        width: size.width,
        height: size.height,
      });
    }
  }

  drawCentredText(
    page,
    'OASIS LEARNING CENTRE TIMETABLE',
    MARGIN,
    PAGE_WIDTH - MARGIN * 2,
    PAGE_HEIGHT - 54,
    23,
    fonts.regular,
    NAVY,
  );
  drawCentredText(
    page,
    publication.studentFirstName.toUpperCase(),
    MARGIN,
    PAGE_WIDTH - MARGIN * 2,
    PAGE_HEIGHT - 91,
    20,
    fonts.bold,
    COPPER,
  );
  drawCentredText(
    page,
    `${publication.termLabel} · ${publication.registrationLevel} · ${formatDate(publication.termStartsOn)} – ${formatDate(publication.termEndsOn)}`,
    MARGIN,
    PAGE_WIDTH - MARGIN * 2,
    PAGE_HEIGHT - 116,
    10,
    fonts.bold,
    MUTED,
  );
}

function drawTimetableGrid(
  page: PDFPage,
  fonts: Fonts,
  entries: readonly TimetablePublicationEntryView[],
): void {
  const tableX = MARGIN;
  const tableTop = PAGE_HEIGHT - 140;
  const tableBottom = 48;
  const headerHeight = 65;
  const dayWidth = 82;
  const rowHeight = (tableTop - tableBottom - headerHeight) / 4;
  const slots = uniqueSlots(entries);
  const slotWidth = (PAGE_WIDTH - MARGIN * 2 - dayWidth) / Math.max(slots.length, 1);

  drawCell(page, tableX, tableTop - headerHeight, dayWidth, headerHeight, HEADER_FILL);
  drawCentredText(
    page,
    'WEEKLY',
    tableX,
    dayWidth,
    tableTop - headerHeight / 2 + 4,
    10,
    fonts.bold,
    NAVY,
  );
  drawCentredText(
    page,
    'PLAN',
    tableX,
    dayWidth,
    tableTop - headerHeight / 2 - 10,
    9,
    fonts.regular,
    MUTED,
  );

  slots.forEach((slot, index) => {
    const x = tableX + dayWidth + index * slotWidth;
    drawCell(page, x, tableTop - headerHeight, slotWidth, headerHeight, HEADER_FILL);
    drawCentredText(
      page,
      slot.kind === 'Break' ? 'BREAK' : slot.label.toUpperCase(),
      x + 3,
      slotWidth - 6,
      tableTop - 26,
      Math.min(10, fittingSize(slot.label, fonts.bold, slotWidth - 12, 10)),
      fonts.bold,
      TEXT,
    );
    drawCentredText(
      page,
      `${formatTime(slot.startMinutes)} – ${formatTime(slot.endMinutes)}`,
      x + 3,
      slotWidth - 6,
      tableTop - 45,
      Math.min(8.5, fittingSize('00:00 – 00:00', fonts.regular, slotWidth - 10, 8.5)),
      fonts.regular,
      MUTED,
    );
  });

  const days = ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
  days.forEach((day, dayIndex) => {
    const y = tableTop - headerHeight - (dayIndex + 1) * rowHeight;
    drawCell(page, tableX, y, dayWidth, rowHeight, DAY_FILL);
    drawCentredText(
      page,
      day.toUpperCase(),
      tableX,
      dayWidth,
      y + rowHeight / 2 - 4,
      11,
      fonts.bold,
      NAVY,
    );

    slots.forEach((slot, slotIndex) => {
      if (slot.kind === 'Break') return;

      const entry = entries.find(
        (candidate) => candidate.day === day && candidate.slotPosition === slot.position,
      );
      const x = tableX + dayWidth + slotIndex * slotWidth;
      const fill = entry?.subjectColour ? SUBJECT_FILLS[entry.subjectColour] : EMPTY_FILL;
      drawCell(page, x, y, slotWidth, rowHeight, fill);

      if (entry?.subjectName) {
        drawSubject(page, fonts.bold, entry.subjectName, x, y, slotWidth, rowHeight);
      } else {
        drawCentredText(page, 'OPEN', x, slotWidth, y + rowHeight / 2 - 3, 7.5, fonts.bold, MUTED);
      }
    });
  });

  const breakHeight = rowHeight * days.length;
  const breakY = tableTop - headerHeight - breakHeight;
  slots.forEach((slot, slotIndex) => {
    if (slot.kind !== 'Break') return;

    const x = tableX + dayWidth + slotIndex * slotWidth;
    drawCell(page, x, breakY, slotWidth, breakHeight, EMPTY_FILL);
    drawVerticalBreak(page, fonts.bold, x, breakY, slotWidth, breakHeight);
  });
}

function uniqueSlots(entries: readonly TimetablePublicationEntryView[]) {
  const slots = new Map<
    number,
    {
      endMinutes: number;
      kind: 'Lesson' | 'Break';
      label: string;
      position: number;
      startMinutes: number;
    }
  >();
  for (const entry of entries) {
    if (!slots.has(entry.slotPosition)) {
      slots.set(entry.slotPosition, {
        position: entry.slotPosition,
        kind: entry.slotKind,
        label: entry.slotLabel,
        startMinutes: entry.startMinutes,
        endMinutes: entry.endMinutes,
      });
    }
  }
  return [...slots.values()].sort((left, right) => left.position - right.position);
}

function drawCell(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGB,
): void {
  page.drawRectangle({ x, y, width, height, color, borderColor: BORDER, borderWidth: 0.85 });
}

function drawSubject(
  page: PDFPage,
  font: PDFFont,
  subject: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  let size = Math.min(10.5, fittingSize(subject, font, width - 14, 10.5));
  let lines = wrapText(subject.toUpperCase(), font, size, width - 14);
  while (lines.length > 3 && size > 7) {
    size -= 0.5;
    lines = wrapText(subject.toUpperCase(), font, size, width - 14);
  }
  const lineHeight = size + 3;
  const firstY = y + height / 2 + ((lines.length - 1) * lineHeight) / 2 - size / 2;
  lines.slice(0, 3).forEach((line, index) => {
    drawCentredText(page, line, x + 5, width - 10, firstY - index * lineHeight, size, font, TEXT);
  });
}

function drawVerticalBreak(
  page: PDFPage,
  font: PDFFont,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const glyphs = ['B.', 'R.', 'E.', 'A.', 'K.'];
  const size = Math.min(9.5, height / 7);
  const lineHeight = size + 1;
  const firstY = y + height / 2 + ((glyphs.length - 1) * lineHeight) / 2 - size / 2;
  glyphs.forEach((glyph, index) => {
    drawCentredText(page, glyph, x, width, firstY - index * lineHeight, size, font, TEXT);
  });
}

function drawFooter(page: PDFPage, fonts: Fonts, publishedAt: Date): void {
  page.drawLine({
    start: { x: MARGIN, y: 31 },
    end: { x: PAGE_WIDTH - MARGIN, y: 31 },
    color: rgb(0.83, 0.85, 0.88),
    thickness: 0.7,
  });
  drawText(
    page,
    'Oasis Learning Centre · Personal learning timetable',
    MARGIN,
    17,
    7,
    fonts.regular,
    MUTED,
  );
  drawRightText(
    page,
    `Published ${formatDate(publishedAt)}`,
    PAGE_WIDTH - MARGIN,
    17,
    7,
    fonts.regular,
    MUTED,
  );
}

function fittingSize(value: string, font: PDFFont, width: number, preferred: number): number {
  let size = preferred;
  while (size > 6.5 && font.widthOfTextAtSize(value.toUpperCase(), size) > width) size -= 0.5;
  return size;
}

function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}
