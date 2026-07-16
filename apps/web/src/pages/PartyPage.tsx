import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { PublicPersonListPage } from '../lib/publicDataProvider';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import { dataGuidancePath, partiesPath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicPersonListItem, PublicPersonStatus } from '../types/publicViews';

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

const PARTY_PEOPLE_PAGE_SIZE = 8;
const CONTRIBUTION_PAGE_SIZE = 10;
const emptyPeoplePage: PublicPersonListPage = { items: [], total: 0 };

function getSectionPage(searchParams: URLSearchParams, key: string) {
  const page = Number.parseInt(searchParams.get(key) ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getVisiblePageNumbers(currentPage: number, pageCount: number) {
  const visibleCount = Math.min(5, pageCount);
  const halfWindow = Math.floor(visibleCount / 2);
  let start = Math.max(1, currentPage - halfWindow);
  const endOverflow = start + visibleCount - 1 - pageCount;

  if (endOverflow > 0) {
    start = Math.max(1, start - endOverflow);
  }

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function usePartyPeoplePage(
  partyName: string | null,
  status: PublicPersonStatus,
  page: number,
) {
  const [result, setResult] = useState<PublicPersonListPage>(emptyPeoplePage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setResult(emptyPeoplePage);

    if (!partyName) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);

    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadPeoplePage(
        { party: partyName, status },
        page,
        PARTY_PEOPLE_PAGE_SIZE,
      ))
      .then((nextPage) => {
        if (active) setResult(nextPage);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('Failed to load party people page', error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, partyName, status]);

  return { ...result, loading };
}

function PersonMiniCard({
  person,
  eyebrow,
}: {
  person: PublicPersonListItem;
  eyebrow: string;
}) {
  const { t } = useI18n();

  return (
    <Link
      to={personPath(person.person_id)}
      className="block pixel-corners border border-line/70 bg-bg/35 p-4 transition hover:border-accent/70 hover:bg-accent/5"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-2 font-display text-lg text-white">{person.name}</h3>
      <p className="mt-2 text-sm text-slate-400">
        {[person.display_position_label, person.region_name ?? person.district]
          .filter(Boolean)
          .join(' / ') || t('partyDetail.publicPerson')}
      </p>
    </Link>
  );
}

function SectionPagination({
  currentPage,
  total,
  pageSize,
  onChange,
}: {
  currentPage: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  if (pageCount <= 1) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4 text-sm text-slate-300">
      <p>{t('event.page', { current: currentPage, total: pageCount })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(1)}
          disabled={currentPage <= 1}
          className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('event.first')}
        </button>
        <button
          type="button"
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('event.previous')}
        </button>
        {getVisiblePageNumbers(currentPage, pageCount).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onChange(pageNumber)}
            aria-current={pageNumber === currentPage ? 'page' : undefined}
            className={pageNumber === currentPage
              ? 'pixel-corners border border-accent bg-accent/20 px-3 py-2 text-xs text-white'
              : 'pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs transition hover:border-accent/55 hover:text-white'}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage >= pageCount}
          className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('event.next')}
        </button>
        <button
          type="button"
          onClick={() => onChange(pageCount)}
          disabled={currentPage >= pageCount}
          className="pixel-corners border border-line/70 bg-bg/35 px-3 py-2 text-xs transition hover:border-accent/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('event.last')}
        </button>
      </div>
    </div>
  );
}

export function PartyPage() {
  const { language, t } = useI18n();
  const { partySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const party = publicDataProvider.getPartyBySlug(partySlug ?? '');
  const officeholderRequestedPage = getSectionPage(searchParams, 'officePage');
  const candidateRequestedPage = getSectionPage(searchParams, 'candidatePage');
  const contributionRequestedPage = getSectionPage(searchParams, 'contributionPage');
  const officeholders = usePartyPeoplePage(party?.name ?? null, 'current', officeholderRequestedPage);
  const candidates = usePartyPeoplePage(party?.name ?? null, 'candidate', candidateRequestedPage);
  const financeSummaries = party ? publicDataProvider.getPartyFinanceSummaries(party.party_id) : [];
  const companySummaries = party ? publicDataProvider.getPartyCompanyContributionSummaries(party.party_id) : [];
  const latestFinance = financeSummaries.slice().sort((left, right) => right.report_year - left.report_year)[0];
  const theme = party ? partyTheme[party.theme_key] : partyTheme.unknown;
  const officeholderPageCount = Math.max(1, Math.ceil(officeholders.total / PARTY_PEOPLE_PAGE_SIZE));
  const candidatePageCount = Math.max(1, Math.ceil(candidates.total / PARTY_PEOPLE_PAGE_SIZE));
  const contributionPageCount = Math.max(1, Math.ceil(companySummaries.length / CONTRIBUTION_PAGE_SIZE));
  const officeholderPage = Math.min(officeholderRequestedPage, officeholderPageCount);
  const candidatePage = Math.min(candidateRequestedPage, candidatePageCount);
  const contributionPage = Math.min(contributionRequestedPage, contributionPageCount);
  const visibleCompanySummaries = companySummaries.slice(
    (contributionPage - 1) * CONTRIBUTION_PAGE_SIZE,
    contributionPage * CONTRIBUTION_PAGE_SIZE,
  );
  const updateSectionPage = (
    key: 'officePage' | 'candidatePage' | 'contributionPage',
    page: number,
    pageCount: number,
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    const nextPage = Math.min(Math.max(page, 1), pageCount);

    if (nextPage <= 1) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, String(nextPage));
    }

    setSearchParams(nextParams);
  };
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
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('common.peopleCount', { count: officeholders.total })}</span>
                  </div>
                  {officeholders.loading ? (
                    <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">
                      {t('office.loading')}
                    </p>
                  ) : officeholders.items.length > 0 ? (
                    <>
                      <div className="grid gap-3">
                        {officeholders.items.map((person) => (
                          <PersonMiniCard
                            key={person.person_id}
                            person={person}
                            eyebrow={person.role_label || t('partyDetail.currentOffice')}
                          />
                        ))}
                      </div>
                      <SectionPagination
                        currentPage={officeholderPage}
                        total={officeholders.total}
                        pageSize={PARTY_PEOPLE_PAGE_SIZE}
                        onChange={(page) => updateSectionPage('officePage', page, officeholderPageCount)}
                      />
                    </>
                  ) : (
                    <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">
                      {t('partyDetail.noOfficeholders')}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg text-white">{t('partyDetail.candidates')}</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{t('partyDetail.candidateCount', { count: candidates.total })}</span>
                  </div>
                  {candidates.loading ? (
                    <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">
                      {t('office.loading')}
                    </p>
                  ) : candidates.items.length > 0 ? (
                    <>
                      <div className="grid gap-3">
                        {candidates.items.map((person) => (
                          <PersonMiniCard
                            key={person.person_id}
                            person={person}
                            eyebrow={person.status_label}
                          />
                        ))}
                      </div>
                      <SectionPagination
                        currentPage={candidatePage}
                        total={candidates.total}
                        pageSize={PARTY_PEOPLE_PAGE_SIZE}
                        onChange={(page) => updateSectionPage('candidatePage', page, candidatePageCount)}
                      />
                    </>
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
                <>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {visibleCompanySummaries.map((summary) => (
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
                  <SectionPagination
                    currentPage={contributionPage}
                    total={companySummaries.length}
                    pageSize={CONTRIBUTION_PAGE_SIZE}
                    onChange={(page) => updateSectionPage('contributionPage', page, contributionPageCount)}
                  />
                </>
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
