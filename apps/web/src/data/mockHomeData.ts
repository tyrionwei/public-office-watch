import { partyTheme, type PartyThemeKey } from '../styles/partyThemes';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import {
  mockPublicHomeElectionTicker,
  mockPublicRaces,
  mockPublicRegionElectionSummary,
} from './mockPublicViews';
import { mockStageRegionNodes, mockStageRegionSummaries } from './mockStageMap';

export type RegionCard = {
  id: string;
  name: string;
  tone: string;
  electionName: string;
  nextVotingDate: string;
  upcomingRaceCount: number;
};

export type UpcomingRace = {
  id: string;
  electionId: string;
  title: string;
  region: string;
  regionId: string;
  date: string;
  status: string;
  partyTag: PartyThemeKey;
  partyLabel: string;
};

const regionTones: Record<string, string> = {
  'north-metro': '交通樞紐與高密度都會選區',
  'central-hill': '跨行政區導覽 placeholder',
  'south-coast': '港口與沿海生活圈',
};

const partyByRaceId: Record<string, PartyThemeKey> = {
  'race-example-mayor': 'dpp',
  'race-example-council': 'kmt',
  'race-example-legislator': 'independent',
};

const nextTicker = mockPublicHomeElectionTicker[0];

export const nextEvent = {
  title: nextTicker?.election_name ?? '範例公開選舉',
  subtitle: '依公開公告整理的下一個重點選舉節點',
  date: nextTicker?.voting_date ?? '2026-11-28',
};

export const regions: RegionCard[] = mockPublicRegionElectionSummary.map((summary) => ({
  id: summary.region_slug,
  name: summary.region_name,
  tone: regionTones[summary.region_slug] ?? '公開資料導覽區塊',
  electionName: summary.next_election_name ?? '尚無公開選舉資料',
  nextVotingDate: summary.next_voting_date ?? '待公告',
  upcomingRaceCount: summary.upcoming_race_count,
}));

export const upcomingRaces: UpcomingRace[] = mockPublicRaces.map((race) => {
  const partyTag = partyByRaceId[race.race_id] ?? 'unknown';

  return {
    id: race.race_id,
    electionId: race.election_id,
    title: race.title,
    region: race.region_name ?? '未指定區域',
    regionId: race.region_slug ?? 'unknown-region',
    date: race.voting_date ?? '待公告',
    status: race.status,
    partyTag,
    partyLabel: partyTheme[partyTag].label,
  };
});

export const stageRegionNodes: StageRegionNode[] = mockStageRegionNodes;
export const stageRegionSummaries: StageRegionSummary[] = mockStageRegionSummaries;

export const dataPrinciples = [
  '只呈現公開且可追溯的資料。',
  '人工審核與來源紀錄優先於視覺效果。',
  '行政區導覽不等於正式選舉選區。',
  '前端僅讀 public views，不讀未審核資料。',
  '介面可帶 arcade 語言，但資料表達保持中性。',
];
