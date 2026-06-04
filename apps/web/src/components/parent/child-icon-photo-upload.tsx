'use client';

import { type ChangeEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { useSession } from '@clerk/nextjs';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'] as const;
const mimeTypeByExtension: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export interface ChildIconPhotoUploadPayload {
  fileName: string;
  mimeType: string;
  publicUrl: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

interface UploadResponse {
  bucket: string;
  photo: ChildIconPhotoUploadPayload & { token: string };
}

interface ChildIconPhotoUploadButtonProps {
  children?: ReactNode;
  disabled?: boolean;
  onError: (message: string) => void;
  onUploaded: (photo: ChildIconPhotoUploadPayload) => Promise<void> | void;
  studentId: string;
}

function fileExtension(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  return allowedExtensions.find((extension) => lowerName.endsWith(extension)) ?? '';
}

function mimeTypeForFile(file: File): string {
  if (file.type) return file.type;
  return mimeTypeByExtension[fileExtension(file.name)] ?? 'application/octet-stream';
}

function validateFile(file: File): string | null {
  const extension = fileExtension(file.name);
  if (!extension) return 'Photos must be JPEG, PNG, or WebP files.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photos must be 5 MB or less.';
  return null;
}

function hasSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/webp') {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  }
  return false;
}

async function validateFileSignature(file: File): Promise<string | null> {
  const mimeType = mimeTypeForFile(file);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasSignature(mimeType, bytes)) return `${file.name} does not match its selected file type.`;
  return null;
}

async function uploadPhoto(
  file: File,
  studentId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<ChildIconPhotoUploadPayload> {
  const response = await fetch('/api/student-settings/child-icon/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: {
        fileName: file.name,
        mimeType: mimeTypeForFile(file),
        sizeBytes: file.size,
      },
      studentId,
    }),
  });
  const payload = (await response.json()) as Partial<UploadResponse> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Photo could not be prepared.');
  }
  if (!payload.bucket || !payload.photo) {
    throw new Error('Photo upload could not be prepared.');
  }

  const { error } = await supabase.storage
    .from(payload.bucket)
    .uploadToSignedUrl(payload.photo.storagePath, payload.photo.token, file, {
      contentType: payload.photo.mimeType,
    });
  if (error) throw error;

  return {
    fileName: payload.photo.fileName,
    mimeType: payload.photo.mimeType,
    publicUrl: payload.photo.publicUrl,
    sizeBytes: payload.photo.sizeBytes,
    storageBucket: payload.photo.storageBucket,
    storagePath: payload.photo.storagePath,
  };
}

export function ChildIconPhotoUploadButton({
  children = 'Upload photo',
  disabled = false,
  onError,
  onUploaded,
  studentId,
}: ChildIconPhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const { session } = useSession();
  const supabase = useMemo(
    () =>
      createClient({
        accessToken: async () => session?.getToken() ?? null,
      }),
    [session],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    setUploading(true);
    try {
      const signatureError = await validateFileSignature(file);
      if (signatureError) {
        onError(signatureError);
        return;
      }
      await onUploaded(await uploadPhoto(file, studentId, supabase));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Photo could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        accept={PHOTO_ACCEPT}
        className="child-icon-photo-upload__input"
        disabled={disabled || uploading}
        onChange={(event) => {
          void handleFile(event);
        }}
        type="file"
      />
      <Button
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        pending={uploading}
        size="sm"
        type="button"
        variant="secondary"
      >
        <Camera aria-hidden="true" size={15} />
        {children}
      </Button>
    </>
  );
}
