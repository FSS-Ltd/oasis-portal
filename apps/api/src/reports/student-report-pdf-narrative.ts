import type { CompiledReport } from '@oasis/domain';
import {
  BLUE_GREY,
  BORDER,
  CONTENT_BOTTOM,
  CONTENT_WIDTH,
  CRIMSON,
  MARGIN,
  NAVY,
  PAGE_HEIGHT,
  PALE_BLUE,
  WHITE,
  drawEmptyState,
  drawRightText,
  drawSectionHeading,
  drawText,
  drawWrappedText,
  ensureSpace,
  formatDate,
  wrapText,
  type PdfContext,
} from './student-report-pdf-layout.js';

export function drawTextEntries(
  context: PdfContext,
  title: string,
  entries: CompiledReport['notes'],
  emptyLabel: string,
): void {
  drawSectionHeading(context, title);
  if (entries.length === 0) {
    drawEmptyState(context, emptyLabel);
    return;
  }

  entries.forEach((entry) => {
    ensureSpace(context, 42);
    const meta = [formatDate(new Date(entry.createdAt)), entry.category].filter(Boolean).join(' - ');
    drawText(context.page, meta, MARGIN, context.y, 8, context.fonts.bold, CRIMSON);
    context.y -= 17;
    drawWrappedText(context, entry.note ?? 'No note text recorded.', {
      color: NAVY,
      size: 9,
      lineHeight: 14,
    });
    context.y -= 7;
    ensureSpace(context, 8);
    context.page.drawLine({
      start: { x: MARGIN, y: context.y },
      end: { x: MARGIN + CONTENT_WIDTH, y: context.y },
      color: BORDER,
      thickness: 0.6,
    });
    context.y -= 16;
  });
}

export function drawMeritActivity(context: PdfContext, report: CompiledReport): void {
  drawSectionHeading(context, 'Merit Activity');
  if (report.meritActivity.length === 0) {
    drawEmptyState(context, 'No merit activity was recorded for this report.');
    return;
  }

  drawMeritHeader(context);
  report.meritActivity.forEach((row, index) => {
    const reasonLines = wrapText(row.reason, context.fonts.regular, 8, 262);
    const rowHeight = Math.max(24, reasonLines.length * 12 + 8);
    if (context.y - rowHeight < CONTENT_BOTTOM) {
      ensureSpace(context, PAGE_HEIGHT);
      drawText(context.page, 'Merit Activity (continued)', MARGIN, context.y, 11, context.fonts.bold, NAVY);
      context.y -= 22;
      drawMeritHeader(context);
    }
    if (index % 2 === 0) {
      context.page.drawRectangle({
        x: MARGIN,
        y: context.y - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: PALE_BLUE,
      });
    }
    drawText(
      context.page,
      formatDate(new Date(row.createdAt)),
      MARGIN + 6,
      context.y - 15,
      8,
      context.fonts.regular,
      NAVY,
    );
    drawText(context.page, row.account, MARGIN + 96, context.y - 15, 8, context.fonts.regular, NAVY);
    drawRightText(
      context.page,
      String(row.delta),
      MARGIN + 222,
      context.y - 15,
      8,
      context.fonts.bold,
      NAVY,
    );
    reasonLines.forEach((line, lineIndex) => {
      drawText(
        context.page,
        line,
        MARGIN + 240,
        context.y - 15 - lineIndex * 12,
        8,
        context.fonts.regular,
        NAVY,
      );
    });
    context.y -= rowHeight;
  });
  context.y -= 20;
}

export function drawBalances(context: PdfContext, report: CompiledReport): void {
  drawSectionHeading(context, 'Balances');
  const balances = [
    ['Spend', report.balances.Spend],
    ['Saving', report.balances.Saving],
    ['Investment', report.balances.Investment],
    ['Investment Return', report.balances.InvestmentReturn],
    ['Tithe Paid', report.balances.TithePaid],
    ['Given', report.balances.Given],
  ] as const;
  const columnWidth = (CONTENT_WIDTH - 12) / 2;
  for (let index = 0; index < balances.length; index += 2) {
    ensureSpace(context, 34);
    for (let columnIndex = 0; columnIndex < 2; columnIndex += 1) {
      const balance = balances[index + columnIndex];
      if (!balance) continue;
      const x = MARGIN + columnIndex * (columnWidth + 12);
      context.page.drawRectangle({
        x,
        y: context.y - 26,
        width: columnWidth,
        height: 28,
        color: PALE_BLUE,
        borderColor: BORDER,
        borderWidth: 0.5,
      });
      drawText(context.page, balance[0], x + 9, context.y - 16, 8.5, context.fonts.regular, BLUE_GREY);
      drawRightText(
        context.page,
        String(balance[1]),
        x + columnWidth - 9,
        context.y - 16,
        9,
        context.fonts.bold,
        NAVY,
      );
    }
    context.y -= 34;
  }
  context.y -= 14;
}

export function drawProgressComment(context: PdfContext, report: CompiledReport): void {
  drawSectionHeading(context, 'Progress Comment');
  const comment = report.headSummary.trim() || 'No progress comment was added.';
  const lines = wrapText(comment, context.fonts.regular, 9.5, CONTENT_WIDTH - 28);
  for (const line of lines) {
    ensureSpace(context, 18);
    context.page.drawRectangle({
      x: MARGIN,
      y: context.y - 13,
      width: CONTENT_WIDTH,
      height: 18,
      color: PALE_BLUE,
    });
    context.page.drawRectangle({ x: MARGIN, y: context.y - 13, width: 3, height: 18, color: CRIMSON });
    if (line) {
      drawText(context.page, line, MARGIN + 14, context.y - 7, 9.5, context.fonts.regular, NAVY);
    }
    context.y -= 18;
  }
  context.y -= 20;
}

function drawMeritHeader(context: PdfContext): void {
  ensureSpace(context, 26);
  context.page.drawRectangle({
    x: MARGIN,
    y: context.y - 22,
    width: CONTENT_WIDTH,
    height: 24,
    color: NAVY,
  });
  drawText(context.page, 'Date', MARGIN + 6, context.y - 14, 7.5, context.fonts.bold, WHITE);
  drawText(context.page, 'Account', MARGIN + 96, context.y - 14, 7.5, context.fonts.bold, WHITE);
  drawText(context.page, 'Change', MARGIN + 180, context.y - 14, 7.5, context.fonts.bold, WHITE);
  drawText(context.page, 'Reason', MARGIN + 240, context.y - 14, 7.5, context.fonts.bold, WHITE);
  context.y -= 24;
}
