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
  const session = await getExistingParticipationSession().catch(() => null);

  const requestKey = `${personId}:${session?.user.id ?? 'public'}`;
  const existingRequest = feedbackContextRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const prioritiesRequest = Promise.resolve(
    client.schema('published').rpc('person_feedback_priorities', { p_person_id: personId }),
  );
  const ownSubmissionsRequest = session
    ? Promise.resolve(client.schema('published').rpc('get_person_feedback_own_submissions', {
        p_person_id: personId,
      }))
    : Promise.resolve({ data: [], error: null });

  const request = Promise.all([prioritiesRequest, ownSubmissionsRequest]).then(([
    prioritiesResult,
    ownSubmissionsResult,
  ]) => {
    if (prioritiesResult.error) throw prioritiesResult.error;
    if (ownSubmissionsResult.error) throw ownSubmissionsResult.error;
    return {
      priorities: Array.isArray(prioritiesResult.data) ? prioritiesResult.data : [],
      ownSubmissions: Array.isArray(ownSubmissionsResult.data) ? ownSubmissionsResult.data : [],
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
