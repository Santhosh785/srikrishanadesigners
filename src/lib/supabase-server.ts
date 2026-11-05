// Server-only Supabase client using the service-role key (bypasses RLS).
// Import this only from API routes or server-rendered frontmatter, never
// from client-side scripts or components.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from 'astro:env/client';
import { SUPABASE_SERVICE_ROLE_KEY } from 'astro:env/server';

export function createServiceClient(): SupabaseClient | null {
  if (!SUPABASE_SERVICE_ROLE_KEY || !PUBLIC_SUPABASE_URL) return null;
  return createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
