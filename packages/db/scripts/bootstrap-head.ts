import { PrismaClient } from '@prisma/client';
import { withEncryption } from '../src/encryption.js';

function prismaWithOptionalUrl(url: string | undefined) {
  const client = url
    ? new PrismaClient({
        datasources: {
          db: { url },
        },
      })
    : new PrismaClient();
  return withEncryption(client);
}

const prisma = prismaWithOptionalUrl(process.env['DIRECT_URL'] ?? process.env['DATABASE_URL']);

function readEmail(): string {
  const emailArg = process.argv.find((arg) => arg.startsWith('--email='));
  const raw = emailArg?.slice('--email='.length) ?? process.env['BOOTSTRAP_HEAD_EMAIL'];
  const email = raw?.trim().toLowerCase();
  if (!email) {
    throw new Error('Usage: pnpm bootstrap:head -- --email=you@example.com');
  }
  return email;
}

async function main() {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('bootstrap-head is disabled in production');
  }

  const email = readEmail();
  const emailBidx = prisma.$enc.blindIndex(email);
  const user = await prisma.user.findUnique({
    where: { emailBidx },
    select: { id: true, role: true, tags: true },
  });

  if (!user) {
    throw new Error(
      [
        `No local user found for ${email}.`,
        'Sign up through Clerk first, then make sure the Clerk webhook reaches /api/clerk/webhook.',
      ].join(' '),
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: 'Head',
      tags: [],
      active: true,
    },
    select: { id: true, role: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: updated.id,
      action: 'Update',
      entity: 'User',
      entityId: updated.id,
      meta: {
        source: 'bootstrap-head',
        previousRole: user.role,
        previousTags: user.tags,
      },
    },
  });

  console.warn(`Promoted ${email} (${updated.id}) to ${updated.role}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
