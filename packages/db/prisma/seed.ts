/**
 * Seed: ACE subjects and nothing else.
 * Real user/student data is never seeded — it only enters via Head admin flows
 * so that PII encryption and audit logging always run.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACE_SUBJECTS: readonly { code: string; name: string }[] = [
  { code: 'MATH', name: 'Mathematics' },
  { code: 'ENG', name: 'English' },
  { code: 'WB', name: 'Word Building' },
  { code: 'LIT', name: 'Literature & Creative Writing' },
  { code: 'SOC', name: 'Social Studies' },
  { code: 'SCI', name: 'Science' },
];

async function main(): Promise<void> {
  for (const subject of ACE_SUBJECTS) {
    await prisma.subject.upsert({
      where: { code: subject.code },
      create: subject,
      update: { name: subject.name },
    });
  }
  console.warn(`Seeded ${String(ACE_SUBJECTS.length)} subjects.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
