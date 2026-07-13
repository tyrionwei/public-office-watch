export type RegionHighlightBackground = {
  regionId: string;
  image: string;
  feature: string;
  focalPoint: string;
};

export const regionHighlightBackgrounds: Record<string, RegionHighlightBackground> = {
  'county-63000': { regionId: 'county-63000', image: '/assets/regions/county-63000-day.png', feature: '臺北 101 與城市天際線', focalPoint: '72% 50%' },
  'county-65000': { regionId: 'county-65000', image: '/assets/regions/county-65000-day.png', feature: '野柳海岸與女王頭', focalPoint: '74% 52%' },
  'county-68000': { regionId: 'county-68000', image: '/assets/regions/county-68000-day.png', feature: '機場跑道與航廈', focalPoint: '70% 54%' },
  'county-66000': { regionId: 'county-66000', image: '/assets/regions/county-66000-day.png', feature: '歌劇院曲面與都會線條', focalPoint: '74% 52%' },
  'county-67000': { regionId: 'county-67000', image: '/assets/regions/county-67000-day.png', feature: '赤崁樓與古城線條', focalPoint: '72% 52%' },
  'county-64000': { regionId: 'county-64000', image: '/assets/regions/county-64000-day.png', feature: '港灣吊臂與 85 大樓', focalPoint: '72% 54%' },
  'county-10017': { regionId: 'county-10017', image: '/assets/regions/county-10017-day.png', feature: '港口與基隆嶼', focalPoint: '72% 52%' },
  'county-10018': { regionId: 'county-10018', image: '/assets/regions/county-10018-day.png', feature: '迎曦門與風城線條', focalPoint: '72% 50%' },
  'county-10020': { regionId: 'county-10020', image: '/assets/regions/county-10020-day.png', feature: '檜意街屋與城市綠帶', focalPoint: '72% 54%' },
  'county-10002': { regionId: 'county-10002', image: '/assets/regions/county-10002-day.png', feature: '龜山島與蘭陽海岸', focalPoint: '74% 52%' },
  'county-10004': { regionId: 'county-10004', image: '/assets/regions/county-10004-day.png', feature: '內灣山線與吊橋', focalPoint: '72% 52%' },
  'county-10005': { regionId: 'county-10005', image: '/assets/regions/county-10005-day.png', feature: '龍騰斷橋與丘陵', focalPoint: '72% 54%' },
  'county-10007': { regionId: 'county-10007', image: '/assets/regions/county-10007-day.png', feature: '八卦山大佛', focalPoint: '72% 50%' },
  'county-10008': { regionId: 'county-10008', image: '/assets/regions/county-10008-day.png', feature: '日月潭與中央山脈', focalPoint: '72% 52%' },
  'county-10009': { regionId: 'county-10009', image: '/assets/regions/county-10009-day.png', feature: '北港廟埕與農田', focalPoint: '72% 54%' },
  'county-10010': { regionId: 'county-10010', image: '/assets/regions/county-10010-day.png', feature: '阿里山日出與森林鐵道', focalPoint: '72% 52%' },
  'county-10013': { regionId: 'county-10013', image: '/assets/regions/county-10013-day.png', feature: '墾丁燈塔與海岸', focalPoint: '74% 52%' },
  'county-10014': { regionId: 'county-10014', image: '/assets/regions/county-10014-day.png', feature: '熱氣球與縱谷', focalPoint: '72% 50%' },
  'county-10015': { regionId: 'county-10015', image: '/assets/regions/county-10015-day.png', feature: '太魯閣峽谷與溪流', focalPoint: '72% 52%' },
  'county-10016': { regionId: 'county-10016', image: '/assets/regions/county-10016-day.png', feature: '玄武岩與雙心石滬', focalPoint: '72% 54%' },
  'county-09020': { regionId: 'county-09020', image: '/assets/regions/county-09020-day.png', feature: '風獅爺與閩南屋脊', focalPoint: '72% 52%' },
  'county-09007': { regionId: 'county-09007', image: '/assets/regions/county-09007-day.png', feature: '藍眼淚海岸與石屋', focalPoint: '72% 54%' },
};

export function getRegionHighlightBackground(
  regionId: string | null | undefined,
  publicRegionId?: string | null,
  stageLabel?: string | null,
) {
  const candidateIds = [
    regionId,
    publicRegionId,
    publicRegionId?.replace(/^region-/, 'county-'),
    stageLabel ? 'county-' + stageLabel : null,
  ];

  for (const candidateId of candidateIds) {
    if (candidateId && regionHighlightBackgrounds[candidateId]) {
      return regionHighlightBackgrounds[candidateId];
    }
  }

  return null;
}
