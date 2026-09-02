type FinanceSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type PartyFinanceCompositionChartProps = {
  ariaLabel: string;
  totalLabel: string;
  totalIncome: number;
  segments: FinanceSegment[];
  unclassifiedLabel: string;
  formatValue: (value: number) => string;
  locale: string;
};

function percent(value: number, total: number, locale: string) {
  if (total <= 0) return '0%';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value / total);
}

export function PartyFinanceCompositionChart({
  ariaLabel,
  totalLabel,
  totalIncome,
  segments,
  unclassifiedLabel,
  formatValue,
  locale,
}: PartyFinanceCompositionChartProps) {
  const visibleSegments = segments.filter((segment) => segment.value > 0);
  const classifiedTotal = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
  const chartTotal = Math.max(totalIncome, classifiedTotal);
  const unclassifiedValue = Math.max(0, chartTotal - classifiedTotal);
  const chartSegments = unclassifiedValue > 0
    ? [...visibleSegments, { key: 'unclassified', label: unclassifiedLabel, value: unclassifiedValue, color: '#64748b' }]
    : visibleSegments;

  let cursor = 0;
  const stops = chartSegments.map((segment) => {
    const start = cursor;
    cursor += chartTotal > 0 ? (segment.value / chartTotal) * 100 : 0;
    return `${segment.color} ${start}% ${cursor}%`;
  });
  const donutBackground = stops.length > 0
    ? `conic-gradient(from -90deg, ${stops.join(', ')})`
    : 'conic-gradient(#334155 0 100%)';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(15rem,0.75fr)_minmax(0,1.45fr)] lg:items-center">
      <div className="relative mx-auto aspect-square w-full max-w-[18rem]" role="img" aria-label={ariaLabel}>
        <div
          className="absolute inset-0 rounded-full border border-white/10 shadow-[0_0_42px_rgba(103,232,249,0.14)]"
          style={{ background: donutBackground }}
        />
        <div className="absolute inset-[20%] grid place-content-center rounded-full border border-line/80 bg-bg text-center shadow-[inset_0_0_28px_rgba(103,232,249,0.08)]">
          <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{totalLabel}</span>
          <strong className="mt-2 px-2 font-display text-lg text-white sm:text-xl">{formatValue(chartTotal)}</strong>
        </div>
        <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-white/70" aria-hidden="true" />
        <span className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-white/25" aria-hidden="true" />
        <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/25" aria-hidden="true" />
        <span className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/25" aria-hidden="true" />
      </div>

      <div className="grid gap-3">
        {chartSegments.map((segment) => {
          const share = chartTotal > 0 ? segment.value / chartTotal : 0;
          return (
            <div key={segment.key} className="pixel-corners border border-line/60 bg-bg/35 px-3 py-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-slate-300">
                  <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: segment.color }} aria-hidden="true" />
                  <span className="truncate">{segment.label}</span>
                </span>
                <span className="shrink-0 font-display text-white">{percent(segment.value, chartTotal, locale)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden bg-slate-800" aria-hidden="true">
                <div
                  className="h-full min-w-px transition-[width] duration-500"
                  style={{ width: `${Math.max(share * 100, 0.35)}%`, backgroundColor: segment.color }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-slate-500">{formatValue(segment.value)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
