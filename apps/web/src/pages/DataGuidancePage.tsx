import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { xiezhiMascotPoses } from '../data/defaultCharacterAssets';
import { useI18n } from '../i18n';
import { updatesPath } from '../routes/routePaths';

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

const publicUpdateFlowKeys = [
  'dataGuidance.updateCollect',
  'dataGuidance.updateReview',
  'dataGuidance.updatePublish',
] as const;

const sourceLinks = [
  {
    labelKey: 'dataGuidance.sourceCecLabel',
    descriptionKey: 'dataGuidance.sourceCecDescription',
    kindKey: 'dataGuidance.sourceOfficial',
    href: 'https://db.cec.gov.tw/',
  },
  {
    labelKey: 'dataGuidance.sourceLegislatureLabel',
    descriptionKey: 'dataGuidance.sourceLegislatureDescription',
    kindKey: 'dataGuidance.sourceOfficial',
    href: 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=109',
  },
  {
    labelKey: 'dataGuidance.sourcePartyRegistryLabel',
    descriptionKey: 'dataGuidance.sourcePartyRegistryDescription',
    kindKey: 'dataGuidance.sourceOfficial',
    href: 'https://party.moi.gov.tw/',
  },
  {
    labelKey: 'dataGuidance.sourceDonationLabel',
    descriptionKey: 'dataGuidance.sourceDonationDescription',
    kindKey: 'dataGuidance.sourceOfficial',
    href: 'https://ardata.cy.gov.tw/home',
  },
  {
    labelKey: 'dataGuidance.sourceReportLabel',
    descriptionKey: 'dataGuidance.sourceReportDescription',
    kindKey: 'dataGuidance.sourceOfficial',
    href: 'https://data.gov.tw/dataset/175227',
  },
  {
    labelKey: 'dataGuidance.sourceJudicialLabel',
    descriptionKey: 'dataGuidance.sourceJudicialDescription',
    kindKey: 'dataGuidance.sourceOfficial',
    href: 'https://opendata.judicial.gov.tw/api/',
  },
  {
    labelKey: 'dataGuidance.sourceVoteTwLabel',
    descriptionKey: 'dataGuidance.sourceVoteTwDescription',
    kindKey: 'dataGuidance.sourceCommunity',
    href: 'https://www.votetw.com/data/',
  },
  {
    labelKey: 'dataGuidance.sourceWikidataLabel',
    descriptionKey: 'dataGuidance.sourceWikidataDescription',
    kindKey: 'dataGuidance.sourceCommunity',
    href: 'https://www.wikidata.org/wiki/Wikidata:WikiProject_Taiwan/Politics/Politician_List',
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

        <SectionPanel title={t('dataGuidance.mascotTitle')} eyebrow={t('dataGuidance.mascotEyebrow')}>
          <div className="grid items-center gap-4 sm:grid-cols-[128px_minmax(0,1fr)]">
            <div className="flex justify-center">
              <img
                src={xiezhiMascotPoses.idle}
                alt={t('dataGuidance.mascotName')}
                className="h-32 w-auto object-contain [image-rendering:pixelated]"
              />
            </div>
            <div>
              <h3 className="font-display text-xl text-white">{t('dataGuidance.mascotName')}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{t('dataGuidance.mascotDescription')}</p>
            </div>
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

        <SectionPanel title={t('dataGuidance.updatesTitle')} eyebrow={t('dataGuidance.updatesEyebrow')}>
          <p className="max-w-4xl text-sm leading-6 text-slate-300">{t('dataGuidance.updatesDescription')}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {publicUpdateFlowKeys.map((key, index) => (
              <article key={key} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                <p className="font-display text-sm text-accent">0{index + 1}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t(key)}</p>
              </article>
            ))}
          </div>
          <Link
            to={updatesPath()}
            className="mt-4 inline-flex border border-accent/45 bg-accent/10 px-4 py-2 text-sm text-accent transition hover:border-accent hover:text-white"
          >
            {t('dataGuidance.viewUpdates')} →
          </Link>
        </SectionPanel>

        <SectionPanel title={t('dataGuidance.donationTitle')} eyebrow={t('dataGuidance.donationEyebrow')}>
          <div className="grid gap-3 text-sm leading-6 text-slate-300 lg:grid-cols-3">
            {(['dataGuidance.donationBoundary', 'dataGuidance.donationCompany', 'dataGuidance.donationSources'] as const).map((key) => (
              <p key={key} className="pixel-corners border border-line/70 bg-bg/35 p-4">{t(key)}</p>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel title={t('dataGuidance.sourcesTitle')} eyebrow={t('dataGuidance.sourcesEyebrow')}>
          <p className="mb-4 max-w-4xl text-sm leading-6 text-slate-300">{t('dataGuidance.sourcesThanks')}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {sourceLinks.map((source) => (
              <a
                key={source.href}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="pixel-corners border border-line/70 bg-bg/35 p-4 transition hover:border-accent/55"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-accent">{t(source.kindKey)}</p>
                <h3 className="mt-2 font-display text-lg text-white">{t(source.labelKey)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t(source.descriptionKey)}</p>
              </a>
            ))}
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
