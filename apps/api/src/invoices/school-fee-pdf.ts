import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { SCHOOL_FEE_DISCOUNT_EXPLANATION, type SchoolFeeBillingCadence } from '@oasis/domain';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAD = 42;
const NAVY = rgb(0.106, 0.169, 0.369);
const CRIMSON = rgb(0.49, 0.11, 0.173);
const BLUE_GREY = rgb(0.353, 0.416, 0.541);
const PALE_BLUE = rgb(0.961, 0.973, 1);
const BORDER = rgb(0.867, 0.89, 0.941);
const MUTED = rgb(0.533, 0.6, 0.733);
const WHITE = rgb(1, 1, 1);
const PAYMENT_BOX_WIDTH = 202;
const PAYMENT_BOX_X = PAGE_WIDTH - PAD - PAYMENT_BOX_WIDTH;
const PAYMENT_BOX_Y = 158;
const PAYMENT_BOX_HEIGHT = 122;
const SECTION_COLUMN_GAP = 24;
const PRIMARY_TABLE_Y = PAGE_HEIGHT - 310;
const CONTINUATION_TABLE_Y = PAGE_HEIGHT - 108;
const TABLE_ROW_START_OFFSET = 30;
const CONTINUATION_MIN_ROW_Y = 94;
const PAYMENT_TOTALS_GAP = 8;

export interface GeneratedInvoiceLine {
  description: string;
  quantity: number;
  unitAmountPence: number;
  totalAmountPence: number;
}

export interface GeneratedInvoiceStudent {
  name: string;
  yearGroup: string;
}

export interface GeneratedInvoiceDiscount {
  label: string;
  baseAmountPence: number;
  appliedAmountPence: number;
  optedOut: boolean;
}

export interface GeneratedInvoiceChildDiscountBreakdown {
  childIndex: number;
  discountAmountPence: number;
  totalAmountPence: number;
  discounts: {
    label: string;
    appliedAmountPence: number;
  }[];
}

export interface GenerateSchoolFeeInvoicePdfInput {
  documentTitle: string;
  billingLabel: string;
  invoiceNumber: string;
  issuedOn: Date | null;
  dueOn: Date | null;
  billTo: string;
  familyLabel: string | null;
  students: GeneratedInvoiceStudent[];
  schoolYear: number | null;
  billingCadence: SchoolFeeBillingCadence | null;
  term: string | null;
  subtotalAmountPence: number;
  discountAmountPence: number;
  totalAmountPence: number;
  discountExplanation: string;
  paymentReference: string;
  lineItems: GeneratedInvoiceLine[];
  discounts: GeneratedInvoiceDiscount[];
  discountBreakdowns: GeneratedInvoiceChildDiscountBreakdown[];
}

export interface GeneratedSchoolFeeInvoicePdf {
  bytes: Uint8Array;
  extractedText: string;
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function generateSchoolFeeInvoicePdf(
  input: GenerateSchoolFeeInvoicePdfInput,
): Promise<GeneratedSchoolFeeInvoicePdf> {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const logoBytes = loadLogoBytes();
  const logo = logoBytes ? await pdf.embedPng(logoBytes).catch(() => null) : null;

  drawHeader(page, fonts, input, logo);
  drawBillTo(page, fonts, input);
  const nextLineIndex = drawLines(page, fonts, input);
  drawDiscounts(page, fonts, input);
  drawPayment(page, fonts, input);
  drawFooter(page, fonts);
  drawLineContinuationPages(pdf, fonts, input, nextLineIndex);

  const bytes = await pdf.save();
  return {
    bytes,
    extractedText: invoiceSearchText(input),
  };
}

function drawHeader(
  page: PDFPage,
  fonts: PdfFonts,
  input: GenerateSchoolFeeInvoicePdfInput,
  logo: PDFImage | null,
) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  page.drawRectangle({
    x: PAGE_WIDTH - 170,
    y: PAGE_HEIGHT - 8,
    width: 170,
    height: 8,
    color: CRIMSON,
  });

  if (logo) {
    const logoDims = logo.scale(0.16);
    page.drawImage(logo, {
      x: PAD,
      y: PAGE_HEIGHT - 93,
      width: logoDims.width,
      height: logoDims.height,
    });
  }

  const textX = logo ? PAD + 70 : PAD;
  drawText(page, 'OASIS LEARNING CENTRE', textX, PAGE_HEIGHT - 46, 13, fonts.bold, NAVY);
  drawText(
    page,
    '5/6 Montpelier Business Park',
    textX,
    PAGE_HEIGHT - 64,
    8.5,
    fonts.regular,
    BLUE_GREY,
  );
  drawText(
    page,
    'Dencora Way, Ashford, Kent TN23 4FG',
    textX,
    PAGE_HEIGHT - 77,
    8.5,
    fonts.regular,
    BLUE_GREY,
  );
  drawText(
    page,
    'admin@oasislearnicentre.co.uk',
    textX,
    PAGE_HEIGHT - 90,
    8.5,
    fonts.regular,
    BLUE_GREY,
  );

  drawText(
    page,
    input.documentTitle,
    PAGE_WIDTH - PAD - 168,
    PAGE_HEIGHT - 45,
    11,
    fonts.bold,
    MUTED,
  );
  drawText(
    page,
    input.invoiceNumber,
    PAGE_WIDTH - PAD - 168,
    PAGE_HEIGHT - 69,
    22,
    fonts.bold,
    CRIMSON,
  );
  drawMetaBox(page, fonts, input);
}

function drawMetaBox(page: PDFPage, fonts: PdfFonts, input: GenerateSchoolFeeInvoicePdfInput) {
  const x = PAGE_WIDTH - PAD - 168;
  const y = PAGE_HEIGHT - 139;
  page.drawRectangle({
    x,
    y,
    width: 168,
    height: 58,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  drawText(page, 'Invoice No', x + 10, y + 40, 7.5, fonts.bold, MUTED);
  drawText(page, input.invoiceNumber, x + 78, y + 40, 8.5, fonts.bold, NAVY);
  drawText(page, 'Issued', x + 10, y + 24, 7.5, fonts.bold, MUTED);
  drawText(page, formatDate(input.issuedOn), x + 78, y + 24, 8.5, fonts.bold, NAVY);
  drawText(page, 'Due date', x + 10, y + 8, 7.5, fonts.bold, MUTED);
  drawText(page, formatDate(input.dueOn), x + 78, y + 8, 8.5, fonts.bold, NAVY);
}

function drawBillTo(page: PDFPage, fonts: PdfFonts, input: GenerateSchoolFeeInvoicePdfInput) {
  const y = PAGE_HEIGHT - 177;
  drawText(page, 'Bill to', PAD, y, 8, fonts.bold, MUTED);
  drawText(page, input.billTo || input.familyLabel || 'Family', PAD, y - 18, 12, fonts.bold, NAVY);
  if (input.familyLabel) {
    drawText(page, input.familyLabel, PAD, y - 34, 9, fonts.regular, BLUE_GREY);
  }

  const rightX = PAGE_WIDTH / 2 + 20;
  drawText(page, 'Student(s)', rightX, y, 8, fonts.bold, MUTED);
  drawText(
    page,
    input.students.map((student) => student.name).join(', ') || 'Not assigned',
    rightX,
    y - 18,
    10,
    fonts.bold,
    NAVY,
    220,
  );
  drawText(page, 'Year group', rightX, y - 42, 8, fonts.bold, MUTED);
  drawText(
    page,
    uniqueValues(input.students.map((student) => student.yearGroup)).join(', ') || 'Not set',
    rightX,
    y - 60,
    10,
    fonts.bold,
    NAVY,
    220,
  );

  page.drawRectangle({ x: PAD, y: y - 104, width: PAGE_WIDTH - PAD * 2, height: 32, color: NAVY });
  drawText(page, input.billingLabel, PAD + 14, y - 84, 11, fonts.bold, WHITE, 300);
  const billingText = invoiceBillingDetail(input);
  if (!billingText) return;
  drawText(page, billingText, PAGE_WIDTH - PAD - 210, y - 84, 9, fonts.bold, WHITE, 200);
}

function invoiceBillingDetail(input: GenerateSchoolFeeInvoicePdfInput): string {
  const billingText = [
    input.term,
    input.billingCadence,
    input.schoolYear ? String(input.schoolYear) : null,
  ]
    .filter(Boolean)
    .join(' / ');
  if (billingText) return billingText;
  return input.documentTitle === 'School Fee Invoice' ? 'School fees' : '';
}

interface InvoiceLinePageResult {
  nextLineIndex: number;
  nextY: number;
}

function drawLines(
  page: PDFPage,
  fonts: PdfFonts,
  input: GenerateSchoolFeeInvoicePdfInput,
): number {
  drawLineTableHeader(page, fonts, PRIMARY_TABLE_Y);
  const totalOffset = invoiceTotalOffset(input);
  const minimumNextY = PAYMENT_BOX_Y + PAYMENT_BOX_HEIGHT + PAYMENT_TOTALS_GAP + 18 + totalOffset;
  const result = drawInvoiceLineRows(
    page,
    fonts,
    input,
    0,
    PRIMARY_TABLE_Y - TABLE_ROW_START_OFFSET,
    minimumNextY,
  );

  const totalsY = result.nextY - 18;
  drawSummaryRow(page, fonts, 'Subtotal', input.subtotalAmountPence, totalsY);
  if (showInvoiceDiscountRow(input)) {
    drawSummaryRow(page, fonts, 'Discounts', -input.discountAmountPence, totalsY - 22);
  }
  page.drawRectangle({
    x: PAGE_WIDTH - PAD - 180,
    y: totalsY - totalOffset,
    width: 180,
    height: 34,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  drawText(
    page,
    'Total',
    PAGE_WIDTH - PAD - 166,
    totalsY - totalOffset + 21,
    10,
    fonts.bold,
    BLUE_GREY,
  );
  drawText(
    page,
    formatMoney(input.totalAmountPence),
    PAGE_WIDTH - PAD - 88,
    totalsY - totalOffset + 19,
    15,
    fonts.bold,
    CRIMSON,
  );
  return result.nextLineIndex;
}

function drawLineContinuationPages(
  pdf: PDFDocument,
  fonts: PdfFonts,
  input: GenerateSchoolFeeInvoicePdfInput,
  firstLineIndex: number,
): void {
  let nextLineIndex = firstLineIndex;
  while (nextLineIndex < input.lineItems.length) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawContinuationHeader(page, fonts, input);
    drawLineTableHeader(page, fonts, CONTINUATION_TABLE_Y);
    const result = drawInvoiceLineRows(
      page,
      fonts,
      input,
      nextLineIndex,
      CONTINUATION_TABLE_Y - TABLE_ROW_START_OFFSET,
      CONTINUATION_MIN_ROW_Y,
    );
    if (result.nextLineIndex === nextLineIndex) {
      throw new Error('invoice line cannot fit on a continuation page');
    }
    nextLineIndex = result.nextLineIndex;
    drawFooter(page, fonts);
  }
}

function drawContinuationHeader(
  page: PDFPage,
  fonts: PdfFonts,
  input: GenerateSchoolFeeInvoicePdfInput,
): void {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: NAVY });
  page.drawRectangle({
    x: PAGE_WIDTH - 170,
    y: PAGE_HEIGHT - 8,
    width: 170,
    height: 8,
    color: CRIMSON,
  });
  drawText(
    page,
    `${input.documentTitle} ${input.invoiceNumber}`,
    PAD,
    PAGE_HEIGHT - 48,
    14,
    fonts.bold,
  );
  drawText(page, 'Line items continued', PAD, PAGE_HEIGHT - 70, 9, fonts.bold, MUTED);
}

function drawLineTableHeader(page: PDFPage, fonts: PdfFonts, y: number): void {
  const width = PAGE_WIDTH - PAD * 2;
  page.drawRectangle({
    x: PAD,
    y,
    width,
    height: 24,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  drawText(page, 'Description', PAD + 10, y + 8, 8, fonts.bold, BLUE_GREY);
  drawText(page, 'Qty', PAD + 312, y + 8, 8, fonts.bold, BLUE_GREY);
  drawText(page, 'Unit', PAD + 365, y + 8, 8, fonts.bold, BLUE_GREY);
  drawText(page, 'Amount', PAD + 462, y + 8, 8, fonts.bold, BLUE_GREY);
}

function drawInvoiceLineRows(
  page: PDFPage,
  fonts: PdfFonts,
  input: GenerateSchoolFeeInvoicePdfInput,
  firstLineIndex: number,
  startY: number,
  minimumNextY: number,
): InvoiceLinePageResult {
  let nextLineIndex = firstLineIndex;
  let nextY = startY;
  while (nextLineIndex < input.lineItems.length) {
    const rowHeight = invoiceLineRowHeight(input, nextLineIndex);
    if (nextY - rowHeight < minimumNextY) break;
    nextY = drawInvoiceLineRow(page, fonts, input, nextLineIndex, nextY);
    nextLineIndex += 1;
  }
  return { nextLineIndex, nextY };
}

function invoiceLineRowHeight(input: GenerateSchoolFeeInvoicePdfInput, lineIndex: number): number {
  const appliedDiscountCount = invoiceLineDiscounts(input, lineIndex).length;
  return appliedDiscountCount > 0 ? 44 + appliedDiscountCount * 12 : 32;
}

function invoiceLineDiscounts(
  input: GenerateSchoolFeeInvoicePdfInput,
  lineIndex: number,
): GeneratedInvoiceChildDiscountBreakdown['discounts'] {
  return (
    input.discountBreakdowns
      .find((candidate) => candidate.childIndex === lineIndex)
      ?.discounts.filter((discount) => discount.appliedAmountPence > 0)
      .slice(0, 4) ?? []
  );
}

function drawInvoiceLineRow(
  page: PDFPage,
  fonts: PdfFonts,
  input: GenerateSchoolFeeInvoicePdfInput,
  lineIndex: number,
  y: number,
): number {
  const line = input.lineItems[lineIndex];
  if (!line) return y;
  const breakdown = input.discountBreakdowns.find(
    (candidate) => candidate.childIndex === lineIndex,
  );
  const appliedDiscounts = invoiceLineDiscounts(input, lineIndex);
  drawText(page, line.description, PAD + 10, y + 12, 9.5, fonts.bold, NAVY, 285);
  drawText(page, String(line.quantity), PAD + 316, y + 12, 9, fonts.regular, NAVY);
  drawText(page, formatMoney(line.unitAmountPence), PAD + 365, y + 12, 9, fonts.regular, NAVY);
  drawText(page, formatMoney(line.totalAmountPence), PAD + 462, y + 12, 9, fonts.bold, NAVY);

  let rowBottomY = y - 10;
  appliedDiscounts.forEach((discount, discountIndex) => {
    const discountY = y - 4 - discountIndex * 12;
    drawText(
      page,
      `Discount - ${discount.label}`,
      PAD + 24,
      discountY,
      7.6,
      fonts.regular,
      BLUE_GREY,
      300,
    );
    drawText(
      page,
      `-${formatMoney(discount.appliedAmountPence)}`,
      PAD + 462,
      discountY,
      7.6,
      fonts.regular,
      BLUE_GREY,
    );
    rowBottomY = discountY - 8;
  });
  if (breakdown && appliedDiscounts.length > 0) {
    const netY = rowBottomY - 2;
    drawText(page, 'Net for child', PAD + 24, netY, 7.8, fonts.bold, MUTED);
    drawText(page, formatMoney(breakdown.totalAmountPence), PAD + 462, netY, 7.8, fonts.bold, NAVY);
    rowBottomY = netY - 12;
  }
  page.drawLine({
    start: { x: PAD, y: rowBottomY },
    end: { x: PAGE_WIDTH - PAD, y: rowBottomY },
    thickness: 0.75,
    color: BORDER,
  });
  return rowBottomY - (appliedDiscounts.length > 0 ? 30 : 22);
}

function showInvoiceDiscountRow(input: GenerateSchoolFeeInvoicePdfInput): boolean {
  return input.discountAmountPence !== 0 || input.documentTitle === 'School Fee Invoice';
}

function invoiceTotalOffset(input: GenerateSchoolFeeInvoicePdfInput): number {
  return showInvoiceDiscountRow(input) ? 58 : 36;
}

function drawSummaryRow(
  page: PDFPage,
  fonts: PdfFonts,
  label: string,
  amountPence: number,
  y: number,
) {
  drawText(page, label, PAGE_WIDTH - PAD - 166, y, 9, fonts.bold, BLUE_GREY);
  drawText(page, formatMoney(amountPence), PAGE_WIDTH - PAD - 82, y, 9, fonts.bold, NAVY);
}

function drawDiscounts(page: PDFPage, fonts: PdfFonts, input: GenerateSchoolFeeInvoicePdfInput) {
  const explanation = input.discountExplanation.trim();
  if (!explanation && input.discounts.length === 0) return;

  const x = PAD;
  const titleY = 322;
  const bodyY = titleY - 18;
  const bodyLineHeight = 10.5;
  const leftColumnWidth = PAYMENT_BOX_X - x - SECTION_COLUMN_GAP;
  const explanationLines = wrapText(
    explanation || SCHOOL_FEE_DISCOUNT_EXPLANATION,
    fonts.regular,
    8.5,
    leftColumnWidth,
  );

  drawText(page, 'Discount Explanation', x, titleY, 8, fonts.bold, MUTED);
  explanationLines.forEach((line, index) => {
    drawText(page, line, x, bodyY - index * bodyLineHeight, 8.5, fonts.regular, BLUE_GREY);
  });

  if (input.discounts.length === 0 || input.discountBreakdowns.length > 0) return;
  const appliedTitleY = bodyY - explanationLines.length * bodyLineHeight - 8;
  drawText(page, 'Applied discounts', x, appliedTitleY, 8, fonts.bold, MUTED);
  input.discounts.slice(0, 4).forEach((discount, index) => {
    const suffix = discount.optedOut
      ? 'opted out'
      : `${formatMoney(discount.appliedAmountPence)} applied`;
    drawText(
      page,
      `${discount.label}: ${suffix}`,
      x,
      appliedTitleY - 15 - index * 12,
      8.5,
      fonts.regular,
      BLUE_GREY,
      leftColumnWidth,
    );
  });
}

function drawPayment(page: PDFPage, fonts: PdfFonts, input: GenerateSchoolFeeInvoicePdfInput) {
  const x = PAYMENT_BOX_X;
  const y = PAYMENT_BOX_Y;
  page.drawRectangle({
    x,
    y,
    width: PAYMENT_BOX_WIDTH,
    height: 122,
    color: PALE_BLUE,
    borderColor: BORDER,
    borderWidth: 1,
  });
  drawText(page, 'Payment', x + 12, y + 102, 8, fonts.bold, MUTED);
  drawText(page, 'Bank', x + 12, y + 82, 8, fonts.regular, BLUE_GREY);
  drawText(page, 'Bells of Revival Ministries', x + 82, y + 82, 8.5, fonts.bold, NAVY);
  drawText(page, 'Account', x + 12, y + 64, 8, fonts.regular, BLUE_GREY);
  drawText(page, '03008371', x + 82, y + 64, 8.5, fonts.bold, NAVY);
  drawText(page, 'Sort code', x + 12, y + 46, 8, fonts.regular, BLUE_GREY);
  drawText(page, '20-02-62', x + 82, y + 46, 8.5, fonts.bold, NAVY);
  drawText(page, 'Payment reference', x + 12, y + 28, 8, fonts.regular, BLUE_GREY);
  drawText(page, input.paymentReference, x + 82, y + 28, 8.5, fonts.bold, CRIMSON);
}

function drawFooter(page: PDFPage, fonts: PdfFonts) {
  page.drawLine({
    start: { x: PAD, y: 70 },
    end: { x: PAGE_WIDTH - PAD, y: 70 },
    thickness: 1.4,
    color: BORDER,
    dashArray: [4, 4],
  });
  drawText(
    page,
    'Payment to be made within 14 days of receipt of invoice',
    PAD,
    48,
    8.5,
    fonts.bold,
    NAVY,
  );
  drawText(
    page,
    `Oasis Learning Centre / Generated ${formatDate(new Date())}`,
    PAGE_WIDTH - PAD - 185,
    48,
    7.5,
    fonts.regular,
    MUTED,
  );
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = NAVY,
  maxWidth?: number,
) {
  if (!maxWidth) {
    page.drawText(sanitizePdfText(text), { x, y, size, font, color });
    return;
  }
  wrapText(text, font, size, maxWidth)
    .slice(0, 2)
    .forEach((line, index) => {
      page.drawText(sanitizePdfText(line), { x, y: y - index * (size + 3), size, font, color });
    });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines;
}

function sanitizePdfText(value: string): string {
  return value.replace(/[–—]/gu, '-').replace(/\s+/gu, ' ').trim();
}

function formatMoney(amountPence: number): string {
  const sign = amountPence < 0 ? '-' : '';
  const amount = Math.abs(amountPence) / 100;
  return `${sign}\u00a3${amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: Date | null): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function invoiceSearchText(input: GenerateSchoolFeeInvoicePdfInput): string {
  return [
    input.documentTitle,
    `Invoice No ${input.invoiceNumber}`,
    `Issued ${formatDate(input.issuedOn)}`,
    `Due date ${formatDate(input.dueOn)}`,
    `Bill to ${input.billTo}`,
    `Student(s) ${input.students.map((student) => student.name).join(', ')}`,
    `Year group ${uniqueValues(input.students.map((student) => student.yearGroup)).join(', ')}`,
    input.billingLabel,
    invoiceBillingDetail(input) || null,
    `Subtotal ${formatMoney(input.subtotalAmountPence)}`,
    `Total ${formatMoney(input.totalAmountPence)}`,
    `Payment reference ${input.paymentReference}`,
    input.discountExplanation.trim() || null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function loadLogoBytes(): Uint8Array | null {
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
