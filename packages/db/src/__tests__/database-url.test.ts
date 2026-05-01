import { describe, expect, it } from 'vitest';
import { runtimeDatabaseUrl } from '../database-url.js';

describe('runtimeDatabaseUrl', () => {
  it('leaves missing and malformed URLs unchanged', () => {
    expect(runtimeDatabaseUrl(undefined)).toBeUndefined();
    expect(runtimeDatabaseUrl('not a url')).toBe('not a url');
  });

  it('leaves direct and session-pooler URLs unchanged', () => {
    const directUrl = 'postgresql://user:pass@db.project.supabase.co:5432/postgres';
    const sessionPoolerUrl =
      'postgresql://user.project:pass@aws-0-eu-west-2.pooler.supabase.com:5432/postgres';

    expect(runtimeDatabaseUrl(directUrl)).toBe(directUrl);
    expect(runtimeDatabaseUrl(sessionPoolerUrl)).toBe(sessionPoolerUrl);
  });

  it('adds Prisma-safe parameters for Supabase transaction pooler URLs', () => {
    expect(
      runtimeDatabaseUrl(
        'postgresql://user.project:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres',
      ),
    ).toBe(
      'postgresql://user.project:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1',
    );
  });

  it('preserves existing query parameters and explicit pool settings', () => {
    expect(
      runtimeDatabaseUrl(
        'postgresql://user.project:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require',
      ),
    ).toBe(
      'postgresql://user.project:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1',
    );

    const configuredUrl =
      'postgresql://user.project:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=3';
    expect(runtimeDatabaseUrl(configuredUrl)).toBe(configuredUrl);
  });
});
