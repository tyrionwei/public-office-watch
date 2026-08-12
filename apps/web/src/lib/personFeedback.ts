import { getSupabasePublicClient } from './supabasePublicClient';

export const feedbackSectionKeys = [
  'basic',
  'candidacies',
  'timeline',
  'affiliations',
  'resume',
  'platform',
  'finance',
  'legal',
  'family',
  'sources',
] as const;

export type FeedbackSectionKey = (typeof feedbackSectionKeys)[number];
export type FeedbackKind = 'supplement_request' | 'problem_report';
export type ProblemType = 'inaccurate' | 'outdated' | 'broken_source' | 'misleading' | 'other';

export type PersonFeedbackPriority = {
  sectionKey: FeedbackSectionKey;
  requestCount: number;
};

export type PersonFeedbackSubmission = {
  feedbackKind: FeedbackKind;
  sectionKey: FeedbackSectionKey;
  active: boolean;
  updatedAt: string;
};

export type PersonFeedbackContext = {
  priorities: PersonFeedbackPriority[];
  ownSubmissions: PersonFeedbackSubmission[];
};

type PersonFeedbackInput = {
  personId: string;
  feedbackKind: FeedbackKind;
  sectionKey: FeedbackSectionKey;
  problemType?: ProblemType;
  message?: string;
  evidenceUrl?: string;
};

const participantStorageKey = 'public-office-watch:person-feedback-participant';

function getParticipantToken() {
  if (typeof window === 'undefined') return null;

  const existing = window.localStorage.getItem(participantStorageKey);
  if (existing) return existing;

  const token = window.crypto.randomUUID();
  window.localStorage.setItem(participantStorageKey, token);
  return token;
}

function emptyContext(): PersonFeedbackContext {
  return { priorities: [], ownSubmissions: [] };
}

export async function fetchPersonFeedbackContext(personId: string): Promise<PersonFeedbackContext> {
  const client = getSupabasePublicClient();
  const participantToken = getParticipantToken();
  if (!client || !participantToken) return emptyContext();

  const { data, error } = await client.schema('published').rpc('get_person_feedback_context', {
    p_person_id: personId,
    p_participant_token: participantToken,
  });

  if (error) throw error;
  const context = data && typeof data === 'object' ? data as Partial<PersonFeedbackContext> : {};
  return {
    priorities: Array.isArray(context.priorities) ? context.priorities : [],
    ownSubmissions: Array.isArray(context.ownSubmissions) ? context.ownSubmissions : [],
  };
}

export async function submitPersonFeedback(input: PersonFeedbackInput) {
  const client = getSupabasePublicClient();
  const participantToken = getParticipantToken();
  if (!client || !participantToken) throw new Error('Person feedback is unavailable.');

  const { error } = await client.schema('published').rpc('submit_person_feedback', {
    p_person_id: input.personId,
    p_participant_token: participantToken,
    p_feedback_kind: input.feedbackKind,
    p_section_key: input.sectionKey,
    p_problem_type: input.problemType ?? null,
    p_message: input.message ?? null,
    p_evidence_url: input.evidenceUrl ?? null,
  });

  if (error) throw error;
  return fetchPersonFeedbackContext(input.personId);
}
