import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { isActiveCandidacy, translateCandidateStatus } from '../data/electionI18n';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { dataGuidancePath, partiesPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicParty, PublicPerson } from '../types/publicViews';

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

function matchesPartyLabel(value: string | null | undefined, party: PublicParty) {
  if (!value) {
    return false;
  }

  const labels = [party.name, party.short_name].filter((label): label is string => Boolean(label));
  return labels.some((label) => value === label || value.includes(label) || label.includes(value));
}

function isPublishedCandidate(candidate: PublicCandidate) {
  return isActiveCandidacy(candidate) || candidate.election_result === 'elected' || candidate.election_result === 'not_elected';
}

function isCurrentOfficeholder(person: PublicPerson) {
  return Boolean(person.position) && !person.position?.includes('候選人');
}

function PersonMiniCard({ person }: { person: PublicPerson }) {
  const { t } = useI18n();

  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{person.position ?? t('partyDetail.currentOffice')}</p>
      <h3 className="mt-2 font-display text-lg text-white">{person.name}</h3>
      <p className="mt-2 text-sm text-slate-400">{[person.district, person.election_year].filter(Boolean).join(' · ') || t('partyDetail.publicPerson')}</p>
    </article>
  );
}

function CandidateMiniCard({ candidate }: { candidate: PublicCandidate }) {
  const { t } = useI18n();

  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {translateCandidateStatus(candidate, t)}
      </p>
      <h3 className="mt-2 font-display text-lg text-white">{candidate.person_name}</h3>
      <p className="mt-2 text-sm text-slate-400">
        {[candidate.race_title, candidate.region_name, candidate.candidate_no ? `#${candidate.candidate_no}` : null]
          .filter(Boolean)
          .join(' · ') || t('partyDetail.publicCandidate')}
      </p>
    </article>
  );
}

export function PartyPage() {
  const { language, t } = useI18n();
  const { partySlug } = useParams();
  const party = publicDataProvider.getPartyBySlug(partySlug ?? '');
  const financeSummaries = party ? publicDataProvider.getPartyFinanceSummaries(party.party_id) : [];
  const companySummaries = party ? publicDataProvider.getPartyCompanyContributionSummaries(party.party_id) : [];
  const latestFinance = financeSummaries.slice().sort((left, right) => right.report_year - left.report_year)[0];
  const theme = party ? partyTheme[party.theme_key] : partyTheme.unknown;
  const officeholders = party
    ? publicDataProvider
        .getPeople()
        .filter((person) => matchesPartyLabel(person.party, party) && isCurrentOfficeholder(person))
    : [];
  const announcedCandidates = party
    ? publicDataProvider
        .getCandidates()
        .filter(
          (candidate) =>
            isPublishedCandidate(candidate) &&
            (matchesPartyLabel(candidate.party, party) || matchesPartyLabel(candidate.person_party, party)),
        )
    : [];
  const currency = (value: number) => formatCurrency(value, language);

  return (
    <AppShell>
      <PixelFrame
        title={t('partyDetail.frameTitle')}
        action={
          <Link to={partiesPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            {t('partyDetail.back')}
          </Link>
        }
      >
        {party ? (
          <div className="space-y-6">
            <section className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(11,19,38,0.94),rgba(15,24,46,0.88))] p-5">
              <div
                className="mb-5 h-2 w-full"
                style={{ background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})` }}
                aria-hidden="true"
              />
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('partyDetail.eyebrow')}</p>
                  <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{party.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {party.short_name ? t('partyDetail.shortName', { name: party.short_name }) : ''}
                    {t('partyDetail.description')}
                  </p>
                </div>
                <Link
                  to={dataGuidancePath()}
                  className="pixel-corners border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent transition hover:border-accent"
                >
                  {t('partyDetail.viewDataNotes')}
                </Link>
              </div>

              <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HudStatCard
                  label={t('partyDetail.income')}
                  value={<span className="font-display text-xl text-signal">{latestFinance ? currency(latestFinance.income_total) : t('parties.awaitingData')}</span>}
                />
                <HudStatCard
                  label={t('partyDetail.expense')}
                  value={<span className="font-display text-xl text-white">{latestFinance ? currency(latestFinance.expense_total) : t('parties.awaitingData')}</span>}
                />
                <HudStatCard
                  label={t('partyDetail.balance')}
                  value={<span className="font-display text-xl text-white">{latestFinance ? currency(latestFinance.balance_amount) : t('parties.awaitingData')}</span>}
                />
                <HudStatCard label={t('parties.companySummaries')} value={t('partyDetail.reviewedCount', { count: companySummaries.length })} />
                <HudStatCard label={t('parties.chairperson')} value={party.chairperson_name ?? t('parties.registryPending')} />
                <HudStatCard label={t('parties.founded')} value={party.founded_date_text ?? t('parties.registryPending')} />
              </dl>
            </section>

            <SectionPanel title={t('partyDetail.registryTitle')} eyebrow={t('partyDetail.registryEyebrow')}>
              <dl className="grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
                {[
                  [t('partyDetail.registryNo'), party.registry_no ?? t('parties.registryPending')],
                  [t('partyDetail.filedDate'), party.filed_date_text ?? t('parties.registryPending')],
                  [t('partyDetail.headquarters'), party.headquarters_address ?? t('parties.registryPending')],
                  [t('partyDetail.phone'), party.contact_phone ?? t('parties.registryPending')],
                  [t('partyDetail.source'), party.source_name ?? t('partyDetail.sourceAwaiting')],
                  [t('partyDetail.updated'), party.updated_at || t('partyDetail.awaitingSync')],
                ].map(([label, value]) => (
                  <div key={label} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
                    <dd className="mt-2 break-words text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionPanel>

            <SectionPanel title={t('partyDetail.peopleTitle')} eyebrow={t('partyDetail.peopleEyebrow')}>
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg text-white">{t('partyDetail.officeholders')}</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('common.peopleCount', { count: officeholders.length })}</span>
                  </div>
                  {officeholders.length > 0 ? (
                    <div className="grid gap-3">
                      {officeholders.map((person) => (
                        <PersonMiniCard key={person.person_id} person={person} />
                      ))}
                    </div>
                  ) : (
                    <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">
                      {t('partyDetail.noOfficeholders')}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg text-white">{t('partyDetail.candidates')}</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('partyDetail.candidateCount', { count: announcedCandidates.length })}</span>
                  </div>
                  {announcedCandidates.length > 0 ? (
                    <div className="grid gap-3">
                      {announcedCandidates.map((candidate) => (
                        <CandidateMiniCard key={candidate.candidate_id} candidate={candidate} />
                      ))}
                    </div>
                  ) : (
                    <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">
                      {t('partyDetail.noCandidates')}
                    </p>
                  )}
                </div>
              </div>
            </SectionPanel>

            {latestFinance ? (
              <SectionPanel title={t('partyDetail.financeTitle', { year: latestFinance.report_year })} eyebrow={t('partyDetail.financeEyebrow')}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    [t('partyDetail.individualDonations'), latestFinance.individual_donation_total],
                    [t('parties.businessDonations'), latestFinance.business_donation_total],
                    [t('partyDetail.groupDonations'), latestFinance.civil_group_donation_total],
                    [t('partyDetail.anonymousDonations'), latestFinance.anonymous_donation_total],
                    [t('partyDetail.otherIncome'), latestFinance.other_income_total],
                  ].map(([label, value]) => (
                    <div key={label} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                      <p className="mt-2 font-display text-lg text-white">{currency(Number(value))}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  {t('partyDetail.source')}:{' '}
                  {latestFinance.source_url ? (
                    <a href={latestFinance.source_url} target="_blank" rel="noreferrer" className="text-accent hover:text-white">
                      {latestFinance.source_name ?? t('partyDetail.donationData')}
                    </a>
                  ) : (
                    latestFinance.source_name ?? t('partyDetail.sourceAwaiting')
                  )}
                  {t('partyDetail.financeBoundary')}
                </p>
              </SectionPanel>
            ) : null}

            <SectionPanel title={t('partyDetail.companyTitle')} eyebrow={t('partyDetail.companyEyebrow')}>
              {companySummaries.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {companySummaries.map((summary) => (
                    <article key={`${summary.party_id}-${summary.company_id}`} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg text-white">{summary.company_name}</h3>
                          <p className="mt-1 text-sm text-slate-400">{t('partyDetail.yearSummary', { year: summary.report_year })}</p>
                        </div>
                        <span className="rounded-sm border border-signal/50 bg-signal/10 px-2 py-1 text-xs text-signal">
                          {summary.confidence_level}
                        </span>
                      </div>
                      <dl className="mt-4 grid gap-2 text-sm text-slate-300">
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">{t('partyDetail.summaryAmount')}</dt>
                          <dd>{currency(summary.amount_total)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">{t('partyDetail.recordCount')}</dt>
                          <dd>{summary.donation_count}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">{t('partyDetail.source')}</dt>
                          <dd className="text-right">
                            {summary.source_url ? (
                              <a href={summary.source_url} target="_blank" rel="noreferrer" className="text-accent hover:text-white">
                                {summary.source_name ?? t('partyDetail.donationData')}
                              </a>
                            ) : (
                              summary.source_name ?? t('partyDetail.sourceAwaiting')
                            )}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">{t('partyDetail.reviewedAt')}</dt>
                          <dd>{summary.reviewed_at ?? t('partyDetail.reviewAwaiting')}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t('partyDetail.noCompanySummaries')}</p>
              )}
            </SectionPanel>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">{t('partyDetail.notFound')}</h2>
            <p>{t('partyDetail.notFoundBody')}</p>
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
