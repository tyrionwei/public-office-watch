import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { xiezhiMascotPoses } from '../data/defaultCharacterAssets';
import { useI18n } from '../i18n';
import {
  ChatApiError,
  chatCooldownSeconds,
  chatNameCooldownMinutes,
  chatDateKey,
  chatPageSize,
  countChatCharacters,
  ensureAnonymousChatSession,
  formatChatDate,
  formatChatTimestamp,
  limitChatInput,
  loadChatMessages,
  loadChatProfile,
  loadChatStatus,
  mergeChatMessages,
  saveChatProfile,
  sendChatMessage,
  subscribeToChatMessages,
  unsubscribeFromChat,
  type ChatMessage,
  type ChatProfile,
  type ChatProfileModeration,
  type ChatRealtimeChannel,
  type ChatStatus,
} from '../lib/globalChat';
const chatNudgeStorageKey = 'public-office-watch-chat-nudge-seen-at-v1';
const chatNudgeDelayMs = 5_000;
const chatNudgeDurationMs = 6_000;
const chatNudgeSuppressionMs = 7 * 24 * 60 * 60 * 1_000;

function wasChatNudgeSeenRecently() {
  try {
    const seenAt = Number(window.localStorage.getItem(chatNudgeStorageKey));
    return seenAt > 0 && Date.now() - seenAt < chatNudgeSuppressionMs;
  } catch {
    return false;
  }
}

function rememberChatNudge() {
  try {
    window.localStorage.setItem(chatNudgeStorageKey, String(Date.now()));
  } catch {
    // The nudge can still work for this visit when storage is unavailable.
  }
}

const copy = {
  'zh-TW': {
    launcher: '開啟全站即時討論',
    tooltip: '即時討論',
    title: '全站即時討論',
    nudgeTitle: '全站聊天室',
    nudgeBody: '聊選舉、人物與地方議題',
    nudgeOpen: '開啟聊天',
    nudgeClose: '關閉聊天室提示',
    close: '關閉聊天室',
    minimize: '縮小聊天室',
    loading: '正在讀取最近訊息…',
    empty: '目前還沒有訊息。',
    postingUnavailable: '目前可瀏覽訊息；發言功能暫時無法使用。',
    earliest: '已到最早訊息',
    loadError: '聊天室暫時無法使用，請稍後再試。',
    reconnecting: '即時連線重新建立中…',
    reply: '回覆',
    replyingTo: '回覆 {name}（#{code}）',
    cancelReply: '取消回覆',
    cancel: '取消',
    removed: '原訊息已移除',
    nameAction: '修改名稱',
    nameTitle: '設定聊天名稱',
    nameEditTitle: '更改聊天名稱',
    namePlaceholder: '輸入 2～12 字名稱',
    identityNote: '名稱可重複，每 30 分鐘可修改一次；公開短碼建立後不會改變。',
    nameCooldown: '{minutes} 分鐘後可再次修改名稱',
    nameCooldownShort: '{minutes} 分',
    responsibility: '我了解發言將公開顯示，並應自行對內容負責；不得張貼連結、廣告、洗版、侵權或違法內容。',
    privacy: '為防止濫用及依法配合調查，本站會記錄匿名識別碼、發言時間與 IP 安全紀錄，一般保存 180 日。',
    rules: '聊天室規則與隱私說明',
    acceptRequired: '請先確認言論責任與隱私說明。',
    saveName: '開始聊天',
    updateName: '儲存名稱',
    saving: '儲存中…',
    composerPlaceholder: '發表短句…',
    send: '送出',
    sending: '送出中…',
    cooldown: '{seconds} 秒後可再次發言',
    externalLink: '聊天室不接受網址或 Email。',
    duplicate: '相同訊息短時間內不能重複送出。',
    muted: '你已被禁言至 {time}，期間無法發言。',
    mutedUnknown: '你目前已被禁言，暫時無法發言。',
    banned: '你的聊天室發言權限已被永久停用。',
    hiddenMessage: '此訊息因疑似違反聊天室規則而被隱藏。',
    mutedMessage: '此使用者目前被禁言，訊息暫時隱藏。',
    bannedMessage: '此使用者已被永久禁言，訊息已隱藏。',
    genericError: '操作未完成，請稍後再試。',
    authError: '匿名身分建立失敗，請稍後再試。',
    nameCooldownError: '名稱每 30 分鐘只能修改一次。',
  },
  en: {
    launcher: 'Open site-wide live chat',
    tooltip: 'Live chat',
    title: 'Site-wide live chat',
    nudgeTitle: 'Site-wide chat',
    nudgeBody: 'Discuss elections, people, and local issues',
    nudgeOpen: 'Open chat',
    nudgeClose: 'Dismiss chat tip',
    close: 'Close chat',
    minimize: 'Minimize chat',
    loading: 'Loading recent messages…',
    empty: 'No messages yet.',
    postingUnavailable: 'Messages are available to read, but posting is temporarily unavailable.',
    earliest: 'You have reached the first message',
    loadError: 'Chat is temporarily unavailable. Please try again later.',
    reconnecting: 'Reconnecting live updates…',
    reply: 'Reply',
    replyingTo: 'Replying to {name} (#{code})',
    cancelReply: 'Cancel reply',
    cancel: 'Cancel',
    removed: 'Original message removed',
    nameAction: 'Change name',
    nameTitle: 'Set your chat name',
    nameEditTitle: 'Change your chat name',
    namePlaceholder: 'Enter a 2–12 character name',
    identityNote: 'Names may repeat and can be changed every 30 minutes. Your public code never changes.',
    nameCooldown: 'You can change your name again in {minutes} minutes',
    nameCooldownShort: '{minutes}m',
    responsibility: 'I understand my posts are public and I am responsible for them. Links, ads, spam, infringement, and illegal content are prohibited.',
    privacy: 'To prevent abuse and respond to lawful requests, anonymous ID, posting time, and protected IP records are normally retained for 180 days.',
    rules: 'Chat rules and privacy notice',
    acceptRequired: 'Please acknowledge the responsibility and privacy notice.',
    saveName: 'Start chatting',
    updateName: 'Save name',
    saving: 'Saving…',
    composerPlaceholder: 'Write a short message…',
    send: 'Send',
    sending: 'Sending…',
    cooldown: 'Send again in {seconds}s',
    externalLink: 'Links and email addresses are not allowed.',
    duplicate: 'The same message cannot be repeated yet.',
    muted: 'You are muted until {time} and cannot post during this period.',
    mutedUnknown: 'You are currently muted and cannot post.',
    banned: 'Your chat posting access has been permanently disabled.',
    hiddenMessage: 'This message is hidden for a possible chat rule violation.',
    mutedMessage: 'This user is currently muted. Their message is temporarily hidden.',
    bannedMessage: 'This user is permanently muted. Their message is hidden.',
    genericError: 'The action could not be completed. Please try again.',
    authError: 'Anonymous identity could not be created. Please try again.',
    nameCooldownError: 'Your name can only be changed once every 30 minutes.',
  },
} as const;

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/gu, (match, key) => String(values[key] ?? match));
}

function PixelChatIcon() {
  return (
    <span className="relative block h-5 w-6 border-2 border-current" aria-hidden="true">
      <span className="absolute left-1 top-1 h-1 w-1 bg-current" />
      <span className="absolute left-[9px] top-1 h-1 w-1 bg-current" />
      <span className="absolute right-1 top-1 h-1 w-1 bg-current" />
      <span className="absolute -bottom-1 left-1 h-1 w-2 border-l-2 border-current bg-[#07101f]" />
    </span>
  );
}

type ChatCopy = { [Key in keyof typeof copy['zh-TW']]: string };

function errorMessage(error: unknown, text: ChatCopy) {
  const code = error instanceof ChatApiError ? error.code : '';
  if (code === 'CHAT_EXTERNAL_LINK') return text.externalLink;
  if (code === 'CHAT_DUPLICATE') return text.duplicate;
  if (code === 'CHAT_AUTH_FAILED' || code === 'CHAT_UNAUTHENTICATED') return text.authError;
  if (code === 'CHAT_NAME_COOLDOWN') return text.nameCooldownError;
  if (code === 'CHAT_MUTED') {
    return error instanceof ChatApiError && error.mutedUntil
      ? interpolate(text.muted, { time: formatChatTimestamp(error.mutedUntil) })
      : text.mutedUnknown;
  }
  if (code === 'CHAT_BANNED') return text.banned;
  return text.genericError;
}

function visibleMessageBody(message: ChatMessage, text: ChatCopy) {
  if (message.visibility_state === 'removed') return text.hiddenMessage;
  if (message.visibility_state === 'author_muted') return text.mutedMessage;
  if (message.visibility_state === 'author_banned') return text.bannedMessage;
  return message.body ?? text.hiddenMessage;
}

export function GlobalChatWidget() {
  const { language } = useI18n();
  const text = copy[language];
  const [status, setStatus] = useState<ChatStatus | null | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [isNudgeVisible, setIsNudgeVisible] = useState(false);
  const [isNudgePaused, setIsNudgePaused] = useState(false);
  const [isPanelEngaged, setIsPanelEngaged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messageLoadFailed, setMessageLoadFailed] = useState(false);
  const [postingUnavailable, setPostingUnavailable] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState('CLOSED');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ChatRealtimeChannel | null>(null);
  const statusRef = useRef<ChatStatus | null | undefined>(undefined);
  const statusRequestRef = useRef<Promise<ChatStatus | null> | null>(null);
  const preserveHeightRef = useRef<number | null>(null);
  const scrollToBottomRef = useRef(false);
  const nameCooldownUntil = profile
    ? Date.parse(profile.display_name_updated_at) + chatNameCooldownMinutes * 60 * 1000
    : 0;
  const profileMuteUntil = profile?.status === 'muted' && profile.muted_until
    ? Date.parse(profile.muted_until)
    : 0;
  const nextVisibilityExpiry = useMemo(() => messages
    .filter((message) => message.visibility_state === 'author_muted' && message.visibility_until)
    .map((message) => Date.parse(message.visibility_until as string))
    .filter((value) => value > Date.now())
    .sort((left, right) => left - right)[0] ?? 0, [messages]);

  const ensureChatStatus = useCallback(() => {
    if (statusRef.current !== undefined) return Promise.resolve(statusRef.current);
    statusRequestRef.current ??= loadChatStatus()
      .then((value) => value?.is_enabled ? value : null)
      .catch(() => null)
      .then((value) => {
        statusRef.current = value;
        setStatus(value);
        return value;
      })
      .finally(() => {
        statusRequestRef.current = null;
      });
    return statusRequestRef.current;
  }, []);

  useEffect(() => {
    if (isOpen || wasChatNudgeSeenRecently()) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      void ensureChatStatus().then((value) => {
        if (active && value) setIsNudgeVisible(true);
      });
    }, chatNudgeDelayMs);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [ensureChatStatus, isOpen]);

  useEffect(() => {
    if (!isNudgeVisible || isNudgePaused || isOpen) return undefined;
    const timer = window.setTimeout(() => {
      rememberChatNudge();
      setIsNudgeVisible(false);
    }, chatNudgeDurationMs);
    return () => window.clearTimeout(timer);
  }, [isNudgePaused, isNudgeVisible, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsPanelEngaged(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia('(max-width: 767px)').matches) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setIsPanelEngaged(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !status) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setMessageLoadFailed(false);
    setPostingUnavailable(false);
    setError(null);
    setMessages([]);
    setReplyTo(null);
    setHasMore(true);

    const receiveMessage = (message: ChatMessage) => {
      const list = listRef.current;
      scrollToBottomRef.current = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      setMessages((current) => mergeChatMessages(
        current.map((currentMessage) => currentMessage.reply_to_message_id === message.id
          ? { ...currentMessage, reply_state: 'available' }
          : currentMessage),
        [message],
      ));
    };

    const removeMessage = (messageId: string) => {
      setMessages((current) => current
        .map((message) => message.reply_to_message_id === messageId
          ? {
            ...message,
            reply_state: 'removed' as const,
            reply_to_display_name_snapshot: null,
            reply_to_public_code_snapshot: null,
            reply_to_body_snapshot: null,
          }
          : message)
        .map((message) => message.id === messageId
          ? {
            ...message,
            body: null,
            visibility_state: 'removed',
            visibility_until: null,
          }
          : message));
      setReplyTo((current) => current?.id === messageId ? null : current);
    };

    const receiveProfileModeration = (moderation: ChatProfileModeration) => {
      setProfile((current) => {
        if (!current || current.public_code !== moderation.public_code) return current;
        return {
          ...current,
          status: moderation.visibility_state === 'author_banned'
            ? 'banned'
            : moderation.visibility_state === 'author_muted' ? 'muted' : 'active',
          muted_until: moderation.visibility_until,
        };
      });

      if (moderation.visibility_state === 'visible') {
        void loadChatMessages().then((page) => {
          if (!cancelled) setMessages((current) => mergeChatMessages(current, page));
        }).catch(() => undefined);
        return;
      }

      setMessages((current) => current.map((message) => {
        const isAuthor = message.public_code_snapshot === moderation.public_code;
        const isReplyTarget = message.reply_to_public_code_snapshot === moderation.public_code;
        return {
          ...message,
          body: isAuthor ? null : message.body,
          visibility_state: isAuthor ? moderation.visibility_state : message.visibility_state,
          visibility_until: isAuthor ? moderation.visibility_until : message.visibility_until,
          reply_state: isReplyTarget ? 'removed' : message.reply_state,
          reply_to_display_name_snapshot: isReplyTarget ? null : message.reply_to_display_name_snapshot,
          reply_to_public_code_snapshot: isReplyTarget ? null : message.reply_to_public_code_snapshot,
          reply_to_body_snapshot: isReplyTarget ? null : message.reply_to_body_snapshot,
        };
      }));
      setReplyTo((current) => current?.public_code_snapshot === moderation.public_code ? null : current);
    };

    const receiveChatStatus = (updatedStatus: ChatStatus) => {
      setStatus(updatedStatus.is_enabled ? updatedStatus : null);
      if (!updatedStatus.is_enabled) {
        setIsOpen(false);
        setIsPanelEngaged(false);
      }
    };

    void loadChatMessages()
      .then((page) => {
        if (cancelled) return;
        setHasMore(page.length === chatPageSize);
        scrollToBottomRef.current = true;
        setMessages((current) => mergeChatMessages(current, page));
      })
      .catch(() => {
        if (!cancelled) {
          setMessageLoadFailed(true);
          setError(text.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    void (async () => {
      try {
        await ensureAnonymousChatSession();
        const [profileResult, channelResult] = await Promise.allSettled([
          loadChatProfile(),
          subscribeToChatMessages(
            receiveMessage,
            setRealtimeStatus,
            removeMessage,
            receiveChatStatus,
            receiveProfileModeration,
          ),
        ]);
        if (channelResult.status === 'fulfilled') {
          if (cancelled) {
            await unsubscribeFromChat(channelResult.value);
          } else {
            channelRef.current = channelResult.value;
          }
        }
        if (cancelled) return;
        if (profileResult.status === 'rejected') {
          setPostingUnavailable(true);
          return;
        }
        const loadedProfile = profileResult.value;
        setProfile(loadedProfile);
        setDisplayName(loadedProfile?.current_display_name ?? '');
        setIsEditingName(!loadedProfile || loadedProfile.terms_version !== status.terms_version);
        setAcceptedTerms(false);
      } catch {
        if (!cancelled) setPostingUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
      const channel = channelRef.current;
      channelRef.current = null;
      setRealtimeStatus('CLOSED');
      void unsubscribeFromChat(channel);
    };
  }, [isOpen, status, text]);

  useEffect(() => {
    if (Math.max(cooldownUntil, nameCooldownUntil, profileMuteUntil) <= Date.now()) return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil, nameCooldownUntil, profileMuteUntil]);

  useEffect(() => {
    if (!isOpen || nextVisibilityExpiry === 0) return undefined;
    const timer = window.setTimeout(() => {
      void loadChatMessages().then((page) => {
        setMessages((current) => mergeChatMessages(current, page));
        setProfile((current) => current?.status === 'muted'
          ? { ...current, status: 'active', muted_until: null }
          : current);
      }).catch(() => undefined);
    }, Math.max(0, nextVisibilityExpiry - Date.now()) + 250);
    return () => window.clearTimeout(timer);
  }, [isOpen, nextVisibilityExpiry]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (preserveHeightRef.current !== null) {
      list.scrollTop = list.scrollHeight - preserveHeightRef.current;
      preserveHeightRef.current = null;
      return;
    }
    if (scrollToBottomRef.current) {
      list.scrollTop = list.scrollHeight;
      scrollToBottomRef.current = false;
    }
  }, [messages]);

  const needsTerms = !profile
    || profile.terms_version !== status?.terms_version
    || !profile.terms_accepted_at;
  const characterCount = countChatCharacters(body);
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - clock) / 1000));
  const nameCooldownSeconds = Math.max(0, Math.ceil((nameCooldownUntil - clock) / 1000));
  const nameCooldownMinutes = Math.max(1, Math.ceil(nameCooldownSeconds / 60));
  const profileBanned = profile?.status === 'banned';
  const profileMuted = profile?.status === 'muted'
    && (!profile.muted_until || Date.parse(profile.muted_until) > clock);
  const isChangingName = Boolean(profile && displayName.trim() !== profile.current_display_name);
  const nameChangeBlocked = isChangingName && nameCooldownSeconds > 0;
  const canSend = Boolean(profile)
    && !needsTerms
    && !profileBanned
    && !profileMuted
    && characterCount > 0
    && cooldownSeconds === 0
    && !isSending;

  const datedMessages = useMemo(() => messages.map((message, index) => ({
    message,
    showDate: index === 0 || chatDateKey(messages[index - 1].created_at) !== chatDateKey(message.created_at),
  })), [messages]);

  async function loadOlder() {
    if (isLoadingOlder || !hasMore || messages.length === 0) return;
    const list = listRef.current;
    if (list) preserveHeightRef.current = list.scrollHeight;
    setIsLoadingOlder(true);
    try {
      const page = await loadChatMessages(messages[0]);
      setHasMore(page.length === chatPageSize);
      setMessages((current) => mergeChatMessages(current, page));
    } catch (caught) {
      preserveHeightRef.current = null;
      setError(errorMessage(caught, text));
    } finally {
      setIsLoadingOlder(false);
    }
  }

  function handleScroll() {
    if ((listRef.current?.scrollTop ?? 100) < 64) void loadOlder();
  }

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (needsTerms && !acceptedTerms) {
      setError(text.acceptRequired);
      return;
    }
    setIsSavingProfile(true);
    try {
      const saved = await saveChatProfile(displayName, needsTerms && acceptedTerms);
      setProfile(saved);
      setDisplayName(saved.current_display_name);
      setAcceptedTerms(false);
      setIsEditingName(false);
    } catch (caught) {
      setError(errorMessage(caught, text));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleMessageSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    setIsSending(true);
    setError(null);
    try {
      const sent = await sendChatMessage(body, replyTo?.id ?? null);
      scrollToBottomRef.current = true;
      setMessages((current) => mergeChatMessages(current, [sent]));
      setBody('');
      setReplyTo(null);
      const until = Date.now() + chatCooldownSeconds * 1000;
      setCooldownUntil(until);
      setClock(Date.now());
    } catch (caught) {
      if (caught instanceof ChatApiError && caught.code === 'CHAT_COOLDOWN') {
        const until = Date.now() + chatCooldownSeconds * 1000;
        setCooldownUntil(until);
        setClock(Date.now());
      }
      if (caught instanceof ChatApiError && caught.code === 'CHAT_TERMS_REQUIRED') {
        setIsEditingName(true);
      }
      if (caught instanceof ChatApiError && caught.code === 'CHAT_MUTED') {
        setProfile((current) => current
          ? { ...current, status: 'muted', muted_until: caught.mutedUntil }
          : current);
      }
      if (caught instanceof ChatApiError && caught.code === 'CHAT_BANNED') {
        setProfile((current) => current
          ? { ...current, status: 'banned', muted_until: null }
          : current);
      }
      setError(errorMessage(caught, text));
    } finally {
      setIsSending(false);
    }
  }

  function jumpToReply(messageId: string | null) {
    if (!messageId) return;
    const target = document.getElementById(`chat-message-${messageId}`);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId(null), 1600);
  }

  function dismissChatNudge() {
    rememberChatNudge();
    setIsNudgeVisible(false);
  }

  async function openChat() {
    dismissChatNudge();
    const currentStatus = await ensureChatStatus();
    if (!currentStatus) return;
    setIsPanelEngaged(false);
    setIsOpen(true);
  }

  if (status === null) return null;

  return (
    <>
      {!isOpen ? (
        <div
          className="fixed bottom-5 right-4 z-[70] sm:right-5"
          onPointerEnter={() => {
            setIsNudgePaused(true);
            void ensureChatStatus();
          }}
          onPointerLeave={() => setIsNudgePaused(false)}
          onFocusCapture={() => setIsNudgePaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsNudgePaused(false);
          }}
          data-chat-launcher
        >
          {isNudgeVisible ? (
            <aside
              className="pixel-corners absolute bottom-full right-0 mb-3 w-[min(18rem,calc(100vw-2rem))] border border-cyan-300/60 bg-[#07101f] p-4 pr-10 text-left shadow-[5px_5px_0_rgba(34,211,238,0.16)]"
              aria-live="polite"
              data-chat-nudge
            >
              <button
                type="button"
                onClick={dismissChatNudge}
                aria-label={text.nudgeClose}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center border border-line text-sm text-slate-400 hover:border-cyan-300/60 hover:text-white"
              >
                ×
              </button>
              <p className="font-display text-sm tracking-[0.12em] text-cyan-100">{text.nudgeTitle}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{text.nudgeBody}</p>
              <button
                type="button"
                onClick={() => void openChat()}
                className="mt-3 border border-cyan-300/60 bg-cyan-300/[0.08] px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/[0.14] hover:text-white"
              >
                {text.nudgeOpen}
              </button>
            </aside>
          ) : null}
          <button
            type="button"
            onClick={() => void openChat()}
            aria-label={text.launcher}
            title={text.tooltip}
            className="grid h-12 w-12 place-items-center border-2 border-cyan-300/80 bg-[#07101f] text-cyan-200 shadow-[4px_4px_0_rgba(34,211,238,0.2)] transition hover:-translate-y-0.5 hover:border-cyan-200 hover:text-white"
          >
            <PixelChatIcon />
          </button>
        </div>
      ) : null}

      {isOpen ? <button type="button" aria-label={text.close} onClick={() => { setIsOpen(false); setIsPanelEngaged(false); }} className="fixed inset-0 z-[71] bg-black/65 md:hidden" /> : null}

      {isOpen ? (
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={text.title}
          onPointerDown={() => setIsPanelEngaged(true)}
          className={`pixel-corners fixed inset-x-0 bottom-0 z-[72] flex h-[82dvh] flex-col border-2 border-cyan-300/70 bg-[#07101f] shadow-[0_-8px_32px_rgba(0,0,0,0.55)] transition-opacity duration-200 md:bottom-5 md:left-auto md:right-5 md:h-[72vh] md:max-h-[720px] md:min-h-[520px] md:w-[400px] md:shadow-[-8px_8px_32px_rgba(0,0,0,0.55)] ${isPanelEngaged ? 'md:opacity-100' : 'md:opacity-60 md:hover:opacity-100 md:focus-within:opacity-100'}`}
        >
          <header className="flex items-center justify-between gap-3 border-b border-cyan-300/25 bg-cyan-300/[0.06] px-4 py-3">
            <h2 className="font-display text-sm tracking-[0.14em] text-cyan-100">{text.title}</h2>
            <div className="flex items-center gap-2">
              {profile && !isEditingName ? (
                <button
                  type="button"
                  disabled={nameCooldownSeconds > 0}
                  onClick={() => setIsEditingName(true)}
                  title={nameCooldownSeconds > 0 ? interpolate(text.nameCooldown, { minutes: nameCooldownMinutes }) : text.nameAction}
                  className="border border-line px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {text.nameAction}{nameCooldownSeconds > 0 ? ` · ${interpolate(text.nameCooldownShort, { minutes: nameCooldownMinutes })}` : ''}
                </button>
              ) : null}
              <button type="button" onClick={() => { setIsOpen(false); setIsPanelEngaged(false); }} aria-label={text.minimize} title={text.minimize} className="grid h-7 w-7 place-items-center border border-line text-lg leading-none text-slate-300 hover:border-cyan-300/70 hover:text-white">−</button>
            </div>
          </header>

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {isLoadingOlder ? <p className="py-2 text-center text-[11px] text-slate-500">{text.loading}</p> : null}
            {!hasMore && messages.length > 0 ? <p className="py-2 text-center text-[11px] text-slate-500">{text.earliest}</p> : null}
            {isLoading && messages.length === 0 ? <p className="py-8 text-center text-xs text-slate-400">{text.loading}</p> : null}
            {!isLoading && !messageLoadFailed && messages.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <img
                  src={xiezhiMascotPoses.play}
                  alt=""
                  aria-hidden="true"
                  className="h-20 w-auto object-contain [image-rendering:pixelated]"
                />
                <p className="mt-2 text-xs text-slate-500">{text.empty}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              {datedMessages.map(({ message, showDate }) => (
                <div key={message.id}>
                  {showDate ? (
                    <div className="my-3 flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="h-px flex-1 bg-line/60" />
                      <span>{formatChatDate(message.created_at)}</span>
                      <span className="h-px flex-1 bg-line/60" />
                    </div>
                  ) : null}
                  <article
                    id={`chat-message-${message.id}`}
                    className={`group border px-3 py-2 transition ${highlightedMessageId === message.id ? 'border-pink-300/80 bg-pink-300/10' : message.visibility_state === 'visible' ? 'border-transparent bg-white/[0.025] hover:border-line/80' : 'border-amber-300/20 bg-amber-300/[0.04]'}`}
                  >
                    {message.visibility_state === 'visible' && message.reply_to_message_id ? (
                      <button
                        type="button"
                        onClick={() => jumpToReply(message.reply_to_message_id)}
                        className="mb-1 block max-w-full truncate text-left text-[10px] text-cyan-300/80 hover:text-cyan-200"
                      >
                        ↪ {message.reply_state === 'removed' ? text.removed : `${message.reply_to_display_name_snapshot}（#${message.reply_to_public_code_snapshot}）：${message.reply_to_body_snapshot}`}
                      </button>
                    ) : null}
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-semibold text-slate-200">
                        {message.display_name_snapshot} <span className="font-normal text-slate-500">（#{message.public_code_snapshot}）</span>
                      </p>
                      <time className="shrink-0 text-[10px] text-slate-500">{formatChatTimestamp(message.created_at)}</time>
                    </div>
                    <p className={`mt-1 break-words text-sm leading-6 ${message.visibility_state === 'visible' ? 'text-slate-100' : 'italic text-amber-100/75'}`}>{visibleMessageBody(message, text)}</p>
                    {message.visibility_state === 'visible' ? (
                      <div className="mt-1 flex justify-end">
                        <button type="button" onClick={() => setReplyTo(message)} className="text-[10px] text-slate-500 hover:text-cyan-200">{text.reply}</button>
                      </div>
                    ) : null}
                  </article>
                </div>
              ))}
            </div>
          </div>

          <footer className="border-t border-cyan-300/20 bg-[#050b16] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {realtimeStatus !== 'SUBSCRIBED' && !isLoading && !postingUnavailable ? <p className="mb-2 text-[10px] text-amber-200/80">{text.reconnecting}</p> : null}
            {error ? <p role="alert" className="mb-2 border-l-2 border-pink-400 bg-pink-400/10 px-2 py-1 text-[11px] text-pink-100">{error}</p> : null}

            {postingUnavailable ? (
              <p className="border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100">{text.postingUnavailable}</p>
            ) : profileBanned || profileMuted ? (
              <div className="border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100">
                {profileBanned
                  ? text.banned
                  : profile?.muted_until
                    ? interpolate(text.muted, { time: formatChatTimestamp(profile.muted_until) })
                    : text.mutedUnknown}
              </div>
            ) : isEditingName || !profile || needsTerms ? (
              <form onSubmit={handleProfileSubmit} className="space-y-2">
                <div>
                  <p className="font-display text-xs text-white">{profile ? text.nameEditTitle : text.nameTitle}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{text.identityNote}</p>
                </div>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(limitChatInput(event.target.value, 12))}
                  placeholder={text.namePlaceholder}
                  aria-label={text.nameTitle}
                  className="w-full border border-line bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/70"
                />
                {needsTerms ? (
                  <label className="flex cursor-pointer items-start gap-2 border border-amber-300/25 bg-amber-300/[0.06] p-2 text-[11px] leading-5 text-slate-300">
                    <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 accent-cyan-300" />
                    <span>{text.responsibility}</span>
                  </label>
                ) : null}
                <details className="text-[10px] text-slate-500">
                  <summary className="cursor-pointer text-cyan-300/80">{text.rules}</summary>
                  <p className="mt-1 leading-5">{text.privacy}</p>
                </details>
                {nameChangeBlocked ? (
                  <p className="text-[10px] text-amber-200/80">{interpolate(text.nameCooldown, { minutes: nameCooldownMinutes })}</p>
                ) : null}
                <div className="flex justify-end gap-2">
                  {profile && !needsTerms ? <button type="button" onClick={() => { setDisplayName(profile.current_display_name); setIsEditingName(false); }} className="px-3 py-2 text-xs text-slate-400 hover:text-white">{text.cancel}</button> : null}
                  <button
                    type="submit"
                    disabled={isSavingProfile || nameChangeBlocked || countChatCharacters(displayName.trim()) < 2 || (needsTerms && !acceptedTerms)}
                    className="border border-cyan-300/60 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSavingProfile ? text.saving : profile ? text.updateName : text.saveName}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMessageSubmit}>
                {replyTo ? (
                  <div className="mb-2 flex items-center justify-between gap-2 border-l-2 border-cyan-300 bg-cyan-300/[0.06] px-2 py-1 text-[10px] text-slate-300">
                    <span className="truncate">{interpolate(text.replyingTo, { name: replyTo.display_name_snapshot, code: replyTo.public_code_snapshot })}：{replyTo.body}</span>
                    <button type="button" onClick={() => setReplyTo(null)} aria-label={text.cancelReply} className="shrink-0 text-slate-500 hover:text-white">×</button>
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      value={body}
                      onChange={(event) => setBody(limitChatInput(event.target.value))}
                      placeholder={text.composerPlaceholder}
                      aria-label={text.composerPlaceholder}
                      className="w-full border border-line bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/70"
                    />
                    <div className="mt-1 flex min-h-4 justify-between text-[10px]">
                      <span className="text-amber-200/80">{cooldownSeconds > 0 ? interpolate(text.cooldown, { seconds: cooldownSeconds }) : ''}</span>
                      <span className={characterCount >= 48 ? 'text-pink-300' : 'text-slate-500'}>{characterCount >= 40 ? `${characterCount} / 50` : ''}</span>
                    </div>
                  </div>
                  <button type="submit" disabled={!canSend} className="mb-5 border border-cyan-300/60 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
                    {isSending ? text.sending : text.send}
                  </button>
                </div>
              </form>
            )}
          </footer>
        </section>
      ) : null}
    </>
  );
}
