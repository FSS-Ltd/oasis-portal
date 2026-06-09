'use client';

import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { useSession } from '@clerk/nextjs';
import { Download, Eye, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp';

const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'] as const;
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'] as const;
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const wordSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const mimeTypeByExtension: Record<string, string> = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export interface NoticeAttachmentPayload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
}

export interface NoticeAttachmentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'pdf' | 'document';
  canPreview: boolean;
}

interface UploadResponse {
  bucket: string;
  attachments: (NoticeAttachmentPayload & { token: string })[];
}

interface NoticeAttachmentPickerProps {
  attachments: NoticeAttachmentPayload[];
  disabled: boolean;
  onAttachmentsChange: (attachments: NoticeAttachmentPayload[]) => void;
  onError: (message: string) => void;
}

function fileExtension(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  return allowedExtensions.find((extension) => lowerName.endsWith(extension)) ?? '';
}

function isImageExtension(extension: string): boolean {
  return imageExtensions.some((imageExtension) => imageExtension === extension);
}

function mimeTypeForFile(file: File): string {
  if (file.type) return file.type;
  return mimeTypeByExtension[fileExtension(file.name)] ?? 'application/octet-stream';
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024)).toString()} KB`;
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function validateFiles(
  existing: readonly NoticeAttachmentPayload[],
  files: readonly File[],
): string | null {
  if (existing.length + files.length > MAX_ATTACHMENTS) {
    return `Attach up to ${String(MAX_ATTACHMENTS)} files per notice.`;
  }

  const existingBytes = existing.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
  const selectedBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (existingBytes + selectedBytes > MAX_TOTAL_BYTES) {
    return 'Attachments must be 25 MB or less in total.';
  }

  for (const file of files) {
    const extension = fileExtension(file.name);
    if (!extension) {
      return 'Attachments must be PDF, Word, JPEG, PNG, or WebP files.';
    }
    const maxBytes = isImageExtension(extension) ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
    if (file.size > maxBytes) {
      return isImageExtension(extension)
        ? 'Images must be 5 MB or less.'
        : 'PDF and Word files must be 10 MB or less.';
    }
  }

  return null;
}

function hasSignature(fileName: string, bytes: Uint8Array): boolean {
  const extension = fileExtension(fileName);
  if (extension === '.pdf') {
    return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  }
  if (extension === '.png') {
    return bytesStartWith(bytes, pngSignature);
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
  if (extension === '.doc') {
    return bytesStartWith(bytes, wordSignature);
  }
  if (extension === '.docx') {
    return bytes[0] === 0x50 && bytes[1] === 0x4b;
  }
  return false;
}

async function validateFileSignatures(files: readonly File[]): Promise<string | null> {
  for (const file of files) {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!hasSignature(file.name, bytes)) {
      return `${file.name} does not match its selected file type.`;
    }
  }

  return null;
}

async function uploadFiles(
  files: readonly File[],
  supabase: ReturnType<typeof createClient>,
): Promise<NoticeAttachmentPayload[]> {
  const response = await fetch('/api/notices/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: files.map((file) => ({
        fileName: file.name,
        mimeType: mimeTypeForFile(file),
        sizeBytes: file.size,
      })),
    }),
  });
  const payload = (await response.json()) as Partial<UploadResponse> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Attachments could not be prepared.');
  }
  if (!payload.bucket || !payload.attachments) return [];

  const uploaded: NoticeAttachmentPayload[] = [];
  for (const [index, attachment] of payload.attachments.entries()) {
    const file = files[index];
    if (!file) throw new Error('Attachment upload could not be matched to a selected file.');

    const { error } = await supabase.storage
      .from(payload.bucket)
      .uploadToSignedUrl(attachment.storagePath, attachment.token, file, {
        contentType: attachment.mimeType,
      });
    if (error) throw error;

    uploaded.push({
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      storageBucket: attachment.storageBucket,
      storagePath: attachment.storagePath,
    });
  }

  return uploaded;
}

export function NoticeAttachmentPicker({
  attachments,
  disabled,
  onAttachmentsChange,
  onError,
}: NoticeAttachmentPickerProps) {
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

  async function handleFiles(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const validationError = validateFiles(attachments, files);
    if (validationError) {
      onError(validationError);
      return;
    }

    setUploading(true);
    try {
      const signatureError = await validateFileSignatures(files);
      if (signatureError) {
        onError(signatureError);
        return;
      }
      const uploaded = await uploadFiles(files, supabase);
      onAttachmentsChange([...attachments, ...uploaded]);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Attachments could not be prepared.');
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(index: number): void {
    onAttachmentsChange(attachments.filter((_, attachmentIndex) => attachmentIndex !== index));
  }

  return (
    <div className="noticeboard-attachment-picker">
      <input
        ref={inputRef}
        accept={ATTACHMENT_ACCEPT}
        className="noticeboard-attachment-picker__input"
        disabled={disabled || uploading || attachments.length >= MAX_ATTACHMENTS}
        multiple
        onChange={(event) => {
          void handleFiles(event);
        }}
        type="file"
      />
      <Button
        disabled={disabled || uploading || attachments.length >= MAX_ATTACHMENTS}
        onClick={() => inputRef.current?.click()}
        pending={uploading}
        type="button"
        variant="secondary"
      >
        <Paperclip aria-hidden="true" size={16} />
        Add attachments
      </Button>
      <p className="muted">
        PDF, Word, JPEG, PNG, or WebP. Images up to 5 MB. Other files up to 10 MB.
      </p>
      {attachments.length > 0 ? (
        <ul className="noticeboard-attachment-list">
          {attachments.map((attachment, index) => (
            <li
              className="noticeboard-attachment-list__item"
              key={`${attachment.fileName}-${String(index)}`}
            >
              <span>
                <Paperclip aria-hidden="true" size={15} />
                <span>{attachment.fileName}</span>
                <small>{formatBytes(attachment.sizeBytes)}</small>
              </span>
              <button
                aria-label={`Remove ${attachment.fileName}`}
                disabled={disabled || uploading}
                onClick={() => {
                  removeAttachment(index);
                }}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function NoticeAttachmentLinks({
  attachments,
  onViewAttachment,
}: {
  attachments: readonly NoticeAttachmentMeta[];
  onViewAttachment?: (() => void) | undefined;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="noticeboard-attachment-links" aria-label="Notice attachments">
      {attachments.map((attachment) => {
        const href = `/api/notices/attachments/${attachment.id}`;
        return (
          <div className="noticeboard-attachment-link" key={attachment.id}>
            <span>
              <Paperclip aria-hidden="true" size={15} />
              <span>{attachment.fileName}</span>
              <small>{formatBytes(attachment.sizeBytes)}</small>
            </span>
            <span className="noticeboard-attachment-link__actions">
              {attachment.canPreview ? (
                <a
                  className="button button--secondary button--sm"
                  href={href}
                  onClick={onViewAttachment}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye aria-hidden="true" size={14} />
                  View
                </a>
              ) : null}
              <a className="button button--secondary button--sm" href={`${href}?download=1`}>
                <Download aria-hidden="true" size={14} />
                Download
              </a>
            </span>
          </div>
        );
      })}
    </div>
  );
}
