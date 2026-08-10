import type { PublicPartyLegalStatistics } from '../types/publicViews.ts';

type PartyLegalStatisticsChartProps = {
  summary: PublicPartyLegalStatistics;
  labels: {
    peopleDistribution: string;
    finalConviction: string;
    nonFinal: string;
    other: string;
    acquittalOnly: string;
    noConfirmed: string;
    confirmedPeople: string;
    records: string;
    recordBreakdown: string;
    peopleUnit: (count: number) => string;
    recordsUnit: (count: number) => string;
  };
  accent: string;
};

export function PartyLegalStatisticsChart({
  summary,
  labels,
  accent,
}: PartyLegalStatisticsChartProps) {
  const peopleRows = [
    {
      key: 'final',
      label: labels.finalConviction,
      value: summary.final_conviction_people,
      color: '#fb7185',
    },
    {
      key: 'non-final',
      label: labels.nonFinal,
      value: summary.non_final_people,
      color: '#fbbf24',
    },
    {
      key: 'other',
      label: labels.other,
      value: summary.other_record_people,
      color: '#a78bfa',
    },
    {
      key: 'acquittal',
      label: labels.acquittalOnly,
      value: summary.acquittal_only_people,
      color: '#67e8f9',
    },
    {
      key: 'none',
      label: labels.noConfirmed,
      value: summary.no_confirmed_record_people,
      color: '#334155',
    },
  ];
  const recordRows = [
    [labels.finalConviction, summary.final_conviction_records, '#fb7185'],
    [labels.nonFinal, summary.non_final_records, '#fbbf24'],
    [labels.other, summary.other_records, '#a78bfa'],
    [labels.acquittalOnly, summary.acquittal_records, '#67e8f9'],
  ] as const;
  const finalRatio = summary.total_people > 0
    ? (summary.final_conviction_people / summary.total_people) * 100
    : 0;

  return (
    <div className="grid gap-5 border-l-2 pl-4" style={{ borderColor: accent }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{labels.finalConviction}</p>
          <p className="mt-2 font-display text-2xl text-white">
            {summary.final_conviction_people}
            <span className="ml-1 text-sm text-slate-500">/ {summary.total_people}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">{finalRatio.toFixed(1)}%</p>
        </div>
        <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{labels.confirmedPeople}</p>
          <p className="mt-2 font-display text-2xl text-white">
            {labels.peopleUnit(summary.confirmed_record_people)}
          </p>
        </div>
        <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{labels.records}</p>
          <p className="mt-2 font-display text-2xl text-white">
            {labels.recordsUnit(summary.record_count)}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{labels.peopleDistribution}</p>
        <div className="flex h-5 overflow-hidden border border-line/70 bg-slate-950/80" role="img" aria-label={labels.peopleDistribution}>
          {peopleRows.filter((row) => row.value > 0).map((row) => (
            <div
              key={row.key}
              title={`${row.label}: ${labels.peopleUnit(row.value)}`}
              style={{
                width: `${(row.value / Math.max(summary.total_people, 1)) * 100}%`,
                minWidth: '2px',
                background: row.key === 'none'
                  ? row.color
                  : `linear-gradient(90deg, ${row.color}99, ${row.color})`,
              }}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {peopleRows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="h-2.5 w-2.5 shrink-0" style={{ background: row.color }} />
                {row.label}
              </span>
              <span className="font-display text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {summary.record_count > 0 ? (
        <div className="border-t border-line/60 pt-4">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">{labels.recordBreakdown}</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recordRows.map(([label, value, color]) => (
              <div key={label} className="flex items-center justify-between border border-line/60 bg-bg/25 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="h-2 w-2" style={{ background: color }} />
                  {label}
                </span>
                <span className="font-display text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
