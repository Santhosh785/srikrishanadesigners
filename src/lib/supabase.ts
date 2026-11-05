// Public (anon) Supabase client. Safe in the browser and on the server; it
// only reads astro:env/client. The service-role client lives in
// supabase-server.ts so client code can never pull in astro:env/server.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from 'astro:env/client';

// `timeoutMs` aborts every request after that long (used by server-side reads
// so pages don't hang when Supabase is unreachable).
export function createPublicClient(opts: { timeoutMs?: number } = {}): SupabaseClient | null {
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) return null;
  const { timeoutMs } = opts;
  return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, timeoutMs
    ? { global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) }) } }
    : undefined);
}
