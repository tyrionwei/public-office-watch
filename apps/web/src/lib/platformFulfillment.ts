import {
  ensureAnonymousParticipationSession,
  getExistingParticipationSession,
  getSupabaseParticipationClient,
} from './supabasePublicClient.ts';
import {
  createParticipationCaptchaToken,
  submitParticipationRequest,
} from './participationSecurity.ts';

export const platformFulfillmentStatuses = [
  'fulfilled',
  'in_progress',
  'not_fulfilled',
  'insufficient_information',
] as const;

export const platformFulfillmentSummaryMinimumVotes = 20;

export type PlatformFulfillmentStatus = typeof platformFulfillmentStatuses[number];

export type PlatformFulfillmentItem = {
  itemKey: string;
  displayOrder: number;
  promiseText: string;
  counts: Record<PlatformFulfillmentStatus, number>;
  totalCount: number;
};


export type PlatformFulfillmentParticipation = {
  claimId: string;
  items: PlatformFulfillmentItem[];
  ownVotes: Partial<Record<string, PlatformFulfillmentStatus>>;
  available: boolean;
  resultsAnnouncedOn: string | null;
  votingOpensOn: string | null;
  votingIsOpen: boolean;
};

type PlatformFulfillmentResultRow = {
  item_key: string;
  display_order: number;
  promise_text: string;
  fulfilled_count: number | string;
  in_progress_count: number | string;
  not_fulfilled_count: number | string;
  insufficient_information_count: number | string;
  total_count: number | string;
  results_announced_on: string | null;
  voting_opens_on: string | null;
  voting_is_open: boolean;
};

type PlatformFulfillmentVoteRow = {
  item_key: string;
  vote_status: PlatformFulfillmentStatus;
};

function count(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isFulfillmentStatus(value: unknown): value is PlatformFulfillmentStatus {
  return typeof value === 'string'
    && platformFulfillmentStatuses.includes(value as PlatformFulfillmentStatus);
}

function mapResult(row: PlatformFulfillmentResultRow): PlatformFulfillmentItem {
  return {
    itemKey: row.item_key,
    displayOrder: Number(row.display_order),
    promiseText: row.promise_text,
    counts: {
      fulfilled: count(row.fulfilled_count),
      in_progress: count(row.in_progress_count),
      not_fulfilled: count(row.not_fulfilled_count),
      insufficient_information: count(row.insufficient_information_count),
    },
    totalCount: count(row.total_count),
  };
}

export function fulfillmentPercent(countValue: number, totalCount: number) {
  if (totalCount <= 0 || countValue <= 0) return 0;
  return countValue * 100 / totalCount;
}

export function summarizePlatformFulfillment(
  items: PlatformFulfillmentItem[],
  minimumVotes = platformFulfillmentSummaryMinimumVotes,
) {
  const qualifyingItems = items.filter((item) => item.totalCount >= minimumVotes);
  const counts: Record<PlatformFulfillmentStatus, number> = {
    fulfilled: 0,
    in_progress: 0,
    not_fulfilled: 0,
    insufficient_information: 0,
  };

  for (const item of qualifyingItems) {
    for (const status of platformFulfillmentStatuses) {
      counts[status] += item.counts[status] / item.totalCount;
    }
  }

  const totalVoteCount = qualifyingItems
    .reduce((total, item) => total + item.totalCount, 0);

  return {
    counts,
    totalCount: qualifyingItems.length,
    qualifyingItemCount: qualifyingItems.length,
    itemCount: items.length,
    totalVoteCount,
    ready: items.length > 0
      && qualifyingItems.length === items.length,
  };
}

export async function loadPlatformFulfillment(
  claimId: string,
): Promise<PlatformFulfillmentParticipation> {
  const client = getSupabaseParticipationClient();
  if (!client || !claimId) {
    return {
      claimId,
      items: [],
      ownVotes: {},
      available: false,
      resultsAnnouncedOn: null,
      votingOpensOn: null,
      votingIsOpen: false,
    };
  }

  const results = await client
    .schema('published')
    .rpc('platform_fulfillment_results', { p_claim_id: claimId });
  if (results.error) throw results.error;

  const session = await getExistingParticipationSession();
  const ownResult = session
    ? await client
      .schema('published')
      .rpc('get_platform_fulfillment_votes', { p_claim_id: claimId })
    : null;
  if (ownResult?.error) throw ownResult.error;

  const ownVotes: Partial<Record<string, PlatformFulfillmentStatus>> = {};
  for (const row of (ownResult?.data ?? []) as PlatformFulfillmentVoteRow[]) {
    if (typeof row.item_key === 'string' && isFulfillmentStatus(row.vote_status)) {
      ownVotes[row.item_key] = row.vote_status;
    }
  }

  const resultRows = (results.data ?? []) as PlatformFulfillmentResultRow[];
  const firstResult = resultRows[0];
  const items = resultRows
    .map(mapResult)
    .filter((item) => item.itemKey && item.promiseText)
    .sort((left, right) => left.displayOrder - right.displayOrder);

  return {
    claimId,
    items,
    ownVotes,
    available: items.length > 0,
    resultsAnnouncedOn: firstResult?.results_announced_on ?? null,
    votingOpensOn: firstResult?.voting_opens_on ?? null,
    votingIsOpen: firstResult?.voting_is_open === true,
  };
}

export async function submitPlatformFulfillmentVote(
  claimId: string,
  itemKey: string,
  voteStatus: PlatformFulfillmentStatus,
) {
  const client = getSupabaseParticipationClient();
  if (!client) throw new Error('Platform fulfilment voting is unavailable');
  const session = await getExistingParticipationSession()
    ?? await ensureAnonymousParticipationSession(await createParticipationCaptchaToken());

  await submitParticipationRequest(session, {
    action: 'platform-fulfillment',
    claimId,
    itemKey,
    voteStatus,
  });
}

export async function withdrawPlatformFulfillmentVote(
  claimId: string,
  itemKey: string,
) {
  const client = getSupabaseParticipationClient();
  if (!client) throw new Error('Platform fulfilment voting is unavailable');
  const session = await getExistingParticipationSession()
    ?? await ensureAnonymousParticipationSession(await createParticipationCaptchaToken());

  await submitParticipationRequest(session, {
    action: 'platform-fulfillment-withdrawal',
    claimId,
    itemKey,
  });
}
