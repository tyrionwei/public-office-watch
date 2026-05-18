import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const workDir = resolve(repoRoot, 'local-data/maps/work');
const rawCandidates = [
  resolve(workDir, 'taiwan-county-boundary.geojson'),
  resolve(workDir, 'taiwan-county-boundary.json'),
];
const outputPath = resolve(repoRoot, 'apps/web/src/data/generated/taiwanCountyMap.ts');
const sourceId = 'taiwan-county-city-boundary';
const today = new Date().toISOString().slice(0, 10);
const pathDecimalPlaces = 4;
const offshoreCountyCodes = ['09007', '09020', '10016'];
const displayMainIslandFocusCountyCodes = new Set(['10002', '10017', '10018', '64000']);
const viewBoxPadding = 0.15;
const displayCanvas = { width: 340, height: 520 };
const displayPadding = 6;
const mainIslandXExaggeration = 1.25;

function roundCoord(value) {
  return Number(value.toFixed(pathDecimalPlaces));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function toSvgPath(rings) {
  const segments = [];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length === 0) continue;
    const [firstX, firstY] = ring[0];
    segments.push(`M${roundCoord(firstX)} ${roundCoord(-firstY)}`);
    for (let i = 1; i < ring.length; i += 1) {
      const [x, y] = ring[i];
      segments.push(`L${roundCoord(x)} ${roundCoord(-y)}`);
    }
    segments.push('Z');
  }
  return segments.join('');
}

function toSvgPathFromDisplayRings(rings) {
  const segments = [];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length === 0) continue;
    const [firstX, firstY] = ring[0];
    segments.push(`M${roundCoord(firstX)} ${roundCoord(firstY)}`);
    for (let i = 1; i < ring.length; i += 1) {
      const [x, y] = ring[i];
      segments.push(`L${roundCoord(x)} ${roundCoord(y)}`);
    }
    segments.push('Z');
  }
  return segments.join('');
}

function collectRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

function getRingBounds(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, area: (maxX - minX) * (maxY - minY) };
}

function selectDisplayRings(code, rings) {
  if (!displayMainIslandFocusCountyCodes.has(code)) return rings;
  const ranked = rings
    .map((ring) => ({ ring, bounds: getRingBounds(ring) }))
    .filter((item) => item.bounds)
    .sort((a, b) => b.bounds.area - a.bounds.area);
  return ranked[0] ? [ranked[0].ring] : rings;
}

function getBoundsFromRings(rings) {
  const points = rings.flat();
  if (points.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    const sx = roundCoord(x);
    const sy = roundCoord(-y);
    minX = Math.min(minX, sx);
    minY = Math.min(minY, sy);
    maxX = Math.max(maxX, sx);
    maxY = Math.max(maxY, sy);
  }

  return { minX, minY, maxX, maxY };
}

function getBoundsFromDisplayRings(rings) {
  const points = rings.flat();
  if (points.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, roundCoord(x));
    minY = Math.min(minY, roundCoord(y));
    maxX = Math.max(maxX, roundCoord(x));
    maxY = Math.max(maxY, roundCoord(y));
  }

  return { minX, minY, maxX, maxY };
}

function mergeBounds(current, next) {
  if (!next) return current;
  if (!current) return next;
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  };
}

function getCentroidFromBounds(bounds) {
  if (!bounds) return null;
  return {
    x: roundCoord((bounds.minX + bounds.maxX) / 2),
    y: roundCoord((bounds.minY + bounds.maxY) / 2),
  };
}

function boundsToViewBox(bounds) {
  if (!bounds) return null;
  return [
    roundCoord(bounds.minX - viewBoxPadding),
    roundCoord(bounds.minY - viewBoxPadding),
    roundCoord(bounds.maxX - bounds.minX + viewBoxPadding * 2),
    roundCoord(bounds.maxY - bounds.minY + viewBoxPadding * 2),
  ].join(' ');
}

function normalizeBounds(bounds, canvas = displayCanvas, padding = displayPadding, xExaggeration = 1) {
  if (!bounds) return null;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const exaggeratedWidth = width * xExaggeration;
  const usableWidth = canvas.width - padding * 2;
  const usableHeight = canvas.height - padding * 2;
  const scale = Math.min(usableWidth / exaggeratedWidth, usableHeight / height);
  const scaledWidth = exaggeratedWidth * scale;
  const scaledHeight = height * scale;
  const offsetX = (canvas.width - scaledWidth) / 2;
  const offsetY = (canvas.height - scaledHeight) / 2;
  return { scale, offsetX, offsetY, sourceBounds: bounds, canvas, xExaggeration };
}

function transformPoint([x, y], transform) {
  const exaggeratedX = (x - transform.sourceBounds.minX) * transform.xExaggeration;
  const nx = roundCoord(exaggeratedX * transform.scale + transform.offsetX);
  const ny = roundCoord((y - transform.sourceBounds.minY) * transform.scale + transform.offsetY);
  return [nx, ny];
}

function transformRings(rings, transform) {
  return rings.map((ring) =>
    ring.map(([x, y]) => {
      const sx = roundCoord(x);
      const sy = roundCoord(-y);
      return transformPoint([sx, sy], transform);
    }),
  );
}

mkdirSync(workDir, { recursive: true });
const rawPath = rawCandidates.find((candidate) => existsSync(candidate));
if (!rawPath) {
  fail([
    'Missing official county boundary export.',
    'Place the government dataset converted to GeoJSON at one of:',
    ...rawCandidates.map((item) => `- ${item}`),
    'Source dataset: https://data.gov.tw/dataset/7442',
    'Raw files stay under local-data/ and must not be committed.',
  ].join('\n'));
}

const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
if (!Array.isArray(raw.features)) {
  fail(`Expected FeatureCollection.features in ${rawPath}`);
}

const countyShapes = raw.features
  .map((feature) => {
    const props = feature.properties ?? {};
    const code = props.COUNTYCODE ?? props.COUNTYCODE_ ?? props.COUNTY_ID ?? null;
    const name = props.COUNTYNAME ?? props.COUNTYNAME_ ?? props.NAME ?? null;
    if (!code || !name) return null;
    const rings = collectRings(feature.geometry);
    const path = toSvgPath(rings);
    if (!path) return null;
    return {
      code: String(code),
      name: String(name),
      rings,
      path,
      bounds: getBoundsFromRings(rings),
      sourceId,
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.code.localeCompare(b.code));

const fullBounds = countyShapes.reduce((acc, county) => mergeBounds(acc, county.bounds), null);
const mainIslandSourceShapes = countyShapes
  .filter((county) => !offshoreCountyCodes.includes(county.code))
  .map((county) => ({ ...county, displaySourceRings: selectDisplayRings(county.code, county.rings) }));
const mainIslandDisplaySourceBounds = mainIslandSourceShapes.reduce(
  (acc, county) => mergeBounds(acc, getBoundsFromRings(county.displaySourceRings)),
  null,
);
const mainIslandViewBounds = countyShapes
  .filter((county) => !offshoreCountyCodes.includes(county.code))
  .reduce((acc, county) => mergeBounds(acc, county.bounds), null);
const mainIslandDisplayTransform = normalizeBounds(
  mainIslandDisplaySourceBounds,
  displayCanvas,
  displayPadding,
  mainIslandXExaggeration,
);

const countyPaths = countyShapes.map(({ code, name, path, rings, bounds, sourceId: itemSourceId }) => {
  const isOffshore = offshoreCountyCodes.includes(code);
  const displaySourceRings = isOffshore ? rings : selectDisplayRings(code, rings);
  const displaySourceBounds = getBoundsFromRings(displaySourceRings);
  const transform = isOffshore
    ? normalizeBounds(displaySourceBounds, { width: 92, height: 92 }, 10, 1)
    : mainIslandDisplayTransform;
  const displayRings = transform ? transformRings(displaySourceRings, transform) : [];
  const displayPath = toSvgPathFromDisplayRings(displayRings);
  const displayBounds = getBoundsFromDisplayRings(displayRings);

  return {
    code,
    name,
    path,
    displayPath,
    bounds,
    displayBounds,
    centroid: getCentroidFromBounds(bounds),
    displayCentroid: getCentroidFromBounds(displayBounds),
    sourceId: itemSourceId,
  };
});

if (countyPaths.length === 0) {
  fail(`No COUNTYCODE / COUNTYNAME features found in ${rawPath}`);
}

const compactPaths = countyPaths
  .map(
    ({ code, name, path, displayPath, bounds, displayBounds, centroid, displayCentroid, sourceId: itemSourceId }) =>
      `{code:${JSON.stringify(code)},name:${JSON.stringify(name)},path:${JSON.stringify(path)},displayPath:${JSON.stringify(displayPath)},bounds:${JSON.stringify(bounds)},displayBounds:${JSON.stringify(displayBounds)},centroid:${JSON.stringify(centroid)},displayCentroid:${JSON.stringify(displayCentroid)},sourceId:${JSON.stringify(itemSourceId)}}`,
  )
  .join(',\n  ');

const countyBoundsByCode = Object.fromEntries(countyPaths.map(({ code, bounds }) => [code, bounds]));
const countyDisplayBoundsByCode = Object.fromEntries(countyPaths.map(({ code, displayBounds }) => [code, displayBounds]));

const mapBoundsMeta = {
  fullViewBox: boundsToViewBox(fullBounds),
  mainIslandViewBox: boundsToViewBox(mainIslandViewBounds),
  mainIslandDisplayViewBox: `0 0 ${displayCanvas.width} ${displayCanvas.height}`,
  offshoreCountyCodes,
  countyBoundsByCode,
  countyDisplayBoundsByCode,
  displayTransformNote: `displayPath is a schematic display coordinate for the arcade stage map. It is based on official boundary data but normalized for UI readability. It is not intended for legal boundary measurement. Main island display box: ${displayCanvas.width}x${displayCanvas.height}, x exaggeration: ${mainIslandXExaggeration}. UI simplified map only.`,
};

const content = `export type TaiwanCountyPath = {\n  code: string;\n  name: string;\n  path: string;\n  displayPath: string;\n  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;\n  displayBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;\n  centroid: { x: number; y: number } | null;\n  displayCentroid: { x: number; y: number } | null;\n  sourceId: string;\n};\n\nexport const taiwanCountyPaths: TaiwanCountyPath[] = [\n  ${compactPaths}\n];\n\nexport const taiwanCountyMapBounds = ${JSON.stringify(mapBoundsMeta, null, 2)};\n\nexport const taiwanCountyMapAssetStatus = {\n  generatedAt: '${today}',\n  sourceId: '${sourceId}',\n  note: 'Generated from official county boundary export placed under local-data/maps/work/. Raw files are not committed. Path coordinates rounded to ${pathDecimalPlaces} decimals. Added schematic displayPath coordinates for arcade stage map readability, including main-island-first rendering, offshore inset rendering, and controlled x exaggeration (${mainIslandXExaggeration}) in a ${displayCanvas.width}x${displayCanvas.height} display box. UI simplified map only, not for legal boundary measurement.',\n};\n`;

writeFileSync(outputPath, content, 'utf8');
const outputBytes = Buffer.byteLength(content, 'utf8');
console.log(`Generated ${outputPath}`);
console.log(`County count: ${countyPaths.length}`);
console.log(`Output bytes: ${outputBytes}`);
if (outputBytes > 500 * 1024) {
  fail(`Generated asset is larger than 500KB (${outputBytes} bytes). Stop and simplify before commit.`);
}
