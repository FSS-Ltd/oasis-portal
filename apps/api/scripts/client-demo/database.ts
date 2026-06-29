import { PrismaClient } from '@prisma/client';
import { withEncryption } from '@oasis/db';
import type { ClientDemoPlan } from './plan.js';
import { createSeedContext, type PrismaWithEncryption } from './types.js';
import { seedAcademicDemoData } from './seed-academic.js';
import { seedActivitiesDemoData } from './seed-activities.js';
import { seedFinanceReportDemoData } from './seed-finance-reports.js';
import { seedIdentityDemoData } from './seed-identity.js';
import { seedMessagingSafetyDemoData } from './seed-messaging-safety.js';

const PRISMA_MIGRATIONS_TABLE = '_prisma_migrations';
export type ClientDemoDatabaseConnection = 'owner' | 'runtime';

export function resolveClientDemoDatabaseUrl(
  env: Record<string, string | undefined>,
  connection: ClientDemoDatabaseConnection,
): string | undefined {
  return connection === 'runtime'
    ? env['DATABASE_URL']
    : (env['DIRECT_URL'] ?? env['DATABASE_URL']);
}

export function makePrismaClient(
  connection: ClientDemoDatabaseConnection = 'owner',
): PrismaWithEncryption {
  const databaseUrl = resolveClientDemoDatabaseUrl(process.env, connection);
  if (connection === 'runtime' && !databaseUrl) {
    throw new Error('DATABASE_URL is required for client demo runtime verification.');
  }
  const base = new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });
  return withEncryption(base);
}

export async function currentSchema(db: PrismaClient): Promise<string> {
  const rows = await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
  const schema = rows[0]?.schema;
  if (!schema) throw new Error('Could not determine current PostgreSQL schema.');
  return schema;
}

export async function resetIsolatedSchema(db: PrismaClient): Promise<number> {
  const tables = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
      AND table_name <> ${PRISMA_MIGRATIONS_TABLE}
    ORDER BY table_name
  `;

  if (tables.length === 0) {
    throw new Error(
      'No application tables found in the isolated demo schema. Run migrations first.',
    );
  }

  const tableList = tables.map(({ table_name }) => quoteIdentifier(table_name)).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  return tables.length;
}

export async function seedDatabase(
  db: PrismaWithEncryption,
  plan: ClientDemoPlan,
  clerkIdsByUserId: Map<string, string>,
): Promise<void> {
  const ctx = createSeedContext(db, plan, clerkIdsByUserId);
  await seedIdentityDemoData(ctx);
  await seedAcademicDemoData(ctx);
  await seedMessagingSafetyDemoData(ctx);
  await seedActivitiesDemoData(ctx);
  await seedFinanceReportDemoData(ctx);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
