import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { logOperationalEvent } from '../lib/observability.js';
import { deliverUserAgreementRequests } from '../services/user-agreement-delivery.js';
import {
  readAgreementPdf,
  sha256,
  storeAgreementPdf,
  validateAgreementPdf,
} from '../services/user-agreement-storage.js';
import {
  bytesFromBase64,
  createInput,
  dateInput,
  filterInput,
  idInput,
  mapRequest,
  pageSize,
  pdfInput,
  recipientsFor,
  requestFor,
  signedEvidence,
} from '../services/user-agreement-records.js';
import { complianceAdminProcedure, router } from '../trpc.js';

export const userAgreementAdminRouter = router({
  people: complianceAdminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: { active: true, role: { not: 'Student' } },
      select: { id: true, role: true, fullNameEnc: true },
    });
    return users
      .map((user) => ({
        id: user.id,
        role: user.role,
        name: ctx.db.$enc.decrypt(user.fullNameEnc),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }),

  documents: complianceAdminProcedure.query(async ({ ctx }) => {
    const docs = await ctx.withRls((tx) =>
      tx.userAgreement.findMany({
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return docs.map((doc) => ({
      id: doc.id,
      title: ctx.db.$enc.decrypt(doc.titleEnc),
      kind: doc.kind,
      latestVersionId: doc.versions[0]?.id ?? null,
      latestVersion: doc.versions[0]?.version ?? 0,
    }));
  }),

  create: complianceAdminProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    if (!input.fileName.toLowerCase().endsWith('.pdf')) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a PDF file.' });
    }
    if (input.status === 'Signed' && (input.recipientIds.length !== 1 || !input.signedOn)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A signed upload needs one recipient and a signing date.',
      });
    }
    const recipients = await recipientsFor(ctx, input.recipientIds);
    const bytes = bytesFromBase64(input.pdfBase64);
    await validateAgreementPdf(bytes);
    const originalSha256 = sha256(bytes);
    const storagePath = await storeAgreementPdf(bytes, 'originals');
    const requestIds = input.recipientIds.map(() => randomUUID());
    const recipient = recipients[0];
    const firstRequestId = requestIds[0];
    if (!firstRequestId) throw new Error('Agreement recipient is missing.');
    const manualSignature =
      input.status === 'Signed' && recipient
        ? await signedEvidence(ctx, {
            requestId: firstRequestId,
            recipientId: recipient.id,
            actorId: ctx.user.id,
            typedName: ctx.db.$enc.decrypt(recipient.fullNameEnc),
            method: 'HeadRecorded',
            openedAt: null,
            declaredSignedOn: input.signedOn ?? null,
            originalSha256,
            receiptSource: bytes,
            manualSourcePath: null,
          })
        : null;
    const result = await ctx.withRls(async (tx) => {
      const agreement = input.agreementId
        ? await tx.userAgreement.findUnique({ where: { id: input.agreementId } })
        : await tx.userAgreement.create({
            data: {
              titleEnc: ctx.db.$enc.encrypt(input.title),
              kind: input.kind,
              createdById: ctx.user.id,
            },
          });
      if (!agreement || agreement.kind !== input.kind) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Selected agreement is unavailable.',
        });
      }
      const latest = await tx.userAgreementVersion.findFirst({
        where: { agreementId: agreement.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = await tx.userAgreementVersion.create({
        data: {
          agreementId: agreement.id,
          version: (latest?.version ?? 0) + 1,
          originalFileNameEnc: ctx.db.$enc.encrypt(input.fileName),
          storagePath,
          sha256: originalSha256,
        },
      });
      await tx.userAgreementRequest.updateMany({
        where: {
          status: 'NeedsSigning',
          version: { agreementId: agreement.id },
        },
        data: { status: 'Superseded', supersededAt: new Date() },
      });
      for (const [index, userId] of input.recipientIds.entries()) {
        const requestId = requestIds[index];
        if (!requestId) throw new Error('Agreement recipient is missing.');
        await tx.userAgreementRequest.create({
          data: {
            id: requestId,
            versionId: version.id,
            recipientId: userId,
            status: input.status,
            ...(input.status === 'NeedsSigning' ? { delivery: { create: {} } } : {}),
            ...(manualSignature ? { signature: { create: manualSignature } } : {}),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'Create',
          entity: 'UserAgreement',
          entityId: agreement.id,
          meta: { versionId: version.id, recipientCount: input.recipientIds.length },
        },
      });
      return { agreementId: agreement.id, versionId: version.id, requestIds };
    });
    if (input.status === 'NeedsSigning') {
      try {
        await deliverUserAgreementRequests(requestIds);
      } catch (error) {
        logOperationalEvent({
          event: 'user_agreement.immediate_email_failed',
          level: 'error',
          message: 'Agreement emails queued for retry',
          meta: { errorType: error instanceof Error ? error.name : 'unknown' },
        });
      }
    }
    return result;
  }),

  assign: complianceAdminProcedure
    .input(
      z.object({
        versionId: z.string().min(1),
        recipientIds: z.array(z.string().min(1)).min(1).max(250),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await recipientsFor(ctx, input.recipientIds);
      const ids = input.recipientIds.map(() => randomUUID());
      await ctx.withRls(async (tx) => {
        const version = await tx.userAgreementVersion.findUnique({
          where: { id: input.versionId },
        });
        if (!version)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Agreement version not found.' });
        await tx.userAgreementRequest.updateMany({
          where: {
            recipientId: { in: input.recipientIds },
            status: 'NeedsSigning',
            version: { agreementId: version.agreementId },
          },
          data: { status: 'Superseded', supersededAt: new Date() },
        });
        await tx.userAgreementRequest.updateMany({
          where: {
            recipientId: { in: input.recipientIds },
            versionId: version.id,
            status: 'Signed',
            supersededAt: null,
          },
          data: { supersededAt: new Date() },
        });
        for (const [index, recipientId] of input.recipientIds.entries()) {
          const requestId = ids[index];
          if (!requestId) throw new Error('Agreement recipient is missing.');
          await tx.userAgreementRequest.create({
            data: { id: requestId, versionId: version.id, recipientId, delivery: { create: {} } },
          });
        }
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Create',
            entity: 'UserAgreementRequest',
            entityId: version.id,
            meta: { recipientCount: input.recipientIds.length },
          },
        });
      });
      try {
        await deliverUserAgreementRequests(ids);
      } catch (error) {
        logOperationalEvent({
          event: 'user_agreement.immediate_email_failed',
          level: 'error',
          message: 'Agreement emails queued for retry',
          meta: { errorType: error instanceof Error ? error.name : 'unknown' },
        });
      }
      return { requestIds: ids };
    }),

  register: complianceAdminProcedure.input(filterInput).query(async ({ ctx, input }) => {
    const userMatches = input.search
      ? (await ctx.db.user.findMany({ select: { id: true, fullNameEnc: true } }))
          .filter((user) =>
            ctx.db.$enc
              .decrypt(user.fullNameEnc)
              .toLowerCase()
              .includes(input.search.toLowerCase()),
          )
          .map((user) => user.id)
      : null;
    const where = {
      ...(userMatches ? { recipientId: { in: userMatches } } : {}),
      ...(input.role ? { recipient: { role: input.role } } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.kind ? { version: { agreement: { kind: input.kind } } } : {}),
    };
    const [total, rows] = await ctx.withRls(async (tx) =>
      Promise.all([
        tx.userAgreementRequest.count({ where }),
        tx.userAgreementRequest.findMany({
          where,
          include: {
            recipient: { select: { fullNameEnc: true, role: true } },
            version: { include: { agreement: true } },
            signature: { include: { signedBy: { select: { fullNameEnc: true } } } },
            delivery: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * pageSize,
          take: pageSize,
        }),
      ]),
    );
    return {
      total,
      page: input.page,
      pageSize,
      rows: rows.map((row) => ({
        ...mapRequest(ctx, row),
        name: ctx.db.$enc.decrypt(row.recipient.fullNameEnc),
        role: row.recipient.role,
        emailAttempts: row.delivery?.attempts ?? 0,
        recordedByName:
          row.signature?.method === 'HeadRecorded'
            ? ctx.db.$enc.decrypt(row.signature.signedBy.fullNameEnc)
            : null,
      })),
    };
  }),

  recordSigned: complianceAdminProcedure
    .input(
      idInput.extend({
        fileName: z.string().trim().min(1),
        pdfBase64: pdfInput,
        signedOn: dateInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.fileName.toLowerCase().endsWith('.pdf'))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a PDF file.' });
      const request = await requestFor(ctx, input.requestId);
      if (request.signature) return mapRequest(ctx, request);
      if (request.status !== 'NeedsSigning')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This request is no longer awaiting signature.',
        });
      const manualBytes = bytesFromBase64(input.pdfBase64);
      await validateAgreementPdf(manualBytes);
      const original = await readAgreementPdf(request.version.storagePath);
      if (sha256(original) !== request.version.sha256)
        throw new Error('Agreement PDF failed integrity check.');
      const manualSourcePath = await storeAgreementPdf(manualBytes, 'manual-signed');
      const user = await ctx.db.user.findUnique({
        where: { id: request.recipientId },
        select: { fullNameEnc: true },
      });
      const signature = await signedEvidence(ctx, {
        requestId: request.id,
        recipientId: request.recipientId,
        actorId: ctx.user.id,
        typedName: ctx.db.$enc.decrypt(user?.fullNameEnc) ?? 'Recorded recipient',
        method: 'HeadRecorded',
        openedAt: request.openedAt,
        declaredSignedOn: input.signedOn,
        originalSha256: request.version.sha256,
        receiptSource: manualBytes,
        manualSourcePath,
      });
      await ctx.withRls(async (tx) => {
        const claim = await tx.userAgreementRequest.updateMany({
          where: { id: request.id, status: 'NeedsSigning' },
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
            meta: { requestId: request.id, method: 'HeadRecorded' },
          },
        });
      });
      return mapRequest(ctx, await requestFor(ctx, request.id));
    }),

  retryEmail: complianceAdminProcedure
    .input(idInput.extend({ reviewedAmbiguousOutcome: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const request = await requestFor(ctx, input.requestId);
      if (request.status !== 'NeedsSigning' || !request.delivery)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No pending email request.' });
      if (request.delivery.status === 'NeedsReview' && !input.reviewedAmbiguousOutcome) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Review the possible duplicate delivery before retrying.',
        });
      }
      await ctx.withRls(async (tx) => {
        await tx.userAgreementDelivery.update({
          where: { requestId: request.id },
          data: {
            status: 'Queued',
            attempts: 0,
            nextAttemptAt: new Date(),
            claimUntil: null,
            lastError: null,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: ctx.user.id,
            action: 'Update',
            entity: 'UserAgreementDelivery',
            entityId: request.id,
            meta: { reviewedAmbiguousOutcome: input.reviewedAmbiguousOutcome },
          },
        });
      });
      return deliverUserAgreementRequests([request.id]);
    }),
});
