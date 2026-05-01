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
