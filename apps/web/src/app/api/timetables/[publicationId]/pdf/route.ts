import { Buffer } from 'node:buffer';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

interface TimetablePdfRouteContext {
  params: Promise<{ publicationId: string }>;
}

function contentDisposition(fileName: string): string {
  const leafName = fileName.replaceAll('\\', '/').split('/').pop();
  const safeName = leafName?.replace(/[\0"\r\n]/gu, '').trim() || 'student-timetable.pdf';
  return `attachment; filename="${safeName}"`;
}

export async function GET(request: Request, context: TimetablePdfRouteContext): Promise<Response> {
  try {
    const { publicationId } = await context.params;
    const caller = await createCallerForRequest(request);
    const result = await caller.timetable.downloadPdf({ publicationId });
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
