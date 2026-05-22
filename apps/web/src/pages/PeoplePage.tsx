import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { publicDataProvider } from '../lib/publicData';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { peoplePath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicPersonFilters, PublicPersonRole, PublicPersonStatus } from '../types/publicViews';

const PAGE_SIZE = 20;

const roleOptions: { value: PublicPersonRole; label: string }[] = [
  { value: 'president', label: '總統' },
  { value: 'vice_president', label: '副總統' },
  { value: 'legislator', label: '立法委員' },
  { value: 'local_chief', label: '縣市首長' },
  { value: 'local_deputy', label: '副縣市首長' },
  { value: 'agency_head', label: '主要單位首長' },
  { value: 'councilor', label: '議員' },
  { value: 'party_officer', label: '政黨職務' },
  { value: 'candidate', label: '候選人' },
  { value: 'other', label: '其他' },
];

const statusOptions: { value: PublicPersonStatus; label: string }[] = [
  { value: 'current', label: '現任' },
  { value: 'candidate', label: '候選人' },
  { value: 'former', label: '曾參選' },
  { value: 'other', label: '其他' },
];

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
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full pixel-corners border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white outline-none focus:border-accent"
      >
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PeoplePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = getFilters(searchParams);
  const people = publicDataProvider.getPeopleByFilters(filters);
  const requestedPage = getPage(searchParams);
  const pageCount = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visiblePeople = people.slice(pageStart, pageStart + PAGE_SIZE);
  const visiblePageNumbers = getVisiblePageNumbers(currentPage, pageCount);
  const allPeople = publicDataProvider.getPeopleByFilters();
  const regionOptions = publicDataProvider
    .getStageRegions()
    .filter((region) => region.level === 'county_city')
    .map((region) => ({ value: region.id, label: region.label }));
  const partyOptions = Array.from(new Set(allPeople.map((person) => normalizePartyLabel(person.party))))
    .sort((left, right) => left.localeCompare(right, 'zh-Hant-TW'))
    .map((party) => ({ value: party, label: party }));

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
          <PixelFrame title="人物篩選">
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">keyword</span>
                <input
                  value={filters.query ?? ''}
                  onChange={(event) => updateFilter('q', event.target.value)}
                  placeholder="姓名、政黨、職位"
                  className="mt-2 w-full pixel-corners border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
                />
              </label>

              <SelectFilter label="region" value={filters.regionId ?? ''} options={regionOptions} onChange={(value) => updateFilter('region', value)} />
              <SelectFilter label="party" value={filters.party ?? ''} options={partyOptions} onChange={(value) => updateFilter('party', value)} />
              <SelectFilter label="role" value={filters.role ?? ''} options={roleOptions} onChange={(value) => updateFilter('role', value)} />
              <SelectFilter label="status" value={filters.status ?? ''} options={statusOptions} onChange={(value) => updateFilter('status', value)} />

              <Link
                to={peoplePath()}
                className="pixel-corners block border border-line/70 bg-bg/35 px-3 py-2 text-center text-sm text-slate-300 hover:border-accent/55 hover:text-white"
              >
                清除篩選
              </Link>
            </div>
          </PixelFrame>
        </aside>

        <PixelFrame
          title="人物與候選人"
          action={
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {people.length} records · page {currentPage}/{pageCount}
            </span>
          }
        >
          <div className="mb-4 pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs text-slate-300">
            預設依現任優先、職位層級、姓氏筆劃排序。從首頁政黨小卡進入時，會自動帶入縣市、政黨與職位條件。
          </div>

          {people.length > 0 ? (
            <div className="overflow-hidden pixel-corners border border-line/70">
              <div className="grid grid-cols-[minmax(140px,1fr)_110px_130px_130px_90px] gap-3 border-b border-line/70 bg-panelAlt/55 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-500 max-lg:hidden">
                <span>name</span>
                <span>party</span>
                <span>role</span>
                <span>region</span>
                <span>status</span>
              </div>
              <div className="divide-y divide-line/60">
                {visiblePeople.map((person) => {
                  const theme = partyTheme[toPartyThemeKey(person.party)];
                  return (
                    <Link
                      key={person.person_id}
                      to={personPath(person.person_id)}
                      className="grid gap-3 px-3 py-3 transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35 lg:grid-cols-[minmax(140px,1fr)_110px_130px_130px_90px]"
                    >
                      <div>
                        <p className="font-display text-lg text-white">{person.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{person.position ?? '公開人物資料'}</p>
                      </div>
                      <div>
                        <span
                          className="pixel-corners inline-block border px-2 py-1 text-xs"
                          style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                        >
                          {normalizePartyLabel(person.party)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{person.role_label}</p>
                      <p className="text-sm text-slate-300">{person.region_name ?? person.district ?? '未指定'}</p>
                      <p className={person.status === 'current' ? 'text-sm text-signal' : 'text-sm text-slate-400'}>
                        {person.status_label}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center text-sm text-slate-300">
              沒有符合目前篩選條件的人物資料。
            </div>
          )}

          {people.length > PAGE_SIZE ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-line/60 pt-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <p>
                顯示 {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, people.length)} / {people.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updatePage(1)}
                  disabled={currentPage <= 1}
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  頭
                </button>
                <button
                  type="button"
                  onClick={() => updatePage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一頁
                </button>
                <button
                  type="button"
                  onClick={() => updatePage(pageCount)}
                  disabled={currentPage >= pageCount}
                  className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  底
                </button>
              </div>
            </div>
          ) : null}
        </PixelFrame>
      </div>
    </AppShell>
  );
}
