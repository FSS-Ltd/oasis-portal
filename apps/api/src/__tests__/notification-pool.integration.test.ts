import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { withEncryption } from '@oasis/db';
import type { SessionUser } from '@oasis/domain';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRlsTx, type AppContext } from '../context.js';
import * as observability from '../lib/observability.js';
import { createBehaviourRouter } from '../routers/behaviour.js';
import { studentNotificationRouter } from '../routers/studentNotification.js';
import { router } from '../trpc.js';

// Explicit opt-in, fixed loopback fixture, independent of application credentials.
const enabled = process.env.OASIS_POOL_DB_TEST === '1';
const fixtureUrl = 'postgresql://postgres@127.0.0.1:55443/oasis_pool_fixture';
const admin = new PrismaClient({ datasources: { db: { url: fixtureUrl } } });
const runtime = withEncryption(
  new PrismaClient({
    datasources: {
      db: {
        url:
          fixtureUrl.replace('postgres@', 'oasis_pool_runtime@') +
          '?connection_limit=1&pool_timeout=1',
      },
    },
  }),
);
const head: SessionUser = {
  id: 'cpoolhead000000000000001',
  role: 'Head',
  tags: [],
  requires2fa: false,
};
const studentIds = ['cpoolstudent000000000001', 'cpoolstudent000000000002'];
const loginIds = ['cpoollogin00000000000001', 'cpoollogin00000000000002'] as const;

function context(user: SessionUser | null = head): AppContext {
  return {
    db: runtime,
    user,
    accountAccessState: user ? 'active' : 'unavailable',
    requestId: 'req_pool_test',
    withRls: (fn) => applyRlsTx(runtime, user, fn),
  };
}

function caller(ctx = context()) {
  return router({
    behaviour: createBehaviourRouter({
      emailClient: { send: () => Promise.resolve({ id: 'unused' }) },
    }),
    studentNotification: studentNotificationRouter,
  }).createCaller(ctx);
}

const award = {
  studentIds,
  type: 'Merit' as const,
  entries: [{ category: 'Kindness', amount: 2 }],
};

function installSql(sql: string): void {
  execFileSync('psql', ['-X', fixtureUrl, '-v', 'ON_ERROR_STOP=1', '-q'], {
    input: sql,
    stdio: 'pipe',
  });
}

describe.skipIf(!enabled)('notifications with one real PostgreSQL connection and RLS', () => {
  beforeAll(async () => {
    const marker = await admin.$queryRaw<Array<{ marker: string }>>`
      SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()
    `;
    expect(marker[0]?.marker).toBe('oasis-timeout-fixture-v1');
    vi.stubEnv('OASIS_MASTER_KEY', Buffer.alloc(32, 7).toString('base64'));
    vi.stubEnv('OASIS_MASTER_KEY_VERSION', '1');
    const dbRoot = fileURLToPath(new URL('../../../../packages/db/', import.meta.url));
    execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], {
      cwd: dbRoot,
      env: { ...process.env, DATABASE_URL: fixtureUrl, DIRECT_URL: fixtureUrl },
      stdio: 'pipe',
    });
    installSql(`DO $$ BEGIN
      CREATE ROLE oasis_pool_runtime LOGIN NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      ALTER ROLE oasis_pool_runtime NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO oasis_pool_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oasis_pool_runtime;`);
    const rls = readFileSync(join(dbRoot, 'prisma/rls.sql'), 'utf8');
    // Install the real policies under test without unrelated domains' migration dependencies.
    const start = rls.indexOf('ALTER TABLE "BehaviourEntry" ENABLE');
    const end = rls.indexOf('ALTER TABLE "DemeritStageOverride" ENABLE');
    if (start < 0 || end <= start) throw new Error('Behaviour RLS policy section not found');
    installSql(rls.slice(start, end));
    const migration = readFileSync(
      join(dbRoot, 'prisma/migrations/20260604052000_student_notifications/migration.sql'),
      'utf8',
    );
    installSql(`DO $$ DECLARE policy record; BEGIN
      FOR policy IN SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'StudentNotification'
      LOOP EXECUTE format('DROP POLICY %I ON "StudentNotification"', policy.policyname); END LOOP;
    END $$;`);
    // db push creates tables; install the actual notification policies from their migration.
    installSql(migration.slice(migration.indexOf('ALTER TABLE "StudentNotification" ENABLE')));
    await admin.user.createMany({
      data: [
        { id: head.id, clerkId: head.id, fullNameEnc: runtime.$enc.encrypt('Head'), role: 'Head' },
        ...loginIds.map((id) => ({
          id,
          clerkId: id,
          fullNameEnc: runtime.$enc.encrypt('Student'),
          role: 'Student' as const,
        })),
      ],
      skipDuplicates: true,
    });
    await admin.student.createMany({
      data: studentIds.map((id, index) => ({
        id,
        userId: loginIds[index] ?? null,
        fullNameEnc: runtime.$enc.encrypt('Student'),
        dobEnc: runtime.$enc.encrypt('2014-01-01'),
        nameBidx: id,
        yearGroup: 'Year 6',
        enrolmentDate: new Date(),
      })),
      skipDuplicates: true,
    });
    await admin.pushDeviceToken.upsert({
      where: { tokenBidx: 'pool-fixture-token' },
      create: {
        userId: loginIds[0],
        tokenBidx: 'pool-fixture-token',
        tokenEnc: runtime.$enc.encrypt('ExpoPushToken[fixture]'),
        platform: 'Ios',
      },
      update: {},
    });
  }, 30_000);

  beforeEach(async () => {
    await admin.studentNotification.deleteMany();
    await admin.meritLedger.deleteMany();
    await admin.behaviourEntry.deleteMany();
    await admin.auditLog.deleteMany();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await Promise.all([admin.$disconnect(), runtime.$disconnect()]);
  });

  it('commits the complete award before Expo is called', async () => {
    const events = vi.spyOn(observability, 'logOperationalEvent');
    let committedCounts: number[] = [];
    const fetchMock = vi.fn(async () => {
      committedCounts = await Promise.all([
        admin.behaviourEntry.count(),
        admin.meritLedger.count(),
        admin.studentNotification.count(),
        admin.auditLog.count(),
      ]);
      return new Response(JSON.stringify({ data: [{ status: 'ok' }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(caller().behaviour.logManyForStudents(award)).resolves.toMatchObject({
      ledgerRowCount: 2,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(committedCounts).toEqual([2, 2, 2, 3]);
    // Push is best-effort: a swallowed pool timeout must still fail this regression.
    expect(events.mock.calls.map(([event]) => event.event)).not.toContain('push.delivery_failed');
  });

  it.each(['AuditLog', 'StudentNotification'] as const)(
    'rolls back all writes when %s fails',
    async (table) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      installSql(`ALTER TABLE "${table}" ADD CONSTRAINT fixture_reject CHECK (false) NOT VALID;`);
      try {
        await expect(caller().behaviour.logManyForStudents(award)).rejects.toThrow();
        expect(await admin.behaviourEntry.count()).toBe(0);
        expect(await admin.meritLedger.count()).toBe(0);
        expect(await admin.studentNotification.count()).toBe(0);
        expect(await admin.auditLog.count()).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        installSql(`ALTER TABLE "${table}" DROP CONSTRAINT fixture_reject;`);
      }
    },
  );

  it('keeps the only connection available while the push network is paused', async () => {
    let started!: () => void;
    let release!: () => void;
    const sending = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        started();
        await pending;
        return new Response(JSON.stringify({ data: [{ status: 'ok' }] }));
      }),
    );
    const ctx = context();
    const result = caller(ctx).studentNotification.announce({
      audience: 'All',
      title: 'Update',
      body: 'News',
    });
    try {
      await sending;
      expect(await ctx.withRls((tx) => tx.studentNotification.count())).toBe(2);
    } finally {
      release();
      await result;
    }
  });

  it('preserves student isolation and clears session authority when the connection is reused', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));
    await caller().behaviour.logManyForStudents(award);
    for (const [index, id] of loginIds.entries()) {
      const ctx = context({ id, role: 'Student', tags: [], requires2fa: false });
      const rows = await ctx.withRls((tx) => tx.studentNotification.findMany());
      expect(rows.map((row) => row.studentId)).toEqual([studentIds[index]]);
    }
    expect(await context(null).withRls((tx) => tx.studentNotification.count())).toBe(0);
  });
});
