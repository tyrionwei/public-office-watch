import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { SupportMessagesAdmin } from '../components/SupportMessagesAdmin';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { AdminMagicLinkError, adminMagicLinkErrorMessage } from '../lib/adminMagicLink';
import { getFeedbackAdminClient, feedbackSessionKey, reconcileFeedbackDraft, feedbackConflictLabels, type FeedbackConflictField, bucketLabels, draftFrom, FeedbackApiError, feedbackBucket, feedbackBuckets, feedbackRequest, progressLabels, requestFeedbackLogin, type FeedbackBucket, type FeedbackDashboard, type FeedbackDetail, type FeedbackDraft, type FeedbackItem } from '../lib/feedbackAdmin';

const inputClass = 'w-full border border-line bg-bg p-2 text-sm text-white';
const buttonClass = 'border border-line px-3 py-2 text-sm text-slate-200 hover:border-accent disabled:opacity-40';
const sectionNames: Record<string, string> = { basic: '基本資料', candidacies: '參選紀錄', timeline: '時間軸', affiliations: '黨籍', resume: '學歷與經歷', platform: '政見', finance: '政治獻金', legal: '司法紀錄', family: '家族關係', sources: '資料來源' };
const problemNames: Record<string, string> = { inaccurate: '內容有誤', outdated: '資料過時', broken_source: '來源失效', misleading: '可能造成誤解', other: '其他問題' };
const eventNames: Record<string, string> = { baseline: '既有紀錄', submitted: '首次提交', resubmitted: '使用者新增內容', duplicate: '相同內容再次提交', managed: '編輯處理' };
function date(value: string | null) { return value ? new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '尚無紀錄'; }
function errorText(error: unknown) {
  if (error instanceof AdminMagicLinkError) return adminMagicLinkErrorMessage(error);
  if (error instanceof FeedbackApiError) return ({ FEEDBACK_CONFLICT: '這筆資料已有更新。你的草稿已保留，請先查看最新內容。', FEEDBACK_REASON_REQUIRED: '請在備註填寫改判、重新開啟或完成的原因（至少 2 字）。', FEEDBACK_INVALID: '欄位格式不正確，請檢查輸入。', FEEDBACK_FORBIDDEN: '這個帳號沒有管理員權限。', FEEDBACK_AUTH: '登入已失效，請重新登入。', FEEDBACK_UNAVAILABLE: '回饋管理尚未接入。' } as Record<string, string>)[error.code] ?? '讀取或儲存未完成，請重試。';
  return '讀取或儲存未完成，請重試。';
}
function FeedbackContent({ item }: { item: FeedbackItem }) {
  return <div className="space-y-2 text-sm">
    <p className="text-slate-400">{sectionNames[item.section_key] ?? item.section_key} · {item.feedback_kind === 'supplement_request' ? '希望補充' : '問題回報'}{item.problem_type ? ` · ${problemNames[item.problem_type] ?? item.problem_type}` : ''}</p>
    <p className="whitespace-pre-wrap break-words">{item.message || '希望補充這個資料區塊。'}</p>
    {item.evidence_url && /^https?:\/\//.test(item.evidence_url) ? <a className="block break-all text-accent underline" href={item.evidence_url} target="_blank" rel="noopener noreferrer">佐證來源：{item.evidence_url}</a> : null}
    <p className="text-xs text-slate-500">首次 {date(item.created_at)} · 最近提交 {date(item.updated_at)} · {item.submission_count} 次提交</p>
    {item.decision === 'pending' && item.previous_decision ? <p className="text-amber-300">曾{item.previous_decision === 'rejected' ? '駁回' : '採納'}，使用者新增內容，請重新判斷。</p> : null}
  </div>;
}
export function InternalFeedbackAdminPage() {
  const [access, setAccess] = useState<'loading' | 'signed-out' | 'ready' | 'forbidden'>('loading');
  const [dashboard, setDashboard] = useState<FeedbackDashboard | null>(null);
  const [query, setQuery] = useState(''); const [kind, setKind] = useState('');
  const [filter, setFilter] = useState({ query: '', kind: '' });
  const [pages, setPages] = useState<Record<string, number>>({});
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<FeedbackDetail | null>(null); const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [latest, setLatest] = useState<FeedbackDetail | null>(null); const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<FeedbackBucket | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const generation = useRef(0);
  const sessionGeneration = useRef(0);
  const sessionIdentity = useRef<string | null>(null);
  const [choices, setChoices] = useState<Partial<Record<FeedbackConflictField, 'mine' | 'latest'>>>({});
  const invalidateSession = useCallback((state: 'signed-out' | 'forbidden') => {
    sessionIdentity.current = null;
    sessionGeneration.current++; generation.current++;
    setDashboard(null); setDetail(null); setDraft(null); setLatest(null); setConflict(false);
    setChoices({}); setNotice(null); setError(''); setBusy(false); setLoading(false);
    request.current = null; setAccess(state);
  }, []);
  const supportUnauthorized = useCallback((status: number) => invalidateSession(status === 401 ? 'signed-out' : 'forbidden'), [invalidateSession]);
  useEffect(() => () => { sessionGeneration.current++; generation.current++; }, []);
  function handleRequestError(caught: unknown) {
    if (caught instanceof FeedbackApiError && [401, 403].includes(caught.status)) invalidateSession(caught.status === 401 ? 'signed-out' : 'forbidden');
    setError(errorText(caught));
  }
  const reconciliation = detail && draft && latest ? reconcileFeedbackDraft(draftFrom(detail.item), draft, draftFrom(latest.item), choices) : null;
  function conflictValue(value: FeedbackDraft, field: FeedbackConflictField) {
    return field === 'status' ? `${value.decision === 'accepted' ? '採納' : value.decision === 'rejected' ? '駁回' : '待處理'} · ${value.priority === 'high' ? '高優先' : '一般'} · ${progressLabels[value.workStatus]}` : value[field] || '無';
  }
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectedId = detail?.item.id;
  useEffect(() => {
    if (!selectedId) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, [selectedId]);
  const refresh = useCallback(async () => {
    const gen = ++generation.current; setLoading(true); setError('');
    try {
      const data = await feedbackRequest<FeedbackDashboard>('dashboard', { ...filter, pages });
      if (generation.current !== gen) return;
      setDashboard(data); setAccess('ready');
    } catch (caught) {
      if (generation.current !== gen) return;
      setError(errorText(caught)); setDashboard(null);
      if (caught instanceof FeedbackApiError && [401, 403].includes(caught.status)) invalidateSession(caught.status === 401 ? 'signed-out' : 'forbidden');
    } finally { if (generation.current === gen) setLoading(false); }
  }, [filter, pages, invalidateSession]);
  useEffect(() => {
    let active = true;
    const client = getFeedbackAdminClient();
    if (!client) { setAccess('signed-out'); setError('尚未設定回饋管理，或網站與資料庫環境不相符。'); return; }
    const sessionGen = sessionGeneration.current;
    void client.auth.getSession().then(({ data, error: authError }) => {
      if (!active || sessionGen !== sessionGeneration.current) return;
      const identity = authError ? null : feedbackSessionKey(data.session);
      if (!identity) invalidateSession('signed-out');
      else {
        if (sessionIdentity.current !== identity) { invalidateSession('signed-out'); sessionIdentity.current = identity; }
        void refresh();
      }
    }).catch(() => { if (active && sessionGen === sessionGeneration.current) { invalidateSession('signed-out'); setError('登入狀態讀取失敗。'); } });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') { invalidateSession('signed-out'); return; }
      if (['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) {
        const identity = feedbackSessionKey(session);
        if (!identity) { invalidateSession('signed-out'); return; }
        if (sessionIdentity.current !== identity) { invalidateSession('signed-out'); sessionIdentity.current = identity; }
        // Refocus and token renewal can confirm the same session. Recheck access
        // without discarding its draft; 401/403 still invalidate all pending work.
        const gen = sessionGeneration.current;
        queueMicrotask(() => { if (active && gen === sessionGeneration.current) void refresh(); });
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [refresh, invalidateSession]);
  async function open(item: FeedbackItem, historyPage = 1) {
    if (access !== 'ready') return;
    const gen = sessionGeneration.current;
    setBusy(true); setError(''); setNotice(null);
    try {
      const next = await feedbackRequest<FeedbackDetail>('detail', { id: item.id, historyPage });
      if (gen !== sessionGeneration.current) return;
      setDetail(next); setDraft(draftFrom(next.item)); setConflict(false); setLatest(null); setChoices({}); request.current = null;
    } catch (caught) { if (gen === sessionGeneration.current) handleRequestError(caught); }
    finally { if (gen === sessionGeneration.current) setBusy(false); }
  }
  async function loadLatest() {
    if (!detail || access !== 'ready') return;
    const gen = sessionGeneration.current;
    setBusy(true);
    try {
      const next = await feedbackRequest<FeedbackDetail>('detail', { id: detail.item.id });
      if (gen === sessionGeneration.current) { setLatest(next); setChoices({}); }
    } catch (caught) { if (gen === sessionGeneration.current) handleRequestError(caught); }
    finally { if (gen === sessionGeneration.current) setBusy(false); }
  }
  async function loadHistory(delta: number) {
    if (!detail || access !== 'ready') return;
    const gen = sessionGeneration.current;
    setBusy(true);
    try {
      const next = await feedbackRequest<FeedbackDetail>('detail', { id: detail.item.id, historyPage: detail.history_page + delta });
      if (gen === sessionGeneration.current) setDetail(previous => previous ? { ...previous, history: next.history, history_page: next.history_page, history_total: next.history_total } : null);
    } catch (caught) { if (gen === sessionGeneration.current) handleRequestError(caught); }
    finally { if (gen === sessionGeneration.current) setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (access !== 'ready' || !detail || !draft || conflict) return;
    const gen = sessionGeneration.current;
    setBusy(true); setError('');
    const payload = { id: detail.item.id, expectedRevision: detail.item.revision, ...draft };
    const key = JSON.stringify(payload);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try {
      const item = await feedbackRequest<FeedbackItem>('save', { ...payload, requestId: request.current.id });
      if (gen !== sessionGeneration.current) return;
      setDetail({ ...detail, item }); setDraft(draftFrom(item)); setNotice(feedbackBucket(item)); request.current = null;
      // Reset only the destination page so the moved item can be found without losing the other sections.
      setPages(previous => ({ ...previous, [feedbackBucket(item)]: 1 }));
      const next = await feedbackRequest<FeedbackDetail>('detail', { id: item.id });
      if (gen !== sessionGeneration.current) return;
      setDetail(next); setDraft(draftFrom(next.item));
    } catch (caught) {
      if (gen !== sessionGeneration.current) return;
      handleRequestError(caught);
      if (caught instanceof FeedbackApiError && caught.status === 409) {
        setConflict(true); setChoices({}); await loadLatest();
      }
    } finally { if (gen === sessionGeneration.current) setBusy(false); }
  }
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSent(false);
    try { await requestFeedbackLogin(email); setSent(true); } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); }
  }
  return <AppShell><div className="space-y-5">
    <PixelFrame title="Feedback Administration">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-white">使用者回饋管理</h1><p className="mt-1 text-xs text-accent">{['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ? '本機回饋 · 測試環境' : '本站回饋'}</p><p className="mt-2 text-sm text-slate-400">採納、優先程度與實際工作進度分開記錄。處理過的回饋仍可查看及修改。</p></div>
        {access === 'ready' || access === 'forbidden' ? <button className={buttonClass} onClick={async () => { setBusy(true); try { const result = await getFeedbackAdminClient()?.auth.signOut(); if (result?.error) throw result.error; invalidateSession('signed-out'); } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); } }} disabled={busy}>登出</button> : null}</div>
      <p className="mt-3 text-xs text-slate-500">採納代表值得處理或查證；高優先不會自動加入搜尋排程。人物資料修正仍循發布流程。</p>
    </PixelFrame>
    {error ? <div role="alert" className="border border-amber-500/50 p-3 text-sm text-amber-200">{error}</div> : null}
    {notice ? <p role="status" className="text-sm text-accent">已儲存，位於{bucketLabels[notice]}。 <a href={`#feedback-${notice}`} onClick={() => { setDetail(null); setDraft(null); }} className="underline">查看分區</a></p> : null}
    {access === 'signed-out' ? <PixelFrame title="管理員登入"><form onSubmit={login} className="max-w-lg space-y-3"><label className="block text-sm">管理員電子郵件<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} autoComplete="email" /></label><button disabled={busy} className={buttonClass}>寄送登入連結</button>{sent ? <p role="status" className="text-sm text-accent">登入連結已寄出，請查看信箱。</p> : null}</form></PixelFrame> : null}
    {access === 'loading' ? <p>{loading ? '正在讀取回饋…' : <button className={buttonClass} onClick={() => void refresh()}>重新讀取</button>}</p> : null}
    {access === 'ready' ? <>
      <SupportMessagesAdmin key={sessionIdentity.current} onUnauthorized={supportUnauthorized} />
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setPages({}); setFilter({ query, kind }); }}>
        <label className="min-w-0 flex-1 text-sm">搜尋人物、回報或備註<input maxLength={100} value={query} onChange={e => setQuery(e.target.value)} className={inputClass} /></label>
        <label className="text-sm">回饋種類<select value={kind} onChange={e => setKind(e.target.value)} className={inputClass}><option value="">全部</option><option value="supplement_request">希望補充</option><option value="problem_report">問題回報</option></select></label>
        <button disabled={loading} className={buttonClass}>搜尋</button><button type="button" disabled={loading} className={buttonClass} onClick={() => void refresh()}>重新整理</button>
      </form>
      {dashboard ? <><p className="text-xs text-slate-500">取得時間 {date(dashboard.fetched_at)}{loading ? ' · 更新中…' : ''}</p><div className="grid gap-5 lg:grid-cols-2">
        {feedbackBuckets.map(bucket => { const group = dashboard.groups[bucket]; return <section id={`feedback-${bucket}`} key={bucket} className={`${bucket === 'pending' || bucket === 'rejected' ? 'lg:col-span-2' : 'flex flex-col'} min-w-0 scroll-mt-8 border border-line bg-panel/60 p-4`}>
          <h2 className="text-xl text-white">{bucketLabels[bucket]} <span className="text-accent">{group.total}</span></h2>
          <p className="mt-1 text-xs text-slate-400">{bucket === 'rejected' ? '保留原因與改判入口' : `待執行／處理中 ${group.unfinished} 件 · 已完成 ${group.completed} 件`}</p>
          {group.oldest_waiting_at ? <p className="mt-1 text-xs text-slate-500">最久等待自 {date(group.oldest_waiting_at)}</p> : null}
          <div className="mt-4 space-y-3">{group.items.length ? group.items.map(item => <article key={item.id} className="min-w-0 border border-line/70 bg-bg/60 p-4">
            <a href={`/people/${item.person_id}`} target="_blank" rel="noopener noreferrer" className="text-lg text-white underline">{item.person_name}</a>
            <div className="mt-2"><FeedbackContent item={item} /></div>
            <div className="mt-3 border-t border-line pt-3 text-sm"><p className="text-accent">{bucketLabels[feedbackBucket(item)]}{item.decision === 'accepted' ? ` · ${progressLabels[item.work_status]}` : ''}</p>
              {item.management_summary ? <p className="mt-2 break-words">管理摘要：{item.management_summary}</p> : null}
              <p className="mt-2 whitespace-pre-wrap break-words text-slate-300">處理備註：{item.review_note || '尚未填寫'}</p><p className="mt-2 break-all text-xs text-slate-500">最後處理：{item.reviewed_by || '尚未處理'} · {date(item.reviewed_at)}</p></div>
            <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className={buttonClass} onClick={() => void open(item)}>編輯處理</button><button disabled={busy} className={buttonClass} onClick={() => void open(item)}>查看完整內容與歷程</button></div>
          </article>) : <p className="py-6 text-sm text-slate-500">此分區目前沒有符合條件的回饋。</p>}</div>
          <div className={`${bucket === 'priority' || bucket === 'normal' ? 'mt-auto pt-4' : 'mt-4'} flex items-center justify-between gap-2 text-xs`}><button disabled={loading || group.page <= 1} className={buttonClass} onClick={() => setPages(previous => ({ ...previous, [bucket]: group.page - 1 }))}>上一頁</button><span>{group.page} / {Math.max(1, Math.ceil(group.total / group.page_size))}</span><button disabled={loading || group.page * group.page_size >= group.total} className={buttonClass} onClick={() => setPages(previous => ({ ...previous, [bucket]: group.page + 1 }))}>下一頁</button></div>
        </section>; })}
      </div></> : null}
    </> : null}
    {access === 'ready' && detail && draft ? <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 sm:p-8" ref={dialogRef} role="dialog" aria-modal="true" aria-label="編輯回饋處理" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) { setDetail(null); setDraft(null); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary')).filter(element => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}><div className="mx-auto max-w-3xl space-y-4 border border-line bg-bg p-5">
      <div className="flex justify-between gap-3"><h2 className="text-xl text-white">{detail.item.person_name} · 編輯處理</h2><button disabled={busy} className={buttonClass} onClick={() => { setDetail(null); setDraft(null); }}>關閉</button></div>
      <FeedbackContent item={detail.item} />
      {error ? <p role="alert" className="text-amber-300">{error}</p> : null}
      {notice ? <p role="status" className="text-accent">已儲存至{bucketLabels[notice]}，可繼續編輯。</p> : null}
      {conflict ? <div className="space-y-3 border border-amber-500 p-3"><h3 className="text-amber-300">較新的版本</h3>{latest && reconciliation ? <>
        <FeedbackContent item={latest.item} />
        <p>最新備註：{latest.item.review_note || '無'}</p>
        <p className="text-sm text-slate-400">未修改的欄位沿用最新版本；雙方都修改的欄位請選擇要保留的內容。</p>
        {(Object.keys(feedbackConflictLabels) as FeedbackConflictField[]).map(field => <div key={field} className="space-y-2 border-t border-line pt-2" data-conflict-field={field}>
          <h4>{feedbackConflictLabels[field]}</h4>
          <p className="whitespace-pre-wrap break-words">原始版本：{conflictValue(draftFrom(detail.item), field)}</p>
          <p className="whitespace-pre-wrap break-words">我的草稿：{conflictValue(draft, field)}</p>
          <p className="whitespace-pre-wrap break-words">最新版本：{conflictValue(draftFrom(latest.item), field)}</p>
          {reconciliation.conflicts.includes(field) ? <div className="flex flex-wrap gap-3">{(['mine', 'latest'] as const).map(choice => <label key={choice}><input type="radio" name={`conflict-${field}`} checked={choices[field] === choice} onChange={() => setChoices(previous => ({ ...previous, [field]: choice }))} />{choice === 'mine' ? '保留我的' : '採用最新'}{feedbackConflictLabels[field]}</label>)}</div> : null}
        </div>)}
        <button disabled={busy || reconciliation.unresolved.length > 0} className={buttonClass} onClick={() => { setDraft(reconciliation.draft); setDetail(latest); setLatest(null); setConflict(false); setError(''); request.current = null; }}>套用合併結果，繼續編輯</button>
      </> : <button disabled={busy} className={buttonClass} onClick={() => void loadLatest()}>讀取最新版本</button>}</div> : null}
      <form onSubmit={save}><fieldset disabled={busy || conflict} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">處理決定<select className={inputClass} value={draft.decision} onChange={e => { const decision = e.target.value as FeedbackDraft['decision']; setDraft({ ...draft, decision, ...(decision === 'accepted' ? {} : { priority: 'normal', workStatus: 'pending' }) }); }}><option value="pending">新回饋／待處理</option><option value="accepted">採納</option><option value="rejected">駁回</option></select></label>
          <label className="text-sm">優先程度<select disabled={draft.decision !== 'accepted'} className={inputClass} value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as FeedbackDraft['priority'] })}><option value="normal">一般</option><option value="high">高優先</option></select></label>
          <label className="text-sm">執行進度<select disabled={draft.decision !== 'accepted'} className={inputClass} value={draft.workStatus} onChange={e => setDraft({ ...draft, workStatus: e.target.value as FeedbackDraft['workStatus'] })}>{Object.entries(progressLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <div className="text-sm"><label htmlFor="feedback-summary">管理摘要（不修改使用者原文）</label><textarea id="feedback-summary" rows={2} maxLength={500} className={inputClass} value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} /></div>
        <div className="text-sm"><label htmlFor="feedback-note">處理備註</label><textarea id="feedback-note" rows={4} maxLength={1000} className={inputClass} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /></div>
        <p className="text-xs text-slate-400">駁回、改判、重新開啟或完成時，請說明原因或結果。舊備註會保留在歷程。</p>
        <button disabled={busy || conflict} className={buttonClass}>{busy ? '儲存中…' : '儲存處理'}</button>
      </fieldset></form>
      <details><summary className="cursor-pointer text-accent">操作與提交歷程（{detail.history_total}）</summary><div className="mt-3 space-y-3">{detail.history.map(h => <div key={h.id} className="border-t border-line pt-3 text-sm"><p>{eventNames[h.event] ?? h.event} · {date(h.created_at)}</p><p className="break-all text-xs text-slate-400">{h.actor_id || (h.event === 'baseline' ? '匯入既有紀錄' : '使用者提交')}</p><p>{h.before_state ? `${bucketLabels[feedbackBucket(h.before_state)]} → ` : ''}{bucketLabels[feedbackBucket(h.after_state)]} · {progressLabels[h.after_state.work_status]}</p><p className="whitespace-pre-wrap break-words">備註：{h.after_state.review_note || '無'}</p><details><summary>當時內容</summary><p className="whitespace-pre-wrap break-words">{h.after_state.message || '希望補充資料'}</p><p className="break-all">{h.after_state.evidence_url}</p><p>管理摘要：{h.after_state.management_summary}</p></details></div>)}</div>
      <div className="mt-3 flex gap-3">{[-1, 1].map(delta => <button key={delta} type="button" disabled={busy || (delta < 0 ? detail.history_page <= 1 : detail.history_page * 20 >= detail.history_total)} className={buttonClass} onClick={() => void loadHistory(delta)}>{delta < 0 ? '較新歷程' : '較舊歷程'}</button>)}</div></details>
    </div></div> : null}
  </div></AppShell>;
}
