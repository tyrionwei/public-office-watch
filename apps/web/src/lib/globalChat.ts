import {
  getSupabaseChatClient,
  ensureAnonymousParticipationSession,
  getExistingParticipationSession,
  type PublicRealtimeChannel,
} from './supabasePublicClient.ts';
import { createParticipationCaptchaToken } from './participationSecurity.ts';

export const chatPageSize = 50;
export const chatCooldownSeconds = 8;
export const chatNameCooldownMinutes = 30;

export type ChatStatus = {
  is_enabled: boolean;
  updated_at: string;
  terms_version: string;
};

export type ChatProfile = {
  public_code: string;
  current_display_name: string;
  terms_version: string | null;
  terms_accepted_at: string | null;
  display_name_updated_at: string;
  status: 'active' | 'muted' | 'banned';
  muted_until: string | null;
};

export type ChatMessageVisibility = 'visible' | 'removed' | 'author_muted' | 'author_banned';

export type ChatMessage = {
  id: string;
  display_name_snapshot: string;
  public_code_snapshot: string;
  body: string | null;
  reply_to_message_id: string | null;
  reply_state: 'available' | 'removed' | null;
  reply_to_display_name_snapshot: string | null;
  reply_to_public_code_snapshot: string | null;
  reply_to_body_snapshot: string | null;
  created_at: string;
  visibility_state: ChatMessageVisibility;
  visibility_until: string | null;
};

export type ChatProfileModeration = {
  public_code: string;
  visibility_state: 'visible' | 'author_muted' | 'author_banned';
  visibility_until: string | null;
};

export type ChatRealtimeChannel = PublicRealtimeChannel;

export class ChatApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly mutedUntil: string | null;

  constructor(code: string, status: number | null = null, mutedUntil: string | null = null) {
    super(code);
    this.name = 'ChatApiError';
    this.code = code;
    this.status = status;
    this.mutedUntil = mutedUntil;
  }
}

export function getChatClient() {
  return getSupabaseChatClient();
}

function requireChatClient() {
  const client = getChatClient();
  if (!client) throw new ChatApiError('CHAT_UNAVAILABLE');
  return client;
}

async function invokeChatApi<T>(body: Record<string, unknown>): Promise<T> {
  const client = requireChatClient();
  const { data, error } = await client.functions.invoke('chat-api', { body });

  if (!error) return data as T;

  let code = 'CHAT_SERVER_ERROR';
  let status: number | null = null;
  const context = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    status = context.status;
    const payload = await context.clone().json().catch(() => null) as {
      error?: unknown;
      mutedUntil?: unknown;
    } | null;
    if (typeof payload?.error === 'string') code = payload.error;
    const mutedUntil = typeof payload?.mutedUntil === 'string' ? payload.mutedUntil : null;
    throw new ChatApiError(code, status, mutedUntil);
  }

  throw new ChatApiError(code, status);
}

export async function loadChatStatus(): Promise<ChatStatus | null> {
  const client = getChatClient();
  if (!client) return null;

  const { data, error } = await client.schema('published').rpc('chat_status');
  if (error) throw new ChatApiError('CHAT_STATUS_UNAVAILABLE');
  const rows = data as ChatStatus[] | null;
  return rows?.[0] ?? null;
}

export async function getExistingChatSession() {
  try {
    return await getExistingParticipationSession();
  } catch {
    throw new ChatApiError('CHAT_AUTH_FAILED');
  }
}

export async function ensureAnonymousChatSession() {
  try {
    const existingSession = await getExistingParticipationSession();
    if (existingSession) return existingSession;
    return await ensureAnonymousParticipationSession(await createParticipationCaptchaToken());
  } catch {
    throw new ChatApiError('CHAT_AUTH_FAILED');
  }
}

export async function loadChatProfile() {
  const result = await invokeChatApi<{ profile: ChatProfile | null }>({ action: 'get-profile' });
  return result.profile;
}

export async function saveChatProfile(displayName: string, acceptTerms: boolean) {
  const result = await invokeChatApi<{ profile: ChatProfile }>({
    action: 'set-profile',
    displayName,
    acceptTerms,
  });
  return result.profile;
}

export async function loadChatMessages(before?: Pick<ChatMessage, 'created_at' | 'id'>) {
  const client = requireChatClient();
  const { data, error } = await client.schema('published').rpc('chat_messages', {
    p_before_created_at: before?.created_at ?? null,
    p_before_id: before?.id ?? null,
    p_limit: chatPageSize,
  });
  if (error) throw new ChatApiError('CHAT_MESSAGES_UNAVAILABLE');
  return (data as ChatMessage[] | null) ?? [];
}

export async function sendChatMessage(body: string, replyToMessageId: string | null) {
  const result = await invokeChatApi<{ message: ChatMessage }>({
    action: 'send-message',
    body,
    replyToMessageId,
  });
  return {
    ...result.message,
    visibility_state: result.message.visibility_state ?? 'visible',
    visibility_until: result.message.visibility_until ?? null,
  };
}

export async function subscribeToChatMessages(
  onMessage: (message: ChatMessage) => void,
  onStatus: (status: string) => void,
  onMessageRemoved: (messageId: string) => void,
  onChatStatusChanged: (status: ChatStatus) => void,
  onProfileModerationChanged: (moderation: ChatProfileModeration) => void,
): Promise<ChatRealtimeChannel> {
  const client = requireChatClient();
  const session = await getExistingParticipationSession().catch(() => null);
  if (session) await client.realtime.setAuth(session.access_token);

  const channel = client
    .channel('global-chat', { config: { private: true } })
    .on('broadcast', { event: 'message_created' }, ({ payload }) => {
      if (isChatMessage(payload)) onMessage(payload);
    })
    .on('broadcast', { event: 'message_removed' }, ({ payload }) => {
      if (
        payload
        && typeof payload === 'object'
        && typeof (payload as { id?: unknown }).id === 'string'
      ) {
        onMessageRemoved((payload as { id: string }).id);
      }
    })
    .on('broadcast', { event: 'status_changed' }, ({ payload }) => {
      if (isChatStatus(payload)) onChatStatusChanged(payload);
    })
    .on('broadcast', { event: 'profile_moderation_changed' }, ({ payload }) => {
      if (isChatProfileModeration(payload)) onProfileModerationChanged(payload);
    })
    .subscribe((status) => onStatus(status));

  return channel;
}

export async function unsubscribeFromChat(channel: ChatRealtimeChannel | null) {
  if (!channel) return;
  const client = getChatClient();
  if (client) await client.removeChannel(channel);
}

export function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) merged.set(message.id, message);
  return Array.from(merged.values()).sort((left, right) => {
    const timeDifference = Date.parse(left.created_at) - Date.parse(right.created_at);
    return timeDifference || left.id.localeCompare(right.id);
  });
}

export function countChatCharacters(value: string) {
  return Array.from(value).length;
}

export function limitChatInput(value: string, maximum = 50) {
  return Array.from(value.replace(/[\r\n]/gu, '')).slice(0, maximum).join('');
}

function taipeiYear(value: Date) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
  }).format(value);
}

export function formatChatTimestamp(value: string, now = new Date()) {
  const date = new Date(value);
  const includeYear = taipeiYear(date) !== taipeiYear(now);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const datePart = includeYear
    ? `${values.year}/${values.month}/${values.day}`
    : `${values.month}/${values.day}`;
  return `${datePart} ${values.hour}:${values.minute}`;
}

export function formatChatDate(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

export function chatDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ChatMessage>;
  return typeof message.id === 'string'
    && typeof message.display_name_snapshot === 'string'
    && typeof message.public_code_snapshot === 'string'
    && (typeof message.body === 'string' || message.body === null)
    && (
      message.visibility_state === 'visible'
      || message.visibility_state === 'removed'
      || message.visibility_state === 'author_muted'
      || message.visibility_state === 'author_banned'
    )
    && typeof message.created_at === 'string';
}

function isChatProfileModeration(value: unknown): value is ChatProfileModeration {
  if (!value || typeof value !== 'object') return false;
  const moderation = value as Partial<ChatProfileModeration>;
  return typeof moderation.public_code === 'string'
    && (
      moderation.visibility_state === 'visible'
      || moderation.visibility_state === 'author_muted'
      || moderation.visibility_state === 'author_banned'
    )
    && (typeof moderation.visibility_until === 'string' || moderation.visibility_until === null);
}

function isChatStatus(value: unknown): value is ChatStatus {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<ChatStatus>;
  return typeof status.is_enabled === 'boolean'
    && typeof status.updated_at === 'string'
    && typeof status.terms_version === 'string';
}
