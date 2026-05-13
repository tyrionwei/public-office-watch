import { PixelCandidateSprite } from './PixelCandidateSprite';
import { PixelFrame } from './PixelFrame';
import type { PollComparison } from '../types/polling';

type PollComparisonPanelProps = {
  comparison: PollComparison;
};

export function PollComparisonPanel({ comparison }: PollComparisonPanelProps) {
  return (
    <PixelFrame
      title="民調焦點比較"
      action={<span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Poll Comparison</span>}
      className="bg-[linear-gradient(180deg,rgba(11,19,38,0.96),rgba(13,24,50,0.92)_55%,rgba(17,29,59,0.88))]"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Poll Comparison</p>
            <h3 className="mt-2 font-display text-2xl text-white">{comparison.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{comparison.summary}</p>
          </div>
          <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-3 text-sm text-slate-300 lg:w-[300px]">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">non-official notice</p>
            <p className="mt-2">{comparison.sourceSummary.disclaimer}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          {comparison.leadingCandidates.slice(0, 1).map((candidate) => (
            <article key={candidate.candidateId} className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <PixelCandidateSprite
                displayName={candidate.displayName}
                partyKey={candidate.partyKey}
                partyLabel={candidate.partyLabel}
                variant={candidate.spriteVariant}
                align="left"
              />
              <dl className="mt-4 grid gap-2 text-sm text-slate-300">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">支持度</dt><dd>{candidate.supportPercent}%</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">趨勢</dt><dd>{candidate.trendLabel}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">資料說明</dt><dd>{candidate.note}</dd></div>
              </dl>
            </article>
          ))}

          <div className="pixel-corners flex items-center justify-center border border-line/70 bg-panelAlt/45 px-4 py-6 text-center">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.24em] text-accent">Compare</p>
              <p className="mt-2 text-xs text-slate-400">來源數 {comparison.sourceSummary.sourceCount}</p>
              <p className="mt-1 text-xs text-slate-400">{comparison.sourceSummary.dateRangeStart} → {comparison.sourceSummary.dateRangeEnd}</p>
              <p className="mt-1 text-xs text-slate-400">更新日期 {comparison.sourceSummary.updatedAt}</p>
            </div>
          </div>

          {comparison.leadingCandidates.slice(1, 2).map((candidate) => (
            <article key={candidate.candidateId} className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <PixelCandidateSprite
                displayName={candidate.displayName}
                partyKey={candidate.partyKey}
                partyLabel={candidate.partyLabel}
                variant={candidate.spriteVariant}
                align="right"
              />
              <dl className="mt-4 grid gap-2 text-sm text-slate-300">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">支持度</dt><dd>{candidate.supportPercent}%</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">趨勢</dt><dd>{candidate.trendLabel}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">資料說明</dt><dd>{candidate.note}</dd></div>
              </dl>
            </article>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">其他候選人</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {comparison.otherCandidates.map((candidate) => (
                <div key={candidate.candidateId} className="pixel-corners border border-line/60 bg-panelAlt/35 p-3">
                  <p className="font-display text-sm text-white">{candidate.displayName}</p>
                  <p className="mt-1 text-xs text-slate-400">{candidate.partyLabel}</p>
                  <p className="mt-2 text-sm text-slate-300">支持度 {candidate.supportPercent}%</p>
                  <p className="mt-1 text-xs text-slate-500">{candidate.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">資料摘要</p>
            <dl className="mt-3 grid gap-2">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">來源數</dt><dd>{comparison.sourceSummary.sourceCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">資料區間</dt><dd>{comparison.sourceSummary.dateRangeStart} → {comparison.sourceSummary.dateRangeEnd}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">更新日期</dt><dd>{comparison.sourceSummary.updatedAt}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-400">{comparison.sourceSummary.methodologyNote}</p>
            <p className="mt-3 text-xs text-slate-400">{comparison.sourceSummary.disclaimer}</p>
          </div>
        </div>
      </div>
    </PixelFrame>
  );
}
