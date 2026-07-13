import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HudStatCard } from '../components/HudStatCard';
import { PixelFrame } from '../components/PixelFrame';
import { SectionPanel } from '../components/SectionPanel';
import { buildElectionEvents, getElectionEventForRace, getRaceRegionGroup } from '../data/electionEvents';
import { getElectionStatusLabel, getRaceCategory, getRaceStatusLabel, getRaceTypeLabel, getRegistrationStatusLabel } from '../data/electionLabels';
import { publicDataProvider } from '../lib/publicData';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { electionEventPath, electionsPath, personPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate } from '../types/publicViews';

function formatNumber(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('zh-TW').format(value);
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}%`;
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

export function RacePage() {
  const { raceId } = useParams();
  const safeRaceId = raceId ?? '';
  const race = publicDataProvider.getRaceById(safeRaceId);
  const election = race ? publicDataProvider.getElectionById(race.election_id) : null;
  const candidates = publicDataProvider.getCandidatesByRaceId(safeRaceId).slice().sort(compareCandidates);
  const electedCount = candidates.filter((candidate) => candidate.is_elected || candidate.registration_status === 'elected').length;
  const events = buildElectionEvents(publicDataProvider.getElections(), publicDataProvider.getRaces());
  const event = getElectionEventForRace(events, race);
  const backPath = event ? electionEventPath(event.key) : electionsPath();

  if (!race) {
    return (
      <AppShell>
        <PixelFrame title="找不到選區項目" action={<Link to={electionsPath()} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回選舉年份</Link>}>
          <p className="text-sm text-slate-300">此選區項目尚未載入，或目前沒有可公開的選區資料。</p>
        </PixelFrame>
      </AppShell>
    );
  }

  const category = getRaceCategory(race);
  const region = getRaceRegionGroup(race);

  return (
    <AppShell>
      <div className="space-y-4">
        <PixelFrame
          title="選區項目細節"
          action={<Link to={backPath} className="text-[11px] uppercase tracking-[0.22em] text-accent">返回大選總覽</Link>}
        >
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">{race.voting_date ?? election?.voting_date ?? '投票日待公告'}</p>
              <h1 className="mt-2 font-display text-4xl text-white">{race.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {event ? event.title : election?.name ?? race.election_name} · {category.label} · {region.label}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{getRaceTypeLabel(race.race_type)}</span>
                <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{getRaceStatusLabel(race.status)}</span>
                {election ? <span className="pixel-corners border border-line/70 bg-bg/35 px-2 py-1">{getElectionStatusLabel(election.status)}</span> : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <HudStatCard label="候選人" value={<span className="font-display text-xl text-white">{candidates.length}</span>} />
              <HudStatCard label="當選" value={<span className="font-display text-xl text-signal">{electedCount}</span>} />
              <HudStatCard label="區域" value={<span className="font-display text-xl text-white">{region.label}</span>} />
            </div>
          </section>
        </PixelFrame>

        <SectionPanel title={candidates.length > 0 ? '候選人與當選資料' : '候選人資料'} eyebrow="候選名冊">
          {candidates.length > 0 ? (
            <div className="overflow-hidden pixel-corners border border-line/70">
              <div className="grid gap-3 border-b border-line/70 bg-panelAlt/55 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500 lg:grid-cols-[72px_minmax(150px,1fr)_minmax(120px,0.55fr)_96px_100px_96px]">
                <span>號次</span>
                <span>姓名</span>
                <span>政黨</span>
                <span>狀態</span>
                <span>得票數</span>
                <span>得票率</span>
              </div>
              <div className="divide-y divide-line/60">
                {candidates.map((candidate) => {
                  const partyLabel = normalizePartyLabel(candidate.party ?? candidate.person_party);
                  const theme = partyTheme[toPartyThemeKey(partyLabel)];
                  const rowContent = (
                    <>
                      <p className="text-sm text-slate-300">{candidate.candidate_no ?? '—'}</p>
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
                  const rowClassName = 'grid gap-3 px-4 py-3 lg:grid-cols-[72px_minmax(150px,1fr)_minmax(120px,0.55fr)_96px_100px_96px]';

                  return candidate.person_id ? (
                    <Link
                      key={candidate.candidate_id}
                      to={personPath(candidate.person_id)}
                      className={`${rowClassName} transition hover:bg-accent/8 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/35`}
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div key={candidate.candidate_id} className={rowClassName}>{rowContent}</div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4 text-sm leading-6 text-slate-300">
              <p>此項目的候選人名冊尚未公布或尚未接入。選區基本資料會先保留，後續資料補齊後會顯示候選人、當選狀態、得票數與得票率。</p>
            </div>
          )}
        </SectionPanel>

        <SectionPanel title="資料來源" eyebrow="公開資料">
          <div className="grid gap-3 text-sm leading-6 text-slate-300 md:grid-cols-2">
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">選舉資料</p>
              <p className="mt-2">{election?.source_name ?? race.source_name ?? '公開選舉資料'}</p>
              {election?.source_url ? <a href={election.source_url} className="mt-2 inline-block text-xs text-accent hover:text-white">查看選舉來源</a> : null}
            </div>
            <div className="pixel-corners border border-line/70 bg-bg/35 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">選區資料</p>
              <p className="mt-2">{race.source_name ?? '公開選區資料'}</p>
              {race.source_url ? <a href={race.source_url} className="mt-2 inline-block text-xs text-accent hover:text-white">查看選區來源</a> : null}
            </div>
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
