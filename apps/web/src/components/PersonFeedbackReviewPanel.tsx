import { useEffect, useMemo, useState } from 'react';
import { SectionPanel } from './SectionPanel';
import {
  fetchInternalPersonFeedbackItems,
  reviewInternalPersonFeedback,
  type PersonFeedbackReviewAction,
  type PersonFeedbackReviewItem,
} from '../lib/internalReviewData';

const pageSize = 12;

const kindLabels: Record<PersonFeedbackReviewItem['feedback_kind'], string> = {
  supplement_request: '希望補充',
  problem_report: '問題回報',
};

const sectionLabels: Record<string, string> = {
  basic: '基本資料',
  candidacies: '參選紀錄',
  timeline: '人物時間軸',
  affiliations: '黨籍紀錄',
  resume: '學歷與經歷',
  platform: '政見',
  finance: '政治獻金',
  legal: '司法／爭議紀錄',
  family: '政治家族關係',
  sources: '資料來源',
};

const problemLabels: Record<string, string> = {
  inaccurate: '內容不正確',
  outdated: '資料已過時',
  broken_source: '來源連結失效',
  misleading: '呈現可能誤導',
  other: '其他問題',
};

const statusLabels: Record<string, string> = {
  received: '待處理',
  reviewing: '審核中',
  verified: '已確認',
  rejected: '已駁回',
  published: '已發布',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusTone(status: string) {
  if (status === 'verified' || status === 'published') return 'border-signal/60 bg-signal/10 text-signal';
  if (status === 'rejected') return 'border-rose-400/60 bg-rose-500/10 text-rose-300';
  if (status === 'reviewing') return 'border-accent/60 bg-accent/10 text-accent';
  return 'border-line/70 bg-bg/50 text-slate-300';
}

export function PersonFeedbackReviewPanel({ query }: { query: string }) {
  const [items, setItems] = useState<PersonFeedbackReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('received');
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchInternalPersonFeedbackItems().then((result) => {
      setItems(result.items);
      setError(result.error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [kindFilter, query, statusFilter]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (kindFilter && item.feedback_kind !== kindFilter) return false;
      if (statusFilter && item.review_status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      return [
        item.person?.name,
        item.person?.party,
        item.person?.position,
        item.person?.district,
        sectionLabels[item.section_key],
        item.problem_type ? problemLabels[item.problem_type] : null,
        item.message,
        item.evidence_url,
        item.review_note,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [items, kindFilter, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleAction(item: PersonFeedbackReviewItem, action: PersonFeedbackReviewAction) {
    const note = notes[item.id]?.trim() ?? '';
    if (action === 'reject' && note.length < 5) {
      setActionMessage('駁回前請填寫至少 5 個字的審核備註。');
      return;
    }

    setActionId(item.id);
    setActionMessage(null);
    const result = await reviewInternalPersonFeedback(item.id, action, note);
    if (result.error || !result.reviewStatus) {
      setActionMessage(result.error ?? '無法更新審核狀態。');
      setActionId(null);
      return;
    }

    const now = new Date().toISOString();
    setItems((current) => current.map((entry) => entry.id === item.id
      ? {
          ...entry,
          review_status: result.reviewStatus as PersonFeedbackReviewItem['review_status'],
          review_note: note || null,
          reviewed_by: 'local_internal_review',
          reviewed_at: action === 'start' ? null : now,
          updated_at: now,
        }
      : entry));
    setActionMessage(
      action === 'start'
        ? `已開始審核：${item.person?.name ?? '未知人物'}`
        : action === 'verify'
          ? `已確認：${item.person?.name ?? '未知人物'}`
          : `已駁回：${item.person?.name ?? '未知人物'}`,
    );
    setActionId(null);
  }

  return (
    <SectionPanel
      title="使用者補充與問題回報"
      eyebrow={loading ? 'loading' : `${filteredItems.length} / ${items.length} records`}
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-slate-400">
          補充需求只影響資料分類優先度；問題回報必須人工查證，確認後也不會自動公開回報文字。
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-slate-500">
            回報種類
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value)}
              className="border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white"
            >
              <option value="">全部種類</option>
              <option value="supplement_request">希望補充</option>
              <option value="problem_report">問題回報</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-500">
            審核狀態
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white"
            >
              <option value="">全部狀態</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <p className="border border-rose-400/50 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p> : null}
      {actionMessage ? <p className="mb-3 border border-accent/50 bg-accent/10 p-3 text-sm text-accent">{actionMessage}</p> : null}
      {!error && loading ? <p className="text-sm text-slate-400">載入回報中...</p> : null}
      {!error && !loading && visibleItems.length === 0 ? (
        <p className="border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">沒有符合條件的回報。</p>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {visibleItems.map((item) => {
          const isTerminal = ['verified', 'rejected', 'published'].includes(item.review_status);
          return (
            <article key={item.id} className="border border-line/70 bg-bg/35 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="border border-accent/50 bg-accent/10 px-2 py-1 text-accent">
                      {kindLabels[item.feedback_kind]}
                    </span>
                    <span className="border border-line/70 px-2 py-1 text-slate-300">
                      {sectionLabels[item.section_key] ?? item.section_key}
                    </span>
                    <span className={`border px-2 py-1 ${statusTone(item.review_status)}`}>
                      {statusLabels[item.review_status] ?? item.review_status}
                    </span>
                  </div>
                  <a
                    href={`/people/${item.person_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block font-display text-lg text-white hover:text-accent"
                  >
                    {item.person?.name ?? '未知人物'}
                  </a>
                  <p className="mt-1 text-sm text-slate-500">
                    {[item.person?.party, item.person?.position, item.person?.district].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>提交 {item.submission_count} 次</p>
                  <p className="mt-1">{formatDate(item.updated_at)}</p>
                </div>
              </div>

              {item.problem_type ? (
                <p className="mt-4 text-sm font-semibold text-signal">
                  {problemLabels[item.problem_type] ?? item.problem_type}
                </p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {item.message ?? '希望優先補充這個資料分類。'}
              </p>
              {item.evidence_url ? (
                <a href={item.evidence_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent hover:text-white">
                  查看佐證來源
                </a>
              ) : null}

              <label className="mt-4 grid gap-2 text-xs text-slate-500">
                審核備註
                <textarea
                  value={notes[item.id] ?? item.review_note ?? ''}
                  maxLength={1000}
                  disabled={isTerminal}
                  onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                  rows={3}
                  placeholder="記錄查證結果；駁回時至少填寫 5 個字。"
                  className="resize-y border border-line/70 bg-bg/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent disabled:opacity-60"
                />
              </label>

              {!isTerminal ? (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {item.review_status === 'received' ? (
                    <button
                      type="button"
                      disabled={actionId === item.id}
                      onClick={() => void handleAction(item, 'start')}
                      className="border border-accent/60 bg-accent/10 px-3 py-2 text-sm text-accent disabled:opacity-50"
                    >
                      開始審核
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={actionId === item.id}
                    onClick={() => void handleAction(item, 'verify')}
                    className="border border-signal/70 bg-signal/10 px-3 py-2 text-sm text-signal disabled:opacity-50"
                  >
                    {item.feedback_kind === 'supplement_request' ? '納入補充優先' : '確認問題'}
                  </button>
                  <button
                    type="button"
                    disabled={actionId === item.id}
                    onClick={() => void handleAction(item, 'reject')}
                    className="border border-rose-400/70 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 disabled:opacity-50"
                  >
                    駁回
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-4 text-sm">
          <span className="text-slate-500">第 {currentPage}/{pageCount} 頁</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="border border-line/70 px-3 py-2 text-slate-300 disabled:opacity-40"
            >
              上一頁
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              className="border border-line/70 px-3 py-2 text-slate-300 disabled:opacity-40"
            >
              下一頁
            </button>
          </div>
        </div>
      ) : null}
    </SectionPanel>
  );
}
