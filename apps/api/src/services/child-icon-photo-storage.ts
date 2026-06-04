import { TRPCError } from '@trpc/server';

interface ChildIconPhotoStorageConfig {
  serviceRoleKey: string;
  url: string;
}

export interface UploadedChildIconPhoto {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

function requireStorageConfig(): ChildIconPhotoStorageConfig {
  const url =
    process.env['SUPABASE_URL']?.trim() ?? process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();

  if (!url || !serviceRoleKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'child icon photo storage is not configured',
    });
  }

  return { serviceRoleKey, url: url.replace(/\/+$/u, '') };
}

function storageObjectUrl(config: ChildIconPhotoStorageConfig, bucket: string, path: string): URL {
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
  return false;
}

function normalizeContentType(value: string | null): string {
  return value?.split(';')[0]?.trim().toLowerCase() ?? '';
}

async function readStorageObject(
  config: ChildIconPhotoStorageConfig,
  photo: UploadedChildIconPhoto,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(storageObjectUrl(config, photo.storageBucket, photo.storagePath), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'child icon photo upload not found' });
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: normalizeContentType(response.headers.get('content-type')),
  };
}

export async function assertUploadedChildIconPhoto(photo: UploadedChildIconPhoto): Promise<void> {
  const config = requireStorageConfig();
  const { bytes, contentType } = await readStorageObject(config, photo);

  if (bytes.byteLength !== photo.sizeBytes) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'child icon photo size mismatch' });
  }
  if (contentType && contentType !== photo.mimeType) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'child icon photo type mismatch' });
  }
  if (!hasExpectedSignature(photo.mimeType, bytes)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'child icon photo content mismatch' });
  }
}
