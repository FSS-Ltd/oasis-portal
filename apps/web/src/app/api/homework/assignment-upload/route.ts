import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCallerForRequest } from '../../auth-context';
import { routeErrorResponse } from '../../notices/route-errors';

export const runtime = 'nodejs';

const uploadIntentInput = z.object({
  assignmentId: z.string().min(1),
  files: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(120),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(1),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const input = uploadIntentInput.parse(await req.json());
    const caller = await createCallerForRequest(req);
    const prepared = await caller.homework.prepareAssignmentImageUpload(input);
    const supabase = createAdminClient();

    const images = await Promise.all(
      prepared.images.map(async (image) => {
        const { data, error } = await supabase.storage
          .from(prepared.bucket)
          .createSignedUploadUrl(image.storagePath);

        if (error) throw error;

        return { ...image, token: data.token };
      }),
    );

    return Response.json({ bucket: prepared.bucket, images });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
