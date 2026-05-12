export const partyTheme = {
  dpp: {
    key: 'dpp',
    label: '民主進步黨',
    primary: '#1F8B4C',
    accent: '#8FE3B2',
    text: '#F8FFF9',
  },
  kmt: {
    key: 'kmt',
    label: '中國國民黨',
    primary: '#1E4FA8',
    accent: '#9BC1FF',
    text: '#F7FBFF',
  },
  tpp: {
    key: 'tpp',
    label: '台灣民眾黨',
    primary: '#7BE7F3',
    accent: '#E9FDFF',
    text: '#10343A',
  },
  npp: {
    key: 'npp',
    label: '時代力量',
    primary: '#F2D43D',
    accent: '#FFF4A8',
    text: '#2C2400',
  },
  pfp: {
    key: 'pfp',
    label: '親民黨',
    primary: '#F28A24',
    accent: '#FFD0A3',
    text: '#2A1700',
  },
  tsp: {
    key: 'tsp',
    label: '台灣基進',
    primary: '#7B3FE4',
    accent: '#D6C2FF',
    text: '#FAF7FF',
  },
  independent: {
    key: 'independent',
    label: '無黨籍',
    primary: '#5B6472',
    accent: '#D7B75E',
    text: '#F8FAFC',
  },
  unknown: {
    key: 'unknown',
    label: '未知政黨',
    primary: '#667085',
    accent: '#CBD5E1',
    text: '#F8FAFC',
  },
} as const;

export type PartyThemeKey = keyof typeof partyTheme;
