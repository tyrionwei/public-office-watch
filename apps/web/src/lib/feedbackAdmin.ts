import { feedbackEnvironmentMatches } from './feedbackEnvironment';
import { getSupabasePublicEnv } from './supabaseEnv';
import { getSupabaseChatAdminClient } from './supabasePublicClient';
import { sendAdminMagicLink } from './adminMagicLink';
import { createAdminLoginCaptchaToken } from './participationSecurity';

export const feedbackBuckets = ['pending', 'priority', 'normal', 'rejected'] as const;
export type FeedbackBucket = typeof feedbackBuckets[number];
export const bucketLabels: Record<FeedbackBucket, string> = { pending: '新回饋／待處理', priority: '優先處理', normal: '已採納・一般處理', rejected: '已駁回' };
export const progressLabels = { pending: '待執行', in_progress: '處理中', completed: '已完成' };
export type FeedbackItem = {
  id: string; person_id: string; person_name: string; feedback_kind: string; section_key: string; problem_type: string | null;
  message: string | null; evidence_url: string | null; decision: 'pending' | 'accepted' | 'rejected'; priority: 'normal' | 'high';
  work_status: keyof typeof progressLabels; management_summary: string; review_note: string | null; reviewed_by: string | null;
  reviewed_at: string | null; revision: number; content_version: number; previous_decision: string | null;
  submission_count: number; created_at: string; updated_at: string; waiting_since: string;
};
export type FeedbackGroup = { total: number; completed: number; unfinished: number; oldest_waiting_at: string | null; page: number; page_size: number; items: FeedbackItem[] };
export type FeedbackDashboard = { fetched_at: string; groups: Record<FeedbackBucket, FeedbackGroup> };
export type FeedbackHistory = { id: number; event: string; actor_id: string | null; created_at: string; before_state: FeedbackItem | null; after_state: FeedbackItem };
export type FeedbackDetail = { item: FeedbackItem; history: FeedbackHistory[]; history_total: number; history_page: number };
export type FeedbackDraft = { decision: FeedbackItem['decision']; priority: FeedbackItem['priority']; workStatus: FeedbackItem['work_status']; summary: string; note: string };
export function feedbackBucket(item: Pick<FeedbackItem, 'decision' | 'priority'>): FeedbackBucket { return item.decision === 'accepted' ? item.priority === 'high' ? 'priority' : 'normal' : item.decision; }
export function draftFrom(item: FeedbackItem): FeedbackDraft { return { decision: item.decision, priority: item.priority, workStatus: item.work_status, summary: item.management_summary, note: item.review_note ?? '' }; }
export const feedbackConflictLabels = { status: '處理決定／優先程度／執行進度', summary: '管理摘要', note: '處理備註' };
export type FeedbackConflictField = keyof typeof feedbackConflictLabels;
export function reconcileFeedbackDraft(base: FeedbackDraft, mine: FeedbackDraft, latest: FeedbackDraft, choices: Partial<Record<FeedbackConflictField, 'mine' | 'latest'>> = {}) {
  const result = { ...latest };
  const conflicts: FeedbackConflictField[] = [];
  const groups = { status: ['decision', 'priority', 'workStatus'], summary: ['summary'], note: ['note'] } as const;
  for (const field of Object.keys(groups) as FeedbackConflictField[]) {
    const keys = groups[field];
    const changed = keys.some(key => mine[key] !== base[key]);
    const remoteChanged = keys.some(key => latest[key] !== base[key]);
    const differs = keys.some(key => mine[key] !== latest[key]);
    if (changed && remoteChanged && differs) conflicts.push(field);
    const source = changed && (!remoteChanged || !differs || choices[field] === 'mine') ? mine : latest;
    Object.assign(result, Object.fromEntries(keys.map(key => [key, source[key]])));
  }
  return { draft: result, conflicts, unresolved: conflicts.filter(field => !choices[field]) };
}
// This key only scopes UI state; server-side authorization remains mandatory.
// A refreshed access token keeps session_id; a new login has a different session_id.
export function feedbackSessionKey(session: { user: { id: string; is_anonymous?: boolean }; access_token: string } | null): string | null {
  if (!session || session.user.is_anonymous) return null;
  try {
    const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    return typeof claims.session_id === 'string' && claims.session_id && claims.sub === session.user.id
      ? `${session.user.id}:${claims.session_id}` : null;
  } catch { return null; }
}
export class FeedbackApiError extends Error { constructor(public code: string, public status = 0) { super(code); } }
export function getFeedbackAdminClient() {
  const env = getSupabasePublicEnv();
  if (!env || !feedbackEnvironmentMatches(window.location.origin, env.url)) return null;
  return getSupabaseChatAdminClient();
}
export async function feedbackRequest<T>(action: string, input: object = {}): Promise<T> {
  const client = getFeedbackAdminClient();
  if (!client) throw new FeedbackApiError('FEEDBACK_UNAVAILABLE');
  const { data, error } = await client.functions.invoke('feedback-admin', { body: { action, input } });
  if (!error) return data as T;
  let code = 'FEEDBACK_SERVER_ERROR'; let status = 0;
  if (error.context instanceof Response) { status = error.context.status; try { code = (await error.context.json()).error ?? code; } catch { /* Keep generic error. */ } }
  throw new FeedbackApiError(code, status);
}
export async function requestFeedbackLogin(email: string) {
  const client = getFeedbackAdminClient();
  if (!client) throw new FeedbackApiError('FEEDBACK_UNAVAILABLE');
  // This route must be in the deployment environment auth redirect allowlist.
  await sendAdminMagicLink(client.auth, email, `${window.location.origin}/internal/feedback-admin`, createAdminLoginCaptchaToken);
}
