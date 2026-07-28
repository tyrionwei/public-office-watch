import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import {
  ChatAdminApiError,
  chatAdminActionLabels,
  chatAdminReasonOptions,
  chatSecurityHoldReasonOptions,
  loadChatAdminDashboard,
  loadChatAdminSession,
  requestChatAdminMagicLink,
  setChatEnabled,
  setChatMessageVisibility,
  setChatProfileMute,
  setChatSecurityHold,
  signOutChatAdmin,
  type ChatAdminDashboard,
  type ChatAdminReason,
  type ChatSecurityHoldReason,
} from '../lib/chatAdmin';

type AccessState = 'loading' | 'signed-out' | 'checking' | 'ready' | 'forbidden';

const reasonLabels = Object.fromEntries(
  [
    ...chatAdminReasonOptions,
    ...chatSecurityHoldReasonOptions,
    { value: 'hold_released', label: '保全需求結束' },
  ].map((option) => [option.value, option.label]),
);

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function displayError(error: unknown) {
  if (error instanceof ChatAdminApiError) {
    if (error.code === 'CHAT_ADMIN_FORBIDDEN') return '此帳號沒有聊天室管理權限。';
    if (error.code === 'CHAT_ADMIN_AUTH_FAILED') return '登入未完成，請確認 Email 後再試。';
    if (error.code === 'CHAT_ADMIN_MESSAGE_HELD') return '此訊息正處於法律保全狀態，不能由一般管理操作變更。';
    if (error.code === 'CHAT_ADMIN_SECURITY_LOG_NOT_FOUND') return '這則訊息的安全紀錄已到期清除，無法設定 Legal Hold。';
    if (error.code === 'CHAT_ADMIN_INVALID_HOLD_REASON') return '請選擇有效的安全紀錄保全原因。';
  }
  return '操作未完成，請稍後再試。';
}

export function InternalChatAdminPage() {
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [dashboard, setDashboard] = useState<ChatAdminDashboard | null>(null);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [reason, setReason] = useState<ChatAdminReason>('spam');
  const [securityHoldReason, setSecurityHoldReason] = useState<ChatSecurityHoldReason>('legal_investigation');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshDashboard() {
    setAccessState('checking');
    setError(null);
    try {
      const nextDashboard = await loadChatAdminDashboard();
      setDashboard(nextDashboard);
      setAccessState('ready');
    } catch (caught) {
      if (caught instanceof ChatAdminApiError && caught.code === 'CHAT_ADMIN_FORBIDDEN') {
        setAccessState('forbidden');
      } else if (caught instanceof ChatAdminApiError && caught.status === 401) {
        setAccessState('signed-out');
      } else {
        setError(displayError(caught));
        setAccessState('checking');
      }
    }
  }

  useEffect(() => {
    let active = true;
    void loadChatAdminSession()
      .then((session) => {
        if (!active) return;
        if (!session || session.user.is_anonymous === true) {
          setAccessState('signed-out');
          return;
        }
        void refreshDashboard();
      })
      .catch((caught) => {
        if (!active) return;
        setError(displayError(caught));
        setAccessState('signed-out');
      });
    return () => { active = false; };
  }, []);

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    setBusyAction('login');
    setError(null);
    try {
      await requestChatAdminMagicLink(email.trim());
      setMagicLinkSent(true);
    } catch (caught) {
      setError(displayError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSignOut() {
    setBusyAction('logout');
    try {
      await signOutChatAdmin();
      setDashboard(null);
      setAccessState('signed-out');
      setMagicLinkSent(false);
    } catch (caught) {
      setError(displayError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyAction(key);
    setError(null);
    try {
      await action();
      await refreshDashboard();
    } catch (caught) {
      setError(displayError(caught));
    } finally {
      setBusyAction(null);
    }
  }

  function handleSecurityHold(messageId: string, currentlyHeld: boolean) {
    const prompt = currentlyHeld
      ? '確定解除這則訊息的 Legal Hold？若安全紀錄已超過 180 日，將在下一次清理時刪除。'
      : '確定設定 Legal Hold？安全紀錄將停止自動清理，直到管理員解除。';
    if (!window.confirm(prompt)) return;
    void runAction(
      `security-hold-${messageId}`,
      () => setChatSecurityHold(messageId, !currentlyHeld, securityHoldReason),
    );
  }

  if (accessState === 'loading' || accessState === 'checking' && !dashboard) {
    return (
      <AppShell>
        <PixelFrame title="Chat Administration">
          <p className="text-sm text-slate-300">正在確認管理權限…</p>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        </PixelFrame>
      </AppShell>
    );
  }

  if (accessState === 'signed-out') {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl">
          <PixelFrame title="Chat Administration">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">restricted operator access</p>
            <h1 className="mt-3 font-display text-2xl text-white">聊天室管理登入</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              僅已由伺服器標記的管理員帳號可以開關聊天室或處理訊息。登入連結不會建立新的管理員帳號。
            </p>
            <form onSubmit={handleMagicLink} className="mt-5 space-y-3">
              <label className="block text-xs text-slate-400" htmlFor="chat-admin-email">管理員 Email</label>
              <input
                id="chat-admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-line bg-bg/70 px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
              <button type="submit" disabled={busyAction === 'login'} className="border border-accent/70 bg-accent/10 px-4 py-2 text-sm text-accent disabled:opacity-50">
                {busyAction === 'login' ? '寄送中…' : '寄送一次性登入連結'}
              </button>
            </form>
            {magicLinkSent ? <p className="mt-4 border-l-2 border-signal bg-signal/10 px-3 py-2 text-sm text-signal">登入連結已寄出，請回到此頁完成登入。</p> : null}
            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          </PixelFrame>
        </div>
      </AppShell>
    );
  }

  if (accessState === 'forbidden') {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl">
          <PixelFrame title="Access Denied">
            <h1 className="font-display text-2xl text-white">沒有聊天室管理權限</h1>
            <p className="mt-3 text-sm text-slate-300">此帳號已登入，但未被伺服器標記為聊天室管理員。</p>
            <button type="button" onClick={() => void handleSignOut()} className="mt-5 border border-line px-4 py-2 text-sm text-slate-300 hover:text-white">登出</button>
          </PixelFrame>
        </div>
      </AppShell>
    );
  }

  if (!dashboard) return null;

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame title="Chat Administration">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent">restricted / audited operations</p>
              <h1 className="mt-2 font-display text-3xl text-white">聊天室管理</h1>
              <p className="mt-2 text-sm text-slate-400">{dashboard.adminEmail ?? '已驗證管理員'}・所有操作都會留下紀錄</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void refreshDashboard()} className="border border-line px-3 py-2 text-sm text-slate-300 hover:text-white">重新整理</button>
              <button type="button" onClick={() => void handleSignOut()} className="border border-line px-3 py-2 text-sm text-slate-400 hover:text-white">登出</button>
            </div>
          </div>
        </PixelFrame>

        {error ? <p role="alert" className="border-l-2 border-rose-400 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <SectionPanel title="緊急開關" eyebrow="feature flag">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`font-display text-2xl ${dashboard.status.is_enabled ? 'text-signal' : 'text-rose-300'}`}>
                  {dashboard.status.is_enabled ? '聊天室開放中' : '聊天室已關閉'}
                </p>
                <p className="mt-2 text-xs text-slate-500">最後變更：{formatDateTime(dashboard.status.updated_at)}</p>
              </div>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void runAction('flag', () => setChatEnabled(!dashboard.status.is_enabled))}
                className={`border px-4 py-3 text-sm disabled:opacity-50 ${dashboard.status.is_enabled ? 'border-rose-400/70 bg-rose-500/10 text-rose-200' : 'border-signal/70 bg-signal/10 text-signal'}`}
              >
                {dashboard.status.is_enabled ? '立即關閉聊天室' : '開啟聊天室'}
              </button>
            </div>
          </SectionPanel>

          <SectionPanel title="目前狀態" eyebrow="summary">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div><dt className="text-xs text-slate-500">公開訊息</dt><dd className="mt-2 font-display text-2xl text-white">{dashboard.counts.visibleMessages}</dd></div>
              <div><dt className="text-xs text-slate-500">已隱藏</dt><dd className="mt-2 font-display text-2xl text-rose-300">{dashboard.counts.removedMessages}</dd></div>
              <div><dt className="text-xs text-slate-500">禁言中</dt><dd className="mt-2 font-display text-2xl text-accent">{dashboard.counts.mutedProfiles}</dd></div>
            </dl>
          </SectionPanel>
        </div>

        <SectionPanel title="安全紀錄保存" eyebrow="180-day retention / legal hold">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div>
              <dl className="grid grid-cols-2 gap-3 text-center sm:max-w-md">
                <div className="border border-line/70 bg-bg/35 p-3">
                  <dt className="text-xs text-slate-500">保存中的安全紀錄</dt>
                  <dd className="mt-2 font-display text-2xl text-white">{dashboard.counts.securityLogs}</dd>
                </div>
                <div className="border border-signal/30 bg-signal/[0.06] p-3">
                  <dt className="text-xs text-slate-500">Legal Hold</dt>
                  <dd className="mt-2 font-display text-2xl text-signal">{dashboard.counts.heldSecurityLogs}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                一般安全紀錄保存 180 日後由系統分批清除。此頁只顯示保存狀態，不顯示或解密 IP。
              </p>
            </div>
            <div>
              <label htmlFor="security-hold-reason" className="block text-xs text-slate-400">Legal Hold 原因</label>
              <select
                id="security-hold-reason"
                value={securityHoldReason}
                onChange={(event) => setSecurityHoldReason(event.target.value as ChatSecurityHoldReason)}
                className="mt-2 w-full border border-line bg-bg px-3 py-2 text-sm text-white"
              >
                {chatSecurityHoldReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">僅限正式調查、有效權利通知或重大安全事件，所有設定與解除都會留下稽核紀錄。</p>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel title="近期訊息" eyebrow="latest 50">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="moderation-reason" className="text-xs text-slate-400">處理原因</label>
            <select id="moderation-reason" value={reason} onChange={(event) => setReason(event.target.value as ChatAdminReason)} className="border border-line bg-bg px-3 py-2 text-sm text-white">
              {chatAdminReasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <p className="text-xs text-slate-500">一般政治立場或用語爭議不在處理範圍。</p>
          </div>

          <div className="space-y-3">
            {dashboard.messages.length === 0 ? <p className="text-sm text-slate-400">目前沒有聊天室訊息。</p> : null}
            {dashboard.messages.map((message) => {
              const isRemoved = message.moderationStatus === 'removed';
              const isMuted = message.profileStatus === 'muted' && (!message.mutedUntil || new Date(message.mutedUntil) > new Date());
              return (
                <article key={message.id} className={`border p-3 ${isRemoved ? 'border-rose-400/30 bg-rose-500/[0.06]' : 'border-line/70 bg-bg/35'}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{message.displayName} <span className="font-normal text-slate-500">（#{message.publicCode}）</span></p>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-200">{message.body}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(message.createdAt)}{isRemoved ? `・已隱藏：${reasonLabels[message.removalReason ?? ''] ?? message.removalReason}` : ''}</p>
                      {isMuted ? <p className="mt-1 text-xs text-accent">禁言至 {formatDateTime(message.mutedUntil)}</p> : null}
                      {message.securityHoldActive ? (
                        <p className="mt-1 text-xs text-signal">Legal Hold 生效中・停止自動清理</p>
                      ) : message.securityLogPresent ? (
                        <p className="mt-1 text-xs text-slate-500">安全紀錄保存至 {formatDateTime(message.securityExpiresAt)}</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-600">安全紀錄已到期清除</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" disabled={busyAction !== null || message.moderationStatus === 'held'} onClick={() => void runAction(`visibility-${message.id}`, () => setChatMessageVisibility(message.id, isRemoved, reason))} className="border border-line px-3 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-40">
                        {isRemoved ? '恢復訊息' : '隱藏訊息'}
                      </button>
                      {isMuted ? (
                        <button type="button" disabled={busyAction !== null} onClick={() => void runAction(`unmute-${message.id}`, () => setChatProfileMute(message.id, false, 60, reason))} className="border border-line px-3 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-40">解除禁言</button>
                      ) : (
                        <>
                          <button type="button" disabled={busyAction !== null} onClick={() => void runAction(`mute-60-${message.id}`, () => setChatProfileMute(message.id, true, 60, reason))} className="border border-accent/50 px-3 py-2 text-xs text-accent disabled:opacity-40">禁言 1 小時</button>
                          <button type="button" disabled={busyAction !== null} onClick={() => void runAction(`mute-1440-${message.id}`, () => setChatProfileMute(message.id, true, 1440, reason))} className="border border-accent/50 px-3 py-2 text-xs text-accent disabled:opacity-40">禁言 24 小時</button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={busyAction !== null || !message.securityLogPresent}
                        onClick={() => handleSecurityHold(message.id, message.securityHoldActive)}
                        className={`border px-3 py-2 text-xs disabled:opacity-40 ${message.securityHoldActive ? 'border-signal/60 text-signal' : 'border-line text-slate-400'}`}
                      >
                        {message.securityHoldActive ? '解除 Legal Hold' : '設定 Legal Hold'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionPanel>

        <SectionPanel title="最近操作紀錄" eyebrow="audit log">
          <div className="divide-y divide-line/50">
            {dashboard.actions.length === 0 ? <p className="py-3 text-sm text-slate-400">尚無管理操作。</p> : null}
            {dashboard.actions.map((action) => (
              <div key={action.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
                <span className="text-slate-500">{formatDateTime(action.createdAt)}</span>
                <span className="text-slate-200">{chatAdminActionLabels[action.actionType] ?? action.actionType}{action.targetPublicCode ? `・#${action.targetPublicCode}` : ''}</span>
                <span className="text-xs text-slate-500">{reasonLabels[action.reason] ?? action.reason}</span>
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
