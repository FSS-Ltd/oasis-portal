import { TRPCError } from '@trpc/server';

interface NoticeAttachmentStorageConfig {
  serviceRoleKey: string;
  url: string;
}

export interface UploadedNoticeAttachment {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

function requireStorageConfig(): NoticeAttachmentStorageConfig {
  const url =
    process.env['SUPABASE_URL']?.trim() ?? process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();

  if (!url || !serviceRoleKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'notice attachment storage is not configured',
    });
  }

  return { serviceRoleKey, url: url.replace(/\/+$/u, '') };
}

function storageObjectUrl(
  config: NoticeAttachmentStorageConfig,
  bucket: string,
  path: string,
): URL {
  const encodedPath = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return new URL(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, config.url);
}

function fileExtension(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  return (
    ['.docx', '.doc', '.jpeg', '.jpg', '.pdf', '.png', '.webp'].find((extension) =>
      lowerName.endsWith(extension),
    ) ?? ''
  );
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function hasExpectedSignature(fileName: string, bytes: Uint8Array): boolean {
  const extension = fileExtension(fileName);

  if (extension === '.pdf') return ascii(bytes, 0, 5) === '%PDF-';
  if (extension === '.png') {
    return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (extension === '.webp') return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP';
  if (extension === '.doc') {
    return bytesStartWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (extension === '.docx') return bytesStartWith(bytes, [0x50, 0x4b]);

  return false;
}

function normalizeContentType(value: string | null): string {
  return value?.split(';')[0]?.trim().toLowerCase() ?? '';
}

async function readStorageObject(
  config: NoticeAttachmentStorageConfig,
  attachment: UploadedNoticeAttachment,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(
    storageObjectUrl(config, attachment.storageBucket, attachment.storagePath),
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachment upload not found' });
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: normalizeContentType(response.headers.get('content-type')),
  };
}

export async function assertUploadedNoticeAttachments(
  attachments: readonly UploadedNoticeAttachment[],
): Promise<void> {
  if (attachments.length === 0) return;

  const config = requireStorageConfig();

  await Promise.all(
    attachments.map(async (attachment) => {
      const { bytes, contentType } = await readStorageObject(config, attachment);

      if (bytes.byteLength !== attachment.sizeBytes) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachment size mismatch' });
      }
      if (contentType && contentType !== attachment.mimeType) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachment type mismatch' });
      }
      if (!hasExpectedSignature(attachment.originalFileName, bytes)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'notice attachment content mismatch' });
      }
    }),
  );
}
