import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { publicDataProvider } from '../lib/publicData';
import { dataGuidancePath, partiesPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicParty, PublicPerson } from '../types/publicViews';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-TW', {
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

const candidateStatusLabels: Record<PublicCandidate['registration_status'], string> = {
  pending: '待確認',
  registered: '已登記',
  qualified: '資格確認',
  disqualified: '資格不符',
  withdrawn: '已撤回',
  elected: '當選',
  not_elected: '未當選',
  unknown: '未知',
};

function isPublishedCandidate(candidate: PublicCandidate) {
  return !['disqualified', 'withdrawn', 'unknown'].includes(candidate.registration_status);
}

function isCurrentOfficeholder(person: PublicPerson) {
  return (
    Boolean(person.position) &&
    !person.position?.startsWith('範例') &&
    !person.position?.includes('候選人') &&
    !person.name.startsWith('測試')
  );
}

function PersonMiniCard({ person }: { person: PublicPerson }) {
  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{person.position ?? '現任公職'}</p>
      <h3 className="mt-2 font-display text-lg text-white">{person.name}</h3>
      <p className="mt-2 text-sm text-slate-400">{[person.district, person.election_year].filter(Boolean).join(' · ') || '公開人物資料'}</p>
    </article>
  );
}

function CandidateMiniCard({ candidate }: { candidate: PublicCandidate }) {
  return (
    <article className="pixel-corners border border-line/70 bg-bg/35 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {candidateStatusLabels[candidate.registration_status] ?? candidate.registration_status}
      </p>
      <h3 className="mt-2 font-display text-lg text-white">{candidate.person_name}</h3>
      <p className="mt-2 text-sm text-slate-400">
        {[candidate.race_title, candidate.region_name, candidate.candidate_no ? `#${candidate.candidate_no}` : null]
          .filter(Boolean)
          .join(' · ') || '候選人公開資料'}
      </p>
    </article>
  );
}

export function PartyPage() {
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

  return (
    <AppShell>
      <PixelFrame
        title="Party Detail"
        action={
          <Link to={partiesPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            返回政黨列表
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
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">party finance summary</p>
                  <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{party.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {party.short_name ? `簡稱 ${party.short_name}。` : ''}此頁顯示已公開的政黨名冊與年度政治獻金摘要。
                  </p>
                </div>
                <Link
                  to={dataGuidancePath()}
                  className="pixel-corners border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent transition hover:border-accent"
                >
                  查看資料說明
                </Link>
              </div>

              <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HudStatCard
                  label="income"
                  value={<span className="font-display text-xl text-signal">{latestFinance ? formatCurrency(latestFinance.income_total) : '待整理'}</span>}
                />
                <HudStatCard
                  label="expense"
                  value={<span className="font-display text-xl text-white">{latestFinance ? formatCurrency(latestFinance.expense_total) : '待整理'}</span>}
                />
                <HudStatCard
                  label="balance"
                  value={<span className="font-display text-xl text-white">{latestFinance ? formatCurrency(latestFinance.balance_amount) : '待整理'}</span>}
                />
                <HudStatCard label="company summaries" value={`${companySummaries.length} 筆已審核摘要`} />
                <HudStatCard label="chairperson / representative" value={party.chairperson_name ?? '待官方名冊同步'} />
                <HudStatCard label="founded" value={party.founded_date_text ?? '待官方名冊同步'} />
              </dl>
            </section>

            <SectionPanel title="官方名冊資料" eyebrow="MOI party registry">
              <dl className="grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ['政黨編號', party.registry_no ?? '待官方名冊同步'],
                  ['備案日期', party.filed_date_text ?? '待官方名冊同步'],
                  ['主事務所地址', party.headquarters_address ?? '待官方名冊同步'],
                  ['通訊電話', party.contact_phone ?? '待官方名冊同步'],
                  ['資料來源', party.source_name ?? '待補來源'],
                  ['更新時間', party.updated_at || '待同步'],
                ].map(([label, value]) => (
                  <div key={label} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                    <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
                    <dd className="mt-2 break-words text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionPanel>

            <SectionPanel title="黨籍人物與候選人" eyebrow="officeholders and public candidates">
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg text-white">目前就職中</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{officeholders.length} people</span>
                  </div>
                  {officeholders.length > 0 ? (
                    <div className="grid gap-3">
                      {officeholders.map((person) => (
                        <PersonMiniCard key={person.person_id} person={person} />
                      ))}
                    </div>
                  ) : (
                    <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">
                      目前沒有已公開的現任公職人物資料。
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg text-white">候選人資料</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{announcedCandidates.length} candidates</span>
                  </div>
                  {announcedCandidates.length > 0 ? (
                    <div className="grid gap-3">
                      {announcedCandidates.map((candidate) => (
                        <CandidateMiniCard key={candidate.candidate_id} candidate={candidate} />
                      ))}
                    </div>
                  ) : (
                    <p className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm text-slate-400">
                      目前沒有已公開的候選人資料。
                    </p>
                  )}
                </div>
              </div>
            </SectionPanel>

            {latestFinance ? (
              <SectionPanel title={`${latestFinance.report_year} 年度政治獻金摘要`} eyebrow="summary only">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['個人捐贈', latestFinance.individual_donation_total],
                    ['營利事業捐贈', latestFinance.business_donation_total],
                    ['人民團體捐贈', latestFinance.civil_group_donation_total],
                    ['匿名捐贈', latestFinance.anonymous_donation_total],
                    ['其他收入', latestFinance.other_income_total],
                  ].map(([label, value]) => (
                    <div key={label} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
                      <p className="mt-2 font-display text-lg text-white">{formatCurrency(Number(value))}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  來源：{latestFinance.source_name ?? '待補來源'}。目前只顯示政黨層級年度摘要，不公開個人捐贈明細。
                </p>
              </SectionPanel>
            ) : null}

            <SectionPanel title="公司關係摘要" eyebrow="reviewed company-level summaries">
              {companySummaries.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {companySummaries.map((summary) => (
                    <article key={`${summary.party_id}-${summary.company_id}`} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg text-white">{summary.company_name}</h3>
                          <p className="mt-1 text-sm text-slate-400">{summary.report_year} 年度摘要</p>
                        </div>
                        <span className="rounded-sm border border-signal/50 bg-signal/10 px-2 py-1 text-xs text-signal">
                          {summary.confidence_level}
                        </span>
                      </div>
                      <dl className="mt-4 grid gap-2 text-sm text-slate-300">
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">摘要金額</dt>
                          <dd>{formatCurrency(summary.amount_total)}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">筆數</dt>
                          <dd>{summary.donation_count}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">審核時間</dt>
                          <dd>{summary.reviewed_at ?? '待審核'}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">目前沒有已審核公司關係摘要。</p>
              )}
            </SectionPanel>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">找不到政黨資料</h2>
            <p>此頁目前只提供已公開的政黨摘要資料。</p>
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
