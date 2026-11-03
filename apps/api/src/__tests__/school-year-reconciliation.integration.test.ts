import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  reconcileStudentSchoolYears,
  SchoolYearReconciliationConflictError,
  type SchoolYearReconciliationDb,
} from '../services/school-year-reconciliation.js';

const databaseUrl = process.env.OASIS_SCHOOL_YEAR_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('school-year PostgreSQL reconciliation', () => {
  it('commits automatic cohorts atomically while preserving manual placements and racing overrides', async () => {
    if (!databaseUrl) throw new Error('An isolated local test database URL is required');
    const url = new URL(databaseUrl);
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
      throw new Error('This integration test requires local PostgreSQL');
    }
    const schema = `school_year_test_${randomUUID().replaceAll('-', '')}`;
    const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    url.searchParams.set('schema', schema);
    const client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    try {
      // The identifier is generated here, never supplied by a caller. The schema is always dropped.
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await admin.$executeRawUnsafe(
        `CREATE TYPE "${schema}"."AuditAction" AS ENUM ('Create', 'Update', 'Delete', 'Access', 'DecryptPii', 'PermissionDenied')`,
      );
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."Student" (
        "id" text PRIMARY KEY, "dobEnc" text NOT NULL, "yearGroup" text NOT NULL,
        "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      const migration = await readFile(
        new URL(
          '../../../../packages/db/prisma/migrations/20261103140000_student_year_group_override/migration.sql',
          import.meta.url,
        ),
        'utf8',
      );
      await client.$executeRawUnsafe(migration);
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."AuditLog" (
        "id" text PRIMARY KEY, "userId" text, "action" "${schema}"."AuditAction" NOT NULL,
        "entity" text NOT NULL, "entityId" text, "meta" jsonb,
        "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await client.$executeRaw`INSERT INTO "Student" ("id", "dobEnc", "yearGroup", "yearGroupOverride") VALUES
        ('primary', '2018-01-01', 'Year 7', NULL),
        ('secondary', '2014-09-01', 'Year 3', NULL),
        ('manual', 'broken:key', 'Year 3', 'Year 3')`;
      const db = Object.assign(client, {
        $enc: {
          decrypt(value: string | null | undefined) {
            if (value === 'broken:key') throw new Error('Unable to decrypt');
            return value ?? null;
          },
        },
      });
      const asOf = new Date('2026-11-03T12:00:00Z');
      await expect(reconcileStudentSchoolYears(db, asOf)).resolves.toMatchObject({
        status: 'Completed',
        updatedCount: 2,
      });
      expect(
        await client.student.findMany({
          select: { id: true, yearGroup: true },
          orderBy: { id: 'asc' },
        }),
      ).toEqual([
        { id: 'manual', yearGroup: 'Year 3' },
        { id: 'primary', yearGroup: 'Year 4' },
        { id: 'secondary', yearGroup: 'Year 7' },
      ]);
      await expect(reconcileStudentSchoolYears(db, asOf)).resolves.toMatchObject({
        status: 'AlreadyCompleted',
        scannedCount: 0,
      });
      expect(await client.auditLog.count({ where: { entity: 'SchoolYearReconciliation' } })).toBe(
        1,
      );

      const racingDb: SchoolYearReconciliationDb = {
        $enc: db.$enc,
        $transaction(run, options) {
          return client.$transaction(
            (tx) =>
              run({
                $executeRaw: tx.$executeRaw.bind(tx),
                auditLog: tx.auditLog,
                student: {
                  async findMany(input) {
                    const rows = await tx.student.findMany(input);
                    // Another committed request chooses the current cohort as a manual placement.
                    await client.$executeRaw`UPDATE "Student" SET "yearGroupOverride" = 'Year 7' WHERE "id" = 'secondary'`;
                    return rows;
                  },
                  updateMany: (input) => tx.student.updateMany(input),
                },
              }),
            options,
          );
        },
      };
      const nextYear = new Date('2027-09-01T12:00:00Z');
      await expect(reconcileStudentSchoolYears(racingDb, nextYear)).rejects.toBeInstanceOf(
        SchoolYearReconciliationConflictError,
      );
      expect(
        await client.student.findUnique({
          where: { id: 'primary' },
          select: { yearGroup: true },
        }),
      ).toEqual({ yearGroup: 'Year 4' });
      expect(
        await client.student.findUnique({
          where: { id: 'secondary' },
          select: { yearGroup: true, yearGroupOverride: true },
        }),
      ).toEqual({ yearGroup: 'Year 7', yearGroupOverride: 'Year 7' });
      expect(await client.auditLog.count({ where: { entity: 'SchoolYearReconciliation' } })).toBe(
        1,
      );
      await expect(reconcileStudentSchoolYears(db, nextYear)).resolves.toMatchObject({
        status: 'Completed',
        scannedCount: 1,
        updatedCount: 1,
      });

      // Reset mutations restore the current automatic year immediately, even after annual work.
      await client.$executeRaw`UPDATE "Student" SET "yearGroupOverride" = NULL, "yearGroup" = 'Year 8' WHERE "id" = 'secondary'`;
      await reconcileStudentSchoolYears(db, new Date('2028-09-01T12:00:00Z'));
      expect(
        await client.student.findMany({
          select: { id: true, yearGroup: true, yearGroupOverride: true },
          orderBy: { id: 'asc' },
        }),
      ).toEqual([
        { id: 'manual', yearGroup: 'Year 3', yearGroupOverride: 'Year 3' },
        { id: 'primary', yearGroup: 'Year 6', yearGroupOverride: null },
        { id: 'secondary', yearGroup: 'Year 9', yearGroupOverride: null },
      ]);
    } finally {
      await client.$disconnect();
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  }, 20_000);
});
