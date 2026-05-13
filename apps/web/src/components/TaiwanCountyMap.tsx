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

export function TaiwanCountyMap({ regions, selectedRegionId, onSelectRegion }: TaiwanCountyMapProps) {
  const offshoreCodes = new Set(taiwanCountyMapBounds.offshoreCountyCodes);
  const mainIslandCounties = taiwanCountyPaths.filter((county) => !offshoreCodes.has(county.code));
  const offshoreCounties = taiwanCountyPaths.filter((county) => offshoreCodes.has(county.code));
  const mainIslandViewBox =
    taiwanCountyMapBounds.mainIslandDisplayViewBox ??
    taiwanCountyMapBounds.mainIslandViewBox ??
    taiwanCountyMapBounds.fullViewBox;

  return (
    <div className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(11,18,34,0.85),rgba(10,18,38,0.72))] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-accent">County boundary map</p>
          <p className="mt-1 text-xs text-slate-400">
            地圖資料來源為官方縣市界線轉換資料，目前仍是 local validation 階段。
          </p>
        </div>
        <span className="rounded-sm border border-line/70 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          19 main + 3 offshore
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[140px_minmax(0,1fr)] 2xl:grid-cols-[152px_minmax(0,1fr)]">
        <div className="flex items-center justify-center overflow-hidden rounded-sm border border-line/60 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.08),transparent_35%),linear-gradient(180deg,rgba(2,8,23,0.92),rgba(15,23,42,0.88))] p-2 min-h-[560px] xl:order-2 xl:min-h-[640px] 2xl:min-h-[700px]">
          <svg
            viewBox={mainIslandViewBox ?? undefined}
            preserveAspectRatio="xMidYMid meet"
            className="block h-[560px] w-full max-w-full xl:h-[640px] 2xl:h-[700px]"
            role="img"
            aria-label="台灣縣市地圖輪廓，選取不同縣市作為 stage region"
          >
            <title>台灣縣市地圖輪廓</title>
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
                  fill={selected ? 'rgba(34,211,238,0.44)' : 'rgba(51,65,85,0.96)'}
                  stroke={selected ? 'rgb(250,204,21)' : 'rgba(241,245,249,0.95)'}
                  strokeWidth={selected ? 1.25 : 0.72}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>{county.name}</title>
                </path>
              );
            })}
          </svg>
        </div>

        <div className="grid gap-2 xl:order-1">
          <div className="pixel-corners border border-line/60 bg-panelAlt/55 px-3 py-2 xl:sticky xl:top-4">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-slate-400">Offshore inset</p>
            <p className="mt-1 text-[11px] text-slate-500">離島不納入主 viewBox，避免把本島縮得太小。</p>
          </div>
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
                  'pixel-corners border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                  selected
                    ? 'border-yellow-300 bg-accent/16 text-white shadow-[0_0_18px_rgba(250,204,21,0.18)]'
                    : 'border-line bg-panelAlt/60 text-slate-200 hover:border-accent/55',
                ].join(' ')}
              >
                <span className="block font-display text-[10px] uppercase tracking-[0.18em] text-slate-500">Offshore county</span>
                <div className="mt-2 overflow-hidden rounded-sm border border-line/60 bg-slate-950/40 p-1">
                  <svg
                    viewBox="0 0 92 92"
                    preserveAspectRatio="xMidYMid meet"
                    className="block h-20 w-full"
                    role="img"
                    aria-label={`${county.name} inset map`}
                  >
                    <path
                      d={county.displayPath}
                      fill={selected ? 'rgba(34,211,238,0.38)' : 'rgba(30,41,59,0.92)'}
                      stroke={selected ? 'rgb(250,204,21)' : 'rgba(226,232,240,0.92)'}
                      strokeWidth={selected ? 1.8 : 1.2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
                <span className="mt-2 block text-sm font-medium">{county.name}</span>
                <span className="mt-1 block text-[11px] text-slate-400">COUNTYCODE {county.code}</span>
                <span className="mt-2 block text-[11px] text-slate-500">{selected ? '目前選取中' : '可點選切換'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span className="rounded-sm border border-line/60 px-2 py-1">主圖聚焦台灣本島 19 縣市</span>
        <span className="rounded-sm border border-line/60 px-2 py-1">離島以 inset 小地圖保留可選取性</span>
        <span className="rounded-sm border border-line/60 px-2 py-1">填色 + 邊框 + 狀態文字代表 selected state</span>
      </div>
    </div>
  );
}
