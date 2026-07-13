import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { PollComparisonPanel } from '../components/PollComparisonPanel';
import { SectionPanel } from '../components/SectionPanel';
import {
  getElectionStatusLabel,
  getElectionTypeLabel,
  getRaceStatusLabel,
  getRaceTypeLabel,
  getRegistrationStatusLabel,
  groupRacesByCategory,
} from '../data/electionLabels';
import { publicDataProvider } from '../lib/publicData';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { electionsPath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicRace } from '../types/publicViews';

function formatNumber(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('zh-TW').format(value);
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}%`;
}

function uniqueCount(values: Array<string | null>) {
  return new Set(values.filter(Boolean)).size;
}

function getCandidateNumber(candidate: PublicCandidate) {
  const value = Number.parseInt(candidate.candidate_no ?? '', 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function compareCandidates(left: PublicCandidate, right: PublicCandidate) {
  const numberDiff = getCandidateNumber(left) - getCandidateNumber(right);
  if (numberDiff !== 0) return numberDiff;
  return left.person_name.localeCompare(right.person_name, 'zh-TW');
}

function groupCandidateRaces(races: PublicRace[], candidatesByRaceId: Map<string, PublicCandidate[]>) {
  return groupRacesByCategory(races).map((group) => ({
    ...group,
    candidateCount: group.races.reduce((total, race) => total + (candidatesByRaceId.get(race.race_id)?.length ?? 0), 0),
    regionCount: uniqueCount(group.races.map((race) => race.region_name)),
  }));
}

export function ElectionPage() {
  const { electionId } = useParams();
  const safeElectionId = electionId ?? '';
  const election = publicDataProvider.getElectionById(safeElectionId);
  const races = publicDataProvider.getRacesByElectionId(safeElectionId);
  const candidates = publicDataProvider.getCandidatesByElectionId(safeElectionId);
  const pollComparison = publicDataProvider.getPollComparisonByElectionId(safeElectionId);
  const candidatesByRaceId = candidates.reduce<Map<string, PublicCandidate[]>>((groups, candidate) => {
    const values = groups.get(candidate.race_id) ?? [];
    values.push(candidate);
    groups.set(candidate.race_id, values);
    return groups;
  }, new Map<string, PublicCandidate[]>());
  const racesWithCandidates = races.filter((race) => candidatesByRaceId.has(race.race_id));
  const raceGroups = groupCandidateRaces(races, candidatesByRaceId);
  const raceGroupsWithCandidates = groupCandidateRaces(racesWithCandidates, candidatesByRaceId);
  const electedCount = candidates.filter((candidate) => candidate.is_elected || candidate.registration_status === 'elected').length;
  const sourcedCandidateCount = candidates.filter((candidate) => candidate.source_name).length;
  const regionCount = uniqueCount(races.map((race) => race.region_name));
  const raceCategorySummary = raceGroups.length > 0
    ? raceGroups.map((group) => `${group.category.label} ${group.races.length} 項`).join('、')
    : '尚未接入選舉項目';

  return (
    <AppShell>
      <PixelFrame
        title="選舉資訊"
        action={
          <Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">
            返回選舉列表
          </Link>
        }
      >
        {election ? (
          <div className="space-y-4">
            <section className="pixel-corners border border-line/70 bg-[linear-gradient(180deg,rgba(11,19,38,0.94),rgba(15,24,46,0.88))] p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.36fr)] lg:items-start">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">選舉概覽</p>
                  <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">{election.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {getElectionTypeLabel(election.election_type)}
                    </span>
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {getElectionStatusLabel(election.status)}
                    </span>
                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                      {election.voting_date ?? '投票日待公告'}
                    </span>
                  </div>
                </div>

                <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-3 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">來源</p>
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

            <SectionPanel title="本次選舉包含" eyebrow="選舉項目">
              {raceGroups.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-slate-300">
                    這次選舉目前接入 {races.length} 個選舉項目，包含 {raceCategorySummary}。下方選區總覽會依項目分類，避免縣市長、議員、立委與其他基層公職混在同一張清單。
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {raceGroups.map((group) => (
                      <div key={group.category.key} className="pixel-corners border border-line/70 bg-bg/35 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{group.category.label}</p>
                        <p className="mt-2 font-display text-2xl text-white">{group.races.length}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {group.regionCount > 0 ? `${group.regionCount} 個區域` : '未指定區域'} · {group.candidateCount} 筆候選紀錄
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">目前尚未接入這次選舉的項目分類。</p>
              )}
            </SectionPanel>

            {pollComparison ? <PollComparisonPanel comparison={pollComparison} /> : null}

            <SectionPanel title={candidates.length > 0 ? '選區與候選人' : '分類選區總覽'} eyebrow="選區與候選人">
              {races.length > 0 ? (
                candidates.length > 0 ? (
                  <div className="space-y-4">
                    {racesWithCandidates.length < races.length ? (
                      <p className="text-sm text-slate-400">
                        目前展開 {racesWithCandidates.length} 個已有候選紀錄的選區，另有 {races.length - racesWithCandidates.length} 個選區尚未接入候選人名冊。
                      </p>
                    ) : null}

                    {raceGroupsWithCandidates.map((group) => (
                      <section key={group.category.key} className="space-y-3">
                        <div className="flex flex-col gap-2 border-b border-line/60 pb-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-accent">{group.category.label}</p>
                            <h3 className="font-display text-2xl text-white">{group.category.label}選區</h3>
                          </div>
                          <p className="text-sm text-slate-400">{group.races.length} 個選區 · {group.candidateCount} 位候選人</p>
                        </div>

                        {group.races.map((race) => {
                          const raceCandidates = (candidatesByRaceId.get(race.race_id) ?? []).slice().sort(compareCandidates);
                          const raceElectedCount = raceCandidates.filter((candidate) => candidate.is_elected || candidate.registration_status === 'elected').length;

                          return (
                            <article key={race.race_id} className="pixel-corners border border-line/70 bg-bg/35">
                              <header className="border-b border-line/60 px-4 py-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                      {getRaceTypeLabel(race.race_type)}
                                    </p>
                                    <h4 className="mt-1 font-display text-xl text-white">{race.title}</h4>
                                    <p className="mt-1 text-sm text-slate-400">{race.region_name ?? '未指定區域'}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs text-slate-300 lg:justify-end">
                                    <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">
                                      {getRaceStatusLabel(race.status)}
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
                                        {getRegistrationStatusLabel(candidate.registration_status)}
                                      </p>
                                      <p className="text-sm text-slate-300">{formatNumber(candidate.vote_count)}</p>
                                      <p className="text-sm text-slate-300">{formatPercent(candidate.vote_rate)}</p>
                                    </>
                                  );
                                  const rowClassName = 'grid gap-3 px-4 py-3 lg:grid-cols-[minmax(150px,1fr)_minmax(120px,0.55fr)_100px_100px_96px]';

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
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
                      <p>候選人名冊尚未接入，先依選舉項目分類呈現選區，避免把大量空白候選卡展開。</p>
                    </div>

                    {raceGroups.map((group) => (
                      <section key={group.category.key} className="space-y-3">
                        <div className="flex flex-col gap-2 border-b border-line/60 pb-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-accent">{group.category.label}</p>
                            <h3 className="font-display text-2xl text-white">{group.category.label}選區總覽</h3>
                          </div>
                          <p className="text-sm text-slate-400">{group.races.length} 個選區</p>
                        </div>
                        <div className="pixel-corners max-h-[420px] overflow-auto border border-line/70 bg-bg/35">
                          <div className="grid gap-3 border-b border-line/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[minmax(180px,1fr)_minmax(120px,0.45fr)_minmax(120px,0.45fr)]">
                            <span>選區</span>
                            <span>區域</span>
                            <span>狀態</span>
                          </div>
                          <div className="divide-y divide-line/60">
                            {group.races.map((race) => (
                              <div key={race.race_id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(180px,1fr)_minmax(120px,0.45fr)_minmax(120px,0.45fr)]">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-white">{race.title}</p>
                                  <p className="mt-1 text-xs text-slate-500">{getRaceTypeLabel(race.race_type)}</p>
                                </div>
                                <p className="text-slate-300">{race.region_name ?? '未指定區域'}</p>
                                <p className="text-slate-300">{getRaceStatusLabel(race.status)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-sm text-slate-400">目前沒有公開選區資料。</p>
              )}
            </SectionPanel>

            <SectionPanel title="資料狀態" eyebrow="公開資料邊界">
              <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-3">
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">涵蓋範圍</p>
                  <p className="mt-2">已接入 {races.length} 個選區、{candidates.length} 筆候選紀錄，{electedCount} 筆標示當選。</p>
                </div>
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">來源</p>
                  <p className="mt-2">{sourcedCandidateCount} 筆候選紀錄帶有來源名稱；缺漏項目會保留空狀態。</p>
                </div>
                <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">資料邊界</p>
                  <p className="mt-2">頁面只讀取已審核的公開資料檢視；政治獻金與公司關係仍走獨立審核流程。</p>
                </div>
              </div>
            </SectionPanel>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-300">
            <h2 className="font-display text-2xl text-white">找不到選舉資訊</h2>
            <p>此選舉尚未載入，或目前沒有可公開的選舉資料。</p>
            <p>你可以返回選舉列表，從目前的公開選舉資料重新進入。</p>
          </div>
        )}
      </PixelFrame>
    </AppShell>
  );
}
