'use client';

import { type ChangeEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { useSession } from '@clerk/nextjs';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  photoMimeTypeForFile,
  validatePhotoFile,
  validatePhotoFileSignature,
} from '@/lib/photo-upload-validation';
import { createClient } from '@/lib/supabase/client';

const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

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
        mimeType: photoMimeTypeForFile(file),
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

    const validationError = validatePhotoFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    setUploading(true);
    try {
      const signatureError = await validatePhotoFileSignature(file);
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
