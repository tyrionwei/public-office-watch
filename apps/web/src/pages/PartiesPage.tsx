import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { publicDataProvider } from '../lib/publicData';
import { partyPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function PartiesPage() {
  const parties = publicDataProvider.getParties();
  const summaries = parties.map((party) => {
    const latestFinance = publicDataProvider
      .getPartyFinanceSummaries(party.party_id)
      .slice()
      .sort((left, right) => right.report_year - left.report_year)[0];
    const companySummaries = publicDataProvider.getPartyCompanyContributionSummaries(party.party_id);

    return { party, latestFinance, companySummaries };
  });

  const totalIncome = summaries.reduce((sum, item) => sum + (item.latestFinance?.income_total ?? 0), 0);
  const totalBusinessDonations = summaries.reduce(
    (sum, item) => sum + (item.latestFinance?.business_donation_total ?? 0),
    0,
  );
  const companyRelationCount = summaries.reduce((sum, item) => sum + item.companySummaries.length, 0);

  return (
    <AppShell>
      <div className="space-y-3">
        <PixelFrame title="Parties & Contributions">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-accent">public-view-shaped mock data</p>
              <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">政黨與政治獻金</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                第一版只呈現政黨層級的政治獻金摘要與已審核公司關係摘要，不公開個人捐贈明細。正式資料未來以監察院與政府開放資料為優先來源。
              </p>
            </div>
            <dl className="grid gap-3">
              <HudStatCard label="party count" value={<span className="font-display text-2xl text-white">{parties.length}</span>} />
              <HudStatCard label="mock income total" value={<span className="font-display text-2xl text-signal">{formatCurrency(totalIncome)}</span>} />
              <HudStatCard label="company summary total" value={<span className="font-display text-2xl text-white">{companyRelationCount}</span>} />
            </dl>
          </div>
        </PixelFrame>

        <SectionPanel title="政黨列表" eyebrow="party registry">
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
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{party.short_name ?? 'party'}</p>
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
                      <dt className="text-slate-500">負責人 / 主席</dt>
                      <dd className="text-right">{party.chairperson_name ?? '待官方名冊同步'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">年度收入</dt>
                      <dd>{latestFinance ? formatCurrency(latestFinance.income_total) : '待整理'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">營利事業捐贈</dt>
                      <dd>{latestFinance ? formatCurrency(latestFinance.business_donation_total) : '待整理'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">公司摘要</dt>
                      <dd>{companySummaries.length} 筆</dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        </SectionPanel>

        <SectionPanel title="資料限制" eyebrow="political contribution boundary">
          <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-3">
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4">只顯示政黨層級摘要，不公開個人捐贈明細。</p>
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4">公司關係摘要需通過人工審核與來源追溯。</p>
            <p className="pixel-corners border border-line/70 bg-bg/35 p-4">g0v/Ronny 資料站作為呈現參考，正式接入前需確認授權。</p>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Mock business donation total: {formatCurrency(totalBusinessDonations)}
          </p>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
