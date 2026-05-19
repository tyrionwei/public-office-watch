import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { publicDataProvider } from '../lib/publicData';
import { dataGuidancePath, partiesPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function PartyPage() {
  const { partySlug } = useParams();
  const party = publicDataProvider.getPartyBySlug(partySlug ?? '');
  const financeSummaries = party ? publicDataProvider.getPartyFinanceSummaries(party.party_id) : [];
  const companySummaries = party ? publicDataProvider.getPartyCompanyContributionSummaries(party.party_id) : [];
  const latestFinance = financeSummaries.slice().sort((left, right) => right.report_year - left.report_year)[0];
  const theme = party ? partyTheme[party.theme_key] : partyTheme.unknown;

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
                    {party.short_name ? `簡稱 ${party.short_name}。` : ''}此頁目前顯示 public-view-shaped mock 摘要。
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
              </dl>
            </section>

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
                  來源：{latestFinance.source_name ?? '待補來源'}。目前為 UI 測試資料，不代表真實政治獻金數字。
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
