import { TRPCError } from '@trpc/server';

interface HomeworkSubmissionStorageConfig {
  serviceRoleKey: string;
  url: string;
}

export interface UploadedHomeworkSubmissionImage {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

export function homeworkSubmissionBucket(): string {
  return process.env['SUPABASE_HOMEWORK_SUBMISSIONS_BUCKET'] ?? 'homework-submissions';
}

function requireStorageConfig(): HomeworkSubmissionStorageConfig {
  const url =
    process.env['SUPABASE_URL']?.trim() ?? process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();

  if (!url || !serviceRoleKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'homework submission storage is not configured',
    });
  }

  return { serviceRoleKey, url: url.replace(/\/+$/u, '') };
}

function storageObjectUrl(
  config: HomeworkSubmissionStorageConfig,
  bucket: string,
  path: string,
): URL {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return new URL(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, config.url);
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function hasExpectedSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/png') {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === 'image/jpeg') return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === 'image/webp') {
    return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP';
  }
  return true;
}

function normalizeContentType(value: string | null): string {
  return value?.split(';')[0]?.trim().toLowerCase() ?? '';
}

async function readStorageObject(
  config: HomeworkSubmissionStorageConfig,
  image: UploadedHomeworkSubmissionImage,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(storageObjectUrl(config, image.storageBucket, image.storagePath), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework submission image not found' });
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: normalizeContentType(response.headers.get('content-type')),
  };
}

export async function assertUploadedHomeworkSubmissionImages(
  images: readonly UploadedHomeworkSubmissionImage[],
): Promise<void> {
  if (images.length === 0) return;
  const config = requireStorageConfig();

  await Promise.all(
    images.map(async (image) => {
      const { bytes, contentType } = await readStorageObject(config, image);

      if (bytes.byteLength !== image.sizeBytes) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework image size mismatch' });
      }
      if (contentType && contentType !== image.mimeType) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework image type mismatch' });
      }
      if (!hasExpectedSignature(image.mimeType, bytes)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'homework image content mismatch' });
      }
    }),
  );
}
