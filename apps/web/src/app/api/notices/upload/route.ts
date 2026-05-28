import { z } from 'zod';
import { getSupabaseServiceRoleConfig } from '@/lib/supabase/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCallerForRequest } from '../../auth-context';
import { routeErrorResponse } from '../route-errors';

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
    .max(5),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const input = uploadIntentInput.parse(await req.json());
    const caller = await createCallerForRequest(req);
    const prepared = await caller.notice.prepareAttachments({ attachments: input.files });
    const supabase = createAdminClient();
    const { noticeAttachmentsBucket } = getSupabaseServiceRoleConfig();

    const attachments = await Promise.all(
      prepared.attachments.map(async (attachment) => {
        const { data, error } = await supabase.storage
          .from(noticeAttachmentsBucket)
          .createSignedUploadUrl(attachment.storagePath);

        if (error) throw error;

        return {
          ...attachment,
          token: data.token,
        };
      }),
    );

    return Response.json({ bucket: noticeAttachmentsBucket, attachments });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
