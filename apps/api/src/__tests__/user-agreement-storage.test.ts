import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  MAX_AGREEMENT_PDF_BYTES,
  validateAgreementPdf,
} from '../services/user-agreement-storage.js';

describe('agreement PDF validation', () => {
  it('accepts a readable PDF and rejects malformed or oversized uploads', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    await expect(validateAgreementPdf(await pdf.save())).resolves.toBeUndefined();
    await expect(validateAgreementPdf(Buffer.from('%PDF-not-a-real-document'))).rejects.toThrow(
      'invalid or password protected',
    );
    await expect(validateAgreementPdf(Buffer.alloc(MAX_AGREEMENT_PDF_BYTES + 1))).rejects.toThrow(
      'under 10 MB',
    );
  });
});
