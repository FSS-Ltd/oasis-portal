import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { canViewScoreKeyReport } from '@oasis/domain';
import { loadActiveScoreKeyReport } from '../reports/active-score-keys.js';
import { generateActiveScoreKeysPdf } from '../reports/active-score-keys-pdf.js';
import { router, authedProcedure } from '../trpc.js';

function requireScoreKeyReportAccess(roleUser: Parameters<typeof canViewScoreKeyReport>[0]): void {
  if (!canViewScoreKeyReport(roleUser)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot view active score keys.' });
  }
}

export const scoreKeyReportRouter = router({
  current: authedProcedure.query(async ({ ctx }) => {
    requireScoreKeyReportAccess(ctx.user);
    return ctx.withRls(loadActiveScoreKeyReport);
  }),
  downloadPdf: authedProcedure.query(async ({ ctx }) => {
    requireScoreKeyReportAccess(ctx.user);
    const report = await ctx.withRls(loadActiveScoreKeyReport);
    const pdf = await generateActiveScoreKeysPdf(report);
    return {
      fileName: pdf.fileName,
      mimeType: pdf.mimeType,
      pdfBase64: Buffer.from(pdf.bytes).toString('base64'),
      generatedAt: report.generatedAt,
    };
  }),
});
