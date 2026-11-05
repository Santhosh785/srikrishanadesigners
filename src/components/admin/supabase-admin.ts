// One shared browser Supabase client for every admin island on a page.
// It wraps the anon client from src/lib/supabase.ts (no second client
// definition); the signed-in session is what grants owner access via RLS.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPublicClient } from '../../lib/supabase';

let client: SupabaseClient | null | undefined;

export function getAdminClient(): SupabaseClient | null {
  if (client === undefined) client = createPublicClient();
  return client;
}

export const DRESS_BUCKET = 'dresses';
