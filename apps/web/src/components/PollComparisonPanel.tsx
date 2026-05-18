import { PixelCandidateSprite } from './PixelCandidateSprite';
import { PixelFrame } from './PixelFrame';
import type { PollComparison } from '../types/polling';

type PollComparisonPanelProps = {
  comparison: PollComparison;
};

export function PollComparisonPanel({ comparison }: PollComparisonPanelProps) {
  return (
    <PixelFrame
      title="Poll Battle"
      className="bg-[linear-gradient(180deg,rgba(22,16,52,0.96),rgba(21,22,54,0.92)_55%,rgba(10,15,34,0.95))]"
    >
      <div className="space-y-4">
        <div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent">民調焦點比較</p>
            <h3 className="mt-2 font-display text-2xl text-white">{comparison.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{comparison.summary}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          {comparison.leadingCandidates.slice(0, 1).map((candidate) => (
            <article key={candidate.candidateId} className="pixel-corners border border-sky-400/30 bg-bg/35 p-4">
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
              </dl>
            </article>
          ))}

          <div className="pixel-corners flex items-center justify-center border border-line/70 bg-panelAlt/45 px-4 py-6 text-center">
            <div>
              <p className="font-display text-4xl uppercase tracking-[0.04em] text-signal [text-shadow:2px_2px_0_#7c2d12]">VS</p>
              <p className="mt-2 text-xs text-slate-400">支持度比較</p>
            </div>
          </div>

          {comparison.leadingCandidates.slice(1, 2).map((candidate) => (
            <article key={candidate.candidateId} className="pixel-corners border border-red-400/30 bg-bg/35 p-4">
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
              </dl>
            </article>
          ))}
        </div>

        <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">其他候選人</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {comparison.otherCandidates.map((candidate) => (
              <div key={candidate.candidateId} className="pixel-corners border border-line/60 bg-panelAlt/35 p-3">
                <p className="font-display text-sm text-white">{candidate.displayName}</p>
                <p className="mt-1 text-xs text-slate-400">{candidate.partyLabel}</p>
                <p className="mt-2 text-sm text-slate-300">支持度 {candidate.supportPercent}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PixelFrame>
  );
}
