const SUPABASE_POOLER_HOST_SUFFIX = '.pooler.supabase.com';
const SUPABASE_TRANSACTION_POOLER_PORT = '6543';

function isSupabaseTransactionPooler(url: URL): boolean {
  return (
    url.hostname.endsWith(SUPABASE_POOLER_HOST_SUFFIX) &&
    url.port === SUPABASE_TRANSACTION_POOLER_PORT
  );
}

export function runtimeDatabaseUrl(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return undefined;

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }

  if (!isSupabaseTransactionPooler(url)) return databaseUrl;

  let changed = false;
  if (!url.searchParams.has('pgbouncer')) {
    url.searchParams.set('pgbouncer', 'true');
    changed = true;
  }
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '1');
    changed = true;
  }

  return changed ? url.toString() : databaseUrl;
}

export const REVIEW_SCHEMA = 'review';

/**
 * Connection URL for the app store review tenant: the same database, bound to the `review` schema.
 *
 * Prisma applies `schema` as a session-level `SET search_path` when `pgbouncer=true`. On the shared
 * transaction pooler that setting would stick to server connections that live requests reuse, so the
 * review client moves to the session pooler (port 5432), where it holds its own connection.
 */
export function reviewDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the review tenant.');
  const url = new URL(databaseUrl);
  if (isSupabaseTransactionPooler(url)) url.port = '5432';
  url.searchParams.delete('pgbouncer');
  url.searchParams.set('schema', REVIEW_SCHEMA);
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
  return url.toString();
}
