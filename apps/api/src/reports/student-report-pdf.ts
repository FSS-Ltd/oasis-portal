import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { CompiledReport } from '@oasis/domain';
import { drawMetricCards, drawPaceTable } from './student-report-pdf-academic.js';
import {
  createPage,
  drawAllFooters,
  loadLogoBytes,
  safeFileName,
  type PdfContext,
} from './student-report-pdf-layout.js';
import {
  drawBalances,
  drawMeritActivity,
  drawProgressComment,
  drawTextEntries,
} from './student-report-pdf-narrative.js';

export interface GenerateStudentReportPdfInput {
  report: CompiledReport;
  generatedAt: Date;
}

export interface GeneratedStudentReportPdf {
  bytes: Uint8Array;
  fileName: string;
  mimeType: 'application/pdf';
}

export async function generateStudentReportPdf(
  input: GenerateStudentReportPdfInput,
): Promise<GeneratedStudentReportPdf> {
  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const logoBytes = loadLogoBytes();
  const logo = logoBytes ? await document.embedPng(logoBytes).catch(() => null) : null;
  const context: PdfContext = {
    document,
    fonts,
    input,
    logo,
    page: createPage(document, fonts, logo, input, false),
    y: 638,
  };

  drawMetricCards(context, input.report);
  if (input.report.sections.paceProgress) drawPaceTable(context, input.report);
  if (input.report.sections.progressComment) drawProgressComment(context, input.report);
  if (input.report.sections.behaviourNotes) {
    drawTextEntries(
      context,
      'Behaviour Notes',
      input.report.behaviour.generalEntries,
      'No behaviour notes were recorded for this report.',
    );
  }
  if (input.report.sections.generalNotes) {
    drawTextEntries(
      context,
      'General Notes',
      input.report.notes,
      'No general notes were recorded for this report.',
    );
  }
  if (input.report.sections.meritActivity) drawMeritActivity(context, input.report);
  if (input.report.sections.balances) drawBalances(context, input.report);

  drawAllFooters(document, fonts, input.report.author);
  const bytes = await document.save();
  return {
    bytes,
    fileName: `${safeFileName(input.report.studentDisplayName)}-${safeFileName(input.report.period.label)}-report.pdf`,
    mimeType: 'application/pdf',
  };
}
