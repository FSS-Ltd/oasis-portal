import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { createCallerForRequest } from '../../auth-context';
import { routeErrorResponse } from '../../notices/route-errors';

export const runtime = 'nodejs';

const uploadFields = z.object({
  kind: z.enum(['UserAgreement', 'SafeguardingDataAnnex']),
  status: z.enum(['NeedsSigning', 'Signed']),
  recipientIds: z.array(z.string().min(1)).min(1).max(250),
});

function stringField(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

export async function POST(req: Request): Promise<Response> {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'Choose a PDF under 10 MB.' }, { status: 400 });
    }
    const caller = await createCallerForRequest(req);
    const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    if (stringField(form, 'action') === 'recordSigned') {
      const result = await caller.userAgreement.recordSigned({
        requestId: stringField(form, 'requestId'),
        fileName: file.name,
        pdfBase64,
        signedOn: stringField(form, 'signedOn'),
      });
      return Response.json(result);
    }
    let recipientIds: unknown;
    try {
      recipientIds = JSON.parse(stringField(form, 'recipientIds'));
    } catch {
      return Response.json({ error: 'Choose recipients.' }, { status: 400 });
    }
    const fields = uploadFields.safeParse({
      kind: stringField(form, 'kind'),
      status: stringField(form, 'status'),
      recipientIds,
    });
    if (!fields.success)
      return Response.json(
        { error: 'Choose a form type, status, and recipients.' },
        { status: 400 },
      );
    const agreementId = stringField(form, 'agreementId');
    const signedOn = stringField(form, 'signedOn');
    const result = await caller.userAgreement.create({
      title: stringField(form, 'title'),
      kind: fields.data.kind,
      fileName: file.name,
      pdfBase64,
      recipientIds: fields.data.recipientIds,
      status: fields.data.status,
      ...(agreementId ? { agreementId } : {}),
      ...(signedOn ? { signedOn } : {}),
    });
    return Response.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Agreement upload failed.');
  }
}
