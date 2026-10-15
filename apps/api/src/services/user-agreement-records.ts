import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { canUseComplianceAdminTag, ROLES, type Role } from '@oasis/domain';
import type { AppContext } from '../context.js';
import {
  AGREEMENT_ACKNOWLEDGEMENT,
  newAgreementSignatureId,
  sealAgreementEvidence,
  verifyAgreementEvidence,
  type AgreementEvidence,
} from '../services/user-agreement-seal.js';
import {
  appendAgreementReceipt,
  readAgreementPdf,
  sha256,
  storeAgreementPdf,
} from '../services/user-agreement-storage.js';

export const idInput = z.object({ requestId: z.string().min(1) });
export const pdfInput = z.string().min(1).max(14_000_000);
export const kindInput = z.enum(['UserAgreement', 'SafeguardingDataAnnex']);
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Enter a valid signing date.');
export const createInput = z.object({
  agreementId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(160),
  kind: kindInput,
  fileName: z.string().trim().min(1).max(255),
  pdfBase64: pdfInput,
  recipientIds: z.array(z.string().min(1)).min(1).max(250),
  status: z.enum(['NeedsSigning', 'Signed']),
  signedOn: dateInput.optional(),
});
export const filterInput = z.object({
  page: z.number().int().min(1).default(1),
  search: z.string().trim().max(100).default(''),
  kind: kindInput.optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['NeedsSigning', 'Signed', 'Superseded']).optional(),
});
export const pageSize = 25;

export function bytesFromBase64(value: string): Uint8Array {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid PDF upload.' });
  }
  return bytes;
}

export async function recipientsFor(ctx: AppContext, ids: readonly string[]) {
  if (new Set(ids).size !== ids.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose each recipient once.' });
  }
  const users = await ctx.db.user.findMany({
    where: { id: { in: [...ids] }, active: true, role: { not: 'Student' } },
    select: { id: true, fullNameEnc: true },
  });
  if (users.length !== ids.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'A selected recipient is unavailable.' });
  }
  return users;
}

export async function requestFor(
  ctx: AppContext & { user: { id: string; role: Role } },
  requestId: string,
) {
  const request = await ctx.withRls((tx) =>
    tx.userAgreementRequest.findUnique({
      where: { id: requestId },
      include: { version: { include: { agreement: true } }, signature: true, delivery: true },
    }),
  );
  if (
    !request ||
    (ctx.user.role !== 'Head' &&
      !canUseComplianceAdminTag(ctx.user) &&
      request.recipientId !== ctx.user.id)
  ) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Agreement not found.' });
  }
  return request;
}

export function mapRequest(ctx: AppContext, row: Awaited<ReturnType<typeof requestFor>>) {
  return {
    id: row.id,
    recipientId: row.recipientId,
    status: row.status,
    openedAt: row.openedAt,
    createdAt: row.createdAt,
    title: ctx.db.$enc.decrypt(row.version.agreement.titleEnc),
    kind: row.version.agreement.kind,
    version: row.version.version,
    agreementId: row.version.agreementId,
    fileName: ctx.db.$enc.decrypt(row.version.originalFileNameEnc),
    signatureId: row.signature?.id ?? null,
    signatureMethod: row.signature?.method ?? null,
    hasManualSource: Boolean(row.signature?.manualSourcePath),
    signedAt: row.signature?.signedAt ?? null,
    declaredSignedOn: row.signature?.declaredSignedOn ?? null,
    emailStatus: row.delivery?.status ?? null,
  };
}

export async function verifyRequestEvidence(
  ctx: AppContext,
  request: Awaited<ReturnType<typeof requestFor>>,
): Promise<boolean> {
  const signature = request.signature;
  if (!signature) return false;
  const raw = ctx.db.$enc.decrypt(signature.evidenceEnc);
  const evidence = JSON.parse(raw) as AgreementEvidence;
  const [original, completed, manual] = await Promise.all([
    readAgreementPdf(request.version.storagePath),
    readAgreementPdf(signature.completedStoragePath),
    signature.manualSourcePath
      ? readAgreementPdf(signature.manualSourcePath)
      : Promise.resolve(undefined),
  ]);
  return (
    evidence.signatureId === signature.id &&
    evidence.requestId === request.id &&
    evidence.recipientId === request.recipientId &&
    evidence.actorId === signature.signedById &&
    evidence.method === signature.method &&
    evidence.signedAt === signature.signedAt.toISOString() &&
    evidence.openedAt === (request.openedAt?.toISOString() ?? null) &&
    evidence.declaredSignedOn ===
      (signature.declaredSignedOn?.toISOString().slice(0, 10) ?? null) &&
    evidence.acknowledgementVersion === (signature.method === 'Portal' ? 1 : null) &&
    evidence.acknowledgement ===
      (signature.method === 'Portal' ? AGREEMENT_ACKNOWLEDGEMENT : null) &&
    evidence.originalSha256 === request.version.sha256 &&
    evidence.completedSha256 === signature.completedSha256 &&
    Boolean(evidence.manualSourceSha256) === Boolean(signature.manualSourcePath) &&
    verifyAgreementEvidence(
      evidence,
      signature.signingKeyId,
      signature.seal,
      original,
      completed,
      manual,
    )
  );
}

export async function signedEvidence(
  ctx: AppContext,
  input: {
    requestId: string;
    recipientId: string;
    actorId: string;
    typedName: string;
    method: 'Portal' | 'HeadRecorded';
    openedAt: Date | null;
    declaredSignedOn: string | null;
    originalSha256: string;
    receiptSource: Uint8Array;
    manualSourcePath: string | null;
  },
) {
  const signatureId = newAgreementSignatureId();
  const signedAt = new Date();
  const completed = await appendAgreementReceipt(input.receiptSource, {
    signatureId,
    signerName: input.typedName,
    signedAt,
    method: input.method === 'Portal' ? 'Signed electronically' : 'Recorded by administrator',
  });
  const completedSha256 = sha256(completed);
  const evidence: AgreementEvidence = {
    schemaVersion: 1,
    signatureId,
    requestId: input.requestId,
    recipientId: input.recipientId,
    actorId: input.actorId,
    method: input.method,
    typedName: input.typedName,
    acknowledgementVersion: input.method === 'Portal' ? 1 : null,
    acknowledgement: input.method === 'Portal' ? AGREEMENT_ACKNOWLEDGEMENT : null,
    openedAt: input.openedAt?.toISOString() ?? null,
    signedAt: signedAt.toISOString(),
    declaredSignedOn: input.declaredSignedOn,
    originalSha256: input.originalSha256,
    completedSha256,
    manualSourceSha256: input.manualSourcePath ? sha256(input.receiptSource) : null,
  };
  const { keyId, seal } = sealAgreementEvidence(evidence);
  const completedStoragePath = await storeAgreementPdf(completed, 'completed');
  return {
    id: signatureId,
    method: input.method,
    signedById: input.actorId,
    signedAt,
    declaredSignedOn: input.declaredSignedOn
      ? new Date(`${input.declaredSignedOn}T00:00:00.000Z`)
      : null,
    manualSourcePath: input.manualSourcePath,
    completedStoragePath,
    completedSha256,
    evidenceEnc: ctx.db.$enc.encrypt(JSON.stringify(evidence)),
    seal,
    signingKeyId: keyId,
  };
}
