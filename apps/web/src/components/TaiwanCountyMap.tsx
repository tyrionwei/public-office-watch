import { taiwanCountyMapBounds, taiwanCountyPaths } from '../data/generated/taiwanCountyMap';
import type { StageRegionNode } from '../types/stageMap';

type TaiwanCountyMapProps = {
  regions: StageRegionNode[];
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
};

function getRegionIdByCountyCode(regions: StageRegionNode[], countyCode: string) {
  return regions.find((region) => region.stageLabel === countyCode)?.id ?? `county-${countyCode}`;
}

const mainIslandTopDownXScale = 0.88;
const mainIslandLabelXScale = 1 / mainIslandTopDownXScale;
const mainIslandDisplayCenterX = 170;
const offshoreIslandLimitByCode: Record<string, number> = {
  '09007': 2,
};
const terrainGreens = ['#8fbe57', '#78ad4f', '#5f9643', '#477b38', '#32642e'];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function terrainFillForCounty(county: { displayCentroid: { x: number; y: number } | null }) {
  if (!county.displayCentroid) {
    return terrainGreens[2];
  }

  const { x, y } = county.displayCentroid;
  const ridgeX = 206 - (y - 80) * 0.08;
  const ridgeScore = clamp(1 - Math.abs(x - ridgeX) / 118, 0, 1);
  const eastScore = clamp((x - 128) / 150, 0, 1);
  const tone = clamp(ridgeScore * 0.74 + eastScore * 0.26, 0, 1);
  const index = Math.round(tone * (terrainGreens.length - 1));

  return terrainGreens[index];
}

function scalePathToInset(path: string, size = 92, padding = 9) {
  const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const points: Array<[number, number]> = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if ((token === 'M' || token === 'L') && tokens[index + 1] && tokens[index + 2]) {
      points.push([Number(tokens[index + 1]), Number(tokens[index + 2])]);
      index += 2;
    }
  }

  if (points.length === 0) {
    return path;
  }

  const bounds = points.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const scale = Math.min((size - padding * 2) / width, (size - padding * 2) / height);
  const offsetX = (size - width * scale) / 2;
  const offsetY = (size - height * scale) / 2;

  return tokens
    .map((token, index) => {
      if ((token === 'M' || token === 'L') && tokens[index + 1] && tokens[index + 2]) {
        return token;
      }
      const previous = tokens[index - 1];
      const previousPrevious = tokens[index - 2];
      if (previous === 'M' || previous === 'L') {
        return Number(((Number(token) - bounds.minX) * scale + offsetX).toFixed(4));
      }
      if (previousPrevious === 'M' || previousPrevious === 'L') {
        return Number(((Number(token) - bounds.minY) * scale + offsetY).toFixed(4));
      }
      return token;
    })
    .join(' ');
}

const largestOffshoreDisplayPathByCode: Record<string, string> = Object.fromEntries(
  taiwanCountyPaths
    .filter((county) => taiwanCountyMapBounds.offshoreCountyCodes.includes(county.code))
    .map((county) => {
      const islandPaths = county.displayPath
        .match(/M[^M]+/g)
        ?.map((path) => {
          const numbers = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
          let minX = Number.POSITIVE_INFINITY;
          let minY = Number.POSITIVE_INFINITY;
          let maxX = Number.NEGATIVE_INFINITY;
          let maxY = Number.NEGATIVE_INFINITY;
          for (let index = 0; index < numbers.length; index += 2) {
            const x = numbers[index];
            const y = numbers[index + 1];
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
          return { path, area: (maxX - minX) * (maxY - minY) };
        })
        .sort((a, b) => b.area - a.area);

      const islandLimit = offshoreIslandLimitByCode[county.code] ?? 1;
      const displayPath = islandPaths
        ?.slice(0, islandLimit)
        .map((island) => island.path)
        .join('');

      return [county.code, scalePathToInset(displayPath ?? county.displayPath)];
    }),
);

export function TaiwanCountyMap({ regions, selectedRegionId, onSelectRegion }: TaiwanCountyMapProps) {
  const offshoreCodes = new Set(taiwanCountyMapBounds.offshoreCountyCodes);
  const mainIslandCounties = taiwanCountyPaths.filter((county) => !offshoreCodes.has(county.code));
  const offshoreCounties = taiwanCountyPaths.filter((county) => offshoreCodes.has(county.code));
  const mainIslandViewBox =
    taiwanCountyMapBounds.mainIslandDisplayViewBox ??
    taiwanCountyMapBounds.mainIslandViewBox ??
    taiwanCountyMapBounds.fullViewBox;

  return (
    <div className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(4,23,52,0.96),rgba(4,16,38,0.94)_58%,rgba(3,10,24,0.96))] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-accent">County boundary map</p>
        </div>
        <span className="rounded-sm border border-line/70 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          本島19縣市 + 離島3縣市
        </span>
      </div>

      <div className="relative overflow-hidden rounded-sm bg-[#0b5f91] bg-[url('/assets/map/pixel-ocean-panel-bg.png')] bg-cover bg-center bg-no-repeat p-2 shadow-[inset_0_0_36px_rgba(2,8,23,0.55)] [image-rendering:pixelated] xl:aspect-[9/10]">
        <div className="relative grid h-full gap-3 xl:grid-cols-[132px_minmax(0,1fr)] 2xl:grid-cols-[148px_minmax(0,1fr)]">
          <div className="relative z-20 grid content-center gap-2 xl:order-1">
            {offshoreCounties.map((county) => {
              const regionId = getRegionIdByCountyCode(regions, county.code);
              const selected = selectedRegionId === regionId;
              return (
                <button
                  key={county.code}
                  type="button"
                  onClick={() => onSelectRegion(regionId)}
                  aria-pressed={selected}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`選取 ${county.name}`}
                  className={[
                    'pixel-corners relative overflow-hidden border bg-slate-950/12 p-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                    selected
                      ? 'border-yellow-300 text-white shadow-[0_0_18px_rgba(250,204,21,0.18)]'
                      : 'border-white/20 text-slate-200 hover:border-accent/55',
                  ].join(' ')}
                >
                  <span className="relative z-10 mb-1 block rounded-sm border border-bg/60 bg-bg/75 px-1.5 py-0.5 text-center font-display text-[12px] leading-tight text-white [text-shadow:1px_1px_0_#06101f,-1px_1px_0_#06101f,1px_-1px_0_#06101f,-1px_-1px_0_#06101f]">
                    {county.name.replace('臺', '台')}
                  </span>
                  <div className="relative z-10 overflow-hidden rounded-sm bg-slate-950/12 p-1">
                    <svg
                      viewBox="0 0 92 92"
                      preserveAspectRatio="xMidYMid meet"
                      className="block h-[92px] w-full drop-shadow-[0_8px_8px_rgba(0,0,0,0.22)] 2xl:h-[104px]"
                      role="img"
                      aria-label={`${county.name} inset map`}
                    >
                      <path
                        d={largestOffshoreDisplayPathByCode[county.code] ?? county.displayPath}
                        fill={selected ? '#f4d35e' : terrainFillForCounty(county)}
                        stroke={selected ? 'rgb(255,244,184)' : 'rgba(18,54,28,0.98)'}
                        strokeWidth={selected ? 2.1 : 1.3}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="relative flex min-h-[500px] items-center justify-center overflow-hidden xl:order-2 xl:min-h-0">
            <svg
              viewBox={mainIslandViewBox ?? undefined}
              preserveAspectRatio="xMidYMid meet"
              className="relative z-20 block h-[500px] w-full max-w-full drop-shadow-[0_18px_18px_rgba(0,0,0,0.28)] xl:h-full"
              role="img"
              aria-label="台灣縣市地圖輪廓，選取不同縣市作為 stage region"
            >
              <title>台灣縣市地圖輪廓</title>
              <g
                transform={`translate(${mainIslandDisplayCenterX} 0) scale(${mainIslandTopDownXScale} 1) translate(-${mainIslandDisplayCenterX} 0)`}
              >
                {mainIslandCounties.map((county) => {
                  const regionId = getRegionIdByCountyCode(regions, county.code);
                  const selected = selectedRegionId === regionId;
                  return (
                    <path
                      key={county.code}
                      d={county.displayPath}
                      role="button"
                      tabIndex={0}
                      aria-label={`選取 ${county.name}`}
                      aria-pressed={selected}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => onSelectRegion(regionId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectRegion(regionId);
                        }
                      }}
                      className="cursor-pointer outline-none transition-opacity focus:opacity-100 hover:opacity-95"
                      fill={selected ? '#f4d35e' : terrainFillForCounty(county)}
                      stroke={selected ? 'rgb(255,245,178)' : 'rgba(18,54,28,0.98)'}
                      strokeWidth={selected ? 2.15 : 1.05}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{county.name}</title>
                    </path>
                  );
                })}
                {mainIslandCounties.map((county) => {
                  if (!county.displayCentroid) {
                    return null;
                  }
                  const regionId = getRegionIdByCountyCode(regions, county.code);
                  const selected = selectedRegionId === regionId;
                  return (
                    <text
                      key={`${county.code}-label`}
                      x={county.displayCentroid.x}
                      y={county.displayCentroid.y}
                      transform={`translate(${county.displayCentroid.x} ${county.displayCentroid.y}) scale(${mainIslandLabelXScale} 1) translate(-${county.displayCentroid.x} -${county.displayCentroid.y})`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none font-display"
                      fill={selected ? '#0f172a' : '#f8fafc'}
                      stroke={selected ? '#fff2a8' : '#06101f'}
                      strokeWidth={selected ? 0.95 : 1.05}
                      paintOrder="stroke"
                      fontSize={selected ? 12 : 10}
                    >
                      {county.name.replace('臺', '台')}
                    </text>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      </div>

    </div>
  );
}
