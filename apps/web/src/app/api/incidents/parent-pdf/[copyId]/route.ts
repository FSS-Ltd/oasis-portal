import { Buffer } from 'node:buffer';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

interface IncidentParentPdfRouteContext {
  params: Promise<{ copyId: string }>;
}

function contentDisposition(fileName: string): string {
  const safeName = fileName.replace(/["\r\n]/gu, '').trim() || 'incident-report.pdf';
  return `attachment; filename="${safeName}"`;
}

export async function GET(req: Request, context: IncidentParentPdfRouteContext): Promise<Response> {
  try {
    const params = await context.params;
    const caller = await createCallerForRequest(req);
    const result = await caller.incident.downloadParentPdf({ copyId: params.copyId });
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
