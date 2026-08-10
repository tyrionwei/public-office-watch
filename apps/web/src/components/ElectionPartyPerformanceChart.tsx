import { collapsePartyElectionPerformance } from '../lib/electionStatistics.ts';
import { toPartyThemeKey } from '../lib/personData.ts';
import { partyTheme } from '../styles/partyThemes.ts';
import type { PublicPartyElectionPerformance } from '../types/publicViews.ts';

type ElectionPartyPerformanceChartProps = {
  rows: PublicPartyElectionPerformance[];
  candidateLabel: string;
  electedLabel: string;
  rateLabel: string;
  otherPartiesLabel: string;
  formatCount: (count: number) => string;
};

export function ElectionPartyPerformanceChart({
  rows,
  candidateLabel,
  electedLabel,
  rateLabel,
  otherPartiesLabel,
  formatCount,
}: ElectionPartyPerformanceChartProps) {
  const displayRows = collapsePartyElectionPerformance(rows);
  const maximum = Math.max(...displayRows.map((row) => row.candidate_count), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 border border-white/20 bg-slate-600" />{candidateLabel}</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 bg-signal" />{electedLabel}</span>
      </div>
      <div className="grid gap-3">
        {displayRows.map((row) => {
          const partyName = row.party_name === '__other_parties__' ? otherPartiesLabel : row.party_name;
          const theme = partyTheme[toPartyThemeKey(partyName)];
          const rate = row.candidate_count > 0 ? row.elected_count / row.candidate_count : 0;
          return (
            <div key={row.party_name} className="grid gap-2 sm:grid-cols-[minmax(8rem,0.55fr)_minmax(14rem,1.45fr)_7.5rem] sm:items-center">
              <p className="truncate text-sm text-slate-200">{partyName}</p>
              <div className="relative h-4 overflow-hidden border border-line/60 bg-slate-950/70">
                <div
                  className="absolute inset-y-0 left-0 bg-slate-600/60"
                  style={{ width: `${(row.candidate_count / maximum) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${(row.elected_count / maximum) * 100}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})` }}
                />
              </div>
              <p className="text-right text-xs text-slate-400">
                <span className="text-white">{formatCount(row.elected_count)}</span> / {formatCount(row.candidate_count)} · {rateLabel} {(rate * 100).toFixed(1)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
