import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from './supabaseEnv.ts';

let cachedClient: SupabaseClient | null | undefined;
let cachedChatClient: SupabaseClient | null | undefined;
let cachedChatAdminClient: SupabaseClient | null | undefined;

export type PublicRealtimeChannel = RealtimeChannel;

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

export function getSupabaseChatClient(): SupabaseClient | null {
  if (cachedChatClient !== undefined) {
    return cachedChatClient;
  }

  const env = getSupabasePublicEnv();

  if (!env) {
    cachedChatClient = null;
    return cachedChatClient;
  }

  cachedChatClient = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'public-office-watch-chat-auth',
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });

  return cachedChatClient;
}

export function getSupabaseChatAdminClient(): SupabaseClient | null {
  if (cachedChatAdminClient !== undefined) {
    return cachedChatAdminClient;
  }

  const env = getSupabasePublicEnv();

  if (!env) {
    cachedChatAdminClient = null;
    return cachedChatAdminClient;
  }

  cachedChatAdminClient = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'public-office-watch-chat-admin-auth',
    },
    realtime: {
      params: { eventsPerSecond: 2 },
    },
  });

  return cachedChatAdminClient;
}
