import { describe, expect, it } from 'vitest';
import { reviewDatabaseUrl, runtimeDatabaseUrl } from '../database-url.js';

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

describe('reviewDatabaseUrl', () => {
  it('moves the transaction pooler to the session pooler and binds the review schema', () => {
    const url = new URL(
      reviewDatabaseUrl(
        'postgresql://user.project:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1',
      ),
    );
    expect(url.port).toBe('5432');
    expect(url.searchParams.has('pgbouncer')).toBe(false);
    expect(url.searchParams.get('schema')).toBe('review');
    expect(url.searchParams.get('connection_limit')).toBe('1');
  });

  it('overrides an existing schema so the review client can never point at public', () => {
    const url = new URL(reviewDatabaseUrl('postgresql://u:p@localhost:5432/oasis?schema=public'));
    expect(url.searchParams.get('schema')).toBe('review');
  });

  it('refuses to build a URL without DATABASE_URL', () => {
    expect(() => reviewDatabaseUrl(undefined)).toThrow(/DATABASE_URL/);
  });
});
