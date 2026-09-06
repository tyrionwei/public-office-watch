import { taiwanRegions } from '../data/taiwanRegions.ts';
import type { StageRegionNode } from '../types/stageMap.ts';
import { normalizeTaiwanText, toCurrentCountyName } from './taiwanText.ts';

type CountyRegion = Pick<StageRegionNode, 'id' | 'label' | 'level'>;

export function isHistoricalCountyRegion(region: CountyRegion) {
  return region.level === 'county_city' && (
    region.id.startsWith('historical-')
    || normalizeTaiwanText(region.label) !== toCurrentCountyName(region.label)
  );
}

export function isCurrentCountyRegion(region: CountyRegion) {
  return region.level === 'county_city' && taiwanRegions.some((county) => (
    (region.id === county.slug || region.id === county.id)
    && normalizeTaiwanText(region.label) === county.name
  ));
}

// Only canonical current IDs may populate current navigation, regardless of selection or input order.
export function getCurrentCountyRegions(regions: StageRegionNode[]) {
  return taiwanRegions.flatMap((county) => {
    const region = regions.find((item) => item.id === county.slug && isCurrentCountyRegion(item))
      ?? regions.find((item) => item.id === county.id && isCurrentCountyRegion(item));
    return region ? [region] : [];
  });
}

export function getCountyRegionLabel(region: CountyRegion, language = 'zh-TW') {
  return isHistoricalCountyRegion(region)
    ? region.label + (language === 'en' ? ' (historical area)' : '（歷史行政區）')
    : region.label;
}
