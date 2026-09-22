import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';

const statuses = ['indicted', 'deferred', 'nonFinal', 'final', 'finalityUnknown', 'other'] as const;

export function LegalStatusHelp() {
  const { t } = useI18n();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const close = () => setPosition(null);
  const show = () => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(320, window.innerWidth - 32);
    setPosition({ top: Math.max(16, Math.min(rect.bottom - 1, window.innerHeight - 360)), left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)), width });
  };
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss);
    return () => { window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss); };
  }, [position]);
  const leave = (target: EventTarget | null) => {
    if (target instanceof Node && (button.current?.contains(target) || tooltip.current?.contains(target))) return;
    if (document.activeElement !== button.current) close();
  };
  return (
    <>
      <button ref={button} type="button" aria-label={t('person.legal.helpLabel')} aria-describedby={position ? id : undefined}
        onMouseEnter={show} onMouseLeave={event => leave(event.relatedTarget)} onFocus={show} onBlur={close} onClick={show}
        onKeyDown={event => { if (event.key === 'Escape') close(); }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/60 text-sm font-bold text-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span aria-hidden="true">!</span>
      </button>
      {position ? createPortal(
        <div ref={tooltip} id={id} role="tooltip" onMouseLeave={event => leave(event.relatedTarget)}
          className="fixed z-50 overflow-y-auto rounded border border-line bg-panel p-4 text-xs leading-5 text-slate-200 shadow-xl"
          style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 16}px)` }}>
          <dl className="space-y-2">
            {statuses.map(status => <div key={status}>
              <dt className="font-semibold text-white">{t(`person.legal.status.${status}`)}</dt>
              <dd>{t(`person.legal.help.${status}`)}</dd>
            </div>)}
          </dl>
          <p className="mt-3 border-t border-line pt-2">{t('person.legal.help.result')}</p>
        </div>, document.body,
      ) : null}
    </>
  );
}
