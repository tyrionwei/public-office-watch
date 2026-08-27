import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from './supabaseEnv.ts';

let cachedClient: SupabaseClient | null | undefined;
let cachedChatClient: SupabaseClient | null | undefined;
let cachedChatAdminClient: SupabaseClient | null | undefined;
let anonymousParticipationSessionPromise: Promise<Session> | null = null;

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
      detectSessionInUrl: false,
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

export function getSupabaseParticipationClient(): SupabaseClient | null {
  return getSupabaseChatClient();
}

export async function getExistingParticipationSession(): Promise<Session | null> {
  const client = getSupabaseParticipationClient();
  if (!client) throw new Error('Anonymous participation is unavailable');

  const { data: current, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  return current.session;
}

export async function ensureAnonymousParticipationSession(captchaToken: string): Promise<Session> {
  const client = getSupabaseParticipationClient();
  if (!client) throw new Error('Anonymous participation is unavailable');

  const currentSession = await getExistingParticipationSession();
  if (currentSession) return currentSession;
  if (!captchaToken.trim()) throw new Error('Anonymous participation requires CAPTCHA verification');

  if (!anonymousParticipationSessionPromise) {
    anonymousParticipationSessionPromise = client.auth.signInAnonymously({
      options: { captchaToken },
    })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data.session) throw new Error('Anonymous participation session was not created');
        return data.session;
      })
      .finally(() => {
        anonymousParticipationSessionPromise = null;
      });
  }

  return anonymousParticipationSessionPromise;
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
