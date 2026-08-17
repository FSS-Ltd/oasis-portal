import { formatPaceIdentifier, type CompiledReport } from '@oasis/domain';
import {
  CONTENT_BOTTOM,
  CONTENT_WIDTH,
  MARGIN,
  NAVY,
  PALE_AMBER,
  PALE_BLUE,
  PALE_GREEN,
  BORDER,
  BLUE_GREY,
  MUTED,
  PAGE_HEIGHT,
  WHITE,
  drawCentredText,
  drawEmptyState,
  drawSectionHeading,
  drawText,
  ensureSpace,
  trimToWidth,
  type PdfContext,
} from './student-report-pdf-layout.js';

interface MetricCard {
  label: string;
  value: string;
  detail: string;
}

export function drawMetricCards(context: PdfContext, report: CompiledReport): void {
  const cards: MetricCard[] = [];
  if (report.sections.attendance) {
    cards.push({
      label: 'ATTENDANCE',
      value: `${String(report.attendance.attendancePct)}%`,
      detail: `${String(report.attendance.present)} present - ${String(report.attendance.absent)} absent - ${String(report.attendance.late)} late`,
    });
  }
  if (report.sections.behaviourSummary) {
    cards.push({
      label: 'BEHAVIOUR SUMMARY',
      value: `${String(report.behaviour.meritsEarned)} merits`,
      detail: `${String(report.behaviour.demeritsCount)} demerits - ${String(report.behaviour.demeritsMerits)} merit impact`,
    });
  }
  if (report.sections.balances) {
    cards.push({
      label: 'BALANCES',
      value: `${String(report.balances.Spend)} spend`,
      detail: `${String(report.balances.Saving)} saving - ${String(report.balances.Investment)} investment`,
    });
  }
  if (cards.length === 0) return;

  ensureSpace(context, 72);
  const gap = 10;
  const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = MARGIN + index * (width + gap);
    context.page.drawRectangle({
      x,
      y: context.y - 54,
      width,
      height: 54,
      color: WHITE,
      borderColor: BORDER,
      borderWidth: 1,
    });
    drawText(context.page, card.label, x + 10, context.y - 16, 7.5, context.fonts.bold, MUTED);
    drawText(
      context.page,
      trimToWidth(card.value, context.fonts.bold, 14, width - 20),
      x + 10,
      context.y - 34,
      14,
      context.fonts.bold,
      NAVY,
    );
    drawText(
      context.page,
      trimToWidth(card.detail, context.fonts.regular, 7.5, width - 20),
      x + 10,
      context.y - 47,
      7.5,
      context.fonts.regular,
      BLUE_GREY,
    );
  });
  context.y -= 76;
}

export function drawPaceTable(context: PdfContext, report: CompiledReport): void {
  drawSectionHeading(context, 'PACE Progress', report.paces.length === 0 ? 32 : 51);
  if (report.paces.length === 0) {
    drawEmptyState(context, 'No PACE progress was recorded for this report.');
    return;
  }

  drawPaceHeader(context, report.sections.paceStatus);
  report.paces.forEach((pace, index) => {
    if (context.y - 27 < CONTENT_BOTTOM) {
      ensureSpace(context, PAGE_HEIGHT);
      drawText(context.page, 'PACE Progress (continued)', MARGIN, context.y, 11, context.fonts.bold, NAVY);
      context.y -= 22;
      drawPaceHeader(context, report.sections.paceStatus);
    }
    const rowY = context.y - 22;
    if (index % 2 === 0) {
      context.page.drawRectangle({
        x: MARGIN,
        y: rowY,
        width: CONTENT_WIDTH,
        height: 25,
        color: PALE_BLUE,
      });
    }
    const columns = paceColumns(report.sections.paceStatus);
    drawText(
      context.page,
      trimToWidth(pace.subjectName, context.fonts.regular, 8.5, columns.subject.width - 12),
      columns.subject.x + 6,
      context.y - 14,
      8.5,
      context.fonts.regular,
      NAVY,
    );
    drawText(
      context.page,
      formatPaceIdentifier(pace.currentPace),
      columns.current.x + 6,
      context.y - 14,
      8.5,
      context.fonts.bold,
      NAVY,
    );
    drawText(
      context.page,
      String(pace.pacesCompletedThisTerm),
      columns.completed.x + 6,
      context.y - 14,
      8.5,
      context.fonts.regular,
      NAVY,
    );
    drawText(
      context.page,
      pace.averageTestScore === null ? '-' : `${String(pace.averageTestScore)}%`,
      columns.score.x + 6,
      context.y - 14,
      8.5,
      context.fonts.regular,
      NAVY,
    );
    if (columns.status) {
      context.page.drawRectangle({
        x: columns.status.x + 4,
        y: context.y - 19,
        width: columns.status.width - 8,
        height: 17,
        color: statusBackground(pace.status.tone),
      });
      drawCentredText(
        context.page,
        pace.status.status,
        columns.status.x,
        columns.status.width,
        context.y - 14,
        7.5,
        context.fonts.bold,
        NAVY,
      );
    }
    context.y -= 25;
  });
  context.y -= 20;
}

function drawPaceHeader(context: PdfContext, includeStatus: boolean): void {
  ensureSpace(context, 27);
  const columns = paceColumns(includeStatus);
  context.page.drawRectangle({
    x: MARGIN,
    y: context.y - 22,
    width: CONTENT_WIDTH,
    height: 24,
    color: NAVY,
  });
  const headings = [
    ['Subject', columns.subject],
    ['Current PACE', columns.current],
    ['Completed', columns.completed],
    ['Avg score', columns.score],
    ...(columns.status ? ([['Status', columns.status]] as const) : []),
  ] as const;
  headings.forEach(([label, column]) => {
    drawText(
      context.page,
      label,
      column.x + 6,
      context.y - 14,
      7.5,
      context.fonts.bold,
      WHITE,
    );
  });
  context.y -= 24;
}

function paceColumns(includeStatus: boolean) {
  const currentWidth = 82;
  const completedWidth = 72;
  const scoreWidth = 66;
  const statusWidth = includeStatus ? 78 : 0;
  const subjectWidth = CONTENT_WIDTH - currentWidth - completedWidth - scoreWidth - statusWidth;
  const subject = { x: MARGIN, width: subjectWidth };
  const current = { x: subject.x + subject.width, width: currentWidth };
  const completed = { x: current.x + current.width, width: completedWidth };
  const score = { x: completed.x + completed.width, width: scoreWidth };
  return {
    subject,
    current,
    completed,
    score,
    status: includeStatus ? { x: score.x + score.width, width: statusWidth } : null,
  };
}

function statusBackground(tone: CompiledReport['paces'][number]['status']['tone']) {
  if (tone === 'green') return PALE_GREEN;
  if (tone === 'amber') return PALE_AMBER;
  if (tone === 'blue') return PALE_BLUE;
  return BORDER;
}
