import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseConfig } from './config';
import type { SupabaseDatabase } from './types';

export type BrowserSupabaseClient = SupabaseClient<SupabaseDatabase>;

export function createClient(): BrowserSupabaseClient {
  const { publishableKey, url } = getSupabaseConfig();

  return createBrowserClient<SupabaseDatabase>(url, publishableKey);
}
