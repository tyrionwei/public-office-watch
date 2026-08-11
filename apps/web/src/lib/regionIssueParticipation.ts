import { getSupabasePublicClient } from './supabasePublicClient';

export type RegionIssueResult = {
  issueId: string;
  regionId: string;
  regionName: string;
  issueKey: string;
  displayOrder: number;
  responseCount: number;
  participantCount: number;
  selectionRate: number;
};

export type RegionIssueParticipation = {
  regionId: string | null;
  issues: RegionIssueResult[];
  selectedIssueIds: string[];
  hasResponse: boolean;
  available: boolean;
};

type RegionIssueResultRow = {
  issue_id: string;
  region_id: string;
  region_name: string;
  issue_key: string;
  display_order: number;
  response_count: number;
  participant_count: number;
  selection_rate: number;
};

type RegionIssueResponsePayload = {
  hasResponse?: boolean;
  selectedIssueIds?: string[];
};

const participantStorageKey = 'public-office-watch:region-issue-participant';

export function getRegionIssueParticipantToken() {
  if (typeof window === 'undefined') return '';

  const existing = window.localStorage.getItem(participantStorageKey);
  if (existing) return existing;

  const token = window.crypto.randomUUID();
  window.localStorage.setItem(participantStorageKey, token);
  return token;
}

function mapIssue(row: RegionIssueResultRow): RegionIssueResult {
  return {
    issueId: row.issue_id,
    regionId: row.region_id,
    regionName: row.region_name,
    issueKey: row.issue_key,
    displayOrder: row.display_order,
    responseCount: row.response_count,
    participantCount: row.participant_count,
    selectionRate: Number(row.selection_rate),
  };
}

export async function loadRegionIssueParticipation(
  regionId: string,
  participantToken: string,
): Promise<RegionIssueParticipation> {
  const client = getSupabasePublicClient();
  if (!client || !regionId || !participantToken) {
    return { regionId: null, issues: [], selectedIssueIds: [], hasResponse: false, available: false };
  }

  const [issuesResult, responseResult] = await Promise.all([
    client
      .from('public_region_issue_results')
      .select('issue_id,region_id,region_name,issue_key,display_order,response_count,participant_count,selection_rate')
      .eq('region_id', regionId)
      .order('display_order', { ascending: true }),
    client.rpc('get_region_issue_response', {
      p_region_id: regionId,
      p_participant_token: participantToken,
    }),
  ]);

  if (issuesResult.error) throw issuesResult.error;
  if (responseResult.error) throw responseResult.error;

  const response = (responseResult.data ?? {}) as RegionIssueResponsePayload;
  return {
    regionId,
    issues: ((issuesResult.data ?? []) as RegionIssueResultRow[]).map(mapIssue),
    selectedIssueIds: Array.isArray(response.selectedIssueIds) ? response.selectedIssueIds : [],
    hasResponse: response.hasResponse === true,
    available: true,
  };
}

export async function loadNationalIssueParticipation(
  participantToken: string,
): Promise<RegionIssueParticipation> {
  const client = getSupabasePublicClient();
  if (!client || !participantToken) {
    return { regionId: null, issues: [], selectedIssueIds: [], hasResponse: false, available: false };
  }

  const issuesResult = await client
    .from('public_region_issue_results')
    .select('issue_id,region_id,region_name,issue_key,display_order,response_count,participant_count,selection_rate')
    .eq('region_name', '臺灣')
    .order('display_order', { ascending: true });

  if (issuesResult.error) throw issuesResult.error;
  const issueRows = (issuesResult.data ?? []) as RegionIssueResultRow[];
  const regionId = issueRows[0]?.region_id ?? null;
  if (!regionId) {
    return { regionId: null, issues: [], selectedIssueIds: [], hasResponse: false, available: false };
  }

  const responseResult = await client.rpc('get_region_issue_response', {
    p_region_id: regionId,
    p_participant_token: participantToken,
  });
  if (responseResult.error) throw responseResult.error;

  const response = (responseResult.data ?? {}) as RegionIssueResponsePayload;
  return {
    regionId,
    issues: issueRows.map(mapIssue),
    selectedIssueIds: Array.isArray(response.selectedIssueIds) ? response.selectedIssueIds : [],
    hasResponse: response.hasResponse === true,
    available: true,
  };
}

export async function submitRegionIssueParticipation(
  regionId: string,
  participantToken: string,
  selectedIssueIds: string[],
) {
  const client = getSupabasePublicClient();
  if (!client) throw new Error('Issue participation is unavailable');

  const { error } = await client.rpc('submit_region_issue_response', {
    p_region_id: regionId,
    p_participant_token: participantToken,
    p_issue_ids: selectedIssueIds,
  });

  if (error) throw error;
}
