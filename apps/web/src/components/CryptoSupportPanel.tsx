import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { availableSupportNetworks, type SupportNetwork, type SupportValidationError } from '../config/cryptoSupport';
import { useI18n, type TranslationKey } from '../i18n';
import { CryptoSupportError, submitCryptoSupport } from '../lib/cryptoSupportClient';
import { SectionPanel } from './SectionPanel';

function newRequestId() {
  return crypto.randomUUID();
}

function inputError(field: SupportValidationError | undefined): TranslationKey {
  if (field === 'network') return 'support.form.networkError';
  if (field === 'recipient') return 'support.form.referenceRecipientError';
  if (field === 'nickname') return 'support.form.nicknameError';
  if (field === 'message') return 'support.form.messageError';
  return 'support.form.referenceError';
}

const supportErrorKey: Record<string, TranslationKey> = {
  SUPPORT_RATE_LIMITED: 'support.form.SUPPORT_RATE_LIMITED',
  SUPPORT_UNAVAILABLE: 'support.form.SUPPORT_UNAVAILABLE',
  SUPPORT_REQUEST_CONFLICT: 'support.form.SUPPORT_REQUEST_CONFLICT',
  PARTICIPATION_CHALLENGE_REQUIRED: 'support.form.PARTICIPATION_CHALLENGE_REQUIRED',
};

export function CryptoSupportPanel({
  networks = availableSupportNetworks(),
}: {
  /** Used by isolated browser fixtures; the page itself supplies trusted config only. */
  networks?: readonly SupportNetwork[];
}) {
  const { t } = useI18n();
  const [networkId, setNetworkId] = useState(networks[0]?.networkId ?? '');
  const [reference, setReference] = useState('');
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(newRequestId);
  const [qrCode, setQrCode] = useState<{ address: string; dataUrl: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const copyGeneration = useRef(0);

  const selected = useMemo(
    () => networks.find((network) => network.networkId === networkId) ?? networks[0] ?? null,
    [networkId, networks],
  );

  useEffect(() => {
    if (selected && selected.networkId !== networkId) setNetworkId(selected.networkId);
  }, [networkId, selected]);

  useEffect(() => {
    let active = true;
    setQrCode(null);
    if (!selected) return () => { active = false; };
    const address = selected.address;
    void QRCode.toDataURL(address, { errorCorrectionLevel: 'M', margin: 4, width: 192 })
      .then((value) => { if (active) setQrCode({ address, dataUrl: value }); })
      .catch(() => { if (active) setQrCode(null); });
    return () => { active = false; };
  }, [selected]);

  function changed(setter: (value: string) => void, value: string) {
    setter(value);
    setRequestId(newRequestId());
    setError(null);
    setSavedId(null);
  }

  function selectNetwork(nextNetworkId: string) {
    if (savingRef.current || nextNetworkId === networkId) return;
    copyGeneration.current++;
    setNetworkId(nextNetworkId);
    setReference('');
    setNickname('');
    setMessage('');
    setRequestId(newRequestId());
    setCopyStatus('idle');
    setError(null);
    setSavedId(null);
  }

  async function copyAddress() {
    if (!selected) return;
    const address = selected.address;
    const generation = ++copyGeneration.current;
    try {
      await navigator.clipboard.writeText(address);
      if (copyGeneration.current === generation) setCopyStatus('copied');
    } catch {
      if (copyGeneration.current === generation) setCopyStatus('failed');
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setSavedId(null);
    try {
      const result = await submitCryptoSupport({
        requestId,
        networkId: selected.networkId,
        receivingAddress: selected.address,
        reference: reference.trim(),
        nickname: nickname.trim() || undefined,
        message: message.trim() || undefined,
      }, networks);
      setSavedId(result.id);
      setReference('');
      setNickname('');
      setMessage('');
      setRequestId(newRequestId());
    } catch (caught) {
      if (caught instanceof CryptoSupportError) {
        setError(t(caught.code === 'SUPPORT_INVALID' ? inputError(caught.field) : supportErrorKey[caught.code] ?? 'support.form.SUPPORT_UNAVAILABLE'));
      } else {
        setError(t('support.form.SUPPORT_UNAVAILABLE'));
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!selected) {
    return (
      <SectionPanel title={t('support.cryptoTitle')} eyebrow={t('support.cryptoEyebrow')}>
        <p className="text-sm leading-7 text-slate-300">{t('support.cryptoPreparing')}</p>
      </SectionPanel>
    );
  }

  return (
    <section className="space-y-3" aria-label={t('support.cryptoTitle')}>
      <p className="px-1 text-sm leading-7 text-slate-300">{t('support.otherMethods')}</p>
      <SectionPanel title={t('support.cryptoTitle')}>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0 space-y-4">
          <h4 className="font-display text-lg text-white">{t('support.cryptoEyebrow')}</h4>
          <label className="grid max-w-xl gap-2 text-sm text-slate-300">
            <span>{t('support.networkLabel')}</span>
            <select
              aria-label={t('support.networkLabel')}
              value={selected.networkId}
              disabled={saving || networks.length === 1}
              onChange={(event) => selectNetwork(event.target.value)}
              className="border border-line/70 bg-bg/70 px-3 py-3 text-white outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-75"
            >
              {networks.map((network) => <option key={network.networkId} value={network.networkId}>{network.displayName}</option>)}
            </select>
          </label>
          <div className="min-w-0 space-y-3">
            <label className="grid gap-2 text-sm text-slate-300">
              <span>{t('support.receivingAddress')}</span>
              <textarea aria-label={t('support.receivingAddress')} readOnly rows={2} value={selected.address} className="block w-full min-w-0 resize-none break-all border border-line/70 bg-bg/70 px-3 py-2 font-mono text-sm leading-5 text-white outline-none focus:border-accent" />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={saving} onClick={() => void copyAddress()} className="pixel-corners border border-accent/55 bg-accent/8 px-3 py-2 text-sm font-semibold text-accent hover:border-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-70">
                {t('support.copyAddress')}
              </button>
              {copyStatus === 'copied' ? <p role="status" className="text-xs text-success">{t('support.copySuccess')}</p> : null}
              {copyStatus === 'failed' ? <p role="status" className="text-xs text-slate-300">{t('support.copyFailed')}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-4 border-t border-line/60 pt-4">
            <div className="shrink-0 border border-line/70 bg-bg/50 p-2">
              {qrCode?.address === selected.address ? <img src={qrCode.dataUrl} alt={t('support.qrAlt', { network: selected.displayName })} width={128} height={128} className="h-32 w-32" /> : <div className="h-32 w-32" aria-label={t('support.qrLoading')} />}
            </div>
            <div className="min-w-0 flex-1 basis-40 space-y-2">
              <p className="text-sm font-semibold text-white">{selected.displayName}</p>
              <p className="text-xs leading-6 text-signal">{t('support.networkWarning')}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 border-t border-line/60 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <header className="mb-4 flex flex-wrap items-center gap-3">
            <h4 className="font-display text-lg text-white">{t('support.formTitle')}</h4>
            <span className="border border-line/70 px-2 py-0.5 text-xs text-slate-400">{t('support.formEyebrow')}</span>
          </header>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <fieldset disabled={saving} className="space-y-4 disabled:opacity-75">
          <p className="text-sm leading-6 text-slate-300">{t('support.formDescription')}</p>
          <p className="text-xs leading-5 text-slate-400">{t('support.formPrivacy')}</p>
          <label className="grid gap-2 text-sm text-slate-300">
            <span>{t('support.form.referenceLabel')}</span>
            <input aria-label={t('support.form.referenceLabel')} required maxLength={256} value={reference} onChange={(event) => changed(setReference, event.target.value)} aria-describedby="support-reference-help" className="border border-line/70 bg-bg/70 px-3 py-3 font-mono text-base text-white outline-none focus:border-accent" />
            <span id="support-reference-help" className="text-xs leading-5 text-slate-400">{t('support.form.referenceHelp')}</span>
            <span className="text-xs leading-5 text-slate-400">{t('support.form.binanceHelp')}</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              <span>{t('support.form.nicknameLabel')}</span>
              <input maxLength={50} value={nickname} onChange={(event) => changed(setNickname, event.target.value)} className="border border-line/70 bg-bg/70 px-3 py-3 text-base text-white outline-none focus:border-accent" />
            </label>
            <label className="grid gap-2 text-sm text-slate-300 sm:col-span-2">
              <span>{t('support.form.messageLabel')}</span>
              <textarea maxLength={2000} rows={4} value={message} onChange={(event) => changed(setMessage, event.target.value)} className="resize-y border border-line/70 bg-bg/70 px-3 py-3 text-base text-white outline-none focus:border-accent" />
            </label>
          </div>
          {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
          {savedId ? <p role="status" className="text-sm text-success">{t('support.form.success')}</p> : null}
          <button type="submit" disabled={saving} className="pixel-corners border border-signal/55 bg-signal/10 px-4 py-3 text-sm font-semibold text-signal hover:border-signal hover:text-white disabled:cursor-not-allowed disabled:opacity-70">
            {saving ? t('support.form.saving') : t('support.form.submit')}
          </button>
          </fieldset>
        </form>
        </div>
        </div>
      </SectionPanel>
    </section>
  );
}
