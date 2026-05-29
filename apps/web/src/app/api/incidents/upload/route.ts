import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCallerForRequest } from '../../auth-context';
import { routeErrorResponse } from '../../notices/route-errors';

export const runtime = 'nodejs';

const uploadIntentInput = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(120),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(10),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const input = uploadIntentInput.parse(await req.json());
    const caller = await createCallerForRequest(req);
    const prepared = await caller.incident.prepareAttachments({ attachments: input.files });
    const supabase = createAdminClient();

    const attachments = await Promise.all(
      prepared.attachments.map(async (attachment) => {
        const { data, error } = await supabase.storage
          .from(prepared.bucket)
          .createSignedUploadUrl(attachment.storagePath);

        if (error) throw error;

        return {
          ...attachment,
          token: data.token,
        };
      }),
    );

    return Response.json({ bucket: prepared.bucket, attachments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
