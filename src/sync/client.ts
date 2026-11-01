import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, syncConfigured } from '../config';

let client: SupabaseClient | null = null;

/** Lazily created so the app works fully offline / unconfigured. */
export function supabase(): SupabaseClient | null {
  if (!syncConfigured()) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'mov.auth' },
  });
  return client;
}
