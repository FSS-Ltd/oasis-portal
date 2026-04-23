import { PrismaClient } from '@prisma/client';
import { withEncryption } from './encryption.js';

export type { PrismaClient } from '@prisma/client';
export * from './encryption.js';

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

function createClient() {
  const base = new PrismaClient({
    log: process.env['NODE_ENV'] === 'production' ? ['error'] : ['warn', 'error'],
  });
  return withEncryption(base);
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
