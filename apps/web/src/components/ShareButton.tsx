import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { createShareCardFile } from '../lib/shareImage';
import { buildLineShareUrl, shareClipboardText } from '../lib/socialSharing';

type ShareButtonProps = {
  title: string;
  text: string;
  url: string;
  imageEyebrow: string;
  imageBody: string;
  imageAlt: string;
  imageFileName: string;
  className?: string;
};

type ActionStatus = 'idle' | 'copied-text' | 'copied-image' | 'copy-image-error' | 'downloaded-image' | 'error';

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function downloadFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function canShareFile(file: File | null) {
  if (!file || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function ShareButton({
  title,
  text,
  url,
  imageEyebrow,
  imageBody,
  imageAlt,
  imageFileName,
  className = '',
}: ShareButtonProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [editableText, setEditableText] = useState(text);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [status, setStatus] = useState<ActionStatus>('idle');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let generatedPreviewUrl: string | null = null;
    setShareFile(null);
    setPreviewUrl(null);
    setImageError(false);
    setImageLoading(true);
    void createShareCardFile({
      eyebrow: imageEyebrow,
      title,
      body: imageBody,
      footer: t('share.cardFooter'),
      url,
    }, imageFileName)
      .then((file) => {
        if (!active) return;
        generatedPreviewUrl = URL.createObjectURL(file);
        setShareFile(file);
        setPreviewUrl(generatedPreviewUrl);
      })
      .catch(() => {
        if (active) setImageError(true);
      })
      .finally(() => {
        if (active) setImageLoading(false);
      });

    return () => {
      active = false;
      if (generatedPreviewUrl) URL.revokeObjectURL(generatedPreviewUrl);
    };
  }, [imageBody, imageEyebrow, imageFileName, isOpen, t, title, url]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerRef.current;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);

  function openPreview() {
    setEditableText(text);
    setStatus('idle');
    setIsOpen(true);
  }

  async function copyTextAndLink() {
    try {
      await navigator.clipboard.writeText(shareClipboardText(editableText, url));
      setStatus('copied-text');
    } catch {
      setStatus('error');
    }
  }

  async function copyImage() {
    if (!shareFile) return;
    if (!navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
      setStatus('copy-image-error');
      return;
    }

    try {
      const imageBlob = shareFile.slice(0, shareFile.size, 'image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': imageBlob })]);
      setStatus('copied-image');
    } catch {
      setStatus('copy-image-error');
    }
  }

  function downloadImage() {
    if (!shareFile) return;
    downloadFile(shareFile);
    setStatus('downloaded-image');
  }


  async function shareTextAndLink() {
    if (!navigator.share) {
      await copyTextAndLink();
      return;
    }

    try {
      await navigator.share({ title, text: editableText, url });
    } catch (error: unknown) {
      if (!isAbortError(error)) setStatus('error');
    }
  }

  async function shareImage() {
    if (!shareFile) return;
    if (!canShareFile(shareFile) || !navigator.share) {
      await copyImage();
      return;
    }

    try {
      await navigator.share({ title, files: [shareFile] });
    } catch (error: unknown) {
      if (!isAbortError(error)) setStatus('error');
    }
  }

  const statusText = status === 'copied-text'
    ? t('share.copiedTextLink')
    : status === 'copied-image'
      ? t('share.copiedImage')
      : status === 'copy-image-error'
        ? t('share.copyImageError')
        : status === 'downloaded-image'
          ? t('share.downloadedImage')
          : status === 'error'
            ? t('share.error')
            : null;
  const lineShareUrl = buildLineShareUrl(editableText, url);
  const nativeShareAvailable = typeof navigator.share === 'function';
  const imageShareAvailable = canShareFile(shareFile);
  const actionClass = 'inline-flex min-h-10 items-center justify-center border border-accent/55 px-3 py-2 text-center text-xs text-accent transition hover:border-accent hover:bg-accent/10 hover:text-white disabled:cursor-wait disabled:opacity-45';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPreview}
        className={[
          'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 border border-accent/55 bg-accent/5 px-3 py-1.5 text-xs text-accent transition hover:border-accent hover:bg-accent/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/50',
          className,
        ].join(' ')}
        aria-label={t('share.action')}
      >
        <span aria-hidden="true">↗</span>
        {t('share.action')}
      </button>

      {isOpen ? createPortal(
        <>
          <button
            type="button"
            aria-label={t('share.close')}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[79] bg-black/70"
          />
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('share.previewTitle')}
            className="pixel-corners fixed inset-x-0 bottom-0 z-[80] max-h-[92dvh] overflow-y-auto border-2 border-cyan-300/70 bg-[#07101f] p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.65)] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,680px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-5"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">{imageEyebrow}</p>
                <h2 className="mt-1 font-display text-xl text-white">{t('share.previewTitle')}</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-8 w-8 place-items-center border border-line text-lg text-slate-300 hover:border-cyan-300/70 hover:text-white"
                aria-label={t('share.close')}
              >
                ×
              </button>
            </header>

            <p className="mt-3 text-xs leading-5 text-slate-400">{t('share.previewHelp')}</p>

            <div className="mt-4 overflow-hidden border border-line/70 bg-bg/60">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={imageAlt}
                  data-share-card-content={imageBody}
                  className="aspect-[1200/630] w-full object-contain"
                />
              ) : (
                <div className="grid aspect-[1200/630] place-items-center px-5 text-center text-sm text-slate-400">
                  {imageLoading ? t('share.generatingImage') : t('share.imageError')}
                </div>
              )}
            </div>

            <label className="mt-4 block">
              <span className="text-xs text-slate-400">{t('share.textLabel')}</span>
              <textarea
                value={editableText}
                onChange={(event) => setEditableText(event.target.value)}
                rows={3}
                className="mt-1 w-full resize-y border border-line bg-bg/70 px-3 py-2 text-sm leading-6 text-slate-100 focus:border-cyan-300 focus:outline-none"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-xs text-slate-400">{t('share.linkLabel')}</span>
              <input
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-1 w-full border border-line bg-bg/70 px-3 py-2 text-xs text-slate-300 focus:border-cyan-300 focus:outline-none"
              />
            </label>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a
                href={lineShareUrl}
                target="_blank"
                rel="noreferrer"
                className={actionClass}
              >
                {t('share.line')}
              </a>
              {nativeShareAvailable ? (
                <button type="button" onClick={() => void shareTextAndLink()} className={actionClass}>
                  {t('share.shareTextLink')}
                </button>
              ) : null}
              {nativeShareAvailable && imageShareAvailable ? (
                <button type="button" onClick={() => void shareImage()} className={actionClass}>
                  {t('share.shareImage')}
                </button>
              ) : null}
              <button type="button" onClick={() => void copyTextAndLink()} className={actionClass}>
                {t('share.copyTextLink')}
              </button>
              <button
                type="button"
                disabled={!shareFile || imageLoading || imageError}
                onClick={() => void copyImage()}
                className={actionClass}
              >
                {t('share.copyImage')}
              </button>
              <button
                type="button"
                disabled={!shareFile || imageLoading || imageError}
                onClick={downloadImage}
                className={actionClass}
              >
                {t('share.downloadImage')}
              </button>
            </div>

            {statusText ? <p className="mt-3 text-center text-xs text-cyan-200" role="status">{statusText}</p> : null}
          </section>
        </>,
        document.body,
      ) : null}
    </>
  );
}

