import type { TaiwanMapSourceMetadata } from '../types/taiwanMap';

export const countyCityBoundarySource: TaiwanMapSourceMetadata = {
  id: 'taiwan-county-city-boundary',
  title: '直轄市、縣市界線(TWD97經緯度)',
  provider: '內政部國土測繪中心',
  sourceUrl: 'https://data.gov.tw/dataset/7442',
  license: '政府資料開放授權條款-第1版',
  downloadedAt: '2026-05-13',
  transformedAt: '2026-05-13',
  transformNote:
    '官方 SHP 來源為 data.gov.tw/dataset/7442 對應之 NLSC 縣市界線(TWD97經緯度EPSG:3824) SHP ZIP。轉換流程使用 mapshaper，simplify 比例為 dp 3%，GeoJSON precision 為 0.0001，prepare script 另將 SVG path 座標 round 到小數第 4 位。generated asset 目前為 schematic display 版本，加入 displayPath、displayBounds、centroid、displayCentroid 與 mainIslandDisplayViewBox。display box 採 340x520，main island x exaggeration 為 2.05，用於 arcade stage map UI readability，不作法定邊界量測用途。部分本島縣市 displayPath 會忽略遠方附屬小島以避免主舞台過窄。generated asset 大小需維持低於 500KB；raw zip、shapefile、work GeoJSON 均未 commit。',
};

export const townDistrictBoundarySource: TaiwanMapSourceMetadata = {
  id: 'taiwan-town-district-boundary',
  title: '鄉鎮市區界線(TWD97經緯度)',
  provider: '內政部國土測繪中心',
  sourceUrl: 'https://data.gov.tw/dataset/7441',
  license: '政府資料開放授權條款-第1版',
  downloadedAt: null,
  transformedAt: null,
  transformNote:
    '本階段先保留第二層來源 metadata。若後續導入鄉鎮市區 geometry，raw 檔同樣應放在 local-data/maps/work/，轉換後只 commit 簡化資產。',
};
