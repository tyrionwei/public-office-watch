import type { RegionCard } from '../data/mockHomeData';
import { PixelFrame } from './PixelFrame';

type SelectedRegionHudProps = {
  region: RegionCard;
};

export function SelectedRegionHud({ region }: SelectedRegionHudProps) {
  return (
    <PixelFrame title="Selected Region HUD">
      <div className="space-y-3 text-sm text-slate-300">
        <div>
          <p className="font-display text-xl text-white">{region.name}</p>
          <p className="mt-1 text-slate-400">{region.tone}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-line bg-bg/40 p-3">
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Next election</dt>
            <dd className="mt-2 text-white">{region.electionName}</dd>
          </div>
          <div className="rounded-sm border border-line bg-bg/40 p-3">
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Voting date</dt>
            <dd className="mt-2 font-display text-signal">{region.nextVotingDate}</dd>
          </div>
          <div className="rounded-sm border border-line bg-bg/40 p-3 sm:col-span-2">
            <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Upcoming race count</dt>
            <dd className="mt-2 text-white">{region.upcomingRaceCount} 項公開選舉項目</dd>
          </div>
        </dl>
      </div>
    </PixelFrame>
  );
}
