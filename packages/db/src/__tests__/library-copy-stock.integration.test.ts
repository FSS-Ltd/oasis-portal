import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { beforeEach, describe, expect, it } from 'vitest';

// Opt-in, fixed loopback fixture only. Never uses application connection strings.
const enabled = process.env.OASIS_LIBRARY_DB_TEST === '1';
const args = [
  '-X',
  '-h',
  '127.0.0.1',
  '-p',
  '55442',
  '-U',
  'postgres',
  '-d',
  'oasis_library_fixture',
  '-v',
  'ON_ERROR_STOP=1',
  '-Atq',
];
function query(sql: string): string {
  return execFileSync('psql', [...args, '-c', sql], { encoding: 'utf8', stdio: 'pipe' }).trim();
}
const migration = new URL(
  '../../prisma/migrations/20261103120000_library_copy_stock/migration.sql',
  import.meta.url,
);

describe.skipIf(!enabled)('library stock on isolated Postgres', () => {
  beforeEach(() => {
    query(`DROP TABLE IF EXISTS "LibraryLoan", "LibraryBook" CASCADE;
      DROP FUNCTION IF EXISTS public.library_adjust_copy_stock();
      DROP TYPE IF EXISTS "LibraryBookCollection";
      CREATE TABLE "LibraryBook" (id text PRIMARY KEY, quantity integer NOT NULL DEFAULT 1);
      CREATE TABLE "LibraryLoan" (id text PRIMARY KEY, "bookId" text NOT NULL REFERENCES "LibraryBook"(id), "returnedAt" timestamp);
      CREATE UNIQUE INDEX "LibraryLoan_one_open_loan_per_book" ON "LibraryLoan"("bookId") WHERE "returnedAt" IS NULL;
      INSERT INTO "LibraryBook" VALUES ('book', 2);
      INSERT INTO "LibraryLoan" VALUES ('first', 'book', NULL);`);
    query(readFileSync(migration, 'utf8'));
  });

  it('backfills existing loans, allows a second copy, and rejects stock exhaustion', () => {
    query(`INSERT INTO "LibraryLoan" VALUES ('second', 'book', NULL)`);
    expect(query(`SELECT "loanedCopies" FROM "LibraryBook" WHERE id = 'book'`)).toBe('2');
    expect(() => query(`INSERT INTO "LibraryLoan" VALUES ('third', 'book', NULL)`)).toThrow();
    expect(query(`SELECT count(*) FROM "LibraryLoan"`)).toBe('2');
  });

  it('preserves existing books in the library and allows assigning Rhino Readers', () => {
    expect(query(`SELECT collection FROM "LibraryBook"`)).toBe('General');
    query(`UPDATE "LibraryBook" SET collection = 'RhinoReaders'`);
    expect(query(`SELECT collection FROM "LibraryBook"`)).toBe('RhinoReaders');
  });

  it('releases stock once for a returned copy and handles deletion of an open loan', () => {
    query(`UPDATE "LibraryLoan" SET "returnedAt" = now() WHERE id = 'first';
      UPDATE "LibraryLoan" SET "returnedAt" = now() WHERE id = 'first';`);
    expect(query(`SELECT "loanedCopies" FROM "LibraryBook"`)).toBe('0');
    query(`INSERT INTO "LibraryLoan" VALUES ('second', 'book', NULL);
      DELETE FROM "LibraryLoan" WHERE id = 'second';`);
    expect(query(`SELECT "loanedCopies" FROM "LibraryBook"`)).toBe('0');
  });

  it('prevents reducing quantity below the number on loan', () => {
    query(`INSERT INTO "LibraryLoan" VALUES ('second', 'book', NULL)`);
    expect(() => query(`UPDATE "LibraryBook" SET quantity = 1`)).toThrow();
    expect(query(`SELECT quantity FROM "LibraryBook"`)).toBe('2');
  });

  it('serializes simultaneous checkouts for the last copy', async () => {
    const run = promisify(execFile);
    const attempts = await Promise.allSettled(
      ['second', 'third'].map((id) =>
        run('psql', [
          ...args,
          '-c',
          `BEGIN; INSERT INTO "LibraryLoan" VALUES ('${id}', 'book', NULL); SELECT pg_sleep(0.1); COMMIT;`,
        ]),
      ),
    );
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(query(`SELECT count(*) FROM "LibraryLoan" WHERE "returnedAt" IS NULL`)).toBe('2');
  });

  it('maintains stock through RLS without revealing other borrowers to parents', () => {
    query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'oasis_library_librarian') THEN CREATE ROLE oasis_library_librarian; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'oasis_library_parent') THEN CREATE ROLE oasis_library_parent; END IF;
      END $$;
      GRANT SELECT, UPDATE ON "LibraryBook" TO oasis_library_librarian;
      GRANT SELECT, INSERT, UPDATE, DELETE ON "LibraryLoan" TO oasis_library_librarian;
      GRANT SELECT ON "LibraryBook", "LibraryLoan" TO oasis_library_parent;
      ALTER TABLE "LibraryBook" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "LibraryBook" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "LibraryLoan" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "LibraryLoan" FORCE ROW LEVEL SECURITY;
      CREATE POLICY staff_books ON "LibraryBook" TO oasis_library_librarian USING (true) WITH CHECK (true);
      CREATE POLICY staff_loans ON "LibraryLoan" TO oasis_library_librarian USING (true) WITH CHECK (true);
      CREATE POLICY parent_books ON "LibraryBook" FOR SELECT TO oasis_library_parent USING (true);
      SET ROLE oasis_library_librarian;
      INSERT INTO "LibraryLoan" VALUES ('second', 'book', NULL);
      RESET ROLE;`);
    expect(query(`SET ROLE oasis_library_parent; SELECT "loanedCopies" FROM "LibraryBook"`)).toBe(
      '2',
    );
    expect(query(`SET ROLE oasis_library_parent; SELECT count(*) FROM "LibraryLoan"`)).toBe('0');
    expect(() =>
      query(
        `SET ROLE oasis_library_parent; INSERT INTO "LibraryLoan" VALUES ('third', 'book', NULL)`,
      ),
    ).toThrow();
  });
});
