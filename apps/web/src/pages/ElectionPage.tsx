import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { MockDataBadge } from '../components/MockDataBadge';
import { PageNotice } from '../components/PageNotice';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { mockPublicCandidates, mockPublicElections, mockPublicRaces } from '../data/mockPublicViews';
import { homePath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';

const registrationStatusLabels: Record<string, string> = {
  registered: '已登記',
  qualified: '已完成資格確認',
  pending: '待確認',
  unknown: '未知',
};

export function ElectionPage() {
  const { electionId } = useParams();
  const election = mockPublicElections.find((item) => item.election_id === electionId);
  const races = mockPublicRaces.filter((race) => race.election_id === electionId);
  const candidates = mockPublicCandidates.filter((candidate) => candidate.election_id === electionId);

  return (
    <AppShell>
      <PixelFrame
        title="Election Info"
        action={
          <Link to={homePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            返回首頁
          </Link>
        }
      >
        {election ? (
          <div className="space-y-6">
            <section className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(11,19,38,0.94),rgba(15,24,46,0.88))] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <MockDataBadge />
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">election hero / hud</p>
                    <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{election.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">尚未接入正式資料，目前只顯示 mock public views 形狀資料。</p>
                  </div>
                </div>

                <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-3 text-sm text-slate-300 lg:w-[300px]">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">mock data notice</p>
                  <p className="mt-2">目前頁面內容為 UI 測試資料，並非正式選舉結果。</p>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HudStatCard label="election date" value={<span className="font-display text-xl text-signal">{election.voting_date ?? '待公告'}</span>} />
                <HudStatCard label="election type" value={election.election_type} />
                <HudStatCard label="status" value={election.status} />
                <HudStatCard
                  label="region / scope"
                  value={races.length > 0 ? races.map((race) => race.region_name ?? '未指定區域').join('、') : '尚無區域資料'}
                />
              </dl>
            </section>

            <SectionPanel title="Race Overview" eyebrow="related races">
              {races.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {races.map((race) => {
                    const candidateCount = candidates.filter((candidate) => candidate.race_id === race.race_id).length;
                    return (
                      <article key={race.race_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                        <h4 className="font-display text-lg text-white">{race.title}</h4>
                        <dl className="mt-3 grid gap-2 text-sm text-slate-300">
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">race type</dt><dd>{race.race_type}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">region / scope</dt><dd>{race.region_name ?? '未指定區域'}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">candidate count</dt><dd>{candidateCount}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">status</dt><dd>{race.status}</dd></div>
                        </dl>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">目前沒有 related races。</p>
              )}
            </SectionPanel>

            <SectionPanel title="Candidate List Placeholder" eyebrow="mock candidates only">
              {candidates.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {candidates.map((candidate) => {
                    const theme = partyTheme[
                      candidate.party === '民主進步黨'
                        ? 'dpp'
                        : candidate.party === '中國國民黨'
                          ? 'kmt'
                          : candidate.party === '無黨籍'
                            ? 'independent'
                            : 'unknown'
                    ];

                    return (
                      <article key={candidate.candidate_id} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-display text-lg text-white">{candidate.person_name}</h4>
                            <p className="mt-1 text-sm text-slate-400">{candidate.race_title}</p>
                          </div>
                          <span
                            className="rounded-sm px-2 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: `${theme.primary}26`,
                              color: theme.text,
                              border: `1px solid ${theme.primary}`,
                            }}
                          >
                            {theme.label}
                          </span>
                        </div>
                        <dl className="mt-4 grid gap-2 text-sm text-slate-300">
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">registration status</dt><dd>{registrationStatusLabels[candidate.registration_status] ?? candidate.registration_status}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-slate-500">data note</dt><dd>UI 測試資料 / placeholder</dd></div>
                        </dl>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">目前沒有候選人 placeholder 資料。</p>
              )}
            </SectionPanel>

            <PageNotice
              title="Election Data Boundary Notice"
              bullets={[
                '資料來源為 mock public views。',
                '尚未接正式 public views。',
                '候選人與 race 資料需人工審核後才會公開。',
                '目前不是正式選舉結果。',
              ]}
            />
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">找不到選舉資訊</h2>
            <p>此頁目前只提供 mock data，尚未接入正式資料。</p>
            <p>你可以返回首頁，從目前的選舉卡片重新進入。</p>
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
