import type { PrismaClient } from '@prisma/client';
import type { ClientDemoPlan, ClientDemoStudentSpec } from './plan.js';

export type PrismaWithEncryption = PrismaClient & {
  $enc: {
    encrypt(value: string): string;
    blindIndex(value: string): string;
  };
};

export type SeedContext = {
  db: PrismaWithEncryption;
  plan: ClientDemoPlan;
  clerkIdsByUserId: Map<string, string>;
  primaryStudent: ClientDemoStudentSpec;
  siblingStudent: ClientDemoStudentSpec;
  now: Date;
};

export function createSeedContext(
  db: PrismaWithEncryption,
  plan: ClientDemoPlan,
  clerkIdsByUserId: Map<string, string>,
): SeedContext {
  const primaryStudent = plan.students[0];
  const siblingStudent = plan.students[1];
  if (!primaryStudent || !siblingStudent) {
    throw new Error('Client demo plan requires two students.');
  }
  return { db, plan, clerkIdsByUserId, primaryStudent, siblingStudent, now: new Date() };
}
