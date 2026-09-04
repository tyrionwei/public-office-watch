import type { StageRegionNode, StageRegionSummary } from '../types/stageMap.ts';
import { countyCityBoundarySource } from './taiwanMapSources.ts';

const boundaryNote = '行政區邊界不等於正式選舉選區，此資料僅作為區域導覽與公開資料索引用途。';
const sourceNote = '縣市 metadata 依政府開放資料集欄位規劃整理，未包含人物、公司、關係、候選人或民調真實資料。';

export type TaiwanRegionMetadata = {
  id: string;
  slug: string;
  code: string;
  name: string;
  level: 'county_city';
  parentCode: null;
  sourceId: string;
  boundaryNote: string;
};

export const taiwanRegions: TaiwanRegionMetadata[] = [
  { id: 'county-63000', slug: 'taipei-city', code: '63000', name: '臺北市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-65000', slug: 'new-taipei-city', code: '65000', name: '新北市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-68000', slug: 'taoyuan-city', code: '68000', name: '桃園市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-66000', slug: 'taichung-city', code: '66000', name: '臺中市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-67000', slug: 'tainan-city', code: '67000', name: '臺南市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-64000', slug: 'kaohsiung-city', code: '64000', name: '高雄市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10017', slug: 'keelung-city', code: '10017', name: '基隆市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10018', slug: 'hsinchu-city', code: '10018', name: '新竹市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10020', slug: 'chiayi-city', code: '10020', name: '嘉義市', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10002', slug: 'yilan-county', code: '10002', name: '宜蘭縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10004', slug: 'hsinchu-county', code: '10004', name: '新竹縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10005', slug: 'miaoli-county', code: '10005', name: '苗栗縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10007', slug: 'changhua-county', code: '10007', name: '彰化縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10008', slug: 'nantou-county', code: '10008', name: '南投縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10009', slug: 'yunlin-county', code: '10009', name: '雲林縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10010', slug: 'chiayi-county', code: '10010', name: '嘉義縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10013', slug: 'pingtung-county', code: '10013', name: '屏東縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10014', slug: 'taitung-county', code: '10014', name: '臺東縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10015', slug: 'hualien-county', code: '10015', name: '花蓮縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-10016', slug: 'penghu-county', code: '10016', name: '澎湖縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-09020', slug: 'kinmen-county', code: '09020', name: '金門縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
  { id: 'county-09007', slug: 'lienchiang-county', code: '09007', name: '連江縣', level: 'county_city', parentCode: null, sourceId: countyCityBoundarySource.id, boundaryNote },
];

export const taiwanStageRegionNodes: StageRegionNode[] = taiwanRegions.map((region, index) => ({
  id: region.slug,
  label: region.name,
  level: 'county_city',
  parentId: 'taiwan-stage',
  publicRegionId: region.id,
  displayOrder: index + 1,
  stageLabel: region.code,
  isPlaceholder: false,
  note: 'official county/city metadata',
}));

export const taiwanStageRegionSummaries: StageRegionSummary[] = taiwanRegions.map((region) => ({
  regionId: region.slug,
  label: region.name,
  nearestElectionName: '待接入公開選舉 metadata',
  nearestElectionDate: 'TBD',
  upcomingRaceCount: 0,
  sourceNote,
  boundaryNote,
}));
