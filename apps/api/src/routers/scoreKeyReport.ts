import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { ACTIVE_SCORE_KEY_SCOPES, canViewScoreKeyReport } from '@oasis/domain';
import { loadActiveScoreKeyReport } from '../reports/active-score-keys.js';
import { generateActiveScoreKeysPdf } from '../reports/active-score-keys-pdf.js';
import { router, authedProcedure } from '../trpc.js';

function requireScoreKeyReportAccess(roleUser: Parameters<typeof canViewScoreKeyReport>[0]): void {
  if (!canViewScoreKeyReport(roleUser)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot view active score keys.' });
  }
}

const scopeInput = z.object({ scope: z.enum(ACTIVE_SCORE_KEY_SCOPES) }).optional();

export const scoreKeyReportRouter = router({
  current: authedProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    requireScoreKeyReportAccess(ctx.user);
    return ctx.withRls((tx) => loadActiveScoreKeyReport(tx, input?.scope));
  }),
  downloadPdf: authedProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    requireScoreKeyReportAccess(ctx.user);
    const report = await ctx.withRls((tx) => loadActiveScoreKeyReport(tx, input?.scope));
    const pdf = await generateActiveScoreKeysPdf(report);
    return {
      fileName: pdf.fileName,
      mimeType: pdf.mimeType,
      pdfBase64: Buffer.from(pdf.bytes).toString('base64'),
      generatedAt: report.generatedAt,
    };
  }),
});
