import { createHash, randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export const USER_AGREEMENT_BUCKET = 'user-agreements';
export const MAX_AGREEMENT_PDF_BYTES = 10 * 1024 * 1024;

function storageConfig() {
  const url =
    process.env['SUPABASE_URL']?.trim() || process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();
  if (!url || !key) throw new Error('Agreement storage is not configured.');
  return { url: url.replace(/\/+$/u, ''), key };
}

function objectUrl(path: string): string {
  const { url } = storageConfig();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${url}/storage/v1/object/${USER_AGREEMENT_BUCKET}/${encodedPath}`;
}

function storageHeaders(): Record<string, string> {
  const { key } = storageConfig();
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function validateAgreementPdf(bytes: Uint8Array): Promise<void> {
  if (bytes.length < 5 || bytes.length > MAX_AGREEMENT_PDF_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a PDF under 10 MB.' });
  }
  if (Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'The file is not a PDF.' });
  }
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    if (pdf.getPageCount() === 0) throw new Error('Empty PDF');
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'The PDF is invalid or password protected.',
    });
  }
}

export async function storeAgreementPdf(bytes: Uint8Array, prefix: string): Promise<string> {
  const path = `${prefix}/${randomUUID()}.pdf`;
  const response = await fetch(objectUrl(path), {
    method: 'POST',
    headers: { ...storageHeaders(), 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: Buffer.from(bytes),
  });
  if (!response.ok)
    throw new Error(`Agreement storage upload failed (${String(response.status)}).`);
  return path;
}

export async function readAgreementPdf(path: string): Promise<Uint8Array> {
  const response = await fetch(objectUrl(path), { headers: storageHeaders() });
  if (!response.ok) throw new Error('Agreement PDF could not be read.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 25 * 1024 * 1024) throw new Error('Agreement PDF is too large.');
  return bytes;
}

export async function signedAgreementPdfUrl(path: string, download: boolean): Promise<string> {
  const { url } = storageConfig();
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(
    `${url}/storage/v1/object/sign/${USER_AGREEMENT_BUCKET}/${encodedPath}`,
    {
      method: 'POST',
      headers: { ...storageHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60, ...(download ? { download: true } : {}) }),
    },
  );
  if (!response.ok) throw new Error('Agreement PDF link could not be created.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object') throw new Error('Invalid storage link response.');
  const relative =
    'signedURL' in result ? result.signedURL : 'signedUrl' in result ? result.signedUrl : null;
  if (typeof relative !== 'string') throw new Error('Invalid storage link response.');
  if (relative.startsWith('https://')) return relative;
  return `${url}/storage/v1${relative.startsWith('/') ? relative : `/${relative}`}`;
}

function printable(value: string): string {
  return value.replace(/[^\x20-\x7e\xA0-\xFF]/gu, '?').slice(0, 100);
}

export async function appendAgreementReceipt(
  original: Uint8Array,
  receipt: { signatureId: string; signerName: string; signedAt: Date; method: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original, { ignoreEncryption: false });
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const rows = [
    'Oasis Portal signing receipt',
    `Signature ID: ${receipt.signatureId}`,
    `Signer: ${printable(receipt.signerName)}`,
    `Method: ${receipt.method}`,
    `Recorded: ${receipt.signedAt.toISOString()}`,
    'Verify this record in the Oasis Portal using its signature ID.',
  ];
  rows.forEach((row, index) => {
    page.drawText(row, { x: 48, y: 780 - index * 35, size: index === 0 ? 16 : 11, font });
  });
  return pdf.save();
}
