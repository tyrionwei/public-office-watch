import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { PollComparisonPanel } from '../components/PollComparisonPanel';
import { SectionPanel } from '../components/SectionPanel';
import { publicDataProvider } from '../lib/publicData';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { homePath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';

const electionTypeLabels: Record<string, string> = {
  presidential: '總統副總統',
  president: '總統副總統',
  legislative: '立法委員',
  legislator: '立法委員',
  local: '地方公職',
  local_chief: '地方首長',
  councilor: '議員',
  township_representative: '鄉鎮市民代表',
  village_chief: '村里長',
  recall: '罷免',
  referendum: '公投',
  by_election: '補選',
  other: '其他選舉',
};

const electionStatusLabels: Record<string, string> = {
  draft: '草稿',
  announced: '已公告',
  upcoming: '即將投票',
  active: '進行中',
  completed: '已完成',
  cancelled: '已取消',
  unknown: '未知',
};

const raceTypeLabels: Record<string, string> = {
  president: '總統',
  vice_president: '副總統',
  legislator: '立法委員',
  legislative_district: '區域立委',
  party_list_legislator: '不分區立委',
  municipality_mayor: '直轄市長',
  county_mayor: '縣市長',
  local_chief: '地方首長',
  city_councilor: '市議員',
  county_councilor: '縣議員',
  councilor_district: '議員選區',
  township_mayor: '鄉鎮市長',
  township_representative: '鄉鎮市民代表',
  township_representative_district: '代表選區',
  village_chief: '村里長',
  indigenous: '原住民選區',
  recall: '罷免',
  referendum: '公投',
  other: '其他',
};

const raceStatusLabels: Record<string, string> = {
  draft: '草稿',
  announced: '已公告',
  upcoming: '即將投票',
  registration_open: '登記中',
  candidates_announced: '候選人公告',
  voting: '投票中',
  completed: '已完成',
  cancelled: '已取消',
  unknown: '未知',
};

const registrationStatusLabels: Record<string, string> = {
  registered: '已登記',
  qualified: '資格確認',
  pending: '待確認',
  elected: '當選',
  not_elected: '未當選',
  disqualified: '資格不符',
  withdrawn: '已撤回',
  unknown: '未知',
};

function formatNumber(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('zh-TW').format(value);
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}%`;
}

function uniqueCount(values: Array<string | null>) {
  return new Set(values.filter(Boolean)).size;
}

function compareCandidates(
  left: ReturnType<typeof publicDataProvider.getCandidatesByElectionId>[number],
  right: ReturnType<typeof publicDataProvider.getCandidatesByElectionId>[number],
) {
  if (left.is_elected !== right.is_elected) return left.is_elected ? -1 : 1;
  const voteDiff = (right.vote_count ?? -1) - (left.vote_count ?? -1);
  if (voteDiff !== 0) return voteDiff;
  return left.person_name.localeCompare(right.person_name, 'zh-TW');
}

export function ElectionPage() {
  const { electionId } = useParams();
  const safeElectionId = electionId ?? '';
  const election = publicDataProvider.getElectionById(safeElectionId);
  const races = publicDataProvider.getRacesByElectionId(safeElectionId);
  const candidates = publicDataProvider.getCandidatesByElectionId(safeElectionId);
  const pollComparison = publicDataProvider.getPollComparisonByElectionId(safeElectionId);
  const candidatesByRaceId = candidates.reduce<Map<string, typeof candidates>>((groups, candidate) => {
    const values = groups.get(candidate.race_id) ?? [];
    values.push(candidate);
    groups.set(candidate.race_id, values);
    return groups;
  }, new Map<string, typeof candidates>());
  const racesWithCandidates = races.filter((race) => candidatesByRaceId.has(race.race_id));
  const raceTypeCounts = Array.from(
    races.reduce<Map<string, number>>((counts, race) => {
      const label = raceTypeLabels[race.race_type] ?? race.race_type;
      counts.set(label, (counts.get(label) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
  ).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-TW'));
  const electedCount = candidates.filter((candidate) => candidate.is_elected || candidate.registration_status === 'elected').length;
  const sourcedCandidateCount = candidates.filter((candidate) => candidate.source_name).length;
  const regionCount = uniqueCount(races.map((race) => race.region_name));

  return (
    <AppShell>
      <PixelFrame
        title="選舉資訊"
        action={
          <Link to={homePath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            返回首頁
          </Link>
        }
      >
        {election ? (
          <div className="space-y-4">
            <section className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(11,19,38,0.94),rgba(15,24,46,0.88))] p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.36fr)] lg:items-start">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">election profile</p>
                  <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{election.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {electionTypeLabels[election.election_type] ?? election.election_type}
                    </span>
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {electionStatusLabels[election.status] ?? election.status}
                    </span>
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {election.voting_date ?? '投票日待公告'}
                    </span>
                  </div>
                </div>

                <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-3 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">source</p>
                  <p className="mt-2">{election.source_name ?? '公開選舉資料'}</p>
                  {election.source_url ? (
                    <a href={election.source_url} className="mt-2 inline-block text-xs text-accent hover:text-white">
                      查看來源
                    </a>
                  ) : null}
                </div>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <HudStatCard label="投票日" value={<span className="font-display text-xl text-signal">{election.voting_date ?? '待公告'}</span>} />
                <HudStatCard label="選區數" value={<span className="font-display text-xl text-white">{races.length}</span>} />
                <HudStatCard label="候選紀錄" value={<span className="font-display text-xl text-white">{candidates.length}</span>} />
                <HudStatCard label="涵蓋區域" value={regionCount > 0 ? `${regionCount} 個` : '未指定'} />
              </dl>
            </section>

            {pollComparison ? <PollComparisonPanel comparison={pollComparison} /> : null}

            <SectionPanel title={candidates.length > 0 ? '選區與候選人' : '選區總覽'} eyebrow="races and candidates">
              {races.length > 0 ? (
                candidates.length > 0 ? (
                  <div className="space-y-3">
                    {racesWithCandidates.length < races.length ? (
                      <p className="text-sm text-slate-400">
                        目前展開 {racesWithCandidates.length} 個已有候選紀錄的選區，另有 {races.length - racesWithCandidates.length} 個選區尚未接入候選人名冊。
                      </p>
                    ) : null}

                    {racesWithCandidates.map((race) => {
                      const raceCandidates = (candidatesByRaceId.get(race.race_id) ?? []).slice().sort(compareCandidates);
                      const raceElectedCount = raceCandidates.filter((candidate) => candidate.is_elected || candidate.registration_status === 'elected').length;

                      return (
                        <article key={race.race_id} className="pixel-corners border border-line/70 bg-bg/35">
                          <header className="border-b border-line/60 px-4 py-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                  {raceTypeLabels[race.race_type] ?? race.race_type}
                                </p>
                                <h3 className="mt-1 font-display text-xl text-white">{race.title}</h3>
                                <p className="mt-1 text-sm text-slate-400">{race.region_name ?? '未指定區域'}</p>
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs text-slate-300 lg:justify-end">
                                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                                  {raceStatusLabels[race.status] ?? race.status}
                                </span>
                                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                                  {raceCandidates.length} 位候選人
                                </span>
                                {raceElectedCount > 0 ? (
                                  <span className="pixel-corners border border-signal/55 bg-signal/10 px-2 py-1 text-signal">
                                    {raceElectedCount} 位當選
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </header>

                          <div className="divide-y divide-line/60">
                            {raceCandidates.map((candidate) => {
                              const partyLabel = normalizePartyLabel(candidate.party ?? candidate.person_party);
                              const theme = partyTheme[toPartyThemeKey(partyLabel)];
                              const rowContent = (
                                <>
                                  <div className="min-w-0">
                                    <p className="truncate font-display text-lg text-white">{candidate.person_name}</p>
                                    <p className="mt-1 truncate text-xs text-slate-500">{candidate.person_position ?? race.title}</p>
                                  </div>
                                  <div className="min-w-0">
                                    <span
                                      className="pixel-corners inline-block max-w-full truncate border px-2 py-1 text-xs"
                                      style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}33`, color: theme.text }}
                                    >
                                      {partyLabel}
                                    </span>
                                  </div>
                                  <p className={candidate.is_elected || candidate.registration_status === 'elected' ? 'text-sm text-signal' : 'text-sm text-slate-300'}>
                                    {registrationStatusLabels[candidate.registration_status] ?? candidate.registration_status}
                                  </p>
                                  <p className="text-sm text-slate-300">{formatNumber(candidate.vote_count)}</p>
                                  <p className="text-sm text-slate-300">{formatPercent(candidate.vote_rate)}</p>
                                </>
                              );
                              const rowClassName = "grid gap-3 px-4 py-3 lg:grid-cols-[minmax(150px,1fr)_minmax(120px,0.55fr)_100px_100px_96px]";

                              return candidate.person_id ? (
                                <Link
                                  key={candidate.candidate_id}
                                  to={personPath(candidate.person_id)}
                                  className={`${rowClassName} transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35`}
                                >
                                  {rowContent}
                                </Link>
                              ) : (
                                <div key={candidate.candidate_id} className={rowClassName}>
                                  {rowContent}
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                      <p>候選人名冊尚未接入，先以精簡選區清單呈現，避免把大量空白候選卡展開。</p>
                      {raceTypeCounts.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {raceTypeCounts.map(([label, count]) => (
                            <span key={label} className="pixel-corners border border-line/70 bg-bg/40 px-2 py-1 text-slate-300">
                              {label} {count}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="pixel-corners max-h-[560px] overflow-auto border border-line/70 bg-bg/35">
                      <div className="grid gap-3 border-b border-line/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[minmax(180px,1fr)_minmax(120px,0.45fr)_minmax(120px,0.45fr)]">
                        <span>選區</span>
                        <span>區域</span>
                        <span>狀態</span>
                      </div>
                      <div className="divide-y divide-line/60">
                        {races.map((race) => (
                          <div key={race.race_id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(180px,1fr)_minmax(120px,0.45fr)_minmax(120px,0.45fr)]">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">{race.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{raceTypeLabels[race.race_type] ?? race.race_type}</p>
                            </div>
                            <p className="text-slate-300">{race.region_name ?? '未指定區域'}</p>
                            <p className="text-slate-300">{raceStatusLabels[race.status] ?? race.status}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-sm text-slate-400">目前沒有公開選區資料。</p>
              )}
            </SectionPanel>

            <SectionPanel title="資料狀態" eyebrow="public data boundary">
              <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-3">
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">coverage</p>
                  <p className="mt-2">已接入 {races.length} 個選區、{candidates.length} 筆候選紀錄，{electedCount} 筆標示當選。</p>
                </div>
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">source</p>
                  <p className="mt-2">{sourcedCandidateCount} 筆候選紀錄帶有來源名稱；缺漏項目會保留空狀態。</p>
                </div>
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">boundary</p>
                  <p className="mt-2">頁面只讀取 approved public views；政治獻金與公司關係仍走獨立審核流程。</p>
                </div>
              </div>
            </SectionPanel>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">找不到選舉資訊</h2>
            <p>此選舉尚未載入，或目前沒有可公開的選舉資料。</p>
            <p>你可以返回首頁，從目前的選舉卡片重新進入。</p>
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
