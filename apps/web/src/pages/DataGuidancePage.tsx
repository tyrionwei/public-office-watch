import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';

const principleKeys = [
  'dataGuidance.principlePublic',
  'dataGuidance.principleReview',
  'dataGuidance.principleDistrict',
  'dataGuidance.principlePublicViews',
  'dataGuidance.principleNeutral',
] as const;

const confidenceLevels = [
  ['A', 'dataGuidance.confidenceA'],
  ['B', 'dataGuidance.confidenceB'],
  ['C', 'dataGuidance.confidenceC'],
  ['D', 'dataGuidance.confidenceD'],
] as const;

const sourceLinks = [
  {
    labelKey: 'dataGuidance.sourceDonationLabel',
    descriptionKey: 'dataGuidance.sourceDonationDescription',
    href: 'https://ardata.cy.gov.tw/home',
  },
  {
    labelKey: 'dataGuidance.sourceReportLabel',
    descriptionKey: 'dataGuidance.sourceReportDescription',
    href: 'https://data.gov.tw/dataset/175227',
  },
  {
    labelKey: 'dataGuidance.sourceJudicialLabel',
    descriptionKey: 'dataGuidance.sourceJudicialDescription',
    href: 'https://opendata.judicial.gov.tw/api/',
  },
] as const;

export function DataGuidancePage() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title={t('dataGuidance.frameTitle')}>
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">{t('dataGuidance.eyebrow')}</p>
            <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{t('dataGuidance.heading')}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{t('dataGuidance.description')}</p>
          </div>
        </PixelFrame>

        <SectionPanel title={t('dataGuidance.principlesTitle')} eyebrow={t('dataGuidance.principlesEyebrow')}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {principleKeys.map((key) => (
              <p key={key} className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                {t(key)}
              </p>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title={t('dataGuidance.confidenceTitle')} eyebrow={t('dataGuidance.confidenceEyebrow')}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {confidenceLevels.map(([level, descriptionKey]) => (
              <article key={level} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                <p className="font-display text-3xl text-signal">{level}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{t(descriptionKey)}</p>
              </article>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title={t('dataGuidance.donationTitle')} eyebrow={t('dataGuidance.donationEyebrow')}>
          <div className="grid gap-3 text-sm leading-6 text-slate-300 lg:grid-cols-3">
            {(['dataGuidance.donationBoundary', 'dataGuidance.donationCompany', 'dataGuidance.donationSources'] as const).map((key) => (
              <p key={key} className="pixel-corners border border-line/70 bg-bg/35 p-4">{t(key)}</p>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title={t('dataGuidance.sourcesTitle')} eyebrow={t('dataGuidance.sourcesEyebrow')}>
          <div className="grid gap-3 md:grid-cols-3">
            {sourceLinks.map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="pixel-corners border border-line/70 bg-bg/35 p-4 transition hover:border-accent/55"
              >
                <h3 className="font-display text-lg text-white">{t(source.labelKey)}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{t(source.descriptionKey)}</p>
              </a>
            ))}
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
