import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

export function expectedTwoFactor(value: string | undefined): boolean {
  if (value === undefined)
    throw new Error('OASIS_ENFORCE_2FA must be set before configuring Realtime.');
  return value.trim().toLowerCase() === 'true';
}

export async function configureRealtime(
  client: PrismaClient,
  enforceTwoFactor: boolean,
): Promise<void> {
  await client.$executeRaw`
    UPDATE oasis_private.realtime_configuration
    SET enforce_2fa = ${enforceTwoFactor}, configured_at = now() WHERE singleton = true
  `;
}

export async function checkRealtime(
  client: PrismaClient,
  enforceTwoFactor: boolean,
): Promise<void> {
  const rows = await client.$queryRaw<{ enforce_2fa: boolean | null }[]>`
    SELECT enforce_2fa FROM oasis_private.realtime_configuration WHERE singleton = true
  `;
  if (rows.length !== 1 || rows[0]?.enforce_2fa !== enforceTwoFactor) {
    throw new Error(
      'Realtime 2FA configuration is missing or differs from OASIS_ENFORCE_2FA. Run realtime:configure before releasing clients.',
    );
  }
}

async function main(): Promise<void> {
  const enforceTwoFactor = expectedTwoFactor(process.env['OASIS_ENFORCE_2FA']);
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DIRECT_URL or DATABASE_URL is required.');
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    if (process.argv[2] === 'configure') await configureRealtime(client, enforceTwoFactor);
    else if (process.argv[2] !== 'check') throw new Error('Expected configure or check.');
    await checkRealtime(client, enforceTwoFactor);
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Realtime configuration failed.');
    process.exitCode = 1;
  });
}
