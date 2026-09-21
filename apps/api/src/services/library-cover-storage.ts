import { TRPCError } from '@trpc/server';

export interface LibraryCoverUpload {
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

function config() {
  const url =
    process.env['SUPABASE_URL']?.trim() ?? process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();
  if (!url || !serviceRoleKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'library cover storage is not configured',
    });
  }
  return { serviceRoleKey, url: url.replace(/\/+$/u, '') };
}

function objectUrl(baseUrl: string, bucket: string, path: string, isPublic = false): URL {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const prefix = isPublic ? '/storage/v1/object/public/' : '/storage/v1/object/';
  return new URL(`${prefix}${encodeURIComponent(bucket)}/${encodedPath}`, baseUrl);
}

function hasExpectedSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/png')
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v);
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return (
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  );
}

export function libraryCoverBucket(): string {
  return process.env['SUPABASE_LIBRARY_BOOK_COVERS_BUCKET'] ?? 'library-book-covers';
}

export function libraryCoverPublicUrl(
  cover: Pick<LibraryCoverUpload, 'storageBucket' | 'storagePath'>,
): string {
  const { url } = config();
  return objectUrl(url, cover.storageBucket, cover.storagePath, true).toString();
}

export async function assertUploadedLibraryCover(cover: LibraryCoverUpload): Promise<void> {
  const { serviceRoleKey, url } = config();
  const response = await fetch(objectUrl(url, cover.storageBucket, cover.storagePath), {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!response.ok)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'library cover upload not found' });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (
    bytes.byteLength !== cover.sizeBytes ||
    (contentType && contentType !== cover.mimeType) ||
    !hasExpectedSignature(cover.mimeType, bytes)
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'library cover upload is invalid' });
  }
}

export async function deleteLibraryCover(
  cover: Pick<LibraryCoverUpload, 'storageBucket' | 'storagePath'>,
): Promise<void> {
  const { serviceRoleKey, url } = config();
  await fetch(objectUrl(url, cover.storageBucket, cover.storagePath), {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    method: 'DELETE',
  });
}
