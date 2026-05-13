import type { StageRegionNode } from '../types/stageMap';
import { PixelFrame } from './PixelFrame';

type TaiwanStageSelectProps = {
  regions: StageRegionNode[];
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
};

export function TaiwanStageSelect({
  regions,
  selectedRegionId,
  onSelectRegion,
}: TaiwanStageSelectProps) {
  const topLevelRegions = regions.filter((region) => region.level === 'county_city');
  const districtRegions = regions.filter((region) => region.level === 'district');

  return (
    <PixelFrame
      title="Stage Select Placeholder"
      action={
        <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
          not geographic boundaries
        </span>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        <div className="pixel-corners border border-line/70 bg-bg/55 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-slate-200">
                Taiwan stage select
              </p>
              <p className="mt-1 text-xs text-slate-500">
                區塊式 map placeholder，只作 UI 導覽，不代表正式選區邊界。
              </p>
            </div>
            <span className="rounded-sm border border-signal/30 bg-signal/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-signal">
              Placeholder
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {regions.map((region) => {
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
                  <span className="mt-2 block text-[11px] text-slate-500">
                    {region.level === 'district' ? 'district placeholder' : 'region placeholder'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="pixel-corners border border-line/70 bg-panelAlt/50 px-4 py-3">
            <p className="font-display text-[11px] uppercase tracking-[0.22em] text-accent">Top level</p>
            <div className="mt-3 grid gap-2">
              {topLevelRegions.map((region) => {
                const selected = selectedRegionId === region.id;
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => onSelectRegion(region.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={[
                      'pixel-corners border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                      selected
                        ? 'border-accent bg-accent/14 text-white shadow-[0_0_18px_rgba(103,232,249,0.14)]'
                        : 'border-line bg-panelAlt/70 text-slate-200 hover:border-accent/55',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-sm uppercase tracking-[0.16em]">{region.label}</p>
                        <p className="mt-1 text-xs text-slate-400">{region.note}</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {region.stageLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pixel-corners border border-line/70 bg-panelAlt/50 px-4 py-3">
            <p className="font-display text-[11px] uppercase tracking-[0.22em] text-accent">District placeholders</p>
            <div className="mt-3 grid gap-2">
              {districtRegions.map((region) => {
                const selected = selectedRegionId === region.id;
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => onSelectRegion(region.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={[
                      'pixel-corners border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                      selected
                        ? 'border-accent bg-accent/14 text-white shadow-[0_0_18px_rgba(103,232,249,0.14)]'
                        : 'border-line bg-panelAlt/70 text-slate-200 hover:border-accent/55',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-sm uppercase tracking-[0.16em]">{region.label}</p>
                        <p className="mt-1 text-xs text-slate-400">不代表正式選區邊界</p>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {region.stageLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PixelFrame>
  );
}
