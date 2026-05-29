import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCallerForRequest } from '../../../auth-context';
import { routeErrorResponse } from '../../../notices/route-errors';

export const runtime = 'nodejs';

const uploadIntentInput = z.object({
  file: z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.number().int().positive(),
  }),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const input = uploadIntentInput.parse(await req.json());
    const caller = await createCallerForRequest(req);
    const photo = await caller.shop.prepareItemPhotoUpload({ photo: input.file });
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(photo.storageBucket)
      .createSignedUploadUrl(photo.storagePath);

    if (error) throw error;

    return Response.json({
      bucket: photo.storageBucket,
      photo: {
        ...photo,
        token: data.token,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
