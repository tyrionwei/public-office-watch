import { taiwanCountyPaths } from '../data/generated/taiwanCountyMap';
import type { StageRegionNode } from '../types/stageMap';
import { PixelFrame } from './PixelFrame';
import { TaiwanCountyMap } from './TaiwanCountyMap';

type TaiwanStageSelectProps = {
  regions: StageRegionNode[];
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
  hideQuickSelect?: boolean;
};

type CompactCountyQuickSelectProps = {
  regions: StageRegionNode[];
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
};

export function CompactCountyQuickSelect({
  regions,
  selectedRegionId,
  onSelectRegion,
}: CompactCountyQuickSelectProps) {
  const topLevelRegions = regions.filter((region) => region.level === 'county_city');

  return (
    <div className="pixel-corners border border-line/70 bg-panelAlt/35 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-display text-[11px] uppercase tracking-[0.22em] text-accent">Compact county quick select</p>
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">chip wall fallback</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {topLevelRegions.map((region) => {
          const selected = selectedRegionId === region.id;
          return (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelectRegion(region.id)}
              aria-current={selected ? 'true' : undefined}
              className={[
                'pixel-corners inline-flex items-center gap-2 border px-3 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                selected
                  ? 'border-accent bg-accent/14 text-white shadow-[0_0_18px_rgba(103,232,249,0.14)]'
                  : 'border-line bg-panelAlt/70 text-slate-200 hover:border-accent/55',
              ].join(' ')}
            >
              <span className="font-display text-[11px] uppercase tracking-[0.14em]">{region.label}</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{region.stageLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TaiwanStageSelect({
  regions,
  selectedRegionId,
  onSelectRegion,
  hideQuickSelect = false,
}: TaiwanStageSelectProps) {
  const topLevelRegions = regions.filter((region) => region.level === 'county_city');
  const hasCountyPaths = taiwanCountyPaths.length > 0;

  return (
    <PixelFrame
      title="Stage Select"
      action={<span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">county level</span>}
      className="h-full"
    >
      <div className="space-y-4">
        <div className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(7,22,45,0.96),rgba(8,27,52,0.94)_55%,rgba(7,18,38,0.96))] p-3 sm:p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-slate-200">Taiwan stage select</p>
            </div>
            <span className="rounded-sm border border-signal/30 bg-signal/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-signal">
              County level
            </span>
          </div>

          {hasCountyPaths ? (
            <TaiwanCountyMap
              regions={topLevelRegions}
              selectedRegionId={selectedRegionId}
              onSelectRegion={onSelectRegion}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {topLevelRegions.map((region) => {
                const selected = selectedRegionId === region.id;
                const blockClasses = selected
                  ? 'border-accent bg-accent/20 text-white shadow-[0_0_18px_rgba(103,232,249,0.18)]'
                  : 'border-line bg-panelAlt/55 text-slate-300 hover:border-accent/55 hover:text-white';

                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => onSelectRegion(region.id)}
                    aria-pressed={selected}
                    className={[
                      'pixel-corners min-h-[76px] border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                      blockClasses,
                    ].join(' ')}
                  >
                    <span className="block font-display text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {region.stageLabel}
                    </span>
                    <span className="mt-2 block text-sm font-medium leading-snug">{region.label}</span>
                    <span className="mt-2 block text-[11px] text-slate-500">COUNTYCODE {region.stageLabel}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!hideQuickSelect ? (
            <div className="mt-5">
              <CompactCountyQuickSelect
                regions={regions}
                selectedRegionId={selectedRegionId}
                onSelectRegion={onSelectRegion}
              />
            </div>
          ) : null}
        </div>
      </div>
    </PixelFrame>
  );
}
