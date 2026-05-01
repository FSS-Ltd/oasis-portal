import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { getSupabaseConfig } from './config';
import type { SupabaseDatabase } from './types';

export type ServerSupabaseClient = SupabaseClient<SupabaseDatabase>;

export async function createClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  const { publishableKey, url } = getSupabaseConfig();

  return createServerClient<SupabaseDatabase>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Clerk remains the auth source,
          // and Supabase Auth middleware is intentionally not configured.
        }
      },
    },
  });
}
