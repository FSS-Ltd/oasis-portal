import { Buffer } from 'node:buffer';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAD = 42;
const NAVY = rgb(0.106, 0.169, 0.369);
const CRIMSON = rgb(0.49, 0.11, 0.173);
const MUTED = rgb(0.353, 0.416, 0.541);
const BORDER = rgb(0.867, 0.89, 0.941);
const PALE_BLUE = rgb(0.961, 0.973, 1);

export interface GenerateIncidentParentPdfInput {
  reportNumber: string;
  childName: string;
  incidentType: string;
  occurredAt: Date;
  parentSummary: string;
  firstAidSummary: string | null;
  followUp: string | null;
  signedOffBy: string | null;
  signedOffAt: Date | null;
  sharingReason: string;
}

export interface GeneratedIncidentParentPdf {
  fileName: string;
  mimeType: 'application/pdf';
  pdfBase64: string;
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function generateIncidentParentPdf(
  input: GenerateIncidentParentPdfInput,
): Promise<GeneratedIncidentParentPdf> {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  drawHeader(page, fonts, input);
  drawMeta(page, fonts, input);
  drawSection(page, fonts, 'Summary shared with parent', input.parentSummary, PAGE_HEIGHT - 235);
  drawSection(page, fonts, 'First aid / immediate action', input.firstAidSummary ?? 'Not recorded', PAGE_HEIGHT - 360);
  drawSection(page, fonts, 'Follow-up requested', input.followUp ?? 'No follow-up recorded', PAGE_HEIGHT - 485);
  drawSection(page, fonts, 'Sharing reason', input.sharingReason, PAGE_HEIGHT - 610);
  drawFooter(page, fonts, input);

  const bytes = await pdf.save();
  return {
    fileName: `${input.reportNumber}-${safeFileName(input.childName)}-parent-copy.pdf`,
    mimeType: 'application/pdf',
    pdfBase64: Buffer.from(bytes).toString('base64'),
  };
}

function drawHeader(page: PDFPage, fonts: PdfFonts, input: GenerateIncidentParentPdfInput) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  page.drawRectangle({
    x: PAGE_WIDTH - 170,
    y: PAGE_HEIGHT - 8,
    width: 170,
    height: 8,
    color: CRIMSON,
  });
  drawText(page, 'OASIS LEARNING CENTRE', PAD, PAGE_HEIGHT - 48, 13, fonts.bold, NAVY);
  drawText(page, 'Parent copy', PAD, PAGE_HEIGHT - 66, 9, fonts.bold, CRIMSON);
  drawText(page, 'Incident Report', PAD, PAGE_HEIGHT - 104, 24, fonts.bold, NAVY);
  drawText(page, input.reportNumber, PAGE_WIDTH - PAD - 120, PAGE_HEIGHT - 48, 12, fonts.bold, CRIMSON);
}

function drawMeta(page: PDFPage, fonts: PdfFonts, input: GenerateIncidentParentPdfInput) {
  const y = PAGE_HEIGHT - 175;
  page.drawRectangle({
    x: PAD,
    y,
    width: PAGE_WIDTH - PAD * 2,
    height: 58,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  drawText(page, 'Child', PAD + 12, y + 38, 8, fonts.bold, MUTED);
  drawText(page, input.childName, PAD + 78, y + 38, 9, fonts.bold, NAVY);
  drawText(page, 'Type', PAD + 12, y + 21, 8, fonts.bold, MUTED);
  drawText(page, input.incidentType, PAD + 78, y + 21, 9, fonts.bold, NAVY);
  drawText(page, 'Date / time', PAD + 12, y + 4, 8, fonts.bold, MUTED);
  drawText(page, formatDateTime(input.occurredAt), PAD + 78, y + 4, 9, fonts.bold, NAVY);
}

function drawSection(page: PDFPage, fonts: PdfFonts, title: string, body: string, y: number) {
  drawText(page, title, PAD, y, 11, fonts.bold, NAVY);
  drawWrappedText(page, body, PAD, y - 20, 9, fonts.regular, MUTED, PAGE_WIDTH - PAD * 2, 15);
}

function drawFooter(page: PDFPage, fonts: PdfFonts, input: GenerateIncidentParentPdfInput) {
  page.drawRectangle({
    x: PAD,
    y: 58,
    width: PAGE_WIDTH - PAD * 2,
    height: 56,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  const signOff = input.signedOffBy
    ? `Signed off by ${input.signedOffBy}${input.signedOffAt ? ` on ${formatDate(input.signedOffAt)}` : ''}.`
    : 'Signed off by Oasis Learning Centre.';
  drawText(page, 'Head sign-off', PAD + 12, 94, 9, fonts.bold, NAVY);
  drawWrappedText(page, signOff, PAD + 12, 78, 8.5, fonts.regular, MUTED, PAGE_WIDTH - PAD * 2 - 24, 13);
}

function drawText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = NAVY,
  maxWidth?: number,
) {
  const text = maxWidth ? trimToWidth(value, font, size, maxWidth) : value;
  page.drawText(text, { x, y, size, font, color });
}

function drawWrappedText(
  page: PDFPage,
  value: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  maxWidth: number,
  lineHeight: number,
) {
  const words = value.split(/\s+/u).filter(Boolean);
  let line = '';
  let cursorY = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= lineHeight;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) page.drawText(line, { x, y: cursorY, size, font, color });
}

function trimToWidth(value: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}...`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function safeFileName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]/gu, '-').replace(/-+/gu, '-') || 'child';
}
