import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { ACTIVE_SCORE_KEY_SCOPES } from '@oasis/domain';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

export const dynamic = 'force-dynamic';

function contentDisposition(fileName: string): string {
  const safeName = fileName.replace(/[\\/\0"\r\n]/gu, '-').trim() || 'active-score-keys.pdf';
  return `inline; filename="${safeName}"`;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const scope = z
      .enum(ACTIVE_SCORE_KEY_SCOPES)
      .parse(new URL(request.url).searchParams.get('scope') ?? 'all');
    const caller = await createCallerForRequest(request);
    const result = await caller.report.scoreKeys.downloadPdf({ scope });
    const bytes = Buffer.from(result.pdfBase64, 'base64');
    return new Response(bytes, {
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': contentDisposition(result.fileName),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
