import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  testDir,
  '../../prisma/migrations/20260904120000_timetable_builder/migration.sql',
);

function model(name: string) {
  const value = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === name);
  if (!value) throw new Error(`Missing Prisma model ${name}`);
  return value;
}

describe('timetable persistence model', () => {
  it('exposes normalised schedule, draft, and immutable publication models', () => {
    expect(() => model('TimetableAgeGroupSchedule')).not.toThrow();
    expect(() => model('TimetableScheduleSlot')).not.toThrow();
    expect(() => model('StudentTimetable')).not.toThrow();
    expect(() => model('StudentTimetableEntry')).not.toThrow();
    expect(() => model('StudentTimetablePublication')).not.toThrow();
    expect(() => model('StudentTimetablePublicationEntry')).not.toThrow();
  });

  it('stores system-task linkage, subject colour, and publication snapshots', () => {
    expect(model('PersonalTask').fields.map((field) => field.name)).toContain('timetableTermKey');
    expect(model('Subject').fields.map((field) => field.name)).toContain('timetableColour');

    const publicationFields = model('StudentTimetablePublication').fields.map(
      (field) => field.name,
    );
    expect(publicationFields).toEqual(
      expect.arrayContaining([
        'termLabel',
        'termStartsOn',
        'termEndsOn',
        'studentFirstNameEnc',
        'publishedAt',
      ]),
    );
  });

  it('uses distinct PostgreSQL-safe index names in the timetable migration', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const indexNames = [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/gu)].map(
      (match) => match[1] ?? '',
    );
    const postgresNames = indexNames.map((name) => name.slice(0, 63));

    expect(postgresNames).toHaveLength(new Set(postgresNames).size);
  });
});
