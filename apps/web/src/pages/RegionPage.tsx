import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { LocalOfficeSummaryPanel } from '../components/LocalOfficeSummaryPanel';
import { SectionPanel } from '../components/SectionPanel';
import { translateRaceStatus } from '../data/electionI18n';
import { getRegionHighlightBackground } from '../data/regionHighlights';
import { compareUpcomingRacesForDisplay } from '../data/upcomingRaceSort';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { electionsPath, homePath, peoplePath, racePath, regionPath } from '../routes/routePaths';

function getRegionHighlightKey(level: string) {
  if (level === 'county_city') return 'regionPage.countyHighlight' as const;
  if (level === 'district') return 'regionPage.districtHighlight' as const;
  return 'regionPage.countryHighlight' as const;
}

export function RegionPage() {
  const { t } = useI18n();
  const { regionId } = useParams();
  const safeRegionId = regionId ?? '';
  const regionNode = publicDataProvider.getStageRegion(safeRegionId);
  const regionSummary = publicDataProvider.getRegionSummary(safeRegionId);
  const regionCard = publicDataProvider.getRegionCardByStageRegionId(safeRegionId);
  const childRegions = regionNode ? publicDataProvider.getChildStageRegions(regionNode.id) : [];
  const [relatedRaces, setRelatedRaces] = useState(() => publicDataProvider.getRelatedRacesByRegionId(safeRegionId));
  const sortedRelatedRaces = relatedRaces.slice().sort(compareUpcomingRacesForDisplay);
  const highlight = getRegionHighlightBackground(
    regionNode?.id,
    regionNode?.publicRegionId,
    regionNode?.stageLabel,
  );
  const publicRegionId = regionNode?.publicRegionId ?? safeRegionId;

  useEffect(() => {
    let active = true;
    setRelatedRaces(publicDataProvider.getRelatedRacesByRegionId(safeRegionId));

    void publicDataProvider.loadRelatedRacesByRegionId(safeRegionId)
      .then((races) => {
        if (active) {
          setRelatedRaces(races);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [safeRegionId]);

  return (
    <AppShell>
      {regionNode && regionSummary ? (
        <div className="space-y-5">
          <header
            className="pixel-corners relative min-h-[330px] overflow-hidden border border-line/80 bg-panel"
            style={highlight ? {
              backgroundImage: `linear-gradient(90deg, rgba(5, 10, 22, 0.96) 0%, rgba(5, 10, 22, 0.78) 42%, rgba(5, 10, 22, 0.2) 78%), url(${highlight.image})`,
              backgroundPosition: `center, ${highlight.focalPoint}`,
              backgroundSize: 'cover',
            } : undefined}
          >
            <div className="relative flex min-h-[330px] max-w-3xl flex-col justify-between p-5 sm:p-7">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <Link to={homePath()} className="text-accent hover:text-white">{t('regionPage.guide')}</Link>
                <span aria-hidden="true">/</span>
                <span>{regionSummary.label}</span>
              </div>

              <div className="py-8">
                <p className="text-xs uppercase tracking-[0.22em] text-accent">{t(getRegionHighlightKey(regionNode.level))}</p>
                <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">{regionSummary.label}</h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  {highlight?.feature ?? regionCard?.tone ?? regionSummary.sourceNote}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border-l-2 border-signal bg-bg/60 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[11px] text-slate-500">{t('regionPage.nearestElection')}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-white">{regionSummary.nearestElectionName}</p>
                </div>
                <div className="border-l-2 border-accent bg-bg/60 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[11px] text-slate-500">{t('regionPage.voteDate')}</p>
                  <p className="mt-1 font-display text-sm text-accent">{regionSummary.nearestElectionDate}</p>
                </div>
                <div className="border-l-2 border-cyan-300 bg-bg/60 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[11px] text-slate-500">{t('regionPage.publicRaces')}</p>
                  <p className="mt-1 font-display text-sm text-white">{t('regionPage.raceCount', { count: regionSummary.upcomingRaceCount })}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
            <main className="space-y-5">
              <SectionPanel
                title={t('regionPage.relatedElections')}
                eyebrow={t('regionPage.electionsEyebrow')}
                action={<Link to={electionsPath()} className="text-xs text-accent hover:text-white">{t('regionPage.viewAllElections')}</Link>}
              >
                {relatedRaces.length > 0 ? (
                  <div className="divide-y divide-line/60 border-y border-line/60">
                    {sortedRelatedRaces.map((race) => (
                      <Link
                        key={race.id}
                        to={racePath(race.id)}
                        className="grid gap-3 px-2 py-4 transition hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{race.region}</span>
                            <span aria-hidden="true">/</span>
                            <span>{race.date}</span>
                          </div>
                          <h2 className="mt-2 font-display text-lg text-white">{race.title}</h2>
                          <p className="mt-1 text-xs text-slate-400">{translateRaceStatus(race.status, t)}</p>
                        </div>
                        <span className="font-display text-xs text-accent">{t('regionPage.viewCandidates')}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="border-y border-line/60 py-6 text-sm text-slate-400">
                    <p>{t('regionPage.noRecentElections')}</p>
                    <Link to={electionsPath()} className="mt-3 inline-block text-accent hover:text-white">{t('regionPage.viewHistory')}</Link>
                  </div>
                )}
              </SectionPanel>

              {childRegions.length > 0 ? (
                <SectionPanel
                  title={t('regionPage.districtGuide')}
                  eyebrow={t('regionPage.nextLevel')}
                  action={
                    <Link to={peoplePath({ region: publicRegionId })} className="text-xs text-accent hover:text-white">
                      {t('regionPage.viewPeople')}
                    </Link>
                  }
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {childRegions.map((child) => (
                      <Link
                        key={child.id}
                        to={regionPath(child.id)}
                        className="border border-line/70 bg-bg/35 px-4 py-3 transition hover:border-accent/55 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent/35"
                      >
                        <p className="font-display text-sm text-white">{child.label}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{child.note}</p>
                      </Link>
                    ))}
                  </div>
                </SectionPanel>
              ) : null}
            </main>

            <aside className="min-w-0">
              <LocalOfficeSummaryPanel regionId={safeRegionId} />
            </aside>
          </div>
        </div>
      ) : (
        <section className="border border-line/70 bg-panel p-6 text-sm text-slate-300">
          <h1 className="font-display text-2xl text-white">{t('regionPage.notFound')}</h1>
          <p className="mt-3">{t('regionPage.notFoundBody')}</p>
          <Link to={homePath()} className="mt-5 inline-block text-accent hover:text-white">{t('regionPage.back')}</Link>
        </section>
      )}
    </AppShell>
  );
}
