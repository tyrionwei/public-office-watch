import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import {
  createPublicUpdateDraft,
  loadPublicUpdateAdminDashboard,
  loadPublicUpdateAdminSession,
  PublicUpdateAdminApiError,
  type PublicUpdateAdminDashboard,
  type PublicUpdateDraftInput,
  type PublicUpdateEntityType,
  type PublicUpdateReviewAction,
  type PublicUpdateType,
  publicUpdateEntityTypeOptions,
  publicUpdateTypeOptions,
  requestPublicUpdateAdminMagicLink,
  reviewPublicUpdateEvent,
  signOutPublicUpdateAdmin,
} from '../lib/publicUpdateAdmin';

type AccessState = 'loading' | 'signed-out' | 'checking' | 'ready' | 'forbidden';

const emptyDraft: PublicUpdateDraftInput = {
  updateType: 'person',
  title: '',
  summary: '',
  entityType: null,
  entityId: null,
  entityHref: null,
  sourceName: null,
  sourceUrl: null,
  occurredAt: null,
};

function displayError(error: unknown) {
  if (!(error instanceof PublicUpdateAdminApiError)) return '操作未完成，請稍後再試。';
  const messages: Record<string, string> = {
    PUBLIC_UPDATE_ADMIN_UNAVAILABLE: '目前未設定 Supabase，無法使用更新管理。',
    PUBLIC_UPDATE_ADMIN_AUTH_FAILED: '登入狀態無效，請重新寄送登入連結。',
    PUBLIC_UPDATE_ADMIN_INVALID_DRAFT: '草稿欄位格式不正確，請檢查標題、摘要與連結。',
    PUBLIC_UPDATE_ADMIN_INVALID_REVIEW: '請填寫至少 2 字的拒絕或撤回原因。',
    PUBLIC_UPDATE_ADMIN_NOT_FOUND: '找不到這筆更新紀錄。',
    PUBLIC_UPDATE_ADMIN_INVALID_STATE: '這筆紀錄目前不能執行該操作。',
  };
  return messages[error.code] ?? '操作未完成，請稍後再試。';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: PublicUpdateAdminDashboard['events'][number]['review_status']) {
  if (status === 'verified') return '已公開';
  if (status === 'rejected') return '已拒絕';
  return '草稿';
}

export function InternalUpdateAdminPage() {
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [dashboard, setDashboard] = useState<PublicUpdateAdminDashboard | null>(null);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [draft, setDraft] = useState<PublicUpdateDraftInput>(emptyDraft);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshDashboard() {
    setAccessState('checking');
    setError(null);
    try {
      setDashboard(await loadPublicUpdateAdminDashboard());
      setAccessState('ready');
    } catch (caught) {
      if (caught instanceof PublicUpdateAdminApiError && caught.code === 'PUBLIC_UPDATE_ADMIN_FORBIDDEN') setAccessState('forbidden');
      else if (caught instanceof PublicUpdateAdminApiError && caught.status === 401) setAccessState('signed-out');
      else {
        setError(displayError(caught));
        setAccessState('checking');
      }
    }
  }

  useEffect(() => {
    let active = true;
    void loadPublicUpdateAdminSession().then((session) => {
      if (!active) return;
      if (!session || session.user.is_anonymous === true) setAccessState('signed-out');
      else void refreshDashboard();
    }).catch((caught) => {
      if (!active) return;
      setError(displayError(caught));
      setAccessState('signed-out');
    });
    return () => { active = false; };
  }, []);

  const actionByEvent = useMemo(() => {
    const map = new Map<string, PublicUpdateAdminDashboard['actions'][number]>();
    for (const action of dashboard?.actions ?? []) if (!map.has(action.update_id)) map.set(action.update_id, action);
    return map;
  }, [dashboard]);

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    setBusyAction('login');
    setError(null);
    try {
      await requestPublicUpdateAdminMagicLink(email.trim());
      setMagicLinkSent(true);
    } catch (caught) { setError(displayError(caught)); }
    finally { setBusyAction(null); }
  }

  async function handleSignOut() {
    setBusyAction('logout');
    try {
      await signOutPublicUpdateAdmin();
      setDashboard(null);
      setAccessState('signed-out');
      setMagicLinkSent(false);
    } catch (caught) { setError(displayError(caught)); }
    finally { setBusyAction(null); }
  }

  async function handleCreateDraft(event: FormEvent) {
    event.preventDefault();
    setBusyAction('create');
    setError(null);
    try {
      await createPublicUpdateDraft(draft);
      setDraft(emptyDraft);
      await refreshDashboard();
    } catch (caught) { setError(displayError(caught)); }
    finally { setBusyAction(null); }
  }

  async function handleReview(updateId: string, reviewAction: PublicUpdateReviewAction) {
    let reason: string | null = null;
    if (reviewAction !== 'approve') {
      reason = window.prompt(reviewAction === 'reject' ? '請輸入拒絕原因（至少 2 字）' : '請輸入撤回原因（至少 2 字）');
      if (reason === null) return;
    } else if (!window.confirm('確認核准並立即顯示在公開更新動態？')) return;

    setBusyAction(`${reviewAction}-${updateId}`);
    setError(null);
    try {
      await reviewPublicUpdateEvent(updateId, reviewAction, reason);
      await refreshDashboard();
    } catch (caught) { setError(displayError(caught)); }
    finally { setBusyAction(null); }
  }

  if (accessState === 'loading' || accessState === 'checking' && !dashboard) {
    return <AppShell><PixelFrame title="Update Administration"><p className="text-sm text-slate-300">正在確認管理權限…</p>{error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}</PixelFrame></AppShell>;
  }

  if (accessState === 'signed-out') {
    return (
      <AppShell><div className="mx-auto max-w-xl"><PixelFrame title="Update Administration">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">restricted operator access</p>
        <h1 className="mt-3 font-display text-2xl text-white">更新動態管理登入</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">只有已標記的管理員可以建立草稿與核准公開。登入連結不會建立新帳號。</p>
        <form onSubmit={handleMagicLink} className="mt-5 space-y-3">
          <label className="block text-xs text-slate-400" htmlFor="update-admin-email">管理員 Email</label>
          <input id="update-admin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border border-line bg-bg/70 px-3 py-2 text-sm text-white outline-none focus:border-accent" />
          <button type="submit" disabled={busyAction === 'login'} className="border border-accent/70 bg-accent/10 px-4 py-2 text-sm text-accent disabled:opacity-50">{busyAction === 'login' ? '寄送中…' : '寄送一次性登入連結'}</button>
        </form>
        {magicLinkSent ? <p className="mt-4 border-l-2 border-signal bg-signal/10 px-3 py-2 text-sm text-signal">登入連結已寄出，請回到此頁完成登入。</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </PixelFrame></div></AppShell>
    );
  }

  if (accessState === 'forbidden') {
    return <AppShell><div className="mx-auto max-w-xl"><PixelFrame title="Access Denied"><h1 className="font-display text-2xl text-white">沒有更新管理權限</h1><p className="mt-3 text-sm text-slate-300">此帳號已登入，但未被伺服器標記為管理員。</p><button type="button" onClick={() => void handleSignOut()} className="mt-5 border border-line px-4 py-2 text-sm text-slate-300 hover:text-white">登出</button></PixelFrame></div></AppShell>;
  }

  if (!dashboard) return null;

  return (
    <AppShell><div className="space-y-4">
      <PixelFrame title="Update Administration"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-accent">draft → review → publish</p><h1 className="mt-2 font-display text-3xl text-white">公開更新動態管理</h1><p className="mt-2 text-sm text-slate-400">{dashboard.adminEmail ?? '已驗證管理員'}・自動監控資料不會在此自動公開</p></div><div className="flex gap-2"><button type="button" onClick={() => void refreshDashboard()} className="border border-line px-3 py-2 text-sm text-slate-300 hover:text-white">重新整理</button><button type="button" onClick={() => void handleSignOut()} className="border border-line px-3 py-2 text-sm text-slate-400 hover:text-white">登出</button></div></div></PixelFrame>
      {error ? <p role="alert" className="border-l-2 border-rose-400 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      <SectionPanel title="建立內部草稿" eyebrow="not public until approved">
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleCreateDraft}>
          <label className="text-xs text-slate-400">類型<select value={draft.updateType} onChange={(event) => setDraft((current) => ({ ...current, updateType: event.target.value as PublicUpdateType }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white">{publicUpdateTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-xs text-slate-400">相關資料類型（選填）<select value={draft.entityType ?? ''} onChange={(event) => setDraft((current) => ({ ...current, entityType: event.target.value ? event.target.value as PublicUpdateEntityType : null, entityId: event.target.value ? current.entityId : null }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white"><option value="">無</option>{publicUpdateEntityTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-xs text-slate-400 lg:col-span-2">標題（最多 120 字）<input required maxLength={120} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400 lg:col-span-2">摘要（最多 500 字）<textarea required maxLength={500} rows={4} value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">站內連結（選填）<input placeholder="/people/..." value={draft.entityHref ?? ''} onChange={(event) => setDraft((current) => ({ ...current, entityHref: event.target.value || null }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">內部資料 ID（選填）<input disabled={!draft.entityType} value={draft.entityId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, entityId: event.target.value || null }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white disabled:opacity-40" /></label>
          <label className="text-xs text-slate-400">來源名稱（選填）<input value={draft.sourceName ?? ''} onChange={(event) => setDraft((current) => ({ ...current, sourceName: event.target.value || null }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">來源網址（選填）<input type="url" placeholder="https://..." value={draft.sourceUrl ?? ''} onChange={(event) => setDraft((current) => ({ ...current, sourceUrl: event.target.value || null }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">事件時間（選填）<input type="datetime-local" value={draft.occurredAt ?? ''} onChange={(event) => setDraft((current) => ({ ...current, occurredAt: event.target.value || null }))} className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white" /></label>
          <div className="flex items-end"><button type="submit" disabled={busyAction !== null} className="border border-accent/70 bg-accent/10 px-4 py-2 text-sm text-accent disabled:opacity-50">{busyAction === 'create' ? '建立中…' : '建立草稿'}</button></div>
        </form>
      </SectionPanel>
      <SectionPanel title="近期更新紀錄" eyebrow="latest 100 / audited">
        <div className="space-y-3">
          {dashboard.events.map((item) => {
            const latestAction = actionByEvent.get(item.update_id);
            return <article key={item.update_id} className="border border-line/70 bg-bg/35 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`border px-2 py-1 text-[11px] ${item.review_status === 'verified' ? 'border-signal/50 text-signal' : item.review_status === 'rejected' ? 'border-rose-400/50 text-rose-200' : 'border-accent/50 text-accent'}`}>{statusLabel(item.review_status)}</span><span className="text-xs text-slate-500">{publicUpdateTypeOptions.find((option) => option.value === item.update_type)?.label}</span></div><h2 className="mt-2 font-display text-lg text-white">{item.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{item.summary}</p>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-accent hover:text-white">{item.source_name ?? '查看來源'}</a> : null}<p className="mt-3 text-xs text-slate-500">更新：{formatDateTime(item.updated_at)}{latestAction ? `・最近操作：${latestAction.action_type}（${latestAction.reason ?? '無附註'}）` : ''}</p></div><div className="flex shrink-0 flex-wrap gap-2">{item.review_status !== 'verified' ? <><button type="button" disabled={busyAction !== null} onClick={() => void handleReview(item.update_id, 'approve')} className="border border-signal/60 px-3 py-2 text-xs text-signal disabled:opacity-50">核准公開</button><button type="button" disabled={busyAction !== null} onClick={() => void handleReview(item.update_id, 'reject')} className="border border-rose-400/50 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">拒絕</button></> : <button type="button" disabled={busyAction !== null} onClick={() => void handleReview(item.update_id, 'withdraw')} className="border border-amber-300/50 px-3 py-2 text-xs text-amber-200 disabled:opacity-50">撤回公開</button>}</div></div></article>;
          })}
        </div>
      </SectionPanel>
    </div></AppShell>
  );
}
