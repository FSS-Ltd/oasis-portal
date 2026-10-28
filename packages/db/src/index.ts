import { PrismaClient } from '@prisma/client';
import { REVIEW_SCHEMA, reviewDatabaseUrl, runtimeDatabaseUrl } from './database-url.js';
import { withEncryption } from './encryption.js';

export {
  AuditAction,
  CalendarEventCategory,
  CalendarEventAudience,
  ChildRegistrationPromptStatus,
  FaithCornerCommentStatus,
  IncidentConfidentiality,
  IncidentEventType,
  IncidentParentCopyStatus,
  IncidentPersonKind,
  IncidentReportStatus,
  IncidentSeverity,
  IncidentType,
  LibraryReminderEmailStatus,
  LibraryReminderStage,
  PermissionSlipCategory,
  PermissionSlipPaymentStatus,
  PermissionSlipResponseStatus,
  PermissionSlipSignatureSource,
  Prisma,
  SchoolFeeBillingCadence,
  SchoolFeeInvoiceDiscountKind,
  SchoolFeeInvoiceKind,
  SchoolFeeInvoiceStatus,
  ShopCategory,
  ShopReservationStatus,
  StaffNoticeAudience,
  StudentParentLinkRequestStatus,
  StudentNotificationKind,
  StudentRegistrationConsentType,
  StudentSelfRegistrationStatus,
  UserInvitationEmailStatus,
  UserInvitationStatus,
} from '@prisma/client';
export type { PrismaClient } from '@prisma/client';
export * from './encryption.js';

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

function createClient() {
  const databaseUrl = runtimeDatabaseUrl(process.env['DATABASE_URL']);
  const base = new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env['NODE_ENV'] === 'production' ? ['error'] : ['warn', 'error'],
  });
  return withEncryption(base);
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { REVIEW_SCHEMA, reviewDatabaseUrl } from './database-url.js';

let reviewPrisma: Promise<typeof prisma> | undefined;

/**
 * Prisma client for the app store review tenant. Created on first use and refused unless the
 * connection really resolves to the `review` schema, so a misconfiguration fails closed instead of
 * reading live data.
 */
export function getReviewPrisma(): Promise<typeof prisma> {
  reviewPrisma ??= (async () => {
    const base = new PrismaClient({
      datasources: { db: { url: reviewDatabaseUrl(process.env['DATABASE_URL']) } },
      log: ['error'],
    });
    const rows = await base.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
    if (rows[0]?.schema !== REVIEW_SCHEMA) {
      await base.$disconnect();
      throw new Error(`Review client resolved to schema "${String(rows[0]?.schema)}".`);
    }
    return withEncryption(base);
  })().catch((error: unknown) => {
    reviewPrisma = undefined;
    throw error;
  });
  return reviewPrisma;
}
