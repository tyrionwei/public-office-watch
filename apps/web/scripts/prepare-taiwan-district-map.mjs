import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const workDir = resolve(repoRoot, 'local-data/maps/work');
const rawCandidates = [
  resolve(workDir, 'taiwan-district-boundary-simplified.geojson'),
  resolve(workDir, 'taiwan-district-boundary-simplified.json'),
];
const outputPath = resolve(repoRoot, 'apps/web/src/data/generated/taiwanDistrictMap.ts');
const sourceId = 'taiwan-town-boundary-7441';
const sourceUrl = 'https://data.gov.tw/dataset/7441';
const today = new Date().toISOString().slice(0, 10);
const pathDecimalPlaces = 4;

function roundCoord(value) {
  return Number(value.toFixed(pathDecimalPlaces));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function collectRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

function toPath(rings) {
  const segments = [];
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const [firstX, firstY] = ring[0];
    segments.push(`M${roundCoord(firstX)} ${roundCoord(-firstY)}`);
    for (let index = 1; index < ring.length; index += 1) {
      const [x, y] = ring[index];
      segments.push(`L${roundCoord(x)} ${roundCoord(-y)}`);
    }
    segments.push('Z');
  }
  return segments.join('');
}

function getBounds(rings) {
  const points = rings.flat();
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    const pathX = roundCoord(x);
    const pathY = roundCoord(-y);
    minX = Math.min(minX, pathX);
    minY = Math.min(minY, pathY);
    maxX = Math.max(maxX, pathX);
    maxY = Math.max(maxY, pathY);
  }
  return { minX, minY, maxX, maxY };
}

mkdirSync(workDir, { recursive: true });
const rawPath = rawCandidates.find((candidate) => existsSync(candidate));
if (!rawPath) {
  fail([
    'Missing simplified official district boundary export.',
    'Place the government dataset converted and simplified to GeoJSON at one of:',
    ...rawCandidates.map((item) => `- ${item}`),
    `Source dataset: ${sourceUrl}`,
    'Raw files stay under local-data/ and must not be committed.',
  ].join('\n'));
}

const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
if (!Array.isArray(raw.features)) fail(`Expected FeatureCollection.features in ${rawPath}`);

const districtPaths = raw.features
  .map((feature) => {
    const props = feature.properties ?? {};
    const code = props.TOWNCODE ?? null;
    const name = props.TOWNNAME ?? null;
    const countyCode = props.COUNTYCODE ?? null;
    if (!code || !name || !countyCode) return null;
    const rings = collectRings(feature.geometry);
    const path = toPath(rings);
    if (!path) return null;
    return {
      code: String(code),
      name: String(name),
      countyCode: String(countyCode),
      path,
      bounds: getBounds(rings),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.code.localeCompare(b.code));

if (districtPaths.length !== 368) {
  fail(`Expected 368 district features, received ${districtPaths.length} from ${rawPath}`);
}

const compactPaths = districtPaths
  .map(({ code, name, countyCode, path, bounds }) =>
    `{code:${JSON.stringify(code)},name:${JSON.stringify(name)},countyCode:${JSON.stringify(countyCode)},path:${JSON.stringify(path)},bounds:${JSON.stringify(bounds)}}`)
  .join(',\n  ');

const content = `export type TaiwanDistrictPath = {\n  code: string;\n  name: string;\n  countyCode: string;\n  path: string;\n  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;\n};\n\nexport const taiwanDistrictPaths: TaiwanDistrictPath[] = [\n  ${compactPaths}\n];\n\nexport const taiwanDistrictMapAssetStatus = {\n  generatedAt: '${today}',\n  sourceId: '${sourceId}',\n  sourceUrl: '${sourceUrl}',\n  note: 'Generated from the official township and district boundary export under local-data/maps/work/. Source geometry was topology-preserving simplified before generation. Coordinates are rounded to ${pathDecimalPlaces} decimals. Used only for an on-device location suggestion, not legal boundary measurement.',\n};\n`;

writeFileSync(outputPath, content, 'utf8');
const outputBytes = Buffer.byteLength(content, 'utf8');
console.log(`Generated ${outputPath}`);
console.log(`District count: ${districtPaths.length}`);
console.log(`Output bytes: ${outputBytes}`);
if (outputBytes > 1.5 * 1024 * 1024) {
  fail(`Generated asset is larger than 1.5MB (${outputBytes} bytes). Stop and simplify before commit.`);
}
