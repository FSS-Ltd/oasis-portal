'use client';

import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { useSession } from '@clerk/nextjs';
import { ImageUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const MAX_HOMEWORK_IMAGE_BYTES = 10 * 1024 * 1024;
const HOMEWORK_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'] as const;
const mimeTypeByExtension: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export interface HomeworkImagePayload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

interface HomeworkUploadResponse {
  bucket: string;
  images: (HomeworkImagePayload & { token: string })[];
}

interface HomeworkImageUploadProps {
  assignmentId: string;
  disabled?: boolean;
  label: string;
  onError: (message: string) => void;
  onUploaded: (image: HomeworkImagePayload) => void;
  studentId?: string;
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
  if (!extension) return 'Homework images must be JPEG, PNG, or WebP files.';
  if (mimeTypeForFile(file).toLowerCase() !== mimeTypeByExtension[extension]) {
    return 'The homework image type does not match the file extension.';
  }
  if (file.size > MAX_HOMEWORK_IMAGE_BYTES) return 'Homework images must be 10 MB or less.';
  return null;
}

function hasSignature(fileName: string, bytes: Uint8Array): boolean {
  const extension = fileExtension(fileName);
  if (extension === '.png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === '.webp') {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  }
  return false;
}

async function validateSignature(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return hasSignature(file.name, bytes)
    ? null
    : `${file.name} does not match its selected file type.`;
}

async function uploadHomeworkImage(
  input: { assignmentId: string; file: File; studentId?: string },
  supabase: ReturnType<typeof createClient>,
): Promise<HomeworkImagePayload> {
  const response = await fetch('/api/homework/upload', {
    body: JSON.stringify({
      assignmentId: input.assignmentId,
      files: [
        {
          fileName: input.file.name,
          mimeType: mimeTypeForFile(input.file),
          sizeBytes: input.file.size,
        },
      ],
      studentId: input.studentId,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = (await response.json()) as Partial<HomeworkUploadResponse> & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Homework image could not be prepared.');
  const image = payload.images?.[0];
  if (!payload.bucket || !image) throw new Error('Homework image upload token was not returned.');

  const { error } = await supabase.storage
    .from(payload.bucket)
    .uploadToSignedUrl(image.storagePath, image.token, input.file, {
      contentType: image.mimeType,
    });
  if (error) throw error;

  return {
    fileName: image.fileName,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    storageBucket: image.storageBucket,
    storagePath: image.storagePath,
  };
}

export function HomeworkImageUpload({
  assignmentId,
  disabled = false,
  label,
  onError,
  onUploaded,
  studentId,
}: HomeworkImageUploadProps) {
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      onError(validationError);
      return;
    }

    setUploading(true);
    try {
      const signatureError = await validateSignature(file);
      if (signatureError) {
        onError(signatureError);
        return;
      }
      onUploaded(
        await uploadHomeworkImage(
          {
            assignmentId,
            file,
            ...(studentId ? { studentId } : {}),
          },
          supabase,
        ),
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Homework image could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="homework-upload-control">
      <input
        ref={inputRef}
        accept={HOMEWORK_IMAGE_ACCEPT}
        className="homework-upload-control__input"
        disabled={disabled || uploading}
        onChange={(event) => {
          void handleFileChange(event);
        }}
        type="file"
      />
      <Button
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        pending={uploading}
        type="button"
        variant="secondary"
      >
        <ImageUp aria-hidden="true" size={16} />
        {label}
      </Button>
      <p className="muted">JPEG, PNG, or WebP. Max 10 MB.</p>
    </div>
  );
}
