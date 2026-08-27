import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { HomeSeatCount } from '../lib/publicDataProvider';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import { PixelFrame } from './PixelFrame';

type PartySeatDistributionPanelProps = {
  regionId: string | null;
  regionLabel: string;
  national: boolean;
  partyCounts: HomeSeatCount[];
  loading: boolean;
};

function combinePartyCounts(items: HomeSeatCount[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const party = normalizePartyLabel(item.party);
    counts.set(party, (counts.get(party) ?? 0) + item.count);
  }
  return Array.from(counts, ([party, count]) => ({ party, count }))
    .sort((left, right) => right.count - left.count || left.party.localeCompare(right.party, 'zh-Hant-TW'));
}

export function PartySeatDistributionPanel({
  regionId,
  regionLabel,
  national,
  partyCounts: rawPartyCounts,
  loading,
}: PartySeatDistributionPanelProps) {
  const { t } = useI18n();
  const partyCounts = useMemo(() => combinePartyCounts(rawPartyCounts), [rawPartyCounts]);

  const total = useMemo(() => partyCounts.reduce((sum, item) => sum + item.count, 0), [partyCounts]);
  const visiblePartyCounts = partyCounts.slice(0, 5);
  const largestCount = partyCounts[0]?.count ?? 1;
  const role = national ? 'legislator' : 'councilor';
  const basePeopleFilters = {
    region: national ? null : regionId,
    role,
    status: 'current',
  };

  return (
    <PixelFrame
      title={national ? t('seatDistribution.nationalTitle') : t('seatDistribution.localTitle')}
      className="xl:h-full"
      action={loading ? <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t('office.loading')}</span> : null}
    >
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{regionLabel}</p>
            <p className="mt-1 text-xs text-slate-400">{t('seatDistribution.totalSeats', { count: total })}</p>
          </div>
          <span className="font-display text-2xl text-white">{total}</span>
        </div>

        {partyCounts.length > 0 ? (
          <>
            <div className="flex h-4 overflow-hidden border border-line/70 bg-bg/70" aria-hidden="true">
              {partyCounts.map((item) => {
                const theme = partyTheme[toPartyThemeKey(item.party)];
                return <span key={item.party} style={{ width: `${(item.count / total) * 100}%`, backgroundColor: theme.primary }} />;
              })}
            </div>

            <div className="space-y-2">
              {visiblePartyCounts.map((item) => {
                const theme = partyTheme[toPartyThemeKey(item.party)];
                return (
                  <Link
                    key={item.party}
                    data-party-seat-row
                    to={peoplePath({ ...basePeopleFilters, party: item.party })}
                    className="grid grid-cols-[72px_minmax(0,1fr)_2rem] items-center gap-2 rounded-sm px-1 py-1 text-xs transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent/35"
                    aria-label={t('seatDistribution.partySeats', { party: item.party, count: item.count })}
                  >
                    <span className="truncate text-slate-300">{item.party}</span>
                    <span className="h-2 overflow-hidden bg-bg/70">
                      <span
                        className="block h-full"
                        style={{ width: `${Math.max(4, (item.count / largestCount) * 100)}%`, backgroundColor: theme.accent }}
                      />
                    </span>
                    <span className="text-right font-display text-base" style={{ color: theme.text }}>{item.count}</span>
                  </Link>
                );
              })}
            </div>

            <Link
              to={peoplePath(basePeopleFilters)}
              className="pixel-corners flex w-full items-center justify-center border border-line/80 bg-bg/50 px-3 py-2 font-display text-xs text-accent transition hover:border-accent/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/35"
            >
              {t('seatDistribution.viewAll')} <span className="ml-2" aria-hidden="true">›</span>
            </Link>
          </>
        ) : loading ? (
          <div className="h-28 animate-pulse pixel-corners border border-line/60 bg-panelAlt/25" />
        ) : (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-3 py-5 text-center text-sm text-slate-400">
            {t('seatDistribution.empty')}
          </div>
        )}
      </div>
    </PixelFrame>
  );
}
