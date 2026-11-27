import { oenSupportUrl } from '../config/oenSupport';
import { useI18n } from '../i18n';
import { SectionPanel } from './SectionPanel';

export function OenSupportPanel() {
  const { t } = useI18n();

  return (
    <SectionPanel title={t('support.oenTitle')} eyebrow={t('support.oenEyebrow')}>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 space-y-2">
          <p className="font-display text-xl text-accent">{t('support.oenAmount')}</p>
          <p className="text-sm leading-7 text-slate-300">{t('support.oenMethods')}</p>
          <p id="oen-support-notice" className="text-sm leading-7 text-slate-300">{t('support.oenNotice')}</p>
        </div>
        <a
          href={oenSupportUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby="oen-support-notice"
          className="pixel-corners inline-flex min-h-12 items-center justify-center gap-2 border border-accent bg-accent px-5 py-3 text-center font-display text-sm text-bg hover:underline hover:decoration-2 hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-bg"
        >
          <span>{t('support.oenAction')}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </SectionPanel>
  );
}
