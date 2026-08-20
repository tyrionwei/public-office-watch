import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { PersonFeedbackReviewPanel } from '../components/PersonFeedbackReviewPanel';
import { SectionPanel } from '../components/SectionPanel';
import {
  fetchInternalIdentityReviewItems,
  fetchInternalReviewClaims,
  reviewInternalClaim,
  reviewInternalIdentityMatch,
  type IdentityReviewCandidate,
  type IdentityReviewItem,
  type PersonReviewContext,
  type ReviewClaim,
} from '../lib/internalReviewData';
import { personPath } from '../routes/routePaths';

const claimTypeLabels: Record<string, string> = {
  gender: '性別',
  birth_date: '生日',
  education: '學歷',
  experience: '經歷',
  family_relation: '家族關係',
  legal_case: '司法紀錄',
  external_id: '外部 ID',
  party_affiliation: '黨籍',
  platform: '政見',
};

const reviewStatusLabels: Record<string, string> = {
  pending: '待審核',
  needs_more_evidence: '需要更多證據',
  probable_match: '可能為同一人',
  needs_identity_review: '需要身分確認',
  needs_new_person_review: '可能需要建立人物',
};

const matchStatusLabels: Record<string, string> = {
  unreviewed_same_name: '同名，尚未判定',
  pending_review: '等待人工判定',
  probable_match: '可能為同一人',
  auto_matched: '系統已配對',
};

const electionResultLabels: Record<string, string> = {
  elected: '當選',
  not_elected: '未當選',
  pending: '尚未決定',
  unknown: '結果未知',
};

const identityMatchMethodLabels: Record<string, string> = {
  unique_page_profile_with_birth_date: '唯一來源人物頁，且有生日資料',
  unique_page_profile: '唯一來源人物頁',
  verified_external_id: '已驗證外部識別碼',
  exact_name_party_region: '姓名、政黨與地區相符',
};

const scoringReasonLabels: Record<string, string> = {
  'A-level source': 'A 級來源',
  'linked to canonical person': '已連結既有人物',
  'sensitive claim requires stronger evidence': '敏感資料，需要更強證據',
};

const reviewAuditReasonLabels: Record<string, string> = {
  hold_implausible_birth_year: '公報生日辨識結果不合理',
  hold_conflict: '與既有公開資料衝突',
  hold_text_quality: '公報文字辨識品質不足',
  manual_text_review: '公報文字需要人工核對',
  two_pass_ocr_disagreement: '兩次文字辨識結果不一致',
  second_ocr_missing: '第二次文字辨識沒有結果',
  identity_name_malformed: '人物姓名欄疑似錯配',
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function reviewAuditReasons(claimJson: Record<string, unknown> | undefined) {
  const audit = recordValue(claimJson?.reviewAudit);
  const reasonCodes = Array.isArray(audit?.reasonCodes) ? audit.reasonCodes : [];
  return reasonCodes
    .filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
    .map((reason) => reviewAuditReasonLabels[reason] ?? reason);
}

function includesQuery(values: unknown[], query: string) {
  return values.some((value) => value != null && String(value).toLowerCase().includes(query));
}

function personContextSearchValues(context: PersonReviewContext | null) {
  if (!context) return [];
  return [
    context.personId,
    context.name,
    context.alias,
    context.gender,
    context.birthDate,
    context.party,
    context.position,
    context.currentOfficeLabel,
    context.upcomingCandidateLabel,
    context.district,
    context.education,
    context.experience,
    ...context.elections.flatMap((election) => [
      election.electionYear,
      election.electionName,
      election.raceTitle,
      election.regionName,
      election.party,
      election.candidateNo,
      election.electionResult,
    ]),
  ];
}

function formatGender(value: string | null | undefined) {
  if (value === 'male') return '男性';
  if (value === 'female') return '女性';
  if (value === 'other') return '其他';
  return value || '未提供';
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW', { hour12: false });
}

function identityCandidateContext(candidate: IdentityReviewCandidate): PersonReviewContext {
  return candidate.context ?? {
    personId: candidate.personId,
    name: candidate.name,
    alias: null,
    gender: candidate.gender,
    birthDate: candidate.birthDate,
    party: candidate.party,
    position: candidate.position,
    district: candidate.district,
    education: null,
    experience: null,
    currentOfficeLabel: null,
    upcomingCandidateLabel: null,
    elections: [],
  };
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0 border-l border-line/70 pl-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-200">{value ?? '未提供'}</dd>
    </div>
  );
}

function PersonReviewSummary({
  context,
  fallbackName,
  heading = '既有人物資料',
}: {
  context: PersonReviewContext | null;
  fallbackName: string;
  heading?: string;
}) {
  const office = context?.currentOfficeLabel ?? context?.position;

  return (
    <section className="min-w-0 border-l-2 border-accent/60 pl-4">
      <p className="text-xs tracking-[0.14em] text-accent">{heading}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="font-display text-xl text-white">{context?.name ?? fallbackName}</h4>
        {context?.alias ? <span className="text-sm text-slate-400">別名：{context.alias}</span> : null}
      </div>
      {context ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-mono">人物 ID {context.personId}</span>
            <Link to={personPath(context.personId)} target="_blank" className="text-accent hover:text-white">
              開啟人物頁
            </Link>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailField label="性別" value={formatGender(context.gender)} />
            <DetailField label="生日" value={context.birthDate} />
            <DetailField label="政黨" value={context.party} />
            <DetailField label="目前職務" value={office} />
            <DetailField label="地區／選區" value={context.district} />
            <DetailField label="學歷" value={context.education} />
          </dl>
          {context.experience ? (
            <div className="mt-4 border-t border-line/50 pt-3">
              <p className="text-xs text-slate-500">經歷摘要</p>
              <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-line text-sm leading-6 text-slate-300">
                {context.experience}
              </p>
            </div>
          ) : null}
          <div className="mt-4 border-t border-line/50 pt-3">
            <p className="text-xs text-slate-500">最近參選紀錄</p>
            {context.elections.length > 0 ? (
              <div className="mt-2 divide-y divide-line/40">
                {context.elections.map((election) => (
                  <div key={election.candidateId} className="grid gap-1 py-2 text-sm sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center">
                    <span className="font-mono text-signal">{election.electionYear ?? '年份未明'}</span>
                    <span className="min-w-0 text-slate-200">{election.raceTitle || election.electionName}</span>
                    <span className="text-xs text-slate-400">
                      {[election.candidateNo ? `${election.candidateNo} 號` : null, electionResultLabels[election.electionResult] ?? election.electionResult]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">目前沒有可供比對的參選紀錄。</p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-rose-300">找不到這筆 claim 對應的既有人物資料，請先確認人物連結。</p>
      )}
    </section>
  );
}

function claimReviewMetadata(claim: ReviewClaim) {
  const identityMatch = recordValue(claim.claim_json?.identityMatch);
  const sourceName = textValue(claim.claim_json?.personName);
  const sourceBirthDate = textValue(identityMatch?.sourceBirthDate);
  const matchedBy = textValue(identityMatch?.matchedBy);
  const sameNameProfileCount = typeof identityMatch?.sameNameProfileCount === 'number'
    ? identityMatch.sameNameProfileCount
    : null;
  const legalRecords = Array.isArray(claim.claim_json?.legalRecords) ? claim.claim_json.legalRecords : [];
  const sectionTitles = legalRecords
    .map((record) => textValue(recordValue(record)?.sectionTitle))
    .filter((title): title is string => Boolean(title));

  return {
    sourceName,
    sourceBirthDate,
    matchedBy: matchedBy ? identityMatchMethodLabels[matchedBy] ?? matchedBy : null,
    sameNameProfileCount,
    sectionTitles,
  };
}

function isLocalReviewEnabled() {
  return import.meta.env.DEV;
}

function displayClaimType(value: string) {
  return claimTypeLabels[value] ?? value;
}

function isEditableProfileClaim(claimType: string) {
  return claimType === 'education' || claimType === 'experience';
}

function claimTypeTone(value: string) {
  if (value === 'family_relation' || value === 'legal_case') return 'border-rose-400/50 bg-rose-500/10 text-rose-300';
  if (value === 'gender' || value === 'external_id') return 'border-signal/50 bg-signal/10 text-signal';
  return 'border-accent/50 bg-accent/10 text-accent';
}

export function InternalReviewQueuePage() {
  const [claims, setClaims] = useState<ReviewClaim[]>([]);
  const [identityItems, setIdentityItems] = useState<IdentityReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [claimType, setClaimType] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'pending' | 'needs_more_evidence' | ''>('pending');
  const [query, setQuery] = useState('');
  const [actionClaimId, setActionClaimId] = useState<string | null>(null);
  const [actionIdentityKey, setActionIdentityKey] = useState<string | null>(null);
  const [claimValueDrafts, setClaimValueDrafts] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocalReviewEnabled()) return;

    let cancelled = false;
    setLoading(true);
    const timeoutId = window.setTimeout(() => {
      void fetchInternalReviewClaims({ sourceName, claimType, reviewStatus, personName: query.trim() }).then((result) => {
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
          setClaims([]);
        } else {
          setError(null);
          setClaims(result.claims);
        }
        setLoading(false);
      });
    }, query.trim() ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [claimType, query, reviewStatus, sourceName]);

  useEffect(() => {
    if (!isLocalReviewEnabled()) return;

    setIdentityLoading(true);
    void fetchInternalIdentityReviewItems().then((result) => {
      if (result.error) {
        setIdentityError(result.error);
        setIdentityItems([]);
      } else {
        setIdentityError(null);
        setIdentityItems(result.items);
      }
      setIdentityLoading(false);
    });
  }, []);

  const filteredClaims = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return claims;

    return claims.filter((claim) =>
      includesQuery(
        [
          claim.claim_id,
          claim.person_id,
          claim.person_name,
          claim.raw_name,
          claim.claim_type,
          claim.claim_value,
          claim.source_name,
          ...claim.scoring_reasons,
          ...personContextSearchValues(claim.person_context),
        ],
        normalizedQuery,
      ),
    );
  }, [claims, query]);

  const filteredIdentityItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return identityItems;

    return identityItems.filter((item) =>
      includesQuery(
        [
          item.source_person_id,
          item.source_person_key,
          item.raw_name,
          item.gender,
          item.birth_date_text,
          item.party,
          item.position,
          item.district,
          item.election_year,
          item.source_name,
          item.review_status,
        ],
        normalizedQuery,
      ) ||
      item.candidates.some((candidate) =>
        includesQuery(
          [
            candidate.personId,
            candidate.name,
            candidate.party,
            candidate.position,
            candidate.district,
            candidate.gender,
            candidate.birthDate,
            candidate.reason,
            ...personContextSearchValues(candidate.context),
          ],
          normalizedQuery,
        ),
      ),
    );
  }, [identityItems, query]);

  const countsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const claim of claims) {
      counts.set(claim.claim_type, (counts.get(claim.claim_type) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [claims]);

  const identityItemsBySourcePersonId = useMemo(
    () => new Map(
      identityItems.map((item) => [item.source_person_id, item]),
    ),
    [identityItems],
  );

  if (!isLocalReviewEnabled()) {
    return (
      <AppShell>
        <PixelFrame title="找不到頁面">
          <p className="text-sm text-slate-300">此頁僅在本機開發環境顯示。</p>
        </PixelFrame>
      </AppShell>
    );
  }

  async function handleIdentityReviewAction(
    item: IdentityReviewItem,
    candidatePersonId: string | null,
    action: 'approve' | 'reject' | 'create',
  ) {
    const actionKey = item.source_person_id + ':' + (candidatePersonId ?? action);
    setActionIdentityKey(actionKey);
    setActionMessage(null);

    const result = await reviewInternalIdentityMatch(item.source_person_id, candidatePersonId, action);
    if (result.error) {
      setActionMessage(result.error);
      setActionIdentityKey(null);
      return;
    }

    if (action !== 'reject') {
      const refreshedClaims = await fetchInternalReviewClaims({ sourceName, claimType, reviewStatus, personName: query.trim() });
      if (refreshedClaims.error) {
        setError(refreshedClaims.error);
      } else {
        setError(null);
        setClaims(refreshedClaims.claims);
      }

      setIdentityItems((current) => current.filter((entry) => entry.source_person_id !== item.source_person_id));
      setActionMessage(action === 'create' ? '已建立並確認新人物：' + item.raw_name : '已確認身分：' + item.raw_name);
    } else {
      const refreshed = await fetchInternalIdentityReviewItems();
      if (refreshed.error) {
        setIdentityError('已記錄不是同一人，但重新載入失敗：' + refreshed.error);
      } else {
        setIdentityError(null);
        setIdentityItems(refreshed.items);
        const remainingItem = refreshed.items.find((entry) => entry.source_person_id === item.source_person_id);
        setActionMessage(
          remainingItem
            ? `已排除 ${item.raw_name} 的這組配對，尚有 ${remainingItem.candidate_count} 位候選人物待審核。`
            : `已排除 ${item.raw_name} 的最後一組候選配對。`,
        );
      }
    }
    setActionIdentityKey(null);
  }

  async function handleReviewAction(claim: ReviewClaim, action: 'approve' | 'reject') {
    setActionClaimId(claim.claim_id);
    setActionMessage(null);

    const editableProfileClaim = isEditableProfileClaim(claim.claim_type);
    const editedValue = claimValueDrafts[claim.claim_id] ?? claim.claim_value ?? '';
    const result = await reviewInternalClaim(
      claim.claim_id,
      action,
      action === 'approve' && editableProfileClaim ? { claimValue: editedValue } : {},
    );
    if (result.error) {
      setActionMessage(result.error);
      setActionClaimId(null);
      return;
    }

    const reviewedClaimIds = new Set([claim.claim_id, ...result.relatedClaimIds]);
    setClaims((current) => current.filter((item) => !reviewedClaimIds.has(item.claim_id)));
    setClaimValueDrafts((current) => {
      const next = { ...current };
      delete next[claim.claim_id];
      return next;
    });
    const approveCascadeText = result.relatedUpdated > 0 ? `，同步通過 ${result.relatedUpdated} 筆低敏感欄位` : '';
    const rejectCascadeText = result.relatedUpdated > 0 ? `，同步標記 ${result.relatedUpdated} 筆同 QID 資料` : '';
    const editText = result.claimValueChanged ? '，已套用文字修正' : '';
    const personFieldText = result.personFieldUpdated
      ? '，已更新人物主欄位'
      : result.personFieldPreserved
        ? '，人物主欄位保留較新的既有資料'
        : '';
    setActionMessage(
      action === 'approve'
        ? `已通過：${claim.person_name ?? claim.claim_value}${editText}${personFieldText}${approveCascadeText}`
        : `已標記錯誤：${claim.person_name ?? claim.claim_value}${rejectCascadeText}`,
    );
    setActionClaimId(null);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame title="資料審核工作台">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs tracking-[0.18em] text-accent">內部工具 · 僅限本機</p>
              <h2 className="mt-2 font-display text-3xl text-white">補充資料與身分審核</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                先確認資料指向正確人物，再判斷內容與來源是否足以公開。敏感內容通過後會出現在人物頁。
              </p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[720px] xl:grid-cols-4">
              <label className="grid gap-1 text-xs text-slate-500">
                資料來源
                <select
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  className="pixel-corners h-10 border border-line/70 bg-bg/90 px-3 text-sm text-white"
                >
                  <option value="">全部來源</option>
                  <option value="Wikidata 人物補充資料">Wikidata</option>
                  <option value="VoteTW">VoteTW</option>
                  <option value="中央選舉委員會：2022年縣市議員選舉公報 OCR">中選會 2022 縣市議員公報</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                審核狀態
                <select
                  value={reviewStatus}
                  onChange={(event) => setReviewStatus(event.target.value as 'pending' | 'needs_more_evidence' | '')}
                  className="pixel-corners h-10 border border-line/70 bg-bg/90 px-3 text-sm text-white"
                >
                  <option value="pending">待審核</option>
                  <option value="needs_more_evidence">需要更多證據</option>
                  <option value="">全部狀態</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                資料類型
                <select
                  value={claimType}
                  onChange={(event) => setClaimType(event.target.value)}
                  className="pixel-corners h-10 border border-line/70 bg-bg/90 px-3 text-sm text-white"
                >
                  <option value="">全部類型</option>
                  {Object.entries(claimTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-slate-500">
                搜尋
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="姓名、地區、來源或內容"
                  className="pixel-corners h-10 border border-line/70 bg-bg/90 px-3 text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
            </div>
          </div>
        </PixelFrame>

        <PersonFeedbackReviewPanel query={query} />

        <SectionPanel
          title="身分比對審核"
          eyebrow={identityLoading ? '載入中' : `${filteredIdentityItems.length} / ${identityItems.length} 筆`}
        >
          {identityError ? (
            <p className="pixel-corners border border-rose-400/50 bg-rose-500/10 p-4 text-sm text-rose-300">{identityError}</p>
          ) : null}
          {!identityError && identityLoading ? <p className="text-sm text-slate-400">載入中...</p> : null}
          {!identityError && !identityLoading && filteredIdentityItems.length === 0 ? (
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">目前沒有符合條件的身分比對資料。</p>
          ) : null}
          <div className="grid gap-4">
            {filteredIdentityItems.map((item) => (
              <article key={item.source_person_id} className="pixel-corners border border-line/70 bg-bg/35 p-4 sm:p-5">
                <header className="flex flex-col gap-3 border-b border-line/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="pixel-corners border border-accent/50 bg-accent/10 px-2 py-1 text-xs text-accent">
                      {reviewStatusLabels[item.review_status] ?? item.review_status}
                    </span>
                    <span className="text-xs text-slate-400">最高比對分數 {item.best_match_score}</span>
                    <span className="text-xs text-slate-400">建議信心等級 {item.confidence_suggestion}</span>
                    <span className="text-xs text-slate-500">{item.candidate_count} 位同名候選人物</span>
                  </div>
                  <span className="font-mono text-xs text-slate-600">來源資料 ID {item.source_person_id}</span>
                </header>

                <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
                  <section className="min-w-0 border-l-2 border-signal/60 pl-4">
                    <p className="text-xs tracking-[0.14em] text-signal">待配對的來源人物</p>
                    <h3 className="mt-2 font-display text-2xl text-white">{item.raw_name}</h3>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                      <DetailField label="性別" value={formatGender(item.gender)} />
                      <DetailField label="生日" value={item.birth_date_text} />
                      <DetailField label="政黨" value={item.party} />
                      <DetailField label="職務／參選項目" value={item.position} />
                      <DetailField label="地區／選區" value={item.district} />
                      <DetailField label="選舉年份" value={item.election_year} />
                    </dl>
                    <div className="mt-4 border-t border-line/50 pt-3 text-sm">
                      <p className="text-slate-400">來源：{item.source_name}</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-600">來源鍵值：{item.source_person_key}</p>
                      {item.source_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-accent hover:text-white">
                          開啟原始資料
                        </a>
                      ) : null}
                    </div>
                  </section>

                  <section className="min-w-0 xl:border-l xl:border-line/60 xl:pl-6">
                    <p className="text-xs tracking-[0.14em] text-slate-500">既有人物候選</p>
                    {item.candidates.length === 0 ? (
                      <div className="mt-3 flex flex-col gap-3 border-l-2 border-accent/50 pl-4 lg:flex-row lg:items-center lg:justify-between">
                        <p className="text-sm leading-6 text-slate-300">找不到可配對的既有人物。確認來源中的姓名、生日、地區與公職後，再建立新人物。</p>
                        <button
                          type="button"
                          disabled={actionIdentityKey === item.source_person_id + ':create'}
                          onClick={() => void handleIdentityReviewAction(item, null, 'create')}
                          className="pixel-corners shrink-0 border border-accent/70 bg-accent/10 px-3 py-2 text-sm text-accent hover:bg-accent/20 disabled:cursor-wait disabled:opacity-60"
                        >
                          建立新人物並確認
                        </button>
                      </div>
                    ) : null}
                    <div className="divide-y divide-line/60">
                      {item.candidates.map((candidate) => {
                        const actionKey = item.source_person_id + ':' + candidate.personId;
                        const context = identityCandidateContext(candidate);
                        return (
                          <div key={candidate.personId} className="py-5 first:pt-3 last:pb-0">
                            <div className="flex flex-col gap-4 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_auto]">
                              <div className="min-w-0">
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-signal">比對分數 {candidate.score}</span>
                                  <span className="text-slate-400">{matchStatusLabels[candidate.matchStatus] ?? candidate.matchStatus}</span>
                                  {candidate.reason ? <span className="text-slate-500">理由：{candidate.reason}</span> : null}
                                </div>
                                <PersonReviewSummary context={context} fallbackName={candidate.name} heading="候選人物" />
                                {candidate.evidence && Object.keys(candidate.evidence).length > 0 ? (
                                  <details className="mt-3 border-t border-line/40 pt-3 text-xs text-slate-400">
                                    <summary className="cursor-pointer text-accent">查看比對證據</summary>
                                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono leading-5 text-slate-500">
                                      {JSON.stringify(candidate.evidence, null, 2)}
                                    </pre>
                                  </details>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2 2xl:flex-col">
                                <button
                                  type="button"
                                  disabled={actionIdentityKey === actionKey}
                                  onClick={() => void handleIdentityReviewAction(item, candidate.personId, 'approve')}
                                  className="pixel-corners border border-signal/70 bg-signal/15 px-3 py-2 text-sm text-signal hover:bg-signal/25 disabled:cursor-wait disabled:opacity-60"
                                >
                                  確認同一人
                                </button>
                                <button
                                  type="button"
                                  disabled={actionIdentityKey === actionKey}
                                  onClick={() => void handleIdentityReviewAction(item, candidate.personId, 'reject')}
                                  className="pixel-corners border border-rose-400/70 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
                                >
                                  不是同一人
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel
          title="資料內容審核"
          eyebrow={loading ? '載入中' : `${filteredClaims.length} / ${claims.length} 筆`}
        >
          {countsByType.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2 border-b border-line/50 pb-4">
              {countsByType.map(([type, count]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setClaimType(type === claimType ? '' : type)}
                  className={`pixel-corners border px-3 py-2 text-sm ${
                    type === claimType
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line/70 bg-bg/35 text-slate-300 hover:border-accent/60'
                  }`}
                >
                  {displayClaimType(type)} <span className="ml-2 text-signal">{count}</span>
                </button>
              ))}
            </div>
          ) : null}
          {error ? (
            <p className="pixel-corners border border-rose-400/50 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>
          ) : null}
          {actionMessage ? (
            <p className="pixel-corners mb-4 border border-accent/50 bg-accent/10 p-4 text-sm text-accent">{actionMessage}</p>
          ) : null}
          {!error && loading ? <p className="text-sm text-slate-400">載入中...</p> : null}
          {!error && !loading && filteredClaims.length === 0 ? (
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">目前沒有符合條件的待審核資料。</p>
          ) : null}
          <div className="grid gap-4">
            {filteredClaims.map((claim) => {
              const metadata = claimReviewMetadata(claim);
              const auditReasons = reviewAuditReasons(claim.claim_json);
              const identityReviewItem = claim.source_person_id
                ? identityItemsBySourcePersonId.get(claim.source_person_id)
                : null;
              const matchedElection = claim.person_context?.elections.find(
                (election) => election.candidateId === claim.candidate_id,
              );
              const matchedElectionLabel = matchedElection
                ? `${matchedElection.electionYear ?? '年份未明'} · ${matchedElection.raceTitle || matchedElection.electionName} · ${electionResultLabels[matchedElection.electionResult] ?? matchedElection.electionResult}`
                : null;
              const editableProfileClaim = isEditableProfileClaim(claim.claim_type);
              const editedClaimValue = claimValueDrafts[claim.claim_id] ?? claim.claim_value ?? '';
              return (
                <article key={claim.claim_id} className="pixel-corners border border-line/70 bg-bg/35 p-4 sm:p-5">
                  <header className="flex flex-col gap-3 border-b border-line/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`pixel-corners border px-2 py-1 text-xs ${claimTypeTone(claim.claim_type)}`}>
                        {displayClaimType(claim.claim_type)}
                      </span>
                      <span className="text-xs text-slate-300">{reviewStatusLabels[claim.review_status] ?? claim.review_status}</span>
                      <span className="text-xs text-slate-500">審核分數 {claim.review_score}</span>
                      <span className="text-xs text-slate-500">信心等級 {claim.confidence_level}</span>
                    </div>
                    <span className="font-mono text-xs text-slate-600">資料 ID {claim.claim_id}</span>
                  </header>

                  <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.5fr)]">
                    <PersonReviewSummary
                      context={claim.person_context}
                      fallbackName={claim.person_name ?? claim.raw_name ?? '未知人物'}
                    />

                    <section className="min-w-0 xl:border-l xl:border-line/60 xl:pl-6">
                      <p className="text-xs tracking-[0.14em] text-rose-300">待審內容</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{displayClaimType(claim.claim_type)}</h3>
                      {editableProfileClaim ? (
                        <label className="mt-3 block border-l-2 border-rose-400/60 pl-4">
                          <span className="text-xs text-slate-400">可修正格式或錯字，通過時會保存此版本</span>
                          <textarea
                            value={editedClaimValue}
                            onChange={(event) => setClaimValueDrafts((current) => ({
                              ...current,
                              [claim.claim_id]: event.target.value,
                            }))}
                            maxLength={20_000}
                            rows={claim.claim_type === 'experience' ? 8 : 5}
                            className="mt-2 w-full resize-y border border-line/80 bg-bg/80 px-3 py-2 text-base leading-7 text-slate-100 outline-none focus:border-accent"
                          />
                        </label>
                      ) : (
                        <p className="mt-3 whitespace-pre-line break-words border-l-2 border-rose-400/60 pl-4 text-base leading-7 text-slate-200">
                          {claim.claim_value ?? '未提供內容'}
                        </p>
                      )}
                      {auditReasons.length > 0 ? (
                        <div className="mt-4 border-l-2 border-amber-400/70 pl-4 text-sm leading-6 text-amber-200">
                          <p>保留待審原因</p>
                          <ul className="mt-1 list-disc pl-5">
                            {auditReasons.map((reason) => <li key={reason}>{reason}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      {!claim.person_id ? (
                        <p className="mt-4 border-l-2 border-amber-400/70 pl-4 text-sm leading-6 text-amber-200">
                          尚未完成人物身分比對，不能公開。
                          {identityReviewItem ? ` 上方身分比對審核有 ${identityReviewItem.candidate_count} 位同名候選人物。` : ' 請先建立或確認人物連結。'}
                        </p>
                      ) : null}
                      {claim.claim_type === 'platform' && !claim.candidate_id ? (
                        <p className="mt-4 border-l-2 border-amber-400/70 pl-4 text-sm leading-6 text-amber-200">
                          尚未對應到確切參選紀錄，需先完成選舉配對才能公開。
                        </p>
                      ) : null}

                      <dl className="mt-5 grid gap-3 border-t border-line/50 pt-4 sm:grid-cols-2 2xl:grid-cols-3">
                        <DetailField label="來源頁人物" value={metadata.sourceName} />
                        <DetailField label="來源生日" value={metadata.sourceBirthDate} />
                        <DetailField label="配對方式" value={metadata.matchedBy} />
                        <DetailField label="同名來源資料數" value={metadata.sameNameProfileCount} />
                        <DetailField label="來源段落" value={metadata.sectionTitles.join('、') || null} />
                        <DetailField label="資料來源" value={claim.source_name} />
                        {claim.claim_type === 'platform' ? <DetailField label="對應參選紀錄" value={matchedElectionLabel} /> : null}
                      </dl>

                      {claim.scoring_reasons.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {claim.scoring_reasons.map((reason) => (
                            <span key={reason} className="border-l border-line/70 pl-2 text-xs text-slate-400">
                              {scoringReasonLabels[reason] ?? reason}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <footer className="mt-5 flex flex-col gap-4 border-t border-line/60 pt-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="text-xs text-slate-500">
                          <p>更新時間：{formatDateTime(claim.updated_at)}</p>
                          {claim.source_url ? (
                            <a href={claim.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-accent hover:text-white">
                              開啟原始資料
                            </a>
                          ) : <p className="mt-2 text-rose-300">未提供原始資料連結</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              actionClaimId === claim.claim_id
                              || !claim.person_id
                              || (claim.claim_type === 'platform' && !claim.candidate_id)
                              || (editableProfileClaim && !editedClaimValue.trim())
                            }
                            onClick={() => void handleReviewAction(claim, 'approve')}
                            className="pixel-corners border border-signal/70 bg-signal/15 px-4 py-2 text-sm text-signal hover:bg-signal/25 disabled:cursor-wait disabled:opacity-60"
                          >
                            {!claim.person_id
                              ? '先完成人物比對'
                              : claim.claim_type === 'platform'
                                ? '確認人物與選舉後公開'
                                : editableProfileClaim
                                  ? '儲存修正並公開'
                                  : '通過並公開'}
                          </button>
                          <button
                            type="button"
                            disabled={actionClaimId === claim.claim_id}
                            onClick={() => void handleReviewAction(claim, 'reject')}
                            className="pixel-corners border border-rose-400/70 bg-rose-500/10 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
                          >
                            標記錯誤
                          </button>
                        </div>
                      </footer>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
