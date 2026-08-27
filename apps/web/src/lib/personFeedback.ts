import {
  ensureAnonymousParticipationSession,
  getExistingParticipationSession,
  getSupabaseParticipationClient,
} from './supabasePublicClient';
import {
  createParticipationCaptchaToken,
  submitParticipationRequest,
} from './participationSecurity';

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

const feedbackContextRequests = new Map<string, Promise<PersonFeedbackContext>>();

function emptyContext(): PersonFeedbackContext {
  return { priorities: [], ownSubmissions: [] };
}

export async function fetchPersonFeedbackContext(personId: string): Promise<PersonFeedbackContext> {
  const client = getSupabaseParticipationClient();
  if (!client) return emptyContext();
  const session = await getExistingParticipationSession();
  if (!session) return emptyContext();

  const requestKey = `${personId}:${session.user.id}`;
  const existingRequest = feedbackContextRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = Promise.resolve(client.schema('published').rpc('get_person_feedback_context', {
    p_person_id: personId,
  })).then(({ data, error }) => {
    if (error) throw error;
    const context = data && typeof data === 'object' ? data as Partial<PersonFeedbackContext> : {};
    return {
      priorities: Array.isArray(context.priorities) ? context.priorities : [],
      ownSubmissions: Array.isArray(context.ownSubmissions) ? context.ownSubmissions : [],
    };
  }).finally(() => {
    feedbackContextRequests.delete(requestKey);
  });

  feedbackContextRequests.set(requestKey, request);
  return request;
}

export async function submitPersonFeedback(input: PersonFeedbackInput) {
  const client = getSupabaseParticipationClient();
  if (!client) throw new Error('Person feedback is unavailable.');
  const session = await getExistingParticipationSession()
    ?? await ensureAnonymousParticipationSession(await createParticipationCaptchaToken());

  await submitParticipationRequest(session, {
    action: 'person-feedback',
    personId: input.personId,
    feedbackKind: input.feedbackKind,
    sectionKey: input.sectionKey,
    problemType: input.problemType,
    message: input.message,
    evidenceUrl: input.evidenceUrl,
  });

  return fetchPersonFeedbackContext(input.personId);
}
