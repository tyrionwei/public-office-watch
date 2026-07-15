import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { buildElectionEvents } from '../data/electionEvents';
import { translateElectionEventTitle, translateElectionStatus, translateRaceCategory } from '../data/electionI18n';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { electionEventPath } from '../routes/routePaths';
import type { PublicElectionIndexData } from '../lib/publicDataProvider';

function groupEventsByYear(events: ReturnType<typeof buildElectionEvents>, unknownYearLabel: string, locale: string) {
  const groups = new Map<string, typeof events>();

  for (const event of events) {
    const key = event.year ? String(event.year) : unknownYearLabel;
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).sort((left, right) => {
    const leftYear = Number.parseInt(left[0], 10);
    const rightYear = Number.parseInt(right[0], 10);

    if (Number.isFinite(leftYear) && Number.isFinite(rightYear)) return rightYear - leftYear;
    return left[0].localeCompare(right[0], locale);
  });
}

export function ElectionsPage() {
  const { language, t } = useI18n();
  const [indexData, setIndexData] = useState<PublicElectionIndexData>({ elections: [], raceSummaries: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadElectionIndex())
      .then((data) => {
        if (active) setIndexData(data);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load election index', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const events = buildElectionEvents(indexData.elections, [], indexData.raceSummaries);
  const eventGroups = groupEventsByYear(events, t('elections.unknownYear'), language);
  const upcomingEvents = events.filter((event) => ['active', 'upcoming', 'announced'].includes(event.status));
  const totalRaces = events.reduce((total, event) => total + event.raceCount, 0);
  const listSeparator = language === 'en' ? ', ' : '、';
  const summarizeSources = (event: (typeof events)[number]) => {
    const names = Array.from(new Set(event.elections.map((election) => election.name)));
    if (names.length <= 3) return names.join(listSeparator);
    return names.slice(0, 3).join(listSeparator) + ' ' + t('elections.moreSources', { count: names.length });
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame
          title={t('elections.frameTitle')}
          action={<span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{t('elections.eventCount', { count: events.length })}</span>}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-accent">{t('elections.eyebrow')}</p>
              <h1 className="mt-2 font-display text-4xl text-white">{t('elections.heading')}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                {t('elections.description')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HudStatCard label={t('elections.events')} value={<span className="font-display text-xl text-white">{events.length}</span>} />
              <HudStatCard label={t('elections.races')} value={<span className="font-display text-xl text-white">{totalRaces}</span>} />
              <HudStatCard label={t('elections.upcoming')} value={<span className="font-display text-xl text-signal">{upcomingEvents.length}</span>} />
            </div>
          </div>
        </PixelFrame>

        {eventGroups.length > 0 ? (
          eventGroups.map(([year, yearEvents]) => (
            <SectionPanel key={year} title={year} eyebrow={t('elections.year')}>
              <div className="grid gap-3 xl:grid-cols-2">
                {yearEvents.map((event) => (
                  <Link
                    key={event.key}
                    to={electionEventPath(event.key)}
                    className="pixel-corners block border border-line/70 bg-bg/35 p-4 transition hover:border-accent/60 hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{event.votingDate ?? t('elections.voteDatePending')}</p>
                        <h2 className="mt-2 font-display text-2xl text-white">{translateElectionEventTitle(event, t)}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{t('elections.sourceData', { source: summarizeSources(event) })}</p>
                      </div>
                      <span className={['active', 'upcoming', 'announced'].includes(event.status) ? 'pixel-corners border border-signal/55 bg-signal/10 px-2 py-1 text-xs text-signal' : 'pixel-corners border border-line/70 bg-panelAlt/45 px-2 py-1 text-xs text-slate-300'}>
                        {translateElectionStatus(event.status, t)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('elections.categories')}</p>
                        <p className="mt-1 truncate">{event.categoryKeys.map((key) => translateRaceCategory(key, t)).join(listSeparator)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('elections.regions')}</p>
                        <p className="mt-1 truncate">{event.regionSummary === '進入查看區域' ? t('elections.viewRegions') : event.regionSummary}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('elections.races')}</p>
                        <p className="mt-1">{t('elections.raceCount', { count: event.raceCount })}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionPanel>
          ))
        ) : (
          <PixelFrame title={loading ? t('elections.loadingTitle') : t('elections.emptyTitle')}>
            <p className="text-sm text-slate-300">{loading ? t('elections.loadingBody') : t('elections.emptyBody')}</p>
          </PixelFrame>
        )}
      </div>
    </AppShell>
  );
}
