import type { PollingPlace } from '../types/pollingPlace';

export function validNeighborhood(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999 ? value : undefined;
}

function venueKey(place: PollingPlace) {
  const normalize = (value: string) => value.normalize('NFKC').replace(/臺/g, '台').replace(/\s+/g, '').trim();
  const name = normalize(place.station_name);
  const address = normalize(place.address);
  return name || address ? name + '|' + address : place.id;
}

function formatNumberRanges(values: number[], width = 0) {
  const sorted = Array.from(new Set(values)).sort((left, right) => left - right);
  const format = (value: number) => String(value).padStart(width, '0');
  const ranges: string[] = [];

  for (let index = 0; index < sorted.length;) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    if (end - index >= 2) ranges.push(format(sorted[index]) + '–' + format(sorted[end]));
    else for (let item = index; item <= end; item += 1) ranges.push(format(sorted[item]));
    index = end + 1;
  }

  return ranges.join('、');
}

function expandStationNumberRanges(value: string) {
  return value.split('、').flatMap((part) => {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)[–-](\d+)$/);
    if (!range) return trimmed ? [trimmed] : [];
    const start = Number(range[1]);
    const end = Number(range[2]);
    const width = Math.max(range[1].length, range[2].length);
    if (end < start || end - start > 999) return [trimmed];
    return Array.from({ length: end - start + 1 }, (_, index) => String(start + index).padStart(width, '0'));
  });
}

export function dedupePollingPlaces(places: PollingPlace[]) {
  const venues = new Map<string, PollingPlace>();

  for (const place of places) {
    const key = venueKey(place);
    const existing = venues.get(key);
    if (!existing) {
      venues.set(key, { ...place, neighborhoods: [...place.neighborhoods] });
      continue;
    }

    const stationNumbers = Array.from(new Set(
      [...expandStationNumberRanges(existing.station_no), ...expandStationNumberRanges(place.station_no)],
    )).sort((left, right) => left.localeCompare(right, 'zh-Hant-TW', { numeric: true }));
    const numericStationNumbers = stationNumbers.every((value) => /^\d+$/.test(value))
      ? stationNumbers.map(Number)
      : null;
    const neighborhoods = Array.from(new Set([...existing.neighborhoods, ...place.neighborhoods]))
      .sort((left, right) => left - right);
    const rawNeighborhoods = Array.from(new Set(
      [existing.raw_neighborhoods, place.raw_neighborhoods].map((value) => value.trim()).filter(Boolean),
    ));
    const coverageKind = existing.coverage_kind === 'ambiguous' || place.coverage_kind === 'ambiguous'
      ? 'ambiguous'
      : existing.coverage_kind === 'whole_village' || place.coverage_kind === 'whole_village'
        ? 'whole_village'
        : existing.coverage_kind === 'unpartitioned' || place.coverage_kind === 'unpartitioned'
          ? 'unpartitioned'
          : 'neighborhoods';

    venues.set(key, {
      ...existing,
      station_no: numericStationNumbers
        ? formatNumberRanges(numericStationNumbers, Math.max(...stationNumbers.map((value) => value.length)))
        : stationNumbers.join('、'),
      coverage_kind: coverageKind,
      neighborhoods,
      raw_neighborhoods: neighborhoods.length > 0 ? formatNumberRanges(neighborhoods) + '鄰' : rawNeighborhoods.join('、'),
    });
  }

  return Array.from(venues.values());
}

export function matchPollingPlaces(places: PollingPlace[], neighborhood?: number) {
  if (places.length === 0) return { exact: false, places };
  if (places.some((place) => place.coverage_kind === 'ambiguous')) return { exact: false, places };
  const matches = places.filter((place) => ['whole_village', 'unpartitioned'].includes(place.coverage_kind)
    || (validNeighborhood(neighborhood) !== undefined && place.neighborhoods.includes(neighborhood!)));
  return matches.length === 1 ? { exact: true, places: matches } : { exact: false, places };
}

export function pollingPlaceMapUrl(place: Pick<PollingPlace, 'station_name' | 'address'>) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.station_name + ' ' + place.address);
}
