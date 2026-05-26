import { Buffer } from 'node:buffer';
import { createCallerForRequest } from '../../auth-context';
import { routeErrorResponse } from '../route-errors';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Choose a PDF invoice before uploading.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const caller = await createCallerForRequest(req);
    const result = await caller.invoice.uploadDraft({
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      sizeBytes: file.size,
      pdfBase64: bytes.toString('base64'),
    });

    return Response.json({
      invoice: {
        id: result.invoice.id,
        familyLabel: result.invoice.familyLabel,
        invoiceNumber: result.invoice.invoiceNumber,
        issuedOn: result.invoice.issuedOn,
        dueOn: result.invoice.dueOn,
        term: result.invoice.term,
        totalAmountPence: result.invoice.totalAmountPence,
        originalFileName: result.invoice.originalFileName,
        fileSizeBytes: result.invoice.fileSizeBytes,
        lineItems: result.invoice.lineItems.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitAmountPence: line.unitAmountPence,
        })),
      },
      parsed: result.parsed,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
