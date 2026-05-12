import { partyTheme, type PartyThemeKey } from '../styles/partyThemes';

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
  title: string;
  region: string;
  date: string;
  status: string;
  partyTag: PartyThemeKey;
  partyLabel: string;
};

export const nextEvent = {
  title: '範例地方公職選舉',
  subtitle: '依公開公告整理的下一個重點選舉節點',
  date: '2026-11-28',
};

export const regions: RegionCard[] = [
  {
    id: 'north-metro',
    name: '北部都會區',
    tone: '交通樞紐與高密度都會選區',
    electionName: '範例市長選舉',
    nextVotingDate: '2026-11-28',
    upcomingRaceCount: 3,
  },
  {
    id: 'central-hill',
    name: '中部山線',
    tone: '跨行政區導覽 placeholder',
    electionName: '範例議員選舉',
    nextVotingDate: '2026-11-28',
    upcomingRaceCount: 2,
  },
  {
    id: 'south-coast',
    name: '南部海線',
    tone: '港口與沿海生活圈',
    electionName: '範例區域選舉',
    nextVotingDate: '2026-11-28',
    upcomingRaceCount: 4,
  },
];

export const upcomingRaces: UpcomingRace[] = [
  {
    id: 'race-1',
    title: '範例市長選舉',
    region: '北部都會區',
    date: '2026-11-28',
    status: 'upcoming',
    partyTag: 'dpp',
    partyLabel: partyTheme.dpp.label,
  },
  {
    id: 'race-2',
    title: '範例議員選舉',
    region: '中部山線',
    date: '2026-11-28',
    status: 'announced',
    partyTag: 'kmt',
    partyLabel: partyTheme.kmt.label,
  },
  {
    id: 'race-3',
    title: '範例區域立委選舉',
    region: '南部海線',
    date: '2026-11-28',
    status: 'announced',
    partyTag: 'independent',
    partyLabel: partyTheme.independent.label,
  },
];

export const dataPrinciples = [
  '只呈現公開且可追溯的資料。',
  '證據頁以來源、信心等級與更新時間優先。',
  '前端僅讀 public views，不讀未審核資料。',
  '視覺風格可帶 arcade 語言，但資料表達保持中性。',
];
