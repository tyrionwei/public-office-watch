import { MyPollingPlace } from './MyPollingPlace';
import { Link } from 'react-router-dom';
import { translateCandidateStatus } from '../data/electionI18n';
import { selectNextElectionVotingCycle } from '../data/electionVotingCycles';
import { useI18n } from '../i18n';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { normalizeTaiwanText } from '../lib/taiwanText';
import { electionEventPath, electionsPath, personPath, racePath, regionPath } from '../routes/routePaths';
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
  const districtName = preference.district?.name;
  const villageName = preference.village?.name;
  const votingAreaLabel = [preference.county.name, districtName, villageName].filter(Boolean).join(' ');
  const votingCycle = selectNextElectionVotingCycle(preference, ticker.date);
  const tickerIsRelated = races.some((race) => race.electionId === ticker.electionId);
  const nextVoteTitle = votingCycle?.title[language] ?? (tickerIsRelated ? ticker.title : (isEnglish ? 'No confirmed vote for your registered area' : '目前沒有已確認與戶籍地區相關的投票'));
  const nextVoteDate = votingCycle?.votingDate ?? (tickerIsRelated ? ticker.date : null);
  const hasOfficialPollingPlaceLookup = votingCycle?.pollingPlaceStatus === 'lookup-available'
    && Boolean(votingCycle.pollingPlaceLookupUrl);
  const votingHours = votingCycle?.votingHours
    ? `${votingCycle.votingHours.startsAt}–${votingCycle.votingHours.endsAt}`
    : null;
  const daysUntil = nextVoteDate ? getDaysUntil(nextVoteDate) : null;
  const groupedRaces = new Map<RaceGroupKey, UpcomingRace[]>();
  races.forEach((race) => {
    const key = getRaceGroupKey(race);
    groupedRaces.set(key, [...(groupedRaces.get(key) ?? []), race]);
  });
  const homepageCandidateRaceIds = new Set(
    races.filter((race) => getRaceGroupKey(race) !== 'village').map((race) => race.id),
  );
  const candidates = uniqueCandidates(candidateSummaries, homepageCandidateRaceIds);
  const villageDirectoryPath = votingCycle?.electionEventKey && villageName
    ? electionEventPath(votingCycle.electionEventKey) + '?' + new URLSearchParams({
      category: 'village_chief',
      region: preference.county.name,
      q: villageName,
    }).toString()
    : null;

  const raceCards: Array<{
    key: RaceGroupKey;
    title: string;
    emptyHint: string;
    caution?: string;
  }> = [
    {
      key: 'chief',
      title: isEnglish ? `${preference.county.name} chief election` : `${preference.county.name}首長選舉`,
      emptyHint: isEnglish ? 'No published race yet' : '尚無已發布選舉資料',
    },
    {
      key: 'councilor',
      title: isEnglish ? `${preference.county.name} councilor elections` : `${preference.county.name}議員選舉`,
      emptyHint: isEnglish ? 'District data has not been published yet' : '尚無已發布選區資料',
      caution: isEnglish
        ? 'Your councilor district must still be confirmed against official election district data.'
        : '議員選區仍須依正式選區資料確認，不能只用行政區推定。',
    },
    {
      key: 'village',
      title: isEnglish
        ? `${districtName ?? preference.county.name} village chief election`
        : `${districtName ?? preference.county.name}${villageName ?? ''}村里長選舉`,
      emptyHint: villageName
        ? (isEnglish ? 'No published village race yet' : '尚無已發布村里選舉資料')
        : (isEnglish ? 'Add a village to narrow this section' : '選填村里後可進一步縮小範圍'),
      caution: isEnglish
        ? 'The actual ballot is determined by the electoral roll and official announcement.'
        : '實際選票仍以選舉人名冊與正式公告為準。',
    },
  ];

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

      <section className="pixel-corners border border-line/80 bg-panel p-4" aria-labelledby="my-election-races-title">
        <div className="flex items-end justify-between gap-3 border-b border-line/70 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{isEnglish ? 'YOUR AREA' : '依設定地區'}</p>
            <h2 id="my-election-races-title" className="mt-1 font-display text-lg text-white">{isEnglish ? 'Currently related elections' : '目前相關的選舉'}</h2>
          </div>
          <Link to={electionsPath()} className="min-h-11 shrink-0 py-3 text-xs text-accent underline underline-offset-4">
            {isEnglish ? 'All elections' : '全部選舉'}
          </Link>
        </div>

        {loading ? (
          <div className="mt-3 grid gap-2" aria-label={isEnglish ? 'Loading elections' : '載入選舉資料'}>
            {[0, 1, 2].map((item) => <span key={item} className="h-20 animate-pulse border border-line/60 bg-bg/45" />)}
          </div>
        ) : loadError ? (
          <p role="status" className="mt-3 border border-rose-400/50 bg-rose-950/20 p-3 text-sm text-rose-200">
            {isEnglish ? 'Election data could not be loaded. Please try again later.' : '選舉資料暫時無法載入，請稍後再試。'}
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {raceCards.map((card) => {
              const matchingRaces = groupedRaces.get(card.key) ?? [];
              const matchingRaceIds = new Set(matchingRaces.map((race) => race.id));
              const candidateCount = candidateSummaries.filter(({ candidate }) => matchingRaceIds.has(candidate.race_id)).length;
              const directoryPath = card.key === 'village' ? villageDirectoryPath : null;
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-sm leading-6 text-white">{card.title}</h3>
                    <span className="shrink-0 text-accent" aria-hidden="true">›</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {matchingRaces.length > 0
                      ? isEnglish
                        ? `${matchingRaces.length} published race(s) · ${candidateCount} recorded candidate(s)`
                        : `已發布 ${matchingRaces.length} 個選區／項目 · 收錄 ${candidateCount} 筆參選紀錄`
                      : directoryPath
                        ? isEnglish
                          ? 'The village chief registration roster is available · Open the area directory'
                          : '已收錄村里長登記名冊 · 進入依地區查找'
                        : card.emptyHint}
                  </p>
                  {card.caution ? <p className="mt-2 text-[11px] leading-5 text-amber-200/80">{card.caution}</p> : null}
                </>
              );
              const cardPath = matchingRaces.length === 1 ? racePath(matchingRaces[0].id) : directoryPath;
              return cardPath ? (
                <Link key={card.key} data-mobile-race-card={card.key} to={cardPath} className="block min-h-20 border border-line/70 bg-bg/45 p-3 focus:outline-none focus:ring-2 focus:ring-accent/35">
                  {content}
                </Link>
              ) : (
                <div key={card.key} data-mobile-race-card={card.key} className="min-h-20 border border-line/70 bg-bg/45 p-3">{content}</div>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          {isEnglish
            ? 'These are elections related to your saved area, not a definitive personal ballot.'
            : '這裡顯示的是依設定地區整理的相關選舉，不代表個人最終可領取的完整選票。'}
        </p>
      </section>

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
            {loading
              ? (isEnglish ? 'Loading candidate data…' : '正在載入參選人物資料…')
              : (isEnglish ? 'No candidates have been published for this area yet.' : '目前尚無此地區已發布的參選人物。')}
          </p>
        )}
      </section>

      <section data-polling-place-status className="pixel-corners border border-line/80 bg-panel p-4" aria-labelledby="my-election-info-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{isEnglish ? 'OFFICIAL CHECK' : '官方資料'}</p>
            <h2 id="my-election-info-title" className="mt-1 font-display text-lg text-white">{isEnglish ? 'Voting information' : '投票資訊'}</h2>
          </div>
          {hasOfficialPollingPlaceLookup ? (
            <button type="button" onClick={onOpenPollingPlace} aria-expanded={pollingPlaceOpen} className="min-h-11 shrink-0 border border-signal/60 bg-signal/8 px-3 text-xs font-semibold text-signal">
              {isEnglish ? 'View polling places' : '查看投開票所'}
            </button>
          ) : <span className="shrink-0 border border-line px-2 py-1 text-[10px] text-slate-400">{isEnglish ? 'Not announced' : '尚未公告'}</span>}
        </div>
        <dl className="mt-3 divide-y divide-line/60 border-y border-line/60 text-sm">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-400">{isEnglish ? 'Date' : '日期'}</dt>
            <dd className="text-right text-white">{nextVoteDate ?? (isEnglish ? 'To be announced' : '待公告')}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-400">{isEnglish ? 'Time' : '時間'}</dt>
            <dd className="text-right text-slate-300">
              {votingHours ?? (isEnglish ? 'Updated after official announcement' : '正式公告後更新')}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-400">{isEnglish ? 'Polling place' : '投票所'}</dt>
            <dd className="max-w-[70%] text-right text-slate-300">
              {hasOfficialPollingPlaceLookup
                ? (isEnglish ? 'Look up by registered area, village and neighborhood' : '請依戶籍地區、村里鄰查詢')
                : (isEnglish ? 'Not announced yet' : '尚未公告')}
            </dd>
          </div>
        </dl>
        {hasOfficialPollingPlaceLookup ? (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {isEnglish ? `Saved registered area: ${votingAreaLabel}` : `你儲存的戶籍投票地區：${votingAreaLabel}`}
            </p>
            {districtName ? (
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                {villageName
                  ? isEnglish
                    ? `The CEC link inside the polling-place panel will open with ${preference.county.name}, ${districtName}, ${villageName}, and its default general-voter category selected. Indigenous voters should adjust the voter category there and choose a neighborhood if needed.`
                    : `區塊內的中選會官方查詢會帶入「${preference.county.name}／${districtName}／${villageName}」及中選會預設的「一般」類別；具原住民投票資格者請在中選會頁面調整，鄰別仍請依需要選擇。`
                  : isEnglish
                    ? `The CEC link inside the polling-place panel will open with ${preference.county.name}, ${districtName}, and its default general-voter category selected. Indigenous voters should adjust the voter category there; choose village and neighborhood there if needed.`
                    : `區塊內的中選會官方查詢會帶入「${preference.county.name}／${districtName}」及中選會預設的「一般」類別；具原住民投票資格者請在中選會頁面調整，村里鄰也請於該頁選擇。`}
              </p>
            ) : null}
            <div className="mt-3 border border-line/70 bg-bg/35 p-3">
              <h3 className="font-display text-sm text-white">{isEnglish ? 'What to bring' : '投票要帶什麼'}</h3>
              <ul className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-300">
                <li className="border border-line/60 px-1 py-2">{isEnglish ? 'National ID' : '國民身分證'}</li>
                <li className="border border-line/60 px-1 py-2">{isEnglish ? 'Seal' : '印章'}</li>
                <li className="border border-line/60 px-1 py-2">{isEnglish ? 'Voting notice' : '投票通知單'}</li>
              </ul>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                {isEnglish
                  ? 'If you do not bring a seal, you may sign or use a fingerprint. If you do not bring the notice, remember its electoral-roll number.'
                  : '未帶印章可簽名或按指印；未帶投票通知單仍可投票，建議先記下名冊號次。'}
              </p>
            </div>
            <p className="mt-3 border-l-2 border-amber-300/60 pl-3 text-[11px] leading-5 text-amber-100/80">
              {isEnglish
                ? 'Current location cannot determine your assigned polling place. Confirm it using your registered address, official lookup result, and voting notice.'
                : '目前位置不能判定你應前往的投票所。請依戶籍地址、官方查詢結果與投票通知單確認。'}
            </p>
            {votingCycle.officialAnnouncementUrl ? (
              <a href={votingCycle.officialAnnouncementUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-xs text-slate-400 underline underline-offset-4">
                {isEnglish ? 'CEC election announcement' : '查看中選會選舉公告'} <span className="ml-1" aria-hidden="true">↗</span>
              </a>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            {isEnglish ? 'Official election announcements remain authoritative.' : '實際投票資訊以選舉機關正式公告為準。'}
          </p>
        )}
      </section>
      {pollingPlaceOpen && votingCycle?.pollingPlaceLookupUrl ? (
        <MyPollingPlace eventKey={votingCycle.id} lookupUrl={votingCycle.pollingPlaceLookupUrl} onClose={onClosePollingPlace} />
      ) : null}
    </section>
  );
}
