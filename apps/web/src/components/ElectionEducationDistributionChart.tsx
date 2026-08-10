import type { PublicElectionEducationDistribution } from '../types/publicViews.ts';

const educationColors: Record<PublicElectionEducationDistribution['education_key'], string> = {
  doctorate: '#fb7185',
  master: '#22d3ee',
  university: '#38bdf8',
  tertiary_unspecified: '#818cf8',
  junior_college: '#a78bfa',
  high_school: '#fbbf24',
  secondary_or_below: '#fb923c',
  other: '#94a3b8',
  unknown: '#475569',
};

type ElectionEducationDistributionChartProps = {
  rows: PublicElectionEducationDistribution[];
  labels: Record<PublicElectionEducationDistribution['education_key'], string>;
  countLabel: string;
  formatCount: (count: number) => string;
};

export function ElectionEducationDistributionChart({
  rows,
  labels,
  countLabel,
  formatCount,
}: ElectionEducationDistributionChartProps) {
  const total = rows.reduce((sum, row) => sum + row.candidate_count, 0);
  const maximum = Math.max(...rows.map((row) => row.candidate_count), 1);

  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const percentage = total > 0 ? row.candidate_count / total : 0;
        return (
          <div
            key={row.education_key}
            className="grid gap-2 sm:grid-cols-[minmax(8rem,0.55fr)_minmax(14rem,1.45fr)_8rem] sm:items-center"
          >
            <p className="truncate text-sm text-slate-200">{labels[row.education_key]}</p>
            <div
              className="relative h-4 overflow-hidden border border-line/60 bg-slate-950/70"
              role="img"
              aria-label={`${labels[row.education_key]}: ${formatCount(row.candidate_count)} ${countLabel}, ${(percentage * 100).toFixed(1)}%`}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${(row.candidate_count / maximum) * 100}%`,
                  background: `linear-gradient(90deg, ${educationColors[row.education_key]}99, ${educationColors[row.education_key]})`,
                }}
              />
            </div>
            <p className="text-right text-xs text-slate-400">
              <span className="text-white">{formatCount(row.candidate_count)}</span> {countLabel} · {(percentage * 100).toFixed(1)}%
            </p>
          </div>
        );
      })}
    </div>
  );
}
