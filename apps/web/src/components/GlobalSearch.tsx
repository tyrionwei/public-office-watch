import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicDataProvider } from '../lib/publicData';
import type { PublicSearchResult } from '../lib/publicDataProvider';

const resultTypeOrder: PublicSearchResult['type'][] = ['party', 'election', 'region', 'person', 'company'];
const resultTypeLabels: Record<PublicSearchResult['type'], string> = {
  party: '政黨',
  election: '選舉',
  region: '地區',
  person: '人物',
  company: '公司',
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const results = useMemo(() => publicDataProvider.searchPublicRecords(query), [query]);
  const showPanel = isFocused && query.trim().length > 0;

  const groupedResults = useMemo(
    () =>
      resultTypeOrder
        .map((type) => ({
          type,
          results: results.filter((result) => result.type === type),
        }))
        .filter((group) => group.results.length > 0),
    [results],
  );

  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor="global-search" className="sr-only">
        搜尋人物、公司、政黨、選舉、地區
      </label>
      <div className="pixel-corners flex min-h-14 items-center gap-2 border border-line/80 bg-bg/55 px-3 shadow-[inset_0_0_18px_rgba(114,232,255,0.08)] focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20">
        <span className="font-display text-sm text-signal" aria-hidden="true">
          ⌕
        </span>
        <input
          id="global-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          placeholder="搜尋人物、公司、政黨、選舉、地區"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
      </div>

      {showPanel ? (
        <div className="pixel-corners absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 max-h-[420px] overflow-auto border border-accent/35 bg-[#071126]/98 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.42)]">
          {query.trim().length < 2 ? (
            <p className="px-2 py-3 text-xs text-slate-400">請輸入至少 2 個字元。</p>
          ) : groupedResults.length > 0 ? (
            <div className="space-y-3">
              {groupedResults.map((group) => (
                <section key={group.type}>
                  <p className="mb-1 px-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    {resultTypeLabels[group.type]}
                  </p>
                  <div className="grid gap-1">
                    {group.results.map((result) =>
                      result.href ? (
                        <Link
                          key={`${result.type}-${result.id}`}
                          to={result.href}
                          onClick={() => setQuery('')}
                          className="pixel-corners block border border-transparent px-3 py-2 transition hover:border-accent/45 hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/25"
                        >
                          <SearchResultContent result={result} />
                        </Link>
                      ) : (
                        <div
                          key={`${result.type}-${result.id}`}
                          className="pixel-corners border border-line/50 bg-bg/30 px-3 py-2"
                        >
                          <SearchResultContent result={result} note="詳情頁未啟用" />
                        </div>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="px-2 py-3 text-xs text-slate-400">找不到符合的公開資料。</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchResultContent({ result, note }: { result: PublicSearchResult; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-display text-sm text-white">{result.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{result.subtitle}</p>
      </div>
      <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-accent">{note ?? result.label}</span>
    </div>
  );
}
