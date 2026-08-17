import { Buffer } from 'node:buffer';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

interface ReportPdfRouteContext {
  params: Promise<{ reportId: string }>;
}

function contentDisposition(fileName: string): string {
  const leafName = fileName.replaceAll('\\', '/').split('/').pop();
  const safeName = leafName?.replace(/[\0"\r\n]/gu, '').trim() || 'student-report.pdf';
  return `attachment; filename="${safeName}"`;
}

export async function GET(req: Request, context: ReportPdfRouteContext): Promise<Response> {
  try {
    const params = await context.params;
    const caller = await createCallerForRequest(req);
    const result = await caller.report.downloadPdf({ reportId: params.reportId });
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
