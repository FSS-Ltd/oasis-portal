import { Buffer } from 'node:buffer';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../route-errors';

interface InvoicePdfRouteContext {
  params: Promise<{ id: string }>;
}

function contentDisposition(fileName: string): string {
  const safeName = fileName.replace(/["\r\n]/gu, '').trim() || 'invoice.pdf';
  return `attachment; filename="${safeName}"`;
}

export async function GET(req: Request, context: InvoicePdfRouteContext): Promise<Response> {
  try {
    const params = await context.params;
    const caller = await createCallerForRequest(req);
    const result = await caller.invoice.downloadPdf({ invoiceId: params.id });
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
