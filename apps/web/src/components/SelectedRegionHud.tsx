import type { RegionCard } from '../data/mockHomeData';
import { PixelFrame } from './PixelFrame';

type SelectedRegionHudProps = {
  region: RegionCard | undefined;
};

export function SelectedRegionHud({ region }: SelectedRegionHudProps) {
  if (!region) {
    return null;
  }

  return (
    <PixelFrame
      title="Selected Region HUD"
      action={
        <span className="rounded-sm border border-line/70 bg-bg/40 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          public view mock
        </span>
      }
      className="bg-[linear-gradient(180deg,rgba(11,19,38,0.96),rgba(12,22,43,0.9)_58%,rgba(18,28,56,0.88))]"
    >
      <div className="space-y-4 text-sm text-slate-300">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">selected region</p>
            <p className="mt-2 font-display text-2xl text-white">{region.name}</p>
            <p className="mt-2 max-w-md text-sm text-slate-400">{region.tone}</p>
          </div>
          <button
            type="button"
            className="pixel-corners border border-accent/70 bg-accent/12 px-4 py-2 font-display text-xs uppercase tracking-[0.22em] text-accent transition hover:bg-accent/20"
          >
            查看區域資料
          </button>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">最近選舉</dt>
            <dd className="mt-2 text-sm text-white">{region.electionName}</dd>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">投票日</dt>
            <dd className="mt-2 font-display text-xl text-signal">{region.nextVotingDate}</dd>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">upcoming race count</dt>
            <dd className="mt-2 text-white">{region.upcomingRaceCount} 項公開選舉項目</dd>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">資料來源提示</dt>
            <dd className="mt-2 text-slate-300">依公開公告整理的 mock public view 介面資料。</dd>
          </div>
        </dl>
      </div>
    </PixelFrame>
  );
}
