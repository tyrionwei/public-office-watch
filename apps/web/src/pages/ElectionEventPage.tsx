import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { buildElectionEvents, getElectionEventByKey, getRaceRegionGroup } from '../data/electionEvents';
import type { ElectionEvent } from '../data/electionEvents';
import { compareElectionRegionLabels, getElectionStatusLabel, getRaceCategory, getRaceCategoryByType, getRaceStatusLabel, getRaceTypeLabel } from '../data/electionLabels';
import type { RaceCategory } from '../data/electionLabels';
import { publicDataProvider } from '../lib/publicData';
import type { PublicRaceListPage } from '../lib/publicDataProvider';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { electionEventPath, electionsPath, racePath } from '../routes/routePaths';
import type { PublicElectionRaceFacet } from '../types/publicViews';

type CategoryOption = RaceCategory & { count: number };
type RegionOption = { key: string; label: string; count: number };
const PAGE_SIZE = 50;

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

function buildCategoryOptions(facets: PublicElectionRaceFacet[]): CategoryOption[] {
  const options = new Map<string, CategoryOption>();

  for (const facet of facets) {
    const category = getRaceCategoryByType(facet.race_type);
    const option = options.get(category.key) ?? { ...category, count: 0 };
    option.count += facet.race_count;
    options.set(category.key, option);
  }

  return Array.from(options.values()).sort((left, right) => left.order - right.order);
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
  const { eventKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<ElectionEvent | null>(null);
  const [facets, setFacets] = useState<PublicElectionRaceFacet[]>([]);
  const [racePage, setRacePage] = useState<PublicRaceListPage>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [racesLoading, setRacesLoading] = useState(false);

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
  const categoryOptions = buildCategoryOptions(facets);
  const selectedCategoryOption = categoryOptions.find((option) => option.key === selectedCategoryParam)
    ?? categoryOptions[0];
  const selectedCategory = selectedCategoryOption?.key ?? '';
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

    const raceTypes = Array.from(new Set(
      facets
        .filter((facet) => getRaceCategoryByType(facet.race_type).key === selectedCategory)
        .map((facet) => facet.race_type),
    ));
    setRacesLoading(true);

    void publicDataProvider.loadElectionRacePage(
      event.key,
      event.elections.map((election) => election.election_id),
      { raceTypes, regionKey: selectedRegion || undefined },
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
  }, [event, facets, requestedPage, selectedCategory, selectedRegion]);

  if (!event) {
    return (
      <AppShell>
        <PixelFrame title={loading ? '大選資料載入中' : '找不到大選事件'} action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回選舉年份</Link>}>
          <p className="text-sm text-slate-300">{loading ? '正在載入此大選的選區項目。' : '此大選事件尚未載入，或目前沒有可公開的選舉資料。'}</p>
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
  const selectedCategoryLabel = selectedCategoryOption?.label ?? '請選擇項目';
  const selectedRegionLabel = selectedRegion
    ? regionOptions.find((option) => option.key === selectedRegion)?.label ?? selectedRegion
    : '全部區域';
  const regionCount = regionOptions.length;

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame
          title="大選總覽"
          action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回選舉年份</Link>}
        >
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">{event.votingDate ?? '投票日待公告'}</p>
              <h1 className="mt-2 font-display text-4xl text-white">{event.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                這個事件合併 {event.elections.length} 筆原始選舉資料：{event.sourceNameSummary}。預設顯示層級最高的項目；可從左側切換項目，再從右側依縣市或區域縮小範圍。
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{getElectionStatusLabel(event.status)}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{event.categorySummary}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{regionCount} 個區域</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HudStatCard label="原始選舉" value={<span className="font-display text-xl text-white">{event.elections.length}</span>} />
              <HudStatCard label="選區項目" value={<span className="font-display text-xl text-white">{event.raceCount}</span>} />
              <HudStatCard label="區域" value={<span className="font-display text-xl text-white">{regionCount}</span>} />
            </div>
          </section>
        </PixelFrame>

        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_240px]">
          <aside className="space-y-3">
            <PixelFrame title="項目分類">
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

          <SectionPanel title="選區項目" eyebrow={`${selectedCategoryLabel} / ${selectedRegionLabel}`}>
            {!selectedCategory ? (
              <p className="text-sm text-slate-400">目前沒有可公開的選區項目。</p>
            ) : racesLoading ? (
              <p className="text-sm text-slate-400">正在載入符合條件的選區項目。</p>
            ) : filteredRaces.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">目前顯示第 {pageStart + 1}-{pageStart + filteredRaces.length} 項，共 {racePage.total} 個項目。點進單一項目後可查看候選人與當選資料。</p>
                <div className="overflow-hidden pixel-corners border border-line/70">
                  <div className="grid gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 lg:grid-cols-[minmax(180px,1fr)_130px_130px_110px]">
                    <span>項目</span>
                    <span>分類</span>
                    <span>區域</span>
                    <span>狀態</span>
                  </div>
                  <div className="divide-y divide-line/60">
                    {filteredRaces.map((race) => {
                      const category = getRaceCategory(race);
                      const region = getRaceRegionGroup(race);

                      return (
                        <Link
                          key={race.race_id}
                          to={racePath(race.race_id)}
                          className="grid gap-3 px-4 py-3 text-sm transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35 lg:grid-cols-[minmax(180px,1fr)_130px_130px_110px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg text-white">{race.title}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{getRaceTypeLabel(race.race_type)}</p>
                          </div>
                          <p className="text-slate-300">{category.label}</p>
                          <p className="text-slate-300">{region.label}</p>
                          <p className="text-slate-300">{getRaceStatusLabel(race.status)}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                {racePage.total > PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4 text-sm text-slate-300">
                    <p>第 {currentPage}/{pageCount} 頁</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updatePage(1)}
                        disabled={currentPage <= 1}
                        className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        第一頁
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        上一頁
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
                        下一頁
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePage(pageCount)}
                        disabled={currentPage >= pageCount}
                        className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        最後一頁
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-400">目前沒有符合此項目與區域的選區資料。</p>
            )}
          </SectionPanel>

          <aside className="space-y-3">
            <PixelFrame title="縣市 / 區域">
              <div className="space-y-2">
                <Link
                  to={buildFilterPath(event.key, searchParams, 'region', '')}
                  className={selectedRegion === '' ? 'block pixel-corners border border-accent bg-accent/20 px-3 py-2 text-sm text-white' : 'block pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-sm text-slate-300 hover:border-accent/55 hover:text-white'}
                >
                  全部區域 <span className="float-right text-slate-500">{selectedCategoryOption?.count ?? 0}</span>
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
