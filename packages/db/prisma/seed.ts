/**
 * Seed: ACE subjects and nothing else.
 * Real user/student data is never seeded — it only enters via Head admin flows
 * so that PII encryption and audit logging always run.
 */
import { PrismaClient, type TimetableColour } from '@prisma/client';

const prisma = new PrismaClient();

const ACE_SUBJECTS: readonly { code: string; name: string; timetableColour: TimetableColour }[] = [
  { code: 'MATH', name: 'Mathematics', timetableColour: 'Yellow' },
  { code: 'ENG', name: 'English', timetableColour: 'Red' },
  { code: 'WB', name: 'Word Building', timetableColour: 'Purple' },
  { code: 'LIT', name: 'Literature & Creative Writing', timetableColour: 'PaleRed' },
  { code: 'SOC', name: 'Social Studies', timetableColour: 'Green' },
  { code: 'SCI', name: 'Science', timetableColour: 'DarkBlue' },
  { code: 'ANSCI', name: 'Animal Science', timetableColour: 'LightBlue' },
  { code: 'BIBLE', name: 'Bible Studies', timetableColour: 'Brown' },
];

async function main(): Promise<void> {
  for (const subject of ACE_SUBJECTS) {
    await prisma.subject.upsert({
      where: { code: subject.code },
      create: subject,
      update: { name: subject.name, timetableColour: subject.timetableColour },
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
