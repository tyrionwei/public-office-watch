import type { PublicPartyCompanyContributionSummary } from '../types/publicViews.ts';

type PartyCompanyContributionChartProps = {
  rows: PublicPartyCompanyContributionSummary[];
  amountLabel: string;
  countLabel: (count: number) => string;
  formatValue: (value: number) => string;
  accent: string;
};

export function PartyCompanyContributionChart({
  rows,
  amountLabel,
  countLabel,
  formatValue,
  accent,
}: PartyCompanyContributionChartProps) {
  const visibleRows = rows.slice(0, 6);
  const maximum = Math.max(...visibleRows.map((row) => row.amount_total), 1);

  return (
    <div className="grid gap-3" role="img" aria-label={amountLabel}>
      {visibleRows.map((row, index) => (
        <div key={row.company_id} className="grid gap-2 sm:grid-cols-[minmax(9rem,0.75fr)_minmax(12rem,1.25fr)] sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-200"><span className="mr-2 font-display text-slate-500">{String(index + 1).padStart(2, '0')}</span>{row.company_name}</p>
            <p className="mt-1 text-xs text-slate-500">{countLabel(row.donation_count)}</p>
          </div>
          <div>
            <div className="h-3 overflow-hidden border border-line/60 bg-slate-950/70">
              <div
                className="h-full min-w-px"
                style={{ width: `${(row.amount_total / maximum) * 100}%`, background: `linear-gradient(90deg, ${accent}55, ${accent})` }}
              />
            </div>
            <p className="mt-1 text-right font-display text-sm text-white">{formatValue(row.amount_total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
