import { Buffer } from 'node:buffer';
import { createCallerForRequest } from '../../auth-context';
import { routeErrorResponse } from '../route-errors';

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'invoice PDF file is required' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const caller = await createCallerForRequest(req);
    const result = await caller.invoice.uploadDraft({
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      sizeBytes: file.size,
      pdfBase64: bytes.toString('base64'),
    });

    return Response.json(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
