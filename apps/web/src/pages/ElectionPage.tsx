import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { PixelFrame } from '../components/PixelFrame';
import { mockPublicCandidates, mockPublicElections, mockPublicRaces } from '../data/mockPublicViews';
import { homePath } from '../routes/routePaths';

export function ElectionPage() {
  const { electionId } = useParams();
  const election = mockPublicElections.find((item) => item.election_id === electionId);
  const races = mockPublicRaces.filter((race) => race.election_id === electionId);
  const candidates = mockPublicCandidates.filter((candidate) => candidate.election_id === electionId);

  return (
    <AppShell>
      <PixelFrame title="Election Info" action={<Link to={homePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回首頁</Link>}>
        {election ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">public views / mock data</p>
              <h2 className="font-display text-3xl text-white">{election.name}</h2>
              <p className="text-sm text-slate-400">尚未接入正式資料，目前只顯示 UI 測試資料與 placeholder 關聯。</p>
            </div>

            <dl className="grid gap-4 md:grid-cols-2">
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">election date</dt>
                <dd className="mt-2 font-display text-xl text-signal">{election.voting_date ?? '待公告'}</dd>
              </div>
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">election type</dt>
                <dd className="mt-2 text-white">{election.election_type}</dd>
              </div>
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4 md:col-span-2">
                <dt className="text-xs uppercase tracking-[0.22em] text-slate-500">region / scope</dt>
                <dd className="mt-2 text-slate-300">
                  {races.length > 0 ? races.map((race) => race.region_name ?? '未指定區域').join('、') : '尚無區域資料'}
                </dd>
              </div>
            </dl>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">related races</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {races.map((race) => (
                    <li key={race.race_id}>{race.title} · {race.region_name ?? '未指定區域'}</li>
                  ))}
                </ul>
              </div>
              <div className="pixel-corners border border-line/70 bg-bg/38 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">candidates placeholder</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {candidates.map((candidate) => (
                    <li key={candidate.candidate_id}>{candidate.person_name} · {candidate.party ?? '未知政黨'}</li>
                  ))}
                </ul>
              </div>
            </div>
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
