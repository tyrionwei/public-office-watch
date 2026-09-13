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
