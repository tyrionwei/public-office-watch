import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ElectionBreadcrumbs } from '../components/ElectionBreadcrumbs';
import { ElectionPartyPerformanceChart } from '../components/ElectionPartyPerformanceChart';
import { ElectionEducationDistributionChart } from '../components/ElectionEducationDistributionChart';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { buildElectionEvents, getElectionEventByKey, getRaceRegionGroup } from '../data/electionEvents';
import type { ElectionEvent } from '../data/electionEvents';
import { translateElectionEventTitle, translateElectionStatus, translateRaceCategory, translateRaceStatus, translateRaceType } from '../data/electionI18n';
import { compareElectionRegionLabels, getRaceCategoryByType } from '../data/electionLabels';
import type { RaceCategory } from '../data/electionLabels';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { PublicRaceListPage } from '../lib/publicDataProvider';
import { PUBLIC_ELECTION_RACE_PAGE_SIZE as PAGE_SIZE } from '../lib/publicReadContracts';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { electionEventPath, electionsPath, racePath } from '../routes/routePaths';
import type { PublicElectionEducationDistribution, PublicElectionRaceFacet, PublicPartyElectionPerformance } from '../types/publicViews';

type CategoryOption = RaceCategory & { count: number };
type RegionOption = { key: string; label: string; count: number };

function getPage(searchParams: URLSearchParams) {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getVisiblePageNumbers(currentPage: number, pageCount: number) {
  const visibleCount = Math.min(5, pageCount);
  const halfWindow = Math.floor(visibleCount / 2);
  let start = Math.max(1, currentPage - halfWindow);
  const endOverflow = start + visibleCount - 1 - pageCount;

  if (endOverflow > 0) {
    start = Math.max(1, start - endOverflow);
  }

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function buildCategoryOptions(facets: PublicElectionRaceFacet[], t: ReturnType<typeof useI18n>['t']): CategoryOption[] {
  const options = new Map<string, CategoryOption>();

  for (const facet of facets) {
    const category = getRaceCategoryByType(facet.race_type);
    const option = options.get(category.key) ?? { ...category, count: 0 };
    option.count += facet.race_count;
    options.set(category.key, option);
  }

  return Array.from(options.values())
    .map((option) => ({ ...option, label: translateRaceCategory(option.key, t) }))
    .sort((left, right) => left.order - right.order);
}

function buildRegionOptions(facets: PublicElectionRaceFacet[]): RegionOption[] {
  const options = new Map<string, RegionOption>();

  for (const facet of facets) {
    const option = options.get(facet.region_key) ?? { key: facet.region_key, label: facet.region_label, count: 0 };
    option.count += facet.race_count;
    options.set(facet.region_key, option);
  }

  return Array.from(options.values()).sort((left, right) => compareElectionRegionLabels(left.label, right.label));
}

function buildFilterPath(eventKey: string, searchParams: URLSearchParams, key: 'category' | 'region', value: string) {
  const nextParams = new URLSearchParams(searchParams);

  if (value) {
    nextParams.set(key, value);
  } else {
    nextParams.delete(key);
  }

  nextParams.delete('page');
  const query = nextParams.toString();
  return query ? `${electionEventPath(eventKey)}?${query}` : electionEventPath(eventKey);
}

export function ElectionEventPage() {
  const { language, t } = useI18n();
  const { eventKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<ElectionEvent | null>(null);
  const [facets, setFacets] = useState<PublicElectionRaceFacet[]>([]);
  const [racePage, setRacePage] = useState<PublicRaceListPage>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [educationDistribution, setEducationDistribution] = useState<PublicElectionEducationDistribution[]>([]);
  const [educationDistributionLoading, setEducationDistributionLoading] = useState(false);
  const [racesLoading, setRacesLoading] = useState(false);
  const [partyPerformance, setPartyPerformance] = useState<PublicPartyElectionPerformance[]>([]);
  const [partyPerformanceLoading, setPartyPerformanceLoading] = useState(false);
  const selectedQuery = (searchParams.get('q') ?? '').trim().slice(0, 100);
  const [queryInput, setQueryInput] = useState(selectedQuery);

  useEffect(() => setQueryInput(selectedQuery), [selectedQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setEvent(null);
    setFacets([]);
    setRacePage({ items: [], total: 0 });

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadElectionIndex())
      .then(async (indexData) => {
        const eventSummary = getElectionEventByKey(
          buildElectionEvents(indexData.elections, [], indexData.raceSummaries),
          eventKey ?? '',
        );

        if (!eventSummary) return null;
        const nextFacets = await publicDataProvider.loadElectionRaceFacets(
          eventSummary.elections.map((election) => election.election_id),
        );
        return { event: eventSummary, facets: nextFacets };
      })
      .then((result) => {
        if (active && result) {
          setEvent(result.event);
          setFacets(result.facets);
        }
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load election event', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventKey]);

  const selectedCategoryParam = searchParams.get('category') ?? '';
  const categoryOptions = buildCategoryOptions(facets, t);
  const selectedCategoryOption = categoryOptions.find((option) => option.key === selectedCategoryParam)
    ?? categoryOptions[0];
  const selectedCategory = selectedCategoryOption?.key ?? '';
  const selectedRaceTypes = useMemo(() => Array.from(new Set(
    facets
      .filter((facet) => getRaceCategoryByType(facet.race_type).key === selectedCategory)
      .map((facet) => facet.race_type),
  )), [facets, selectedCategory]);
  const regionOptions = buildRegionOptions(
    facets.filter((facet) => getRaceCategoryByType(facet.race_type).key === selectedCategory),
  );
  const selectedRegionParam = searchParams.get('region') ?? '';
  const selectedRegion = regionOptions.some((option) => option.key === selectedRegionParam)
    ? selectedRegionParam
    : '';
  const requestedPage = getPage(searchParams);

  useEffect(() => {
    let active = true;
    setRacePage({ items: [], total: 0 });

    if (!event || !selectedCategory) {
      setRacesLoading(false);
      return () => {
        active = false;
      };
    }

    setRacesLoading(true);

    void publicDataProvider.loadElectionRacePage(
      event.key,
      event.elections.map((election) => election.election_id),
      { raceTypes: selectedRaceTypes, regionKey: selectedRegion || undefined, query: selectedQuery || undefined },
      requestedPage,
      PAGE_SIZE,
    )
      .then((nextPage) => {
        if (active) setRacePage(nextPage);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load election race page', error);
      })
      .finally(() => {
        if (active) setRacesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [event, requestedPage, selectedCategory, selectedQuery, selectedRaceTypes, selectedRegion]);

  useEffect(() => {
    let active = true;
    setEducationDistribution([]);

    if (!event || !selectedCategory) {
      setEducationDistributionLoading(false);
      return () => {
        active = false;
      };
    }

    setEducationDistributionLoading(true);
    void publicDataProvider.loadElectionEducationDistribution(
      event.key,
      event.elections.map((election) => election.election_id),
      { raceTypes: selectedRaceTypes, regionKey: selectedRegion || undefined },
    )
      .then((rows) => {
        if (active) setEducationDistribution(rows);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load election education distribution', error);
      })
      .finally(() => {
        if (active) setEducationDistributionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [event, selectedCategory, selectedRaceTypes, selectedRegion]);


  useEffect(() => {
    let active = true;
    setPartyPerformance([]);

    if (!event || event.status !== 'completed' || !selectedCategory) {
      setPartyPerformanceLoading(false);
      return () => {
        active = false;
      };
    }

    setPartyPerformanceLoading(true);
    void publicDataProvider.loadElectionPartyPerformance(
      event.key,
      event.elections.map((election) => election.election_id),
      { raceTypes: selectedRaceTypes, regionKey: selectedRegion || undefined },
    )
      .then((rows) => {
        if (active) setPartyPerformance(rows);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load election party performance', error);
      })
      .finally(() => {
        if (active) setPartyPerformanceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [event, selectedCategory, selectedRaceTypes, selectedRegion]);

  if (!event) {
    return (
      <AppShell>
        <PixelFrame title={loading ? t('event.loadingTitle') : t('event.notFoundTitle')} action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">{t('event.backYears')}</Link>}>
          <p className="text-sm text-slate-300">{loading ? t('event.loadingBody') : t('event.notFoundBody')}</p>
        </PixelFrame>
      </AppShell>
    );
  }

  const filteredRaces = racePage.items;
  const pageCount = Math.max(1, Math.ceil(racePage.total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visiblePageNumbers = getVisiblePageNumbers(currentPage, pageCount);
  const updatePage = (page: number) => {
    const nextParams = new URLSearchParams(searchParams);
    const nextPage = Math.min(Math.max(page, 1), pageCount);

    if (nextPage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(nextPage));
    }

    setSearchParams(nextParams);
  };
  const applyQuery = (rawQuery: string) => {
    const nextParams = new URLSearchParams(searchParams);
    const query = rawQuery.trim().slice(0, 100);

    if (query) {
      nextParams.set('q', query);
    } else {
      nextParams.delete('q');
    }

    nextParams.delete('page');
    setSearchParams(nextParams);
  };

  const selectedCategoryLabel = selectedCategoryOption?.label ?? t('event.selectCategory');
  const selectedRegionLabel = selectedRegion
    ? regionOptions.find((option) => option.key === selectedRegion)?.label ?? selectedRegion
    : t('event.allRegions');
  const regionCount = regionOptions.length;
  const categorySummary = categoryOptions.map((option) => option.label).join(language === 'en' ? ', ' : '、');
  const eventTitle = translateElectionEventTitle(event, t);
  const regionBreadcrumbPath = selectedRegion
    ? `${electionEventPath(event.key)}?${new URLSearchParams({ region: selectedRegion }).toString()}`
    : null;

  return (
    <AppShell>
      <div className="space-y-4">
        <ElectionBreadcrumbs
          items={[
            { label: eventTitle, to: electionEventPath(event.key) },
            ...(selectedRegion ? [{ label: selectedRegionLabel, to: regionBreadcrumbPath ?? undefined }] : []),
            { label: selectedCategoryLabel },
          ]}
        />
        <PixelFrame
          title={t('event.overview')}
          action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">{t('event.backYears')}</Link>}
        >
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">{event.votingDate ?? t('event.voteDatePending')}</p>
              <h1 className="mt-2 font-display text-4xl text-white">{eventTitle}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {t('event.description', { categories: categorySummary, regions: regionCount })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{translateElectionStatus(event.status, t)}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{categorySummary}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{t('event.regionCount', { count: regionCount })}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HudStatCard label={t('event.sourceElections')} value={<span className="font-display text-xl text-white">{event.elections.length}</span>} />
              <HudStatCard label={t('event.raceItems')} value={<span className="font-display text-xl text-white">{event.raceCount}</span>} />
              <HudStatCard label={t('event.regions')} value={<span className="font-display text-xl text-white">{regionCount}</span>} />
            </div>
          </section>
        </PixelFrame>

        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_240px]">
          <aside className="space-y-3">
            <PixelFrame title={t('event.categoryFilter')}>
              <div className="space-y-2">
                {categoryOptions.map((option) => (
                  <Link
                    key={option.key}
                    to={buildFilterPath(event.key, searchParams, 'category', option.key)}
                    className={selectedCategory === option.key ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                  >
                    {option.label} <span className="float-right text-slate-500">{option.count}</span>
                  </Link>
                ))}
              </div>
            </PixelFrame>
          </aside>

          <div className="min-w-0 space-y-4">
            {event.status === 'completed' && (partyPerformanceLoading || partyPerformance.length > 0) ? (
              <SectionPanel title={t('event.partyPerformanceTitle')} eyebrow={t('event.partyPerformanceEyebrow')}>
                {partyPerformanceLoading ? (
                  <p className="text-sm text-slate-400">{t('event.partyPerformanceLoading')}</p>
                ) : (
                  <ElectionPartyPerformanceChart
                    rows={partyPerformance}
                    candidateLabel={t('event.partyPerformanceCandidates')}
                    electedLabel={t('event.partyPerformanceElected')}
                    rateLabel={t('event.partyPerformanceRate')}
                    otherPartiesLabel={t('event.partyPerformanceOther')}
                    formatCount={(count) => new Intl.NumberFormat(language).format(count)}
                  />
                )}
              </SectionPanel>
            ) : null}

            {educationDistributionLoading || educationDistribution.length > 0 ? (
              <SectionPanel title={t('event.educationDistributionTitle')} eyebrow={t('event.educationDistributionEyebrow')}>
                {educationDistributionLoading ? (
                  <p className="text-sm text-slate-400">{t('event.educationDistributionLoading')}</p>
                ) : (
                  <ElectionEducationDistributionChart
                    rows={educationDistribution}
                    labels={{
                      doctorate: t('event.educationDoctorate'),
                      master: t('event.educationMaster'),
                      university: t('event.educationUniversity'),
                      tertiary_unspecified: t('event.educationTertiaryUnspecified'),
                      junior_college: t('event.educationJuniorCollege'),
                      high_school: t('event.educationHighSchool'),
                      secondary_or_below: t('event.educationSecondaryOrBelow'),
                      other: t('event.educationOther'),
                      unknown: t('event.educationUnknown'),
                    }}
                    countLabel={t('event.educationCandidates')}
                    formatCount={(count) => new Intl.NumberFormat(language).format(count)}
                  />
                )}
              </SectionPanel>
            ) : null}


            <SectionPanel title={t('event.raceItems')} eyebrow={`${selectedCategoryLabel} / ${selectedRegionLabel}`}>
            <form
              className="mb-4 pixel-corners border border-line/70 bg-bg/35 p-3"
              onSubmit={(submitEvent) => {
                submitEvent.preventDefault();
                applyQuery(queryInput);
              }}
            >
              <label htmlFor="election-race-search" className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-400">{t('event.raceSearchLabel')}</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="election-race-search"
                  type="search"
                  value={queryInput}
                  onChange={(inputEvent) => setQueryInput(inputEvent.target.value)}
                  maxLength={100}
                  placeholder={t('event.raceSearchPlaceholder')}
                  className="min-w-0 flex-1 pixel-corners border border-line/70 bg-panelAlt/55 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
                />
                <button
                  type="submit"
                  className="pixel-corners border border-accent bg-accent/20 px-4 py-2 text-sm text-white transition hover:bg-accent/30"
                >
                  {t('event.raceSearchSubmit')}
                </button>
                {selectedQuery ? (
                  <button type="button" onClick={() => { setQueryInput(''); applyQuery(''); }} className="pixel-corners border border-line/70 bg-bg/35 px-4 py-2 text-sm text-slate-300 transition hover:border-accent/55 hover:text-white">{t('event.raceSearchClear')}</button>
                ) : null}
              </div>
            </form>
            {!selectedCategory ? (
              <p className="text-sm text-slate-400">{t('event.noPublicRaces')}</p>
            ) : racesLoading ? (
              <p className="text-sm text-slate-400">{t('event.loadingRaces')}</p>
            ) : filteredRaces.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">{t('event.resultSummary', { start: pageStart + 1, end: pageStart + filteredRaces.length, total: racePage.total })}</p>
                <div className="overflow-hidden pixel-corners border border-line/70">
                  <div className="grid gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 lg:grid-cols-[minmax(180px,1fr)_130px_130px_110px]">
                    <span>{t('event.item')}</span>
                    <span>{t('event.category')}</span>
                    <span>{t('event.regions')}</span>
                    <span>{t('event.status')}</span>
                  </div>
                  <div className="divide-y divide-line/60">
                    {filteredRaces.map((race) => {
                      const category = getRaceCategoryByType(race.race_type);
                      const region = getRaceRegionGroup(race);

                      return (
                        <Link
                          key={race.race_id}
                          to={racePath(race.race_id)}
                          className="grid gap-3 px-4 py-3 text-sm transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35 lg:grid-cols-[minmax(180px,1fr)_130px_130px_110px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg text-white">{race.title}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{translateRaceType(race.race_type, t)}</p>
                          </div>
                          <p className="text-slate-300">{translateRaceCategory(category.key, t)}</p>
                          <p className="text-slate-300">{region.label}</p>
                          <p className="text-slate-300">{translateRaceStatus(race.status, t)}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                {racePage.total > PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4 text-sm text-slate-300">
                    <p>{t('event.page', { current: currentPage, total: pageCount })}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updatePage(1)}
                        disabled={currentPage <= 1}
                        className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('event.first')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('event.previous')}
                      </button>
                      {visiblePageNumbers.map((pageNumber) => (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => updatePage(pageNumber)}
                          aria-current={pageNumber === currentPage ? 'page' : undefined}
                          className={
                            pageNumber === currentPage
                              ? 'pixel-corners border border-accent bg-accent/20 px-3 py-2 text-xs text-white'
                              : 'pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white'
                          }
                        >
                          {pageNumber}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => updatePage(currentPage + 1)}
                        disabled={currentPage >= pageCount}
                        className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('event.next')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePage(pageCount)}
                        disabled={currentPage >= pageCount}
                        className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('event.last')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-400">{t('event.noMatches')}</p>
            )}
            </SectionPanel>
          </div>

          <aside className="space-y-3">
            <PixelFrame title={t('event.regionFilter')}>
              <div className="space-y-2">
                <Link
                  to={buildFilterPath(event.key, searchParams, 'region', '')}
                  className={selectedRegion === '' ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                >
                  {t('event.allRegions')} <span className="float-right text-slate-500">{selectedCategoryOption?.count ?? 0}</span>
                </Link>
                {regionOptions.map((option) => (
                  <Link
                    key={option.key}
                    to={buildFilterPath(event.key, searchParams, 'region', option.key)}
                    className={selectedRegion === option.key ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                  >
                    {option.label} <span className="float-right text-slate-500">{option.count}</span>
                  </Link>
                ))}
              </div>
            </PixelFrame>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
