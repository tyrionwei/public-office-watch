import { taiwanCountyPaths } from '../data/generated/taiwanCountyMap.ts';
import { taiwanDistrictPaths } from '../data/generated/taiwanDistrictMap.ts';
import { taiwanRegions } from '../data/taiwanRegions.ts';
import type { VotingRegionChoice } from '../votingRegion.tsx';

type Point = { x: number; y: number };

export type ResolvedTaiwanLocation = {
  county: VotingRegionChoice;
  district?: VotingRegionChoice;
};

function pathRings(path: string): Point[][] {
  return path
    .split(/Z/i)
    .map((part) => Array.from(part.matchAll(/(?:M|L)?\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/gi), (match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
    })))
    .filter((ring) => ring.length >= 3);
}

function ringContainsPoint(ring: Point[], point: Point) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const a = ring[current];
    const b = ring[previous];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pathContainsPoint(path: string, point: Point) {
  return pathRings(path).filter((ring) => ringContainsPoint(ring, point)).length % 2 === 1;
}

export function resolveTaiwanCounty(latitude: number, longitude: number): VotingRegionChoice | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const point = { x: longitude, y: -latitude };

  const match = taiwanCountyPaths.find((county) => {
    const bounds = county.bounds;
    if (!bounds
      || point.x < bounds.minX
      || point.x > bounds.maxX
      || point.y < bounds.minY
      || point.y > bounds.maxY) return false;
    return pathContainsPoint(county.path, point);
  });
  if (!match) return null;

  const region = taiwanRegions.find((candidate) => candidate.code === match.code);
  return region ? { id: region.id, name: region.name } : null;
}

export function resolveTaiwanLocation(latitude: number, longitude: number): ResolvedTaiwanLocation | null {
  const county = resolveTaiwanCounty(latitude, longitude);
  if (!county) return null;

  const countyCode = taiwanRegions.find((candidate) => candidate.id === county.id)?.code;
  if (!countyCode) return { county };
  const point = { x: longitude, y: -latitude };
  const district = taiwanDistrictPaths.find((candidate) => {
    if (candidate.countyCode !== countyCode) return false;
    const bounds = candidate.bounds;
    if (!bounds
      || point.x < bounds.minX
      || point.x > bounds.maxX
      || point.y < bounds.minY
      || point.y > bounds.maxY) return false;
    return pathContainsPoint(candidate.path, point);
  });

  return {
    county,
    ...(district ? { district: { id: `district-${district.code}`, name: district.name } } : {}),
  };
}
