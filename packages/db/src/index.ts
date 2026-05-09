import { PrismaClient } from '@prisma/client';
import { runtimeDatabaseUrl } from './database-url.js';
import { withEncryption } from './encryption.js';

export {
  AuditAction,
  ChildRegistrationPromptStatus,
  Prisma,
  StaffNoticeAudience,
  StudentRegistrationConsentType,
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
