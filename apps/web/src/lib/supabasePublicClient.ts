import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from './supabaseEnv';

let cachedClient: SupabaseClient | null | undefined;

export function getSupabasePublicClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const env = getSupabasePublicEnv();

  if (!env) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
