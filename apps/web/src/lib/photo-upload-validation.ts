const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'] as const;

const mimeTypeByExtension: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function fileExtension(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  return allowedExtensions.find((extension) => lowerName.endsWith(extension)) ?? '';
}

export function photoMimeTypeForFile(file: File): string {
  if (file.type) return file.type;
  return mimeTypeByExtension[fileExtension(file.name)] ?? 'application/octet-stream';
}

export function validatePhotoFile(file: File): string | null {
  const extension = fileExtension(file.name);
  if (!extension) return 'Photos must be JPEG, PNG, or WebP files.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photos must be 5 MB or less.';
  return null;
}

function hasPhotoSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  }
  return false;
}

export async function validatePhotoFileSignature(file: File): Promise<string | null> {
  const mimeType = photoMimeTypeForFile(file);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasPhotoSignature(mimeType, bytes)) {
    return `${file.name} does not match its selected file type.`;
  }
  return null;
}
