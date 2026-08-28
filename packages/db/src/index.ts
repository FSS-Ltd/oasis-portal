import { PrismaClient } from '@prisma/client';
import { runtimeDatabaseUrl } from './database-url.js';
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
  PermissionSlipCategory,
  PermissionSlipPaymentStatus,
  PermissionSlipResponseStatus,
  PermissionSlipSignatureSource,
  ParentNotificationKind,
  Prisma,
  SchoolFeeBillingCadence,
  SchoolFeeInvoiceDiscountKind,
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
