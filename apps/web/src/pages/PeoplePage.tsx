import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { PUBLIC_PEOPLE_PAGE_SIZE as PAGE_SIZE } from '../lib/publicReadContracts';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { getPersonDisplayPosition, normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicPersonFilters, PublicPersonListItem, PublicPersonRole, PublicPersonStatus } from '../types/publicViews';

const roleOptionDefinitions: { value: PublicPersonRole; labelKey: TranslationKey }[] = [
  { value: 'president', labelKey: 'people.role.president' },
  { value: 'vice_president', labelKey: 'people.role.vice_president' },
  { value: 'legislator', labelKey: 'people.role.legislator' },
  { value: 'local_chief', labelKey: 'people.role.local_chief' },
  { value: 'local_deputy', labelKey: 'people.role.local_deputy' },
  { value: 'agency_head', labelKey: 'people.role.agency_head' },
  { value: 'councilor', labelKey: 'people.role.councilor' },
  { value: 'party_officer', labelKey: 'people.role.party_officer' },
  { value: 'candidate', labelKey: 'people.role.candidate' },
  { value: 'other', labelKey: 'people.role.other' },
];

const statusOptionDefinitions: { value: PublicPersonStatus; labelKey: TranslationKey }[] = [
  { value: 'current', labelKey: 'people.status.current' },
  { value: 'candidate', labelKey: 'people.status.candidate' },
  { value: 'former', labelKey: 'people.status.former' },
  { value: 'other', labelKey: 'people.status.other' },
];

const priorityPartyOrder = ['民主進步黨', '中國國民黨', '台灣民眾黨'];
const independentPartyLabels = new Set(['無黨籍', '無黨籍及未經政黨推薦']);

function normalizedPartySortLabel(party: string) {
  if (party === '臺灣民眾黨') return '台灣民眾黨';
  if (party === '臺灣基進') return '台灣基進';
  return party;
}

function comparePartyOptions(left: string, right: string) {
  const leftLabel = normalizedPartySortLabel(left);
  const rightLabel = normalizedPartySortLabel(right);
  const leftIndependent = independentPartyLabels.has(leftLabel);
  const rightIndependent = independentPartyLabels.has(rightLabel);

  if (leftIndependent !== rightIndependent) {
    return leftIndependent ? 1 : -1;
  }

  const leftPriority = priorityPartyOrder.indexOf(leftLabel);
  const rightPriority = priorityPartyOrder.indexOf(rightLabel);

  if (leftPriority !== -1 || rightPriority !== -1) {
    if (leftPriority === -1) return 1;
    if (rightPriority === -1) return -1;
    return leftPriority - rightPriority;
  }

  if (leftLabel === '未知政黨' || rightLabel === '未知政黨') {
    if (leftLabel === rightLabel) return 0;
    return leftLabel === '未知政黨' ? 1 : -1;
  }

  return leftLabel.localeCompare(rightLabel, 'zh-Hant-TW');
}

function getFilters(searchParams: URLSearchParams): PublicPersonFilters {
  return {
    query: searchParams.get('q') ?? undefined,
    regionId: searchParams.get('region') ?? undefined,
    party: searchParams.get('party') ?? undefined,
    role: (searchParams.get('role') as PublicPersonRole | null) ?? undefined,
    status: (searchParams.get('status') as PublicPersonStatus | null) ?? undefined,
  };
}

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

function SelectFilter({
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  allLabel: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full pixel-corners border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white outline-none focus:border-accent"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function KeywordFilter({
  value,
  onSearch,
  label,
  buttonLabel,
}: {
  value: string;
  onSearch: (value: string) => void;
  label: string;
  buttonLabel: string;
}) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(draftValue.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <input
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        placeholder={label}
        className="mt-2 w-full pixel-corners border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
      />
      <button
        type="submit"
        className="mt-2 w-full pixel-corners border border-accent/70 bg-accent/15 px-3 py-2 text-sm text-accent transition hover:bg-accent/25 hover:text-white"
      >
        {buttonLabel}
      </button>
    </form>
  );
}

export function PeoplePage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = getFilters(searchParams);
  const { party, query, regionId, role, status } = filters;
  const requestedPage = getPage(searchParams);
  const [peoplePage, setPeoplePage] = useState<{ items: PublicPersonListItem[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    setPeoplePage({ items: [], total: 0 });

    const requestFilters = { party, query, regionId, role, status };

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadPeoplePage(requestFilters, requestedPage, PAGE_SIZE))
      .then((nextPage) => {
        if (active) {
          setPeoplePage(nextPage);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoading(false);
          setLoadError(true);
          if (import.meta.env.DEV) {
            console.warn('Failed to load people page', error);
          }
        }
      });

    return () => {
      active = false;
    };
  }, [party, query, regionId, role, status, requestedPage, requestVersion]);

  const people = peoplePage.items;
  const pageCount = Math.max(1, Math.ceil(peoplePage.total / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visiblePageNumbers = getVisiblePageNumbers(currentPage, pageCount);
  const regionOptions = publicDataProvider
    .getStageRegions()
    .filter((region) => region.level === 'county_city')
    .map((region) => ({ value: region.id, label: region.label }));
  const roleOptions = useMemo(
    () => roleOptionDefinitions.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t],
  );
  const statusOptions = useMemo(
    () => statusOptionDefinitions.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t],
  );
  const partyOptions = Array.from(new Set(publicDataProvider.getParties().map((item) => normalizePartyLabel(item.name))))
    .sort(comparePartyOptions)
    .map((item) => ({ value: item, label: item }));
  const activeFilterItems = [
    query ? { label: t('people.name'), value: query } : null,
    regionId ? { label: t('people.region'), value: regionOptions.find((option) => option.value === regionId)?.label ?? regionId } : null,
    party ? { label: t('people.party'), value: party } : null,
    role ? { label: t('people.role'), value: roleOptions.find((option) => option.value === role)?.label ?? role } : null,
    status ? { label: t('people.status'), value: statusOptions.find((option) => option.value === status)?.label ?? status } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const updateFilter = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }

    nextParams.delete('page');
    setSearchParams(nextParams);
  };

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

  return (
    <AppShell>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <PixelFrame title={t('people.filterTitle')}>
            <div className="space-y-4">
              <KeywordFilter value={filters.query ?? ''} onSearch={(value) => updateFilter('q', value)} label={t('people.keyword')} buttonLabel={t('common.search')} />

              <SelectFilter label={t('people.region')} value={filters.regionId ?? ''} options={regionOptions} onChange={(value) => updateFilter('region', value)} allLabel={t('common.all')} />
              <SelectFilter label={t('people.party')} value={filters.party ?? ''} options={partyOptions} onChange={(value) => updateFilter('party', value)} allLabel={t('common.all')} />
              <SelectFilter label={t('people.role')} value={filters.role ?? ''} options={roleOptions} onChange={(value) => updateFilter('role', value)} allLabel={t('common.all')} />
              <SelectFilter label={t('people.status')} value={filters.status ?? ''} options={statusOptions} onChange={(value) => updateFilter('status', value)} allLabel={t('common.all')} />

              <Link
                to={peoplePath()}
                className="pixel-corners block border border-line/70 bg-bg/35 px-3 py-2 text-center text-sm text-slate-300 hover:border-accent/55 hover:text-white"
              >
                {t('common.clearFilters')}
              </Link>
            </div>
          </PixelFrame>
        </aside>

        <PixelFrame
          title={t('people.title')}
          action={
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {t('common.recordsPage', { count: loading ? '...' : loadError ? '—' : peoplePage.total, currentPage, pageCount })}
            </span>
          }
        >
          <div className="mb-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)]">
            <div className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs leading-5 text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">{t('people.currentFilters')}</span>
                {activeFilterItems.length > 0 ? (
                  activeFilterItems.map((item) => (
                    <span key={item.label} className="pixel-corners border border-line/70 bg-panelAlt/45 px-2 py-1 text-slate-200">
                      {item.label}：{item.value}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">{t('people.allPeople')}</span>
                )}
              </div>
              <p className="mt-2 text-slate-400">
                {t('people.defaultScope')}
              </p>
            </div>
            <div className="pixel-corners border border-accent/35 bg-accent/10 px-3 py-2 text-xs leading-5 text-slate-300">
              <p>
                {t('people.currentResults')} <span className="font-display text-base text-white">{loading ? '...' : loadError ? '—' : peoplePage.total}</span> {t('people.recordsUnit')}
              </p>
              <p className="mt-1 text-slate-400">{t('people.sortHint')}</p>
            </div>
          </div>

          {loading ? (
            <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center text-sm text-slate-300">
              {t('people.loading')}
            </div>
          ) : loadError ? (
            <div role="alert" className="pixel-corners border border-arcadePink/55 bg-arcadePink/10 px-4 py-8 text-center text-sm text-slate-200">
              <p>{t('people.loadError')}</p>
              <button
                type="button"
                onClick={() => setRequestVersion((value) => value + 1)}
                className="mt-4 pixel-corners border border-accent/70 bg-accent/15 px-4 py-2 text-sm text-accent transition hover:bg-accent/25 hover:text-white"
              >
                {t('people.retry')}
              </button>
            </div>
          ) : people.length > 0 ? (
            <div className="overflow-hidden pixel-corners border border-line/70">
              <div className="grid grid-cols-[minmax(160px,1fr)_minmax(120px,0.7fr)_minmax(120px,0.75fr)_minmax(130px,0.8fr)_90px] gap-3 border-b border-line/70 bg-panelAlt/55 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-500 max-lg:hidden">
                <span>{t('people.name')}</span>
                <span>{t('people.party')}</span>
                <span>{t('people.role')}</span>
                <span>{t('people.region')}</span>
                <span>{t('people.status')}</span>
              </div>
              <div className="divide-y divide-line/60">
                {people.map((person) => {
                  const theme = partyTheme[toPartyThemeKey(person.party)];
                  return (
                    <Link
                      key={person.person_id}
                      to={personPath(person.person_id)}
                      className="grid gap-3 px-3 py-3 transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35 lg:grid-cols-[minmax(160px,1fr)_minmax(120px,0.7fr)_minmax(120px,0.75fr)_minmax(130px,0.8fr)_90px]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg text-white">{person.name}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{getPersonDisplayPosition(person)}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="mb-1 block text-[10px] text-slate-500 lg:hidden">{t('people.party')}</span>
                        <span
                          className="pixel-corners inline-block max-w-full truncate border px-2 py-1 text-xs"
                          style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                        >
                          {normalizePartyLabel(person.party)}
                        </span>
                      </div>
                      <p className="min-w-0 truncate text-sm text-slate-300"><span className="mr-2 text-[10px] text-slate-500 lg:hidden">{t('people.role')}</span>{person.role_label}</p>
                      <p className="min-w-0 truncate text-sm text-slate-300"><span className="mr-2 text-[10px] text-slate-500 lg:hidden">{t('people.region')}</span>{person.region_name ?? person.district ?? t('people.noRegion')}</p>
                      <p className={person.status === 'current' ? 'text-sm text-signal' : 'text-sm text-slate-400'}>
                        <span className="mr-2 text-[10px] text-slate-500 lg:hidden">{t('people.status')}</span>{person.status_label}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center text-sm text-slate-300">
              {t('people.noResults')}
            </div>
          )}

          {!loading && !loadError && peoplePage.total > PAGE_SIZE ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-line/60 pt-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {t('people.showing', { start: pageStart + 1, end: pageStart + people.length, total: peoplePage.total })}
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => updatePage(1)}
                  disabled={currentPage <= 1}
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('people.first')}
                </button>
                <button
                  type="button"
                  onClick={() => updatePage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('people.previous')}
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
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('people.next')}
                </button>
                <button
                  type="button"
                  onClick={() => updatePage(pageCount)}
                  disabled={currentPage >= pageCount}
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('people.last')}
                </button>
              </div>
            </div>
          ) : null}
        </PixelFrame>
      </div>
    </AppShell>
  );
}
