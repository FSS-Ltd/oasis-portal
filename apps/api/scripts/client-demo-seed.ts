import { fileURLToPath } from 'node:url';
import { upsertDemoClerkUsers } from './client-demo/clerk.js';
import { requireEnv } from './client-demo/env.js';
import {
  currentSchema,
  makePrismaClient,
  resetIsolatedSchema,
  seedDatabase,
} from './client-demo/database.js';
import {
  buildClientDemoPlan,
  validateClientDemoSeedEnvironment,
  type ClientDemoPlan,
} from './client-demo/plan.js';

export {
  CLIENT_DEMO_SEED_CONFIRMATION,
  buildClientDemoPlan,
  validateClientDemoRuntimeEnvironment,
  validateClientDemoSeedEnvironment,
} from './client-demo/plan.js';
export { resolveClientDemoDatabaseUrl } from './client-demo/database.js';

async function runClientDemoSeed(): Promise<void> {
  const db = makePrismaClient('owner');
  try {
    const schema = await currentSchema(db);
    const seedEnvironment = validateClientDemoSeedEnvironment(process.env, {
      currentSchema: schema,
    });
    const plan = buildClientDemoPlan({
      emailDomain: requireEnv(process.env, 'OASIS_CLIENT_DEMO_EMAIL_DOMAIN'),
      password: requireEnv(process.env, 'OASIS_CLIENT_DEMO_PASSWORD'),
    });

    const truncatedTables = await resetIsolatedSchema(db);
    const clerkResult = await upsertDemoClerkUsers(process.env, plan);
    await seedDatabase(db, plan, clerkResult.clerkIdsByUserId);

    console.warn(
      formatSeedSummary(plan, seedEnvironment, truncatedTables, clerkResult.createdCount),
    );
  } finally {
    await db.$disconnect();
  }
}

function formatSeedSummary(
  plan: ClientDemoPlan,
  seedEnvironment: { schema: string; appUrl: string },
  truncatedTables: number,
  createdClerkUsers: number,
): string {
  return [
    `Seeded Oasis client demo data in schema "${seedEnvironment.schema}" for ${seedEnvironment.appUrl}.`,
    `Clerk users: ${String(plan.users.length)} (${String(createdClerkUsers)} created, ${String(
      plan.users.length - createdClerkUsers,
    )} updated).`,
    `Database tables reset: ${String(truncatedTables)}.`,
    `Demo emails: ${plan.users.map((user) => user.email).join(', ')}.`,
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runClientDemoSeed().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
