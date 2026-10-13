import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { agreementRecipientProcedure, router } from '../trpc.js';
import {
  idInput,
  mapRequest,
  requestFor,
  signedEvidence,
  verifyRequestEvidence,
} from '../services/user-agreement-records.js';
import {
  readAgreementPdf,
  sha256,
  signedAgreementPdfUrl,
} from '../services/user-agreement-storage.js';

export const userAgreementRecipientRouter = router({
  mine: agreementRecipientProcedure.query(async ({ ctx }) => {
    const rows = await ctx.withRls((tx) =>
      tx.userAgreementRequest.findMany({
        where: { recipientId: ctx.user.id },
        include: { version: { include: { agreement: true } }, signature: true, delivery: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map((row) => mapRequest(ctx, row));
  }),

  pendingCount: agreementRecipientProcedure.query(({ ctx }) =>
    ctx.withRls((tx) =>
      tx.userAgreementRequest.count({
        where: { recipientId: ctx.user.id, status: 'NeedsSigning' },
      }),
    ),
  ),

  open: agreementRecipientProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const request = await requestFor(ctx, input.requestId);
    const url = await signedAgreementPdfUrl(request.version.storagePath, false);
    if (
      request.recipientId === ctx.user.id &&
      request.status === 'NeedsSigning' &&
      !request.openedAt
    ) {
      await ctx.withRls((tx) =>
        tx.userAgreementRequest.updateMany({
          where: {
            id: request.id,
            recipientId: ctx.user.id,
            openedAt: null,
            status: 'NeedsSigning',
          },
          data: { openedAt: new Date() },
        }),
      );
    }
    return { url, opened: request.recipientId === ctx.user.id };
  }),

  sign: agreementRecipientProcedure
    .input(
      idInput.extend({
        fullName: z.string().trim().min(1).max(160),
        acknowledged: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await requestFor(ctx, input.requestId);
      if (request.recipientId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      if (request.signature) return mapRequest(ctx, request);
      if (request.status !== 'NeedsSigning' || !request.openedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Open the current form before signing.',
        });
      }
      const original = await readAgreementPdf(request.version.storagePath);
      if (sha256(original) !== request.version.sha256)
        throw new Error('Agreement PDF failed integrity check.');
      const signature = await signedEvidence(ctx, {
        requestId: request.id,
        recipientId: request.recipientId,
        actorId: ctx.user.id,
        typedName: input.fullName,
        method: 'Portal',
        openedAt: request.openedAt,
        declaredSignedOn: null,
        originalSha256: request.version.sha256,
        receiptSource: original,
        manualSourcePath: null,
      });
      await ctx.withRls(async (tx) => {
        const claim = await tx.userAgreementRequest.updateMany({
          where: {
            id: request.id,
            recipientId: ctx.user.id,
            status: 'NeedsSigning',
            openedAt: { not: null },
          },
          data: { status: 'Signed' },
        });
        if (claim.count === 0) return;
        await tx.userAgreementSignature.create({ data: { ...signature, requestId: request.id } });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'UserAgreementSignature',
            entityId: signature.id,
            meta: { requestId: request.id, method: 'Portal' },
          },
        });
      });
      return mapRequest(ctx, await requestFor(ctx, request.id));
    }),

  download: agreementRecipientProcedure
    .input(idInput.extend({ copy: z.enum(['original', 'completed', 'manual']) }))
    .query(async ({ ctx, input }) => {
      const request = await requestFor(ctx, input.requestId);
      const path =
        input.copy === 'original'
          ? request.version.storagePath
          : input.copy === 'manual'
            ? request.signature?.manualSourcePath
            : request.signature?.completedStoragePath;
      if (!path) throw new TRPCError({ code: 'NOT_FOUND', message: 'PDF copy not found.' });
      if (input.copy === 'original') {
        if (sha256(await readAgreementPdf(path)) !== request.version.sha256) {
          throw new Error('Agreement PDF failed integrity check.');
        }
      } else if (!(await verifyRequestEvidence(ctx, request))) {
        throw new Error('Agreement signing record failed verification.');
      }
      return { url: await signedAgreementPdfUrl(path, true) };
    }),

  verify: agreementRecipientProcedure.input(idInput).query(async ({ ctx, input }) => {
    const request = await requestFor(ctx, input.requestId);
    const signature = request.signature;
    if (!signature) throw new TRPCError({ code: 'NOT_FOUND', message: 'Signature not found.' });
    return {
      signatureId: signature.id,
      valid: await verifyRequestEvidence(ctx, request),
    };
  }),
});
