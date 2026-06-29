import { fileURLToPath } from 'node:url';
import { verifyDemoClerkUsers } from './client-demo/clerk.js';
import { requireEnv } from './client-demo/env.js';
import { currentSchema, makePrismaClient } from './client-demo/database.js';
import {
  buildClientDemoPlan,
  validateClientDemoRuntimeEnvironment,
  type ClientDemoPlan,
} from './client-demo/plan.js';
import {
  verifyClientDemoDatabase,
  type ClientDemoDatabaseVerificationSummary,
} from './client-demo/verify.js';

async function runClientDemoVerification(): Promise<void> {
  const db = makePrismaClient('runtime');
  try {
    const schema = await currentSchema(db);
    const demoEnvironment = validateClientDemoRuntimeEnvironment(process.env, {
      currentSchema: schema,
    });
    const plan = buildClientDemoPlan({
      emailDomain: requireEnv(process.env, 'OASIS_CLIENT_DEMO_EMAIL_DOMAIN'),
      password: requireEnv(process.env, 'OASIS_CLIENT_DEMO_PASSWORD'),
    });

    const databaseSummary = await verifyClientDemoDatabase(db, plan);
    const clerkSummary = await verifyDemoClerkUsers(process.env, plan);

    console.warn(
      formatVerificationSummary(plan, demoEnvironment, databaseSummary, clerkSummary.checkedUsers),
    );
  } finally {
    await db.$disconnect();
  }
}

function formatVerificationSummary(
  plan: ClientDemoPlan,
  demoEnvironment: { schema: string; appUrl: string },
  databaseSummary: ClientDemoDatabaseVerificationSummary,
  checkedClerkUsers: number,
): string {
  return [
    `Verified Oasis client demo in schema "${demoEnvironment.schema}" for ${demoEnvironment.appUrl}.`,
    `Clerk users checked: ${String(checkedClerkUsers)}.`,
    `Database users checked: ${String(databaseSummary.checkedUsers)}.`,
    `Database students checked: ${String(databaseSummary.checkedStudents)}.`,
    `Feature coverage checks: ${String(databaseSummary.checks.length)}.`,
    `Demo emails: ${plan.users.map((user) => user.email).join(', ')}.`,
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runClientDemoVerification().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
