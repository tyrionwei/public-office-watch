export function parseNeighborhoods(raw) {
  const text = raw.normalize('NFKC').trim();
  if (['全里', '全村'].includes(text)) return { coverage_kind: 'whole_village', neighborhoods: [] };
  if (text === '未分鄰') return { coverage_kind: 'unpartitioned', neighborhoods: [] };
  const normalized = text.replace(/[鄰\s]/g, '').replace(/[、，.]/g, ',').replace(/[–—－~～至]/g, '-');
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(normalized)) {
    return { coverage_kind: 'ambiguous', neighborhoods: [] };
  }
  const values = new Set();
  for (const part of normalized.split(',')) {
    const [start, last] = part.split('-').map(Number);
    const end = last ?? start;
    if (start < 1 || end > 999 || end < start) throw new Error('Invalid neighborhood range: ' + raw);
    for (let number = start; number <= end; number++) values.add(number);
  }
  return { coverage_kind: 'neighborhoods', neighborhoods: [...values].sort((a,b) => a-b) };
}

export function validatePollingAssignments(places) {
  const stationKeys = new Set();
  const villages = Map.groupBy(places, (place) => place.village_code);
  for (const place of places) {
    const key = place.station_no + ':' + place.village_code;
    if (stationKeys.has(key)) throw new Error('Duplicate station assignment: ' + key);
    stationKeys.add(key);
  }
  for (const [village, assignments] of villages) {
    if (assignments.length > 100) throw new Error('Village exceeds public query limit: ' + village);
    if (assignments.length > 1 && assignments.some((p) => ['whole_village','unpartitioned'].includes(p.coverage_kind))) {
      throw new Error('Whole-village assignment conflicts with another station: ' + village);
    }
    const owners = new Map();
    for (const place of assignments) for (const number of place.neighborhoods) {
      if (owners.has(number)) throw new Error('Neighborhood assigned to multiple stations: ' + village + ':' + number);
      owners.set(number, place.station_no);
    }
  }
}
