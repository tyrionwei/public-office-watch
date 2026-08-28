import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';
import { peoplePath, supportPath } from '../routes/routePaths';

const roadmapStages = [
  {
    titleKey: 'about.roadmapCompletedTitle',
    itemKeys: [
      'about.roadmapCompletedMap',
      'about.roadmapCompletedBrowse',
      'about.roadmapCompletedFeedback',
    ],
    markerClassName: 'bg-signal',
  },
  {
    titleKey: 'about.roadmapCurrentTitle',
    itemKeys: [
      'about.roadmapCurrentOffices',
      'about.roadmapCurrentIdentity',
      'about.roadmapCurrentDesktop',
      'about.roadmapCurrentSprites',
    ],
    markerClassName: 'bg-accent',
  },
  {
    titleKey: 'about.roadmapNextTitle',
    itemKeys: [
      'about.roadmapNextRegions',
      'about.roadmapNextCompare',
      'about.roadmapNextIssues',
    ],
    markerClassName: 'bg-yellow-300',
  },
  {
    titleKey: 'about.roadmapLaterTitle',
    itemKeys: [
      'about.roadmapLaterCandidates',
      'about.roadmapLaterDonations',
      'about.roadmapLaterMobile',
    ],
    markerClassName: 'bg-slate-400',
  },
] satisfies Array<{
  titleKey: TranslationKey;
  itemKeys: TranslationKey[];
  markerClassName: string;
}>;

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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(['about.progressMap', 'about.progressData', 'about.progressBoundary', 'about.progressUpdates'] as const).map((key) => (
              <p key={key} className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                {t(key)}
              </p>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title={t('about.supportTitle')} eyebrow={t('about.supportEyebrow')}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="pixel-corners border border-signal/45 bg-signal/8 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-signal">{t('about.donationEyebrow')}</p>
              <h3 className="mt-2 font-display text-xl text-white">{t('about.donationTitle')}</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{t('about.donationDescription')}</p>
              <Link
                to={supportPath()}
                className="pixel-corners mt-4 inline-flex border border-signal/55 bg-bg/45 px-3 py-2 text-sm text-signal transition hover:border-signal hover:text-white"
              >
                {t('about.donationAction')}
              </Link>
            </div>

            <Link
              to={peoplePath()}
              className="pixel-corners flex min-h-32 flex-col justify-center border border-line/70 bg-bg/35 px-5 py-4 text-sm text-white transition hover:border-accent/55 hover:text-accent lg:h-full"
            >
              <span className="block font-display text-base">{t('about.supportDataTitle')}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">{t('about.supportDataDescription')}</span>
            </Link>
          </div>
        </SectionPanel>

        <SectionPanel title={t('about.openSourceTitle')} eyebrow={t('about.openSourceEyebrow')}>
          <p className="max-w-4xl text-sm leading-6 text-slate-300">{t('about.openSourceDescription')}</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <a
              href="https://github.com/tyrionwei/public-office-watch"
              target="_blank"
              rel="noreferrer"
              className="pixel-corners border border-accent/45 bg-accent/8 p-5 text-sm text-white transition hover:border-accent hover:text-accent"
            >
              <span className="block font-display text-base">{t('about.openSourceCodeTitle')}</span>
              <span className="mt-2 block leading-6 text-slate-300">{t('about.openSourceCodeDescription')}</span>
              <span className="mt-4 inline-flex border border-accent/45 bg-bg/45 px-3 py-2 text-xs text-accent">
                {t('about.openSourceCodeAction')}
              </span>
            </a>
            <article className="pixel-corners border border-line/70 bg-bg/35 p-5">
              <h3 className="font-display text-base text-white">{t('about.openSourceCodexTitle')}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{t('about.openSourceCodexDescription')}</p>
            </article>
            <article className="pixel-corners border border-line/70 bg-bg/35 p-5">
              <h3 className="font-display text-base text-white">{t('about.openSourceReviewTitle')}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{t('about.openSourceReviewDescription')}</p>
            </article>
          </div>
        </SectionPanel>

        <div id="roadmap" className="scroll-mt-6">
          <SectionPanel title={t('about.roadmapTitle')} eyebrow={t('about.roadmapEyebrow')}>
            <p className="max-w-4xl text-sm leading-6 text-slate-300">{t('about.roadmapDescription')}</p>
            <div className="mt-5 grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
              {roadmapStages.map((stage) => (
                <article key={stage.titleKey} className="border-t border-line/70 pt-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 ${stage.markerClassName}`} aria-hidden="true" />
                    <h4 className="font-display text-base text-white">{t(stage.titleKey)}</h4>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {stage.itemKeys.map((itemKey) => (
                      <li key={itemKey} className="flex gap-2 text-sm leading-6 text-slate-300">
                        <span className={`mt-2.5 h-1.5 w-1.5 shrink-0 ${stage.markerClassName}`} aria-hidden="true" />
                        <span>{t(itemKey)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </SectionPanel>
        </div>
      </div>
    </AppShell>
  );
}
