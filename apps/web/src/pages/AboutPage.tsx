import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';

export function AboutPage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title={t('about.frameTitle')}>
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">{t('about.eyebrow')}</p>
            <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{t('about.heading')}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t('about.description')}</p>
          </div>
        </PixelFrame>

        <SectionPanel title={t('about.progressTitle')} eyebrow={t('about.progressEyebrow')}>
          <div className="grid gap-3 md:grid-cols-3">
            {(['about.progressMap', 'about.progressData', 'about.progressBoundary'] as const).map((key) => (
              <p key={key} className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                {t(key)}
              </p>
            ))}
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
