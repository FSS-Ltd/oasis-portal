import { describe, expect, it } from 'vitest';
import {
  CLIENT_DEMO_SEED_CONFIRMATION,
  buildClientDemoPlan,
  resolveClientDemoDatabaseUrl,
  validateClientDemoRuntimeEnvironment,
  validateClientDemoSeedEnvironment,
} from '../../scripts/client-demo-seed.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('client demo seed safety', () => {
  it('rejects the live public schema even with the confirmation phrase', () => {
    expect(() =>
      validateClientDemoSeedEnvironment(
        {
          APP_URL: 'https://client-demo.oasisportal.space',
          DATABASE_URL:
            'postgresql://postgres:password@db.fjatgkyswxqkbunrsmdq.supabase.co/postgres',
          OASIS_CLIENT_DEMO_SCHEMA: 'public',
          OASIS_CLIENT_DEMO_SEED_CONFIRMATION: CLIENT_DEMO_SEED_CONFIRMATION,
          OASIS_CLIENT_DEMO_DATABASE_ISOLATION: 'dedicated-demo-database',
          OASIS_PRODUCTION_SUPABASE_REF: 'fjatgkyswxqkbunrsmdq',
        },
        { currentSchema: 'public' },
      ),
    ).toThrow(/production Supabase project/u);
  });

  it('requires a dedicated demo database confirmation before seeding public', () => {
    expect(() =>
      validateClientDemoSeedEnvironment(
        {
          APP_URL: 'https://client-demo.oasisportal.space',
          DATABASE_URL: 'postgresql://postgres:password@db.demoportalref.supabase.co/postgres',
          OASIS_CLIENT_DEMO_SCHEMA: 'public',
          OASIS_CLIENT_DEMO_SEED_CONFIRMATION: CLIENT_DEMO_SEED_CONFIRMATION,
          OASIS_PRODUCTION_SUPABASE_REF: 'fjatgkyswxqkbunrsmdq',
        },
        { currentSchema: 'public' },
      ),
    ).toThrow(/dedicated demo database/u);
  });

  it('rejects the live Supabase project even when using a non-public schema', () => {
    expect(() =>
      validateClientDemoSeedEnvironment(
        {
          APP_URL: 'https://client-demo.oasisportal.space',
          DIRECT_URL:
            'postgresql://postgres:password@db.fjatgkyswxqkbunrsmdq.supabase.co/postgres?schema=client_demo',
          OASIS_CLIENT_DEMO_SCHEMA: 'client_demo',
          OASIS_CLIENT_DEMO_SEED_CONFIRMATION: CLIENT_DEMO_SEED_CONFIRMATION,
          OASIS_PRODUCTION_SUPABASE_REF: 'fjatgkyswxqkbunrsmdq',
        },
        { currentSchema: 'client_demo' },
      ),
    ).toThrow(/production Supabase project/u);
  });

  it('requires an explicit confirmation phrase', () => {
    expect(() =>
      validateClientDemoSeedEnvironment(
        {
          APP_URL: 'https://client-demo.oasisportal.space',
          OASIS_CLIENT_DEMO_SCHEMA: 'client_demo',
          OASIS_CLIENT_DEMO_SEED_CONFIRMATION: 'seed-demo',
        },
        { currentSchema: 'client_demo' },
      ),
    ).toThrow(/OASIS_CLIENT_DEMO_SEED_CONFIRMATION/u);
  });

  it('rejects the live production host even when the schema is isolated', () => {
    expect(() =>
      validateClientDemoSeedEnvironment(
        {
          APP_URL: 'https://oasisportal.space',
          OASIS_CLIENT_DEMO_SCHEMA: 'client_demo',
          OASIS_CLIENT_DEMO_SEED_CONFIRMATION: CLIENT_DEMO_SEED_CONFIRMATION,
        },
        { currentSchema: 'client_demo' },
      ),
    ).toThrow(/demo host/u);
  });

  it('accepts an isolated demo schema and demo app URL', () => {
    expect(
      validateClientDemoSeedEnvironment(
        {
          APP_URL: 'https://client-demo.oasisportal.space',
          OASIS_CLIENT_DEMO_SCHEMA: 'client_demo',
          OASIS_CLIENT_DEMO_SEED_CONFIRMATION: CLIENT_DEMO_SEED_CONFIRMATION,
        },
        { currentSchema: 'client_demo' },
      ),
    ).toEqual({ appUrl: 'https://client-demo.oasisportal.space', schema: 'client_demo' });
  });

  it('accepts public when the database is a dedicated demo Supabase project', () => {
    expect(
      validateClientDemoSeedEnvironment(
        {
          APP_URL: 'https://client-demo.oasisportal.space',
          DATABASE_URL: 'postgresql://postgres:password@db.demoportalref.supabase.co/postgres',
          OASIS_CLIENT_DEMO_SCHEMA: 'public',
          OASIS_CLIENT_DEMO_SEED_CONFIRMATION: CLIENT_DEMO_SEED_CONFIRMATION,
          OASIS_CLIENT_DEMO_DATABASE_ISOLATION: 'dedicated-demo-database',
          OASIS_PRODUCTION_SUPABASE_REF: 'fjatgkyswxqkbunrsmdq',
        },
        { currentSchema: 'public' },
      ),
    ).toEqual({ appUrl: 'https://client-demo.oasisportal.space', schema: 'public' });
  });

  it('allows non-destructive verification without the seed reset confirmation', () => {
    expect(
      validateClientDemoRuntimeEnvironment(
        {
          APP_URL: 'https://client-demo.oasisportal.space',
          DATABASE_URL: 'postgresql://oasis_app:password@db.demoportalref.supabase.co/postgres',
          OASIS_CLIENT_DEMO_SCHEMA: 'public',
          OASIS_CLIENT_DEMO_DATABASE_ISOLATION: 'dedicated-demo-database',
          OASIS_PRODUCTION_SUPABASE_REF: 'fjatgkyswxqkbunrsmdq',
        },
        { currentSchema: 'public' },
      ),
    ).toEqual({ appUrl: 'https://client-demo.oasisportal.space', schema: 'public' });
  });
});

describe('client demo database connection selection', () => {
  it('uses the owner connection for destructive seeding and runtime connection for verification', () => {
    const env = {
      DATABASE_URL: 'postgresql://oasis_app:runtime@db.demoportalref.supabase.co/postgres',
      DIRECT_URL: 'postgresql://postgres:owner@db.demoportalref.supabase.co/postgres',
    };

    expect(resolveClientDemoDatabaseUrl(env, 'owner')).toBe(env.DIRECT_URL);
    expect(resolveClientDemoDatabaseUrl(env, 'runtime')).toBe(env.DATABASE_URL);
  });
});

describe('client demo seed plan', () => {
  it('creates the requested client-facing role accounts from synthetic specs', () => {
    const plan = buildClientDemoPlan({
      emailDomain: 'demo.oasisportal.space',
      password: 'DemoPassword123!',
    });

    expect(plan.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'clientdemo_user_head_parent',
          role: 'Head',
          email: 'head-parent@demo.oasisportal.space',
          linkedAsGuardian: true,
        }),
        expect.objectContaining({
          id: 'clientdemo_user_parent',
          role: 'Parent',
          email: 'parent@demo.oasisportal.space',
          linkedAsGuardian: true,
        }),
        expect.objectContaining({
          id: 'clientdemo_user_pastor',
          role: 'Pastor',
          email: 'pastor@demo.oasisportal.space',
        }),
        expect.objectContaining({
          id: 'clientdemo_user_student',
          role: 'Student',
          email: 'student@demo.oasisportal.space',
        }),
      ]),
    );
    expect(plan.students).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'clientdemo_student_primary',
          userId: 'clientdemo_user_student',
        }),
      ]),
    );
  });
});

describe('client demo GitHub workflow', () => {
  it('defines a manual seed and verification workflow using demo-only secrets', () => {
    const workflow = readFileSync(
      join(process.cwd(), '..', '..', '.github', 'workflows', 'client-demo.yml'),
      'utf8',
    );

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('environment: Client Demo');
    expect(workflow).toContain('pnpm --filter @oasis/api seed:client-demo');
    expect(workflow).toContain('pnpm --filter @oasis/api verify:client-demo');

    for (const secretName of [
      'CLIENT_DEMO_DATABASE_URL',
      'CLIENT_DEMO_DIRECT_URL',
      'CLIENT_DEMO_CLERK_SECRET_KEY',
      'CLIENT_DEMO_OASIS_MASTER_KEY',
      'CLIENT_DEMO_OASIS_MASTER_KEY_VERSION',
      'CLIENT_DEMO_OASIS_BIDX_PEPPER',
      'CLIENT_DEMO_PASSWORD',
    ]) {
      expect(workflow).toContain(`secrets.${secretName}`);
    }
  });
});
