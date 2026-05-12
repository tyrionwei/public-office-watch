import type { RegionCard } from '../data/mockHomeData';
import { PixelFrame } from './PixelFrame';

type TaiwanStageSelectProps = {
  regions: RegionCard[];
  selectedRegionId: string;
  onSelect: (regionId: string) => void;
};

export function TaiwanStageSelect({ regions, selectedRegionId, onSelect }: TaiwanStageSelectProps) {
  return (
    <PixelFrame title="Stage Select Taiwan Map">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-h-[320px] items-center justify-center rounded-sm border border-dashed border-line bg-bg/60 p-6 text-center text-slate-400">
          <div>
            <p className="font-display text-lg text-slate-200">Taiwan map placeholder</p>
            <p className="mt-2 text-sm">此階段先用區塊式 stage select，下一步再接真正地圖資料與互動。</p>
          </div>
        </div>
        <div className="grid gap-3">
          {regions.map((region) => {
            const selected = selectedRegionId === region.id;
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => onSelect(region.id)}
                className={`rounded-sm border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-line bg-panelAlt/70 text-slate-200 hover:border-accent/60'
                }`}
              >
                <p className="font-display text-sm uppercase tracking-[0.16em]">{region.name}</p>
                <p className="mt-1 text-xs text-slate-400">{region.tone}</p>
              </button>
            );
          })}
        </div>
      </div>
    </PixelFrame>
  );
}
