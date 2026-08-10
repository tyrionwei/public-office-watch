import type {
  PublicPartyPeopleStatisticBucket,
  PublicPartyPeopleStatisticDimension,
  PublicPartyPeopleStatisticRow,
} from '../types/publicViews.ts';

type PartyPeopleStatisticsChartProps = {
  rows: PublicPartyPeopleStatisticRow[];
  labels: {
    dimensions: Record<PublicPartyPeopleStatisticDimension, string>;
    buckets: Record<PublicPartyPeopleStatisticBucket, string>;
    currentRatio: string;
    peopleUnit: (count: number) => string;
  };
  accent: string;
};

const dimensionOrder: PublicPartyPeopleStatisticDimension[] = [
  'current_status',
  'gender',
  'age',
  'education',
];

const bucketColors: Record<PublicPartyPeopleStatisticBucket, string> = {
  current: '#22d3ee',
  not_current: '#475569',
  male: '#38bdf8',
  female: '#fb7185',
  under_40: '#34d399',
  '40_49': '#22d3ee',
  '50_59': '#818cf8',
  '60_plus': '#fbbf24',
  doctorate: '#fb7185',
  master: '#22d3ee',
  university: '#38bdf8',
  tertiary_unspecified: '#818cf8',
  junior_college: '#a78bfa',
  high_school: '#fbbf24',
  secondary_or_below: '#fb923c',
  other: '#94a3b8',
  unknown: '#334155',
};

function ratio(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

export function PartyPeopleStatisticsChart({
  rows,
  labels,
  accent,
}: PartyPeopleStatisticsChartProps) {
  const total = rows[0]?.total_people ?? 0;
  const currentCount = rows.find(
    (row) => row.dimension_key === 'current_status' && row.bucket_key === 'current',
  )?.people_count ?? 0;

  return (
    <div className="grid gap-4 border-l-2 pl-4" style={{ borderColor: accent }}>
      <div className="grid gap-4 lg:grid-cols-2">
        {dimensionOrder.map((dimension) => {
          const dimensionRows = rows
            .filter((row) => row.dimension_key === dimension)
            .filter((row) => row.people_count > 0);
          const isEducation = dimension === 'education';

          return (
            <section
              key={dimension}
              className={`pixel-corners border border-line/70 bg-bg/30 p-4 ${isEducation ? 'lg:col-span-2' : ''}`}
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-line/60 pb-3">
                <h4 className="font-display text-base text-white">{labels.dimensions[dimension]}</h4>
                {dimension === 'current_status' ? (
                  <p className="text-xs text-slate-400">
                    {labels.currentRatio}: <span className="text-white">{ratio(currentCount, total).toFixed(1)}%</span>
                  </p>
                ) : null}
              </div>
              <div className={`grid gap-3 ${isEducation ? 'sm:grid-cols-2' : ''}`}>
                {dimensionRows.map((row) => {
                  const percentage = ratio(row.people_count, total);
                  return (
                    <div key={row.bucket_key} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-2 text-slate-300">
                          <span
                            className="h-2.5 w-2.5 shrink-0"
                            style={{ background: bucketColors[row.bucket_key] }}
                          />
                          <span className="truncate">{labels.buckets[row.bucket_key]}</span>
                        </span>
                        <span className="shrink-0 text-slate-500">
                          <span className="font-display text-white">{labels.peopleUnit(row.people_count)}</span>
                          {' / '}{percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden border border-line/60 bg-slate-950/75"
                        role="img"
                        aria-label={`${labels.buckets[row.bucket_key]}: ${labels.peopleUnit(row.people_count)}, ${percentage.toFixed(1)}%`}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${percentage}%`,
                            minWidth: row.people_count > 0 ? '2px' : undefined,
                            background: `linear-gradient(90deg, ${bucketColors[row.bucket_key]}99, ${bucketColors[row.bucket_key]})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
