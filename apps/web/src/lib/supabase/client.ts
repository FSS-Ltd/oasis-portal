import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseConfig } from './config';
import type { SupabaseDatabase } from './types';

export type BrowserSupabaseClient = SupabaseClient<SupabaseDatabase>;

interface CreateClientOptions {
  accessToken?: () => Promise<string | null>;
}

export function createClient(options: CreateClientOptions = {}): BrowserSupabaseClient {
  const { publishableKey, url } = getSupabaseConfig();

  if (options.accessToken) {
    return createBrowserClient<SupabaseDatabase>(url, publishableKey, {
      accessToken: options.accessToken,
      isSingleton: false,
    });
  }

  return createBrowserClient<SupabaseDatabase>(url, publishableKey);
}
