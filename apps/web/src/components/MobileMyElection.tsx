import { MyPollingPlace } from './MyPollingPlace';
import { MyBallots } from './MyBallots';
import { Link } from 'react-router-dom';
import { translateCandidateStatus } from '../data/electionI18n';
import { selectNextElectionVotingCycle } from '../data/electionVotingCycles';
import { useI18n } from '../i18n';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { normalizeTaiwanText } from '../lib/taiwanText';
import { personPath, regionPath } from '../routes/routePaths';
import type { HomeCandidateSummary, HomeTicker, UpcomingRace } from '../lib/publicDataProvider';
import type { VotingRegionPreference } from '../votingRegion';
import { PixelCandidateSprite } from './PixelCandidateSprite';

type MobileMyElectionProps = {
  preference: VotingRegionPreference;
  ticker: HomeTicker;
  races: UpcomingRace[];
  candidateSummaries: HomeCandidateSummary[];
  loading: boolean;
  loadError: boolean;
  pollingPlaceOpen: boolean;
  onOpenPollingPlace: () => void;
  onClosePollingPlace: () => void;
};

type RaceGroupKey = 'chief' | 'councilor' | 'village' | 'referendum' | 'other';

function getRaceGroupKey(race: UpcomingRace): RaceGroupKey {
  if (race.raceType === 'municipality_mayor' || race.raceType === 'county_mayor' || race.raceType === 'local_chief') return 'chief';
  if (race.raceType === 'city_councilor' || race.raceType === 'county_councilor' || race.raceType === 'councilor_district') return 'councilor';
  if (race.raceType === 'village_chief') return 'village';
  if (race.raceType === 'referendum') return 'referendum';
  return 'other';
}

function getDaysUntil(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const target = new Date(`${date}T00:00:00+08:00`).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

function uniqueCandidates(candidateSummaries: HomeCandidateSummary[], raceIds: Set<string>) {
  const seen = new Set<string>();
  return candidateSummaries
    .filter(({ candidate }) => raceIds.has(candidate.race_id))
    .filter(({ candidate }) => {
      const key = candidate.person_id || candidate.candidate_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function MobileMyElection({
  preference,
  ticker,
  races,
  candidateSummaries,
  loading,
  loadError,
  pollingPlaceOpen,
  onOpenPollingPlace,
  onClosePollingPlace,
}: MobileMyElectionProps) {
  const { language, t } = useI18n();
  const isEnglish = language === 'en';
  const votingCycle = selectNextElectionVotingCycle(preference, new Date().toISOString().slice(0, 10));
  const tickerIsRelated = races.some((race) => race.electionId === ticker.electionId);
  const nextVoteTitle = votingCycle?.title[language] ?? (tickerIsRelated ? ticker.title : (isEnglish ? 'No confirmed vote for your registered area' : '目前沒有已確認與戶籍地區相關的投票'));
  const nextVoteDate = votingCycle?.votingDate ?? (tickerIsRelated ? ticker.date : null);
  const hasOfficialPollingPlaceLookup = votingCycle?.pollingPlaceStatus === 'lookup-available'
    && Boolean(votingCycle.pollingPlaceLookupUrl);
  const daysUntil = nextVoteDate ? getDaysUntil(nextVoteDate) : null;
  const homepageCandidateRaceIds = new Set(
    races.filter((race) => getRaceGroupKey(race) !== 'village').map((race) => race.id),
  );
  const candidates = uniqueCandidates(candidateSummaries, homepageCandidateRaceIds);

  return (
    <section data-mobile-my-election className="space-y-3 md:hidden">
      <article className="pixel-corners overflow-hidden border-2 border-signal/60 bg-panel shadow-[0_0_24px_rgba(244,211,94,0.08)]">
        <div className="border-b border-line/70 bg-signal/8 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-signal">{isEnglish ? 'NEXT VOTE' : '下一場投票'}</p>
          <h1 className="mt-2 font-display text-xl leading-8 text-white">{normalizeTaiwanText(nextVoteTitle)}</h1>
        </div>
        <dl className="grid grid-cols-2 gap-px bg-line/70">
          <div className="bg-panel px-4 py-4">
            <dt className="text-xs text-slate-400">{isEnglish ? 'Vote date' : '投票日期'}</dt>
            <dd className="mt-1 font-display text-lg text-white">{nextVoteDate ?? (isEnglish ? 'To be announced' : '待公告')}</dd>
          </div>
          <div className="bg-panel px-4 py-4">
            <dt className="text-xs text-slate-400">{isEnglish ? 'Countdown' : '距離投票'}</dt>
            <dd className="mt-1 font-display text-lg text-signal">
              {daysUntil === null ? (isEnglish ? 'To be announced' : '待公告') : isEnglish ? `${daysUntil} days` : `${daysUntil} 天`}
            </dd>
          </div>
        </dl>
        <div className="p-4">
          <Link to={regionPath(preference.county.id)} className="flex min-h-12 items-center justify-center border border-signal bg-signal/12 px-4 font-display text-sm text-signal focus:outline-none focus:ring-2 focus:ring-signal/40">
            {isEnglish ? 'View elections for my area' : '查看我的地區相關選舉'} <span className="ml-2" aria-hidden="true">›</span>
          </Link>
        </div>
      </article>

      {votingCycle?.electionEventKey ? <MyBallots eventKey={votingCycle.electionEventKey} preference={preference} /> : null}
      {hasOfficialPollingPlaceLookup && votingCycle?.pollingPlaceLookupUrl ? (
        <>
          <MyPollingPlace eventKey={votingCycle.id} lookupUrl={votingCycle.pollingPlaceLookupUrl} summary={!pollingPlaceOpen} onClose={onClosePollingPlace} />
          <button type="button" onClick={pollingPlaceOpen ? onClosePollingPlace : onOpenPollingPlace} className="min-h-11 px-2 text-xs text-accent underline underline-offset-4">
            {pollingPlaceOpen ? (isEnglish ? 'Hide all possible polling places' : '收合完整投開票所資料') : (isEnglish ? 'View all possible polling places' : '查看完整投開票所資料')}
          </button>
        </>
      ) : <p className="pixel-corners border border-line/80 bg-panel p-4 text-sm text-slate-400">{isEnglish ? 'Polling place announcement pending.' : '投開票所公告待補。'}</p>}

      <section className="pixel-corners border border-line/80 bg-panel p-4" aria-labelledby="my-election-candidates-title">
        <div className="flex items-end justify-between gap-3 border-b border-line/70 pb-3">
          <h2 id="my-election-candidates-title" className="font-display text-lg text-white">{isEnglish ? 'Recorded candidates' : '已收錄參選名單'}</h2>
          <span className="text-xs text-slate-400">{candidates.length}</span>
        </div>
        {candidates.length > 0 ? (
          <>
            <div
              data-mobile-candidate-roster
              className="mt-3 grid grid-flow-col grid-rows-2 auto-cols-[calc((100%_-_0.5rem)/2)] snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
            >
              {candidates.map(({ candidate, gender, birthDate, ageGroup }) => {
                const party = normalizePartyLabel(candidate.party ?? candidate.person_party);
                if (!candidate.person_id) {
                  return (
                    <div key={candidate.candidate_id} data-mobile-candidate-card data-registration-name
                      className="min-w-0 snap-start border border-line/70 bg-bg/45 p-2">
                      <PixelCandidateSprite
                        displayName={normalizeTaiwanText(candidate.person_name)}
                        personId={null}
                        partyKey={toPartyThemeKey(party)}
                        partyLabel={party}
                        variant={candidate.candidate_id}
                        gender={gender}
                        birthDate={birthDate}
                        ageGroup={ageGroup}
                        useDemographicSprite
                        compactOnMobile
                        lazy
                      />
                      <span data-mobile-candidate-status className="mt-2 inline-flex border border-signal/45 bg-signal/10 px-1.5 py-1 text-[10px] text-signal">
                        {translateCandidateStatus(candidate, t)}
                      </span>
                      <p className="mt-2 line-clamp-2 border-t border-line/60 pt-2 text-[11px] leading-5 text-slate-400">
                        {normalizeTaiwanText(candidate.race_title)}
                      </p>
                    </div>
                  );
                }
                return (
                  <Link
                    data-mobile-candidate-card
                    key={candidate.candidate_id}
                    to={personPath(candidate.person_id)}
                    className="min-w-0 snap-start border border-line/70 bg-bg/45 p-2 focus:outline-none focus:ring-2 focus:ring-accent/35"
                  >
                    <PixelCandidateSprite
                      displayName={normalizeTaiwanText(candidate.person_name)}
                      personId={candidate.person_id}
                      partyKey={toPartyThemeKey(party)}
                      partyLabel={party}
                      variant={candidate.candidate_id}
                      gender={gender}
                      birthDate={birthDate}
                      ageGroup={ageGroup}
                      useDemographicSprite
                      compactOnMobile
                      lazy
                    />
                    <span
                      data-mobile-candidate-status
                      className="mt-2 inline-flex border border-signal/45 bg-signal/10 px-1.5 py-1 text-[10px] leading-none text-signal"
                    >
                      {translateCandidateStatus(candidate, t)}
                    </span>
                    <p className="mt-2 line-clamp-2 border-t border-line/60 pt-2 text-[11px] leading-5 text-slate-400">
                      {normalizeTaiwanText(candidate.race_title)}
                    </p>
                  </Link>
                );
              })}
            </div>
            <p data-mobile-candidate-roster-hint className="mt-2 text-center text-[10px] text-slate-500">
              {isEnglish ? `All ${candidates.length} candidates · Swipe to browse` : `共 ${candidates.length} 位・左右滑動查看全部`}
            </p>
            <p data-mobile-village-candidate-policy className="mt-2 text-center text-[10px] leading-5 text-slate-500">
              {isEnglish
                ? 'Browse village chief candidates by constituency above; the homepage does not show an arbitrary sample.'
                : '村里長候選人請由上方選舉項目依選區查找，首頁不任意抽樣顯示。'}
            </p>
          </>
        ) : (
          <p className="mt-3 border border-line/60 bg-bg/35 p-4 text-sm leading-6 text-slate-400">
            {loadError
              ? (isEnglish ? 'Candidate data could not be loaded.' : '參選名單暫時無法載入。')
              : loading
              ? (isEnglish ? 'Loading candidate data…' : '正在載入參選人物資料…')
              : (isEnglish ? 'No candidates have been published for this area yet.' : '目前尚無此地區已發布的參選人物。')}
          </p>
        )}
      </section>

    </section>
  );
}
