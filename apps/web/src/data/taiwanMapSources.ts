import type { TaiwanMapSourceMetadata } from '../types/taiwanMap';

export const countyCityBoundarySource: TaiwanMapSourceMetadata = {
  id: 'taiwan-county-city-boundary',
  title: '直轄市、縣市界線資料集',
  provider: '內政部國土測繪中心 / 政府資料開放平台',
  sourceUrl: 'https://data.gov.tw/dataset/7442',
  license: '政府資料開放授權條款',
  downloadedAt: null,
  transformedAt: null,
  transformNote: '待確認實際下載來源、轉檔流程與 simplification 設定。',
};

export const townDistrictBoundarySource: TaiwanMapSourceMetadata = {
  id: 'taiwan-town-district-boundary',
  title: '鄉鎮市區界線資料集',
  provider: '內政部國土測繪中心 / 政府資料開放平台',
  sourceUrl: 'https://data.gov.tw/dataset/7441',
  license: '政府資料開放授權條款',
  downloadedAt: null,
  transformedAt: null,
  transformNote: '待確認實際下載來源、轉檔流程與 simplification 設定。',
};
