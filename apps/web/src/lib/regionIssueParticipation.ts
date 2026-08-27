import {
  ensureAnonymousParticipationSession,
  getSupabaseParticipationClient,
} from './supabasePublicClient';
import { submitParticipationRequest } from './participationSecurity';

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
): Promise<RegionIssueParticipation> {
  const client = getSupabaseParticipationClient();
  if (!client || !regionId) {
    return { regionId: null, issues: [], selectedIssueIds: [], hasResponse: false, available: false };
  }
  await ensureAnonymousParticipationSession();

  const [issuesResult, responseResult] = await Promise.all([
    client
      .schema('published')
      .rpc('region_issue_results', {
        p_region_id: regionId,
        p_region_name: null,
      }),
    client.schema('published').rpc('get_region_issue_response', {
      p_region_id: regionId,
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

export async function loadNationalIssueParticipation(): Promise<RegionIssueParticipation> {
  const client = getSupabaseParticipationClient();
  if (!client) {
    return { regionId: null, issues: [], selectedIssueIds: [], hasResponse: false, available: false };
  }
  await ensureAnonymousParticipationSession();

  const issuesResult = await client.schema('published').rpc('region_issue_results', {
    p_region_id: null,
    p_region_name: '臺灣',
  });

  if (issuesResult.error) throw issuesResult.error;
  const issueRows = (issuesResult.data ?? []) as RegionIssueResultRow[];
  const regionId = issueRows[0]?.region_id ?? null;
  if (!regionId) {
    return { regionId: null, issues: [], selectedIssueIds: [], hasResponse: false, available: false };
  }

  const responseResult = await client.schema('published').rpc('get_region_issue_response', {
    p_region_id: regionId,
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
  selectedIssueIds: string[],
) {
  const client = getSupabaseParticipationClient();
  if (!client) throw new Error('Issue participation is unavailable');
  const session = await ensureAnonymousParticipationSession();

  await submitParticipationRequest(session, {
    action: 'region-issue',
    regionId,
    issueIds: selectedIssueIds,
  });
}
