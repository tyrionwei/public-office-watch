import { Link } from 'react-router-dom';
import { regionPath } from '../routes/routePaths';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import { PixelFrame } from './PixelFrame';

type SelectedRegionHudRegion = {
  tone: string;
};

type SelectedRegionHudProps = {
  region: SelectedRegionHudRegion | undefined;
  regionNode: StageRegionNode | undefined;
  regionSummary: StageRegionSummary | undefined;
};

export function SelectedRegionHud({ region, regionNode, regionSummary }: SelectedRegionHudProps) {
  if (!regionSummary || !regionNode) {
    return null;
  }

  return (
    <PixelFrame
      title="Selected Region"
      action={
        <span className="rounded-sm border border-line/70 bg-bg/40 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          public view mock
        </span>
      }
      className="bg-[linear-gradient(180deg,rgba(6,46,91,0.95),rgba(9,37,74,0.92)_55%,rgba(10,19,39,0.95))]"
    >
      <div className="space-y-4 text-sm text-slate-300">
        <div className="relative min-h-[218px] overflow-hidden rounded-sm border border-accent/20 bg-[linear-gradient(180deg,rgba(20,108,171,0.9),rgba(13,73,128,0.78)_48%,rgba(12,40,78,0.92))] p-5">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:100%_18px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(5,12,24,0.85))]" />
          <div className="pointer-events-none absolute bottom-5 right-8 flex items-end gap-1 opacity-90">
            {[42, 68, 96, 132, 82, 58].map((height, index) => (
              <span
                key={height + index}
                className="block w-8 border border-accent/20 bg-slate-900/65"
                style={{ height }}
              />
            ))}
            <span className="ml-2 block h-40 w-5 border border-signal/40 bg-slate-900/70 shadow-[0_0_18px_rgba(244,211,94,0.14)]" />
          </div>
          <div className="relative max-w-[70%]">
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent">selected region</p>
            <p className="mt-3 font-display text-3xl leading-none text-white">{regionSummary.label}</p>
            <p className="mt-2 text-lg font-semibold uppercase tracking-[0.14em] text-slate-100">
              {regionNode.stageLabel}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-200">{region?.tone ?? '公開資料導覽區塊'}</p>
          </div>
          <div className="relative mt-5">
            {regionNode.id ? (
              <Link
                to={regionPath(regionNode.id)}
                className="pixel-corners inline-flex min-w-[220px] justify-center border border-yellow-200/70 bg-signal px-5 py-3 font-display text-sm uppercase tracking-[0.16em] text-slate-950 shadow-[0_4px_0_rgba(120,75,12,0.8)] transition hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(120,75,12,0.8)] focus:outline-none focus:ring-2 focus:ring-signal/40"
              >
                查看此縣市
              </Link>
            ) : null}
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">最近選舉</dt>
            <dd className="mt-2 text-sm text-white">{regionSummary.nearestElectionName}</dd>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">投票日</dt>
            <dd className="mt-2 font-display text-xl text-signal">{regionSummary.nearestElectionDate}</dd>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">項目數</dt>
            <dd className="mt-2 text-white">{regionSummary.upcomingRaceCount} 項公開選舉項目</dd>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3 sm:col-span-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">資料來源提示</dt>
            <dd className="mt-2 text-slate-300">{regionSummary.sourceNote}</dd>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/38 p-3 sm:col-span-3">
            <dt className="text-[11px] uppercase tracking-[0.22em] text-slate-500">boundary note</dt>
            <dd className="mt-2 text-slate-300">{regionSummary.boundaryNote}</dd>
          </div>
        </dl>
      </div>
    </PixelFrame>
  );
}
