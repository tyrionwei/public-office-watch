import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { fetchInternalReviewClaims, type ReviewClaim } from '../lib/internalReviewData';

const claimTypeLabels: Record<string, string> = {
  gender: '性別',
  birth_date: '生日',
  education: '學歷',
  experience: '經歷',
  family_relation: '家族關係',
  legal_case: '司法紀錄',
  external_id: '外部 ID',
};

const autoReviewPolicy = [
  ['可批次處理', '性別、外部 ID 等低風險欄位，可在來源穩定且抽查通過後批次 verified。'],
  ['需抽查', '生日、學歷、經歷可先用 Wikidata 當線索，但需和官方或本人來源交叉檢查。'],
  ['保留人工', '家族關係、政二代、司法紀錄不自動公開，只能人工確認後轉為 public claim。'],
];

function isLocalReviewEnabled() {
  return import.meta.env.DEV;
}

function displayClaimType(value: string) {
  return claimTypeLabels[value] ?? value;
}

function claimTypeTone(value: string) {
  if (value === 'family_relation' || value === 'legal_case') return 'border-rose-400/50 bg-rose-500/10 text-rose-300';
  if (value === 'gender' || value === 'external_id') return 'border-signal/50 bg-signal/10 text-signal';
  return 'border-accent/50 bg-accent/10 text-accent';
}

export function InternalReviewQueuePage() {
  const [claims, setClaims] = useState<ReviewClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimType, setClaimType] = useState('');
  const [sourceName, setSourceName] = useState('Wikidata 人物補充資料');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isLocalReviewEnabled()) return;

    setLoading(true);
    void fetchInternalReviewClaims({ sourceName, claimType }).then((result) => {
      if (result.error) {
        setError(result.error);
        setClaims([]);
      } else {
        setError(null);
        setClaims(result.claims);
      }
      setLoading(false);
    });
  }, [claimType, sourceName]);

  const filteredClaims = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return claims;

    return claims.filter((claim) =>
      [claim.raw_name, claim.claim_type, claim.claim_value, claim.source_name].some((value) =>
        value?.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [claims, query]);

  const countsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const claim of claims) {
      counts.set(claim.claim_type, (counts.get(claim.claim_type) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [claims]);

  if (!isLocalReviewEnabled()) {
    return (
      <AppShell>
        <PixelFrame title="Not Found">
          <p className="text-sm text-slate-300">此頁僅在 local development 顯示。</p>
        </PixelFrame>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame title="Internal Review Queue">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-accent">local only / review-only data</p>
              <h2 className="mt-2 font-display text-3xl text-white">補充資料審核</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                這頁只在 local development 顯示，用來檢查 Wikidata、司法線索或其他低可信補充資料。production 不顯示。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                className="pixel-corners border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white"
              >
                <option value="">全部來源</option>
                <option value="Wikidata 人物補充資料">Wikidata</option>
              </select>
              <select
                value={claimType}
                onChange={(event) => setClaimType(event.target.value)}
                className="pixel-corners border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white"
              >
                <option value="">全部類型</option>
                {Object.entries(claimTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋內容"
                className="pixel-corners border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600"
              />
            </div>
          </div>
        </PixelFrame>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SectionPanel
            title="待審核 claims"
            eyebrow={loading ? 'loading' : `${filteredClaims.length} / ${claims.length} records`}
          >
            {error ? (
              <p className="pixel-corners border border-rose-400/50 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>
            ) : null}
            {!error && loading ? <p className="text-sm text-slate-400">載入中...</p> : null}
            {!error && !loading && filteredClaims.length === 0 ? (
              <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">沒有符合條件的待審核資料。</p>
            ) : null}
            <div className="grid gap-3">
              {filteredClaims.map((claim) => (
                <article key={claim.claim_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`pixel-corners border px-2 py-1 text-xs ${claimTypeTone(claim.claim_type)}`}>
                          {displayClaimType(claim.claim_type)}
                        </span>
                        <span className="text-xs text-slate-500">score {claim.review_score}</span>
                        <span className="text-xs text-slate-500">confidence {claim.confidence_level}</span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-white">{claim.claim_value ?? '未提供內容'}</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {[claim.raw_name ?? claim.person_id, claim.source_name].filter(Boolean).join(' · ') || '待補來源'}
                      </p>
                    </div>
                    {claim.source_url ? (
                      <a href={claim.source_url} target="_blank" rel="noreferrer" className="text-sm text-accent hover:text-white">
                        查看來源
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </SectionPanel>

          <aside className="space-y-4">
            <SectionPanel title="類型統計" eyebrow="claim types">
              <div className="space-y-2">
                {countsByType.map(([type, count]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setClaimType(type === claimType ? '' : type)}
                    className="pixel-corners flex w-full items-center justify-between border border-line/70 bg-bg/35 px-3 py-2 text-left text-sm text-slate-300 hover:border-accent/60"
                  >
                    <span>{displayClaimType(type)}</span>
                    <span className="text-signal">{count}</span>
                  </button>
                ))}
              </div>
            </SectionPanel>

            <SectionPanel title="自動審核原則" eyebrow="policy">
              <div className="space-y-3">
                {autoReviewPolicy.map(([title, body]) => (
                  <div key={title} className="pixel-corners border border-line/70 bg-bg/35 p-3">
                    <h3 className="font-display text-base text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                  </div>
                ))}
              </div>
            </SectionPanel>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
