import { getSupabaseChatAdminClient } from './supabasePublicClient.ts';

export type PublicUpdateType = 'candidate' | 'person' | 'party' | 'election' | 'correction' | 'site';
export type PublicUpdateEntityType = 'person' | 'party' | 'election' | 'race' | 'region';
export type PublicUpdateReviewAction = 'approve' | 'reject' | 'withdraw';

export type PublicUpdateAdminEvent = {
  update_id: string;
  update_type: PublicUpdateType;
  title: string;
  summary: string;
  entity_type: PublicUpdateEntityType | null;
  entity_id: string | null;
  entity_href: string | null;
  source_name: string | null;
  source_url: string | null;
  occurred_at: string | null;
  published_at: string;
  review_status: 'draft' | 'verified' | 'rejected';
  visibility: 'internal' | 'public';
  is_public: boolean;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicUpdateAdminAction = {
  action_id: string;
  update_id: string;
  action_type: 'created' | 'approved' | 'rejected' | 'withdrawn';
  reason: string | null;
  created_at: string;
};

export type PublicUpdateAdminDashboard = {
  adminEmail: string | null;
  events: PublicUpdateAdminEvent[];
  actions: PublicUpdateAdminAction[];
};

export type PublicUpdateDraftInput = {
  updateType: PublicUpdateType;
  title: string;
  summary: string;
  entityType: PublicUpdateEntityType | null;
  entityId: string | null;
  entityHref: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  occurredAt: string | null;
};

export class PublicUpdateAdminApiError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null = null) {
    super(code);
    this.name = 'PublicUpdateAdminApiError';
    this.code = code;
    this.status = status;
  }
}

function requireClient() {
  const client = getSupabaseChatAdminClient();
  if (!client) throw new PublicUpdateAdminApiError('PUBLIC_UPDATE_ADMIN_UNAVAILABLE');
  return client;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('update-admin', { body });
  if (!error) return data as T;

  let code = 'PUBLIC_UPDATE_ADMIN_SERVER_ERROR';
  let status: number | null = null;
  const context = 'context' in error ? error.context : null;
  if (context instanceof Response) {
    status = context.status;
    const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') code = payload.error;
  }
  throw new PublicUpdateAdminApiError(code, status);
}

export async function loadPublicUpdateAdminSession() {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new PublicUpdateAdminApiError('PUBLIC_UPDATE_ADMIN_AUTH_FAILED');
  return data.session;
}

export async function requestPublicUpdateAdminMagicLink(email: string) {
  const client = requireClient();
  const redirectUrl = new URL('/internal/update-admin', window.location.origin).toString();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl, shouldCreateUser: false },
  });
  if (error) throw new PublicUpdateAdminApiError('PUBLIC_UPDATE_ADMIN_AUTH_FAILED');
}

export async function signOutPublicUpdateAdmin() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw new PublicUpdateAdminApiError('PUBLIC_UPDATE_ADMIN_AUTH_FAILED');
}

export function loadPublicUpdateAdminDashboard() {
  return invoke<PublicUpdateAdminDashboard>({ action: 'dashboard' });
}

export async function createPublicUpdateDraft(input: PublicUpdateDraftInput) {
  await invoke({ action: 'create-draft', ...input });
}

export async function reviewPublicUpdateEvent(updateId: string, reviewAction: PublicUpdateReviewAction, reason: string | null) {
  await invoke({ action: 'review', updateId, reviewAction, reason });
}

export const publicUpdateTypeOptions: Array<{ value: PublicUpdateType; label: string }> = [
  { value: 'candidate', label: '候選人' },
  { value: 'person', label: '人物資料' },
  { value: 'party', label: '政黨資料' },
  { value: 'election', label: '選舉資料' },
  { value: 'correction', label: '資料修正' },
  { value: 'site', label: '網站功能' },
];

export const publicUpdateEntityTypeOptions: Array<{ value: PublicUpdateEntityType; label: string }> = [
  { value: 'person', label: '人物' },
  { value: 'party', label: '政黨' },
  { value: 'election', label: '選舉' },
  { value: 'race', label: '選區' },
  { value: 'region', label: '區域' },
];
