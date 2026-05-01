interface SupabaseConfig {
  publishableKey: string;
  url: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const publishableKey = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

  if (!url) {
    throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!publishableKey) {
    throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return { publishableKey, url };
}
