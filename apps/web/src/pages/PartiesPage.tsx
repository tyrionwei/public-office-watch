import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { partyPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function PartiesPage() {
  const { language, t } = useI18n();
  const parties = publicDataProvider.getParties();
  const summaries = parties
    .map((party) => {
      const latestFinance = publicDataProvider
        .getPartyFinanceSummaries(party.party_id)
        .slice()
        .sort((left, right) => right.report_year - left.report_year)[0];
      const companySummaries = publicDataProvider.getPartyCompanyContributionSummaries(party.party_id);

      return { party, latestFinance, companySummaries };
    })
    .filter((item) => item.latestFinance || item.companySummaries.length > 0)
    .sort((left, right) => (right.latestFinance?.income_total ?? 0) - (left.latestFinance?.income_total ?? 0));

  const totalIncome = summaries.reduce((sum, item) => sum + (item.latestFinance?.income_total ?? 0), 0);
  const totalBusinessDonations = summaries.reduce(
    (sum, item) => sum + (item.latestFinance?.business_donation_total ?? 0),
    0,
  );
  const companyRelationCount = summaries.reduce((sum, item) => sum + item.companySummaries.length, 0);
  const trackedPartyIds = new Set(summaries.map((item) => item.party.party_id));
  const sortedParties = parties
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, language));
  const untrackedPartyCount = Math.max(0, sortedParties.length - summaries.length);
  const currency = (value: number) => formatCurrency(value, language);

  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title={t('parties.frameTitle')}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-accent">{t('parties.eyebrow')}</p>
              <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{t('parties.heading')}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{t('parties.description')}</p>
            </div>
            <dl className="grid gap-3">
              <HudStatCard label={t('parties.trackedParties')} value={<span className="font-display text-2xl text-white">{summaries.length}</span>} />
              <HudStatCard label={t('parties.incomeTotal')} value={<span className="font-display text-2xl text-signal">{currency(totalIncome)}</span>} />
              <HudStatCard label={t('parties.companySummaryTotal')} value={<span className="font-display text-2xl text-white">{companyRelationCount}</span>} />
            </dl>
          </div>
        </PixelFrame>

        <SectionPanel title={t('parties.trackedTitle')} eyebrow={t('parties.trackedEyebrow')}>
          <div className="grid gap-3 lg:grid-cols-3">
            {summaries.map(({ party, latestFinance, companySummaries }) => {
              const theme = partyTheme[party.theme_key];
              return (
                <Link
                  key={party.party_id}
                  to={partyPath(party.slug)}
                  className="pixel-corners group border border-line/70 bg-bg/35 p-4 transition hover:border-accent/55 focus:outline-none focus:ring-2 focus:ring-accent/35"
                >
                  <div
                    className="mb-4 h-2 w-full"
                    style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})` }}
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{party.short_name ?? t('parties.partyFallback')}</p>
                      <h3 className="mt-2 font-display text-xl text-white group-hover:text-accent">{party.name}</h3>
                    </div>
                    <span
                      className="rounded-sm border bg-bg/85 px-2 py-1 text-xs font-semibold text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.04)]"
                      style={{ borderColor: theme.accent }}
                    >
                      {theme.label}
                    </span>
                  </div>

                  <dl className="mt-5 grid gap-2 text-sm text-slate-300">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">{t('parties.chairperson')}</dt>
                      <dd className="text-right">{party.chairperson_name ?? t('parties.registryPending')}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">{t('parties.founded')}</dt>
                      <dd className="text-right">{party.founded_date_text ?? t('parties.registryPending')}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">{t('parties.annualIncome')}</dt>
                      <dd>{latestFinance ? currency(latestFinance.income_total) : t('parties.awaitingData')}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">{t('parties.businessDonations')}</dt>
                      <dd>{latestFinance ? currency(latestFinance.business_donation_total) : t('parties.awaitingData')}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">{t('parties.companySummaries')}</dt>
                      <dd>{t('parties.recordCount', { count: companySummaries.length })}</dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        </SectionPanel>

        <SectionPanel title={t('parties.registryTitle')} eyebrow={t('parties.registryEyebrow')}>
          <details className="group pixel-corners border border-line/70 bg-bg/35">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-white marker:hidden">
              <span>{t('parties.registryAll')}</span>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500 group-open:hidden">
                {t('parties.registrySummary', { total: sortedParties.length, untracked: untrackedPartyCount })}
              </span>
              <span className="hidden text-xs uppercase tracking-[0.18em] text-slate-500 group-open:inline">
                {t('parties.registryCollapse')}
              </span>
            </summary>
            <div className="border-t border-line/60 p-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {sortedParties.map((party) => {
                  const theme = partyTheme[party.theme_key];
                  const isTracked = trackedPartyIds.has(party.party_id);

                  return (
                    <Link
                      key={party.party_id}
                      to={partyPath(party.slug)}
                      className="pixel-corners min-w-0 border border-line/60 bg-panelAlt/35 px-3 py-2 transition hover:border-accent/55 focus:outline-none focus:ring-2 focus:ring-accent/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{party.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{party.short_name ?? party.registry_no ?? t('parties.registryRecord')}</p>
                        </div>
                        <span
                          className="shrink-0 rounded-sm border px-2 py-1 text-[11px]"
                          style={{ borderColor: theme.accent, color: isTracked ? theme.text : '#94a3b8' }}
                        >
                          {isTracked ? t('parties.tracked') : theme.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </details>
        </SectionPanel>

        <SectionPanel title={t('parties.limitsTitle')} eyebrow={t('parties.limitsEyebrow')}>
          <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-3">
            {(['parties.limitSummary', 'parties.limitReview', 'parties.limitLicense'] as const).map((key) => (
              <p key={key} className="pixel-corners border border-line/70 bg-bg/35 p-4">{t(key)}</p>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {t('parties.businessDonationTotal', { amount: currency(totalBusinessDonations) })}
          </p>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
