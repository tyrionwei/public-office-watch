import { getSupabaseChatAdminClient } from './supabasePublicClient.ts';

export type ChatAdminReason =
  | 'bot'
  | 'spam'
  | 'external_link'
  | 'advertising'
  | 'rate_limit_evasion'
  | 'illegal_or_legal_notice';

export type ChatAdminMessage = {
  id: string;
  displayName: string;
  publicCode: string;
  body: string;
  moderationStatus: 'visible' | 'removed' | 'held';
  removalReason: string | null;
  removedAt: string | null;
  profileStatus: 'active' | 'muted' | 'banned' | 'unknown';
  mutedUntil: string | null;
  createdAt: string;
};

export type ChatAdminAction = {
  id: string;
  actionType: string;
  messageId: string | null;
  targetPublicCode: string | null;
  reason: string;
  mutedUntil: string | null;
  createdAt: string;
};

export type ChatAdminDashboard = {
  adminEmail: string | null;
  status: {
    is_enabled: boolean;
    updated_at: string;
    terms_version: string;
  };
  counts: {
    visibleMessages: number;
    removedMessages: number;
    mutedProfiles: number;
  };
  messages: ChatAdminMessage[];
  actions: ChatAdminAction[];
};

export class ChatAdminApiError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null = null) {
    super(code);
    this.name = 'ChatAdminApiError';
    this.code = code;
    this.status = status;
  }
}

function requireClient() {
  const client = getSupabaseChatAdminClient();
  if (!client) throw new ChatAdminApiError('CHAT_ADMIN_UNAVAILABLE');
  return client;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('chat-admin', { body });
  if (!error) return data as T;

  let code = 'CHAT_ADMIN_SERVER_ERROR';
  let status: number | null = null;
  const context = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    status = context.status;
    const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') code = payload.error;
  }
  throw new ChatAdminApiError(code, status);
}

export async function loadChatAdminSession() {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new ChatAdminApiError('CHAT_ADMIN_AUTH_FAILED');
  return data.session;
}

export async function requestChatAdminMagicLink(email: string) {
  const client = requireClient();
  const redirectUrl = new URL('/internal/chat-admin', window.location.origin).toString();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
      shouldCreateUser: false,
    },
  });
  if (error) throw new ChatAdminApiError('CHAT_ADMIN_AUTH_FAILED');
}

export async function signOutChatAdmin() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw new ChatAdminApiError('CHAT_ADMIN_AUTH_FAILED');
}

export function loadChatAdminDashboard() {
  return invoke<ChatAdminDashboard>({ action: 'dashboard' });
}

export async function setChatEnabled(enabled: boolean) {
  await invoke({ action: 'set-enabled', enabled });
}

export async function setChatMessageVisibility(
  messageId: string,
  visible: boolean,
  reason: ChatAdminReason,
) {
  await invoke({
    action: 'set-message-visibility',
    messageId,
    visible,
    reason,
  });
}

export async function setChatProfileMute(
  messageId: string,
  muted: boolean,
  durationMinutes: 60 | 1440,
  reason: ChatAdminReason,
) {
  await invoke({
    action: 'set-mute',
    messageId,
    muted,
    durationMinutes,
    reason,
  });
}

export const chatAdminReasonOptions: Array<{
  value: ChatAdminReason;
  label: string;
}> = [
  { value: 'spam', label: '洗版／重複訊息' },
  { value: 'bot', label: '機器人／自動化' },
  { value: 'external_link', label: '外部連結' },
  { value: 'advertising', label: '廣告／招攬' },
  { value: 'rate_limit_evasion', label: '繞過限流' },
  { value: 'illegal_or_legal_notice', label: '明顯違法或有效法律通知' },
];

export const chatAdminActionLabels: Record<string, string> = {
  chat_enabled: '開啟聊天室',
  chat_disabled: '緊急關閉聊天室',
  message_removed: '隱藏訊息',
  message_restored: '恢復訊息',
  user_muted: '禁言使用者',
  user_unmuted: '解除禁言',
};
