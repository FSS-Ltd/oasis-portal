import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { AuditAction, Prisma } from '@oasis/db';
import { AccessDeniedError, canViewAuditLog } from '@oasis/domain';
import { authedProcedure, router } from '../trpc.js';

const auditInclude = Prisma.validator<Prisma.AuditLogInclude>()({
  user: {
    select: {
      id: true,
      fullNameEnc: true,
      emailEnc: true,
    },
  },
});

type AuditLogWithUser = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

const inspectionAuditActions = [
  'Create',
  'Update',
  'Delete',
  'PermissionDenied',
] as const satisfies readonly AuditAction[];

const inspectionAuditEntities = [
  'Attendance',
  'AttendanceExport',
  'BehaviourEntry',
  'ChildNote',
  'PaceAdvancementApproval',
  'PaceRecord',
  'StaffAttendance',
  'Student',
  'StudentSubject',
  'User',
] as const;

const inspectionAuditWhere = Prisma.validator<Prisma.AuditLogWhereInput>()({
  action: { in: [...inspectionAuditActions] },
  entity: { in: [...inspectionAuditEntities] },
});

function requireAuditViewer(user: Parameters<typeof canViewAuditLog>[0]): void {
  if (!canViewAuditLog(user)) {
    const err = new AccessDeniedError('audit log requires Head role or audit-viewer staff tag');
    throw new TRPCError({ code: 'FORBIDDEN', message: err.message, cause: err });
  }
}

const listInput = z
  .object({
    limit: z.number().int().min(1).max(100).default(25),
    cursor: z.string().cuid().optional(),
    action: z.nativeEnum(AuditAction).optional(),
    entity: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .optional();

export const auditRouter = router({
  list: authedProcedure.input(listInput).query(async ({ ctx, input }) => {
    requireAuditViewer(ctx.user);

    const limit = input?.limit ?? 25;
    const filters: Prisma.AuditLogWhereInput = {};

    if (input?.action) filters.action = input.action;
    if (input?.entity) filters.entity = input.entity;
    if (input?.userId) filters.userId = input.userId;
    if (input?.from || input?.to) {
      const createdAt: Prisma.DateTimeFilter<'AuditLog'> = {};
      if (input.from) createdAt.gte = input.from;
      if (input.to) createdAt.lte = input.to;
      filters.createdAt = createdAt;
    }

    const where: Prisma.AuditLogWhereInput = {
      AND: Object.keys(filters).length > 0 ? [inspectionAuditWhere, filters] : [inspectionAuditWhere],
    };

    const queryArgs: Prisma.AuditLogFindManyArgs = {
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: auditInclude,
    };
    if (input?.cursor) {
      queryArgs.cursor = { id: input.cursor };
      queryArgs.skip = 1;
    }

    const rows = (await ctx.db.auditLog.findMany(queryArgs)) as AuditLogWithUser[];

    const pageRows = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? rows[limit]?.id : undefined;
    const decryptedActorCount = pageRows.filter((row) => row.user !== null).length;

    const resultRows = pageRows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      meta: row.meta,
      createdAt: row.createdAt,
      actor: row.user
        ? {
            id: row.user.id,
            fullName: ctx.db.$enc.decrypt(row.user.fullNameEnc),
            email: ctx.db.$enc.decrypt(row.user.emailEnc),
          }
        : null,
    }));

    if (decryptedActorCount > 0) {
      await ctx.db.auditLog.create({
        data: {
          userId: ctx.user.id,
          action: 'DecryptPii',
          entity: 'User',
          meta: { count: decryptedActorCount, source: 'audit.list' },
        },
      });
    }

    return { rows: resultRows, nextCursor };
  }),
});
