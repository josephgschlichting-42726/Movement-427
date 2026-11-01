/**
 * Supabase project settings. Both values are public by design (they ship to every browser);
 * row-level security in supabase/schema.sql is what keeps each user's data private.
 * Never put the service_role / secret key or the database password here.
 *
 * Can also be provided at build time via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const syncConfigured = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
