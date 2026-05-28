import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleConfig } from './config';
import type { SupabaseDatabase } from './types';

export type AdminSupabaseClient = SupabaseClient<SupabaseDatabase>;

export function createAdminClient(): AdminSupabaseClient {
  const { serviceRoleKey, url } = getSupabaseServiceRoleConfig();
  return createSupabaseClient<SupabaseDatabase>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
