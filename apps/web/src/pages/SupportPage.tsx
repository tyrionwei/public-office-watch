import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';

const supportEmail = 'support@pow4vote.org';

export function SupportPage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title={t('support.frameTitle')}>
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.22em] text-signal">{t('support.eyebrow')}</p>
            <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{t('support.heading')}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t('support.description')}</p>
          </div>
        </PixelFrame>

        <SectionPanel title={t('support.preparingTitle')} eyebrow={t('support.preparingEyebrow')}>
          <div className="pixel-corners border border-signal/45 bg-signal/8 p-5">
            <p className="font-display text-xl text-white">{t('support.preparingStatus')}</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              {t('support.preparingDescription')}
            </p>
          </div>
        </SectionPanel>

        <div className="grid gap-3 xl:grid-cols-2">
          <SectionPanel title={t('support.usesTitle')} eyebrow={t('support.usesEyebrow')}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {([
                'support.useHosting',
                'support.useDatabase',
                'support.useData',
                'support.useDevelopment',
                'support.useSources',
                'support.useAdministration',
              ] as const).map((key) => (
                <li key={key} className="flex gap-3 border-t border-line/60 pt-3 text-sm leading-6 text-slate-300">
                  <span className="mt-2 h-2 w-2 shrink-0 bg-signal" aria-hidden="true" />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </SectionPanel>

          <SectionPanel title={t('support.independenceTitle')} eyebrow={t('support.independenceEyebrow')}>
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p>{t('support.independenceDescription')}</p>
              <p>{t('support.noInfluence')}</p>
              <p>{t('support.noTaxDeduction')}</p>
            </div>
          </SectionPanel>
        </div>

        <SectionPanel title={t('support.contactTitle')} eyebrow={t('support.contactEyebrow')}>
          <p className="text-sm leading-7 text-slate-300">{t('support.contactDescription')}</p>
          <a
            href={`mailto:${supportEmail}`}
            className="pixel-corners mt-4 inline-flex border border-accent/55 bg-accent/8 px-4 py-3 font-display text-sm text-accent transition hover:border-accent hover:text-white"
          >
            {supportEmail}
          </a>
          <p className="mt-3 text-xs leading-5 text-slate-400">{t('support.responseTime')}</p>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
