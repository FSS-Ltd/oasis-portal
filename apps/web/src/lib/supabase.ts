import { createClient, type BrowserSupabaseClient } from './supabase/client';

export { createClient };
export type { BrowserSupabaseClient };

export const supabase: BrowserSupabaseClient = createClient();
