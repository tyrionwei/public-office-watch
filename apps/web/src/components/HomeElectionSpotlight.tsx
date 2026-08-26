import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { translateCandidateStatus } from '../data/electionI18n';
import { buildElectionEventKey } from '../data/electionEvents';
import { getRaceCategoryByType, getRaceStatusLabel } from '../data/electionLabels';
import { getRegionHighlightBackground, getRegionHighlightImageSources } from '../data/regionHighlights';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { refreshConfiguredPublicDataProvider } from '../lib/publicDataProviderFactory';
import type { UpcomingRace } from '../lib/publicDataProvider';
import { normalizePartyLabel, toPartyThemeKey } from '../lib/personData';
import { normalizeTaiwanText } from '../lib/taiwanText';
import { electionEventPath, personPath, racePath, regionPath } from '../routes/routePaths';
import { partyTheme } from '../styles/partyThemes';
import type { PublicCandidate, PublicPerson } from '../types/publicViews';
import type { StageRegionNode, StageRegionSummary } from '../types/stageMap';
import { PixelCandidateSprite } from './PixelCandidateSprite';
import { PixelFrame } from './PixelFrame';

type HomeElectionSpotlightProps = {
  races: UpcomingRace[];
  regionNode: StageRegionNode | null;
  regionSummary: StageRegionSummary | null;
  national: boolean;
};

function getCandidateNumber(candidate: PublicCandidate) {
  const number = Number.parseInt(candidate.candidate_no ?? '', 10);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

function compareCandidates(left: PublicCandidate, right: PublicCandidate, locale: string) {
  const numberDifference = getCandidateNumber(left) - getCandidateNumber(right);
  return numberDifference || left.person_name.localeCompare(right.person_name, locale);
}
function getDaysUntil(date: string) {
  const target = Date.parse(`${date}T00:00:00+08:00`);
  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

const chineseDigits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const localCandidateCategoryKeys = new Set(['local_chief', 'councilor']);
const nationalCandidateCategoryKeys = new Set(['presidential', 'legislator']);
const homeElectionCategoryKeys = ['local_chief', 'councilor', 'village_chief'];

function toChineseNumber(value: number) {
  if (value < 10) return chineseDigits[value];
  if (value < 20) return `十${value % 10 ? chineseDigits[value % 10] : ''}`;
  const tens = Math.floor(value / 10);
  return `${chineseDigits[tens]}十${value % 10 ? chineseDigits[value % 10] : ''}`;
}

function fromChineseNumber(value: string) {
  if (!value.includes('十')) return chineseDigits.indexOf(value);
  const [tensText, onesText] = value.split('十');
  const tens = tensText ? chineseDigits.indexOf(tensText) : 1;
  const ones = onesText ? chineseDigits.indexOf(onesText) : 0;
  return tens * 10 + ones;
}

function getRaceDistrictNumber(race: { title: string }) {
  const numericDistrict = race.title.match(/第\s*0*(\d{1,2})\s*(?:選舉區|選區)/);
  if (numericDistrict) return Number(numericDistrict[1]);
  const chineseDistrict = race.title.match(/第\s*([零一二三四五六七八九十]+)\s*(?:選舉區|選區)/);
  return chineseDistrict ? fromChineseNumber(chineseDistrict[1]) : Number.MAX_SAFE_INTEGER;
}

function compareRaceDistricts(left: UpcomingRace, right: UpcomingRace) {
  return getRaceDistrictNumber(left) - getRaceDistrictNumber(right)
    || left.title.localeCompare(right.title, 'zh-Hant-TW');
}

function getRaceSelectorLabel(race: { title: string }) {
  const districtNumber = getRaceDistrictNumber(race);
  const districtLabel = districtNumber !== Number.MAX_SAFE_INTEGER
    ? `第${toChineseNumber(districtNumber)}選區`
    : '';
  const indigenousLabel = race.title.includes('平地原住民')
    ? '平地原住民'
    : race.title.includes('山地原住民')
      ? '山地原住民'
      : '';

  if (districtLabel && indigenousLabel) return `${districtLabel} ${indigenousLabel}`;
  if (districtLabel) return districtLabel;
  if (indigenousLabel) return indigenousLabel;
  return race.title;
}

type ElectionCategoryGroup = {
  key: string;
  order: number;
  races: UpcomingRace[];
};

function getCandidateCategoryLabel(categoryKey: string, regionLabel: string, language: string) {
  if (language === 'en') {
    if (categoryKey === 'presidential') return 'President & vice president';
    if (categoryKey === 'legislator') return 'Legislators';
    if (categoryKey === 'local_chief') return 'Mayor';
    if (categoryKey === 'councilor') return 'Councilors';
    return 'Village chiefs';
  }

  const isCity = regionLabel.endsWith('市');
  if (categoryKey === 'local_chief') return isCity ? '市長' : '縣長';
  if (categoryKey === 'presidential') return '正副總統';
  if (categoryKey === 'legislator') return '立法委員';
  if (categoryKey === 'councilor') return isCity ? '市議員' : '縣議員';
  return '村里長';
}

function getElectionCategoryLabel(categoryKey: string, regionLabel: string, language: string) {
  if (language === 'en') {
    if (categoryKey === 'local_chief') return `${regionLabel} mayoral election`;
    if (categoryKey === 'councilor') return `${regionLabel} councilor election`;
    return `${regionLabel} village chief election`;
  }

  if (categoryKey === 'local_chief') return `${regionLabel}長選舉`;
  if (categoryKey === 'councilor') return `${regionLabel}議員選舉`;
  return `${regionLabel}${regionLabel.endsWith('市') ? '里長' : '村里長'}選舉`;
}

function getLocalElectionTitle(regionLabel: string, language: string) {
  return language === 'en'
    ? `${regionLabel} local public office election`
    : `${regionLabel}地方公職人員選舉`;
}

function getCandidateSectionTitle(regionLabel: string, language: string) {
  return language === 'en' ? `${regionLabel} candidates` : `${regionLabel}參選人物`;
}

function getCategoryEventPath(categoryKey: string, race: UpcomingRace, regionLabel: string) {
  const year = Number.parseInt(race.date.slice(0, 4), 10);
  if (!Number.isFinite(year)) return `/elections/races/${race.id}`;

  const query = new URLSearchParams({
    category: categoryKey,
    region: regionLabel,
  });
  return `${electionEventPath(buildElectionEventKey(year, race.date, 'local'))}?${query.toString()}`;
}
function getNationalCategoryEventPath(categoryKey: string, race: UpcomingRace) {
  const year = Number.parseInt(race.date.slice(0, 4), 10);
  if (!Number.isFinite(year)) return racePath(race.id);

  const query = new URLSearchParams({ category: categoryKey });
  return `${electionEventPath(buildElectionEventKey(year, race.date, 'national'))}?${query.toString()}`;
}


function getCandidateRaceContext(candidate: PublicCandidate, categoryKey: string | null, regionLabel: string) {
  if (categoryKey === 'councilor') {
    const label = getRaceSelectorLabel({ title: candidate.race_title });
    return label === candidate.race_title ? normalizeTaiwanText(candidate.race_title) : label;
  }

  if (categoryKey === 'village_chief') {
    const candidateRegion = normalizeTaiwanText(candidate.region_name ?? '');
    if (candidateRegion && candidateRegion !== regionLabel) return candidateRegion;
    return normalizeTaiwanText(candidate.race_title);
  }

  return null;
}

type CandidateDemographics = Pick<PublicPerson, 'gender'> & { birthDate: string | null };

export function HomeElectionSpotlight({
  races,
  regionNode,
  regionSummary,
  national,
}: HomeElectionSpotlightProps) {
  const { language, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const regionLabel = normalizeTaiwanText(national ? t('national.taiwan') : regionSummary?.label ?? regionNode?.label ?? t('home.unspecifiedRegion'));
  const [activeRaceId, setActiveRaceId] = useState(races[0]?.id ?? '');
  const [candidates, setCandidates] = useState<PublicCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateCounts, setCandidateCounts] = useState<Record<string, number>>({});
  const [candidateDemographics, setCandidateDemographics] = useState<Map<string, CandidateDemographics>>(new Map());
  const requestedCandidateIndex = Number.parseInt(searchParams.get('candidateIndex') ?? '0', 10);
  const restoredCandidateIndex = Number.isFinite(requestedCandidateIndex) && requestedCandidateIndex >= 0
    ? requestedCandidateIndex
    : 0;
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(restoredCandidateIndex);
  const restoredCandidateIndexRef = useRef(restoredCandidateIndex);
  restoredCandidateIndexRef.current = restoredCandidateIndex;
  const [carouselPaused, setCarouselPaused] = useState(false);
  const candidateRefs = useRef<(HTMLAnchorElement | HTMLDivElement | null)[]>([]);
  const updateHomeParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      let changed = false;
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          if (next.has(key)) changed = true;
          next.delete(key);
        } else if (next.get(key) !== value) {
          next.set(key, value);
          changed = true;
        }
      });
      return changed ? next : current;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (!races.some((race) => race.id === activeRaceId)) {
      setActiveRaceId(races[0]?.id ?? '');
    }
  }, [activeRaceId, races]);

  const activeRace = races.find((race) => race.id === activeRaceId) ?? races[0] ?? null;
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, ElectionCategoryGroup>();

    for (const race of races) {
      const category = getRaceCategoryByType(race.raceType);
      const current = groups.get(category.key);
      if (current) current.races.push(race);
      else groups.set(category.key, { key: category.key, order: category.order, races: [race] });
    }

    for (const group of groups.values()) group.races.sort(compareRaceDistricts);
    return Array.from(groups.values()).sort((left, right) => left.order - right.order);
  }, [races]);
  const candidateCategoryGroups = useMemo(
    () => categoryGroups.filter((group) => (
      national ? nationalCandidateCategoryKeys : localCandidateCategoryKeys
    ).has(group.key)),
    [categoryGroups, national],
  );
  const referendumRaces = useMemo(
    () => categoryGroups.find((group) => group.key === 'referendum')?.races ?? [],
    [categoryGroups],
  );
  const requestedCandidateCategory = searchParams.get('candidateCategory');

  useEffect(() => {
    if (!requestedCandidateCategory) return;
    const requestedGroup = candidateCategoryGroups.find((group) => group.key === requestedCandidateCategory);
    if (requestedGroup && !requestedGroup.races.some((race) => race.id === activeRaceId)) {
      setActiveRaceId(requestedGroup.races[0]?.id ?? '');
    }
  }, [activeRaceId, candidateCategoryGroups, requestedCandidateCategory]);

  const activeCategory = activeRace ? getRaceCategoryByType(activeRace.raceType).key : null;
  const activeCategoryRaces = useMemo(
    () => categoryGroups.find((group) => group.key === activeCategory)?.races ?? [],
    [activeCategory, categoryGroups],
  );
  const requestedCouncilorRaceId = searchParams.get('candidateDistrict') ?? '';
  const selectedCouncilorRaceId = activeCategory === 'councilor'
    && activeCategoryRaces.some((race) => race.id === requestedCouncilorRaceId)
    ? requestedCouncilorRaceId
    : '';
  const displayedCategoryRaces = useMemo(
    () => !candidateCategoryGroups.some((group) => group.key === activeCategory)
      ? []
      : activeCategory === 'councilor' && selectedCouncilorRaceId
        ? activeCategoryRaces.filter((race) => race.id === selectedCouncilorRaceId)
        : activeCategoryRaces,
    [activeCategory, activeCategoryRaces, candidateCategoryGroups, selectedCouncilorRaceId],
  );
  const hasCandidateContent = candidateCategoryGroups.length > 0;
  const hasReferendumContent = referendumRaces.length > 0;
  const requestedNationalContent = searchParams.get('homeContent');
  const nationalContentMode = requestedNationalContent === 'candidates' && hasCandidateContent
    ? 'candidates'
    : requestedNationalContent === 'referendums' && hasReferendumContent
      ? 'referendums'
      : hasCandidateContent
        ? 'candidates'
        : 'referendums';
  const showReferendumContent = national && nationalContentMode === 'referendums';


  useEffect(() => {
    let active = true;
    setCandidateCounts({});

    if (candidateCategoryGroups.length === 0) {
      return () => {
        active = false;
      };
    }

    void refreshConfiguredPublicDataProvider()
      .then(async () => Promise.all(candidateCategoryGroups.map(async (group) => {
        const race = group.races[0];
        const year = Number.parseInt(race?.date.slice(0, 4) ?? '', 10);
        if (!race || !Number.isFinite(year)) return [group.key, 0] as const;

        const rows = await publicDataProvider.loadElectionPartyPerformance(
          buildElectionEventKey(year, race.date, national ? 'national' : 'local'),
          Array.from(new Set(group.races.map((item) => item.electionId))),
          national ? {
            raceTypes: Array.from(new Set(group.races.map((item) => item.raceType))),
          } : {
            raceTypes: Array.from(new Set(group.races.map((item) => item.raceType))),
            regionKey: regionLabel,
          },
        );
        return [group.key, rows.reduce((sum, row) => sum + row.candidate_count, 0)] as const;
      })))
      .then((entries) => {
        if (active) setCandidateCounts(Object.fromEntries(entries));
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load home candidate counts', error);
      });

    return () => {
      active = false;
    };
  }, [candidateCategoryGroups, national, regionLabel]);

  useEffect(() => {
    let active = true;
    setCandidates([]);
    setCandidateDemographics(new Map());

    if (displayedCategoryRaces.length === 0) {
      setCandidatesLoading(false);
      return () => {
        active = false;
      };
    }

    setCandidatesLoading(true);
    void refreshConfiguredPublicDataProvider()
      .then(() => publicDataProvider.loadHomeCandidateSummaries(
        displayedCategoryRaces.map((race) => race.id),
      ))
      .then((summaries) => {
        if (!active) return;
        const raceOrder = new Map(displayedCategoryRaces.map((race, index) => [race.id, index]));
        const seenCandidateIds = new Set<string>();
        const sortedSummaries = summaries
          .slice()
          .sort((left, right) => (
            (raceOrder.get(left.candidate.race_id) ?? Number.MAX_SAFE_INTEGER)
            - (raceOrder.get(right.candidate.race_id) ?? Number.MAX_SAFE_INTEGER)
            || compareCandidates(left.candidate, right.candidate, language)
          ))
          .filter((summary) => {
            if (seenCandidateIds.has(summary.candidate.candidate_id)) return false;
            seenCandidateIds.add(summary.candidate.candidate_id);
            return true;
          });
        const sortedCandidates = sortedSummaries.map((summary) => summary.candidate);
        setCandidates(sortedCandidates);
        setCandidateDemographics(new Map(sortedSummaries.map((summary) => [
          summary.candidate.person_id,
          { gender: summary.gender, birthDate: summary.birthDate },
        ])));
        setActiveCandidateIndex(Math.min(restoredCandidateIndexRef.current, Math.max(sortedCandidates.length - 1, 0)));
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Failed to load home candidate carousel', error);
      })
      .finally(() => {
        if (active) setCandidatesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [displayedCategoryRaces, language]);

  useEffect(() => {
    if (candidates.length <= 2 || carouselPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(max-width: 767px)').matches) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveCandidateIndex((index) => (index + 1) % candidates.length);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [candidates.length, carouselPaused]);

  useEffect(() => {
    if (candidates.length <= 2) return;
    candidateRefs.current[activeCandidateIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }, [activeCandidateIndex, candidates.length]);
  useEffect(() => {
    if (candidates.length === 0) return;
    updateHomeParams({ candidateIndex: activeCandidateIndex > 0 ? String(activeCandidateIndex) : null });
  }, [activeCandidateIndex, candidates.length, updateHomeParams]);


  const highlightBackground = getRegionHighlightBackground(regionNode?.id, regionNode?.publicRegionId, regionNode?.stageLabel);
  const highlightImage = national
    ? {
        src: '/assets/elections/national-east-coast-overview-v1.png',
        srcSet: '/assets/elections/national-east-coast-overview-v1.png',
      }
    : highlightBackground
      ? getRegionHighlightImageSources(highlightBackground.image)
      : null;
  const daysUntil = activeRace ? getDaysUntil(activeRace.date) : null;
  const useCandidateGrid = candidates.length <= 2;

  const moveCarousel = (direction: -1 | 1) => {
    setActiveCandidateIndex((index) => (index + direction + candidates.length) % candidates.length);
  };


  const selectCandidateCategory = (group: ElectionCategoryGroup) => {
    setActiveCandidateIndex(0);
    updateHomeParams({
      homeContent: national ? 'candidates' : null,
      candidateCategory: group.key,
      candidateDistrict: null,
      candidateIndex: null,
    });
  };

  const selectCouncilorDistrict = (raceId: string) => {
    setActiveCandidateIndex(0);
    updateHomeParams({
      candidateCategory: 'councilor',
      candidateDistrict: raceId || null,
      candidateIndex: null,
    });
  };

  const selectNationalContent = (mode: 'candidates' | 'referendums') => {
    updateHomeParams({ homeContent: mode });
    if (mode === 'candidates') {
      const requestedGroup = candidateCategoryGroups.find((group) => group.key === requestedCandidateCategory);
      const firstCandidateRace = requestedGroup?.races[0] ?? candidateCategoryGroups[0]?.races[0];
      if (firstCandidateRace) setActiveRaceId(firstCandidateRace.id);
    } else if (referendumRaces[0]) {
      setActiveRaceId(referendumRaces[0].id);
    }
  };

  const candidateCollectionPath = activeRace && activeCategory
    ? selectedCouncilorRaceId
      ? racePath(selectedCouncilorRaceId)
      : national
        ? getNationalCategoryEventPath(activeCategory, activeRace)
        : getCategoryEventPath(activeCategory, activeRace, regionLabel)
    : null;
  const displayedCandidateCount = selectedCouncilorRaceId
    ? candidates.length
    : activeCategory
      ? candidateCounts[activeCategory] ?? candidates.length
      : candidates.length;
  const lowerPanelTitle = showReferendumContent
    ? (language === 'en' ? 'Nationwide referendum items' : '全國公投項目')
    : getCandidateSectionTitle(regionLabel, language);

  return (
    <div className="min-w-0 space-y-3 xl:grid xl:h-full xl:grid-rows-[400px_minmax(0,1fr)] xl:gap-3 xl:space-y-0">
      <PixelFrame title={t('homeSpotlight.title')}>
        <div
          className="relative min-h-[312px] overflow-hidden rounded-sm border border-accent/25 bg-[#071b37]"
          data-region-highlight={highlightBackground?.regionId ?? undefined}
          data-region-highlight-feature={highlightBackground?.feature ?? undefined}
          data-national-overview={national ? '' : undefined}
        >
          {highlightImage ? (
            <img
              src={highlightImage.src}
              srcSet={highlightImage.srcSet}
              sizes="(min-width: 1280px) 45vw, 100vw"
              alt=""
              aria-hidden="true"
              loading="eager"
              decoding="async"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: highlightBackground?.focalPoint ?? 'center' }}
            />
          ) : null}

          <div className="relative flex min-h-[312px] flex-col p-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.98),0_0_6px_rgba(0,0,0,0.82)] sm:p-5">
            {activeRace ? (
              <>
                <h2 className="max-w-[620px] font-display text-2xl leading-tight text-white sm:text-3xl">{national ? normalizeTaiwanText(activeRace.title) : getLocalElectionTitle(regionLabel, language)}</h2>

                <dl className="mt-5 grid max-w-[440px] grid-cols-2 gap-4 text-sm">
                  <div className="rounded-sm border border-white/15 bg-[#061126]/78 px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.16em] text-cyan-100">{t('homeSpotlight.voteDate')}</dt>
                    <dd className="mt-1 font-display text-lg text-white">{activeRace.date}</dd>
                  </div>
                  <div className="rounded-sm border border-white/15 bg-[#061126]/78 px-3 py-2">
                    <dt className="text-xs uppercase tracking-[0.16em] text-cyan-100">{t('homeSpotlight.countdown')}</dt>
                    <dd className="mt-1 font-display text-lg text-white">
                      {daysUntil === null ? t('common.toBeAnnounced') : t('homeSpotlight.daysUntil', { count: daysUntil })}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap items-end gap-3 pt-5">
                  {!national ? (
                    <div className="flex flex-wrap gap-2">
                      {homeElectionCategoryKeys.map((categoryKey) => (
                        <Link
                          key={categoryKey}
                          to={getCategoryEventPath(categoryKey, activeRace, regionLabel)}
                          data-home-election-category={categoryKey}
                          className="pixel-corners inline-flex min-h-9 items-center border-2 border-accent/70 bg-[#03142d] px-3 py-2 font-display text-[10px] leading-tight text-white shadow-[0_0_12px_rgba(34,211,238,0.18)] transition hover:border-signal hover:bg-signal hover:text-[#041126] focus:outline-none focus:ring-2 focus:ring-signal/45"
                        >
                          {getElectionCategoryLabel(categoryKey, regionLabel, language)}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {!national && regionNode?.id ? (
                    <Link
                      to={regionPath(regionNode.id)}
                      className="pixel-corners ml-auto inline-flex shrink-0 items-center border border-signal/80 bg-[#061126]/85 px-3 py-2 font-display text-xs text-signal transition hover:border-signal hover:bg-signal hover:text-[#041126] focus:outline-none focus:ring-2 focus:ring-signal/40"
                    >
                      {t('regionHud.viewCounty')} <span className="ml-2" aria-hidden="true">›</span>
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <div>
                <h2 className="font-display text-2xl text-white">{national ? (language === 'en' ? 'Nationwide' : '全國') : regionLabel}</h2>
                <p className="mt-3 text-sm text-slate-300">{national && language !== 'en' ? '目前沒有已公布的即將到來選舉' : t('homeSpotlight.noElection')}</p>
              </div>
            )}
          </div>
        </div>
      </PixelFrame>

      <PixelFrame
        title={lowerPanelTitle}
        action={!showReferendumContent && candidateCollectionPath ? (
          <Link
            to={candidateCollectionPath}
            data-candidate-view-all
            className="shrink-0 font-display text-[10px] text-slate-300 transition hover:text-signal focus:outline-none focus:ring-2 focus:ring-signal/35"
          >
            {t('homeSpotlight.recordedCandidates', { count: displayedCandidateCount })}
          </Link>
        ) : undefined}
        className="xl:h-full"
      >
        {national && hasCandidateContent && hasReferendumContent ? (
          <div className="mb-3 flex gap-2" data-national-content-tabs aria-label={language === 'en' ? 'Nationwide content' : '全國內容切換'}>
            {(['candidates', 'referendums'] as const).map((mode) => {
              const selected = nationalContentMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => selectNationalContent(mode)}
                  aria-pressed={selected}
                  className={[
                    'pixel-corners min-h-8 border px-3 py-1.5 font-display text-[10px] transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                    selected
                      ? 'border-signal bg-signal text-[#041126]'
                      : 'border-line/80 bg-bg/50 text-slate-300 hover:border-accent hover:text-white',
                  ].join(' ')}
                >
                  {mode === 'candidates'
                    ? (language === 'en' ? 'Candidates' : '參選人物')
                    : (language === 'en' ? 'Referendum items' : '公投項目')}
                </button>
              );
            })}
          </div>
        ) : null}
        {!showReferendumContent && candidateCategoryGroups.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-line/70" data-candidate-category-tabs aria-label={language === 'en' ? 'Candidate categories' : '參選人物類別'}>
            <div className="flex gap-x-5">
              {candidateCategoryGroups.map((group) => {
                const selected = group.key === activeCategory;
                const count = candidateCounts[group.key];
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => selectCandidateCategory(group)}
                    aria-pressed={selected}
                    className={[
                      '-mb-px border-b-2 px-1 pb-2 font-display text-sm transition focus:outline-none focus:ring-2 focus:ring-accent/35',
                      selected
                        ? 'border-signal text-signal [text-shadow:0_0_10px_rgba(244,211,94,0.28)]'
                        : 'border-transparent text-slate-400 hover:border-accent/60 hover:text-accent',
                    ].join(' ')}
                  >
                    {getCandidateCategoryLabel(group.key, regionLabel, language)}{' '}
                    <span className={selected ? 'text-signal/80' : 'text-slate-500'}>({count ?? '…'})</span>
                  </button>
                );
              })}
            </div>
            {activeCategory === 'councilor' && activeCategoryRaces.length > 1 ? (
              <select
                value={selectedCouncilorRaceId}
                onChange={(event) => selectCouncilorDistrict(event.target.value)}
                aria-label={language === 'en' ? 'Select councilor district' : '選擇市議員選區'}
                data-councilor-district-select
                className="pixel-corners mb-1 min-h-8 border border-accent/60 bg-[#061126] px-2 py-1 font-display text-[10px] text-white focus:outline-none focus:ring-2 focus:ring-accent/35"
              >
                <option value="">{language === 'en' ? 'All districts' : '全部選區'}</option>
                {activeCategoryRaces.map((race) => (
                  <option key={race.id} value={race.id}>{getRaceSelectorLabel(race)}</option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
        {!showReferendumContent && candidateCategoryGroups.length > 0 ? (
          <p className="mb-3 text-[10px] leading-5 text-slate-500" data-candidate-roster-disclaimer>
            {t('homeSpotlight.candidateRosterDisclaimer')}
          </p>
        ) : null}
        {showReferendumContent ? (
          referendumRaces.length > 0 ? (
            <div
              className={referendumRaces.length <= 2 ? 'grid gap-3 sm:grid-cols-2' : 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]'}
              data-national-referendum-items
            >
              {referendumRaces.map((race) => (
                <Link
                  key={race.id}
                  to={racePath(race.id)}
                  className={[
                    'pixel-corners block border border-line/75 bg-bg/55 p-4 transition hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/35',
                    referendumRaces.length <= 2 ? 'w-full' : 'w-[240px] shrink-0 snap-start',
                  ].join(' ')}
                >
                  <p className="text-[10px] uppercase tracking-[0.18em] text-signal">{getRaceStatusLabel(race.status)}</p>
                  <h3 className="mt-3 line-clamp-3 font-display text-base leading-6 text-white">{normalizeTaiwanText(race.title)}</h3>
                  <p className="mt-3 text-xs text-slate-400">{language === 'en' ? `Vote date: ${race.date}` : `投票日：${race.date}`}</p>
                  <p className="mt-5 border-t border-line/60 pt-3 text-xs text-accent">
                    {language === 'en' ? 'View referendum details ›' : '查看完整公投內容 ›'}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center">
              <p className="font-display text-base text-white">
                {language === 'en' ? 'No nationwide voting items are announced.' : '目前沒有已公告的全國投票項目'}
              </p>
            </div>
          )
        ) : candidatesLoading ? (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center text-sm text-slate-400">{t('homeSpotlight.loadingCandidates')}</div>
        ) : candidates.length > 0 ? (
          <div
            className="relative"
            onPointerEnter={() => setCarouselPaused(true)}
            onPointerLeave={() => setCarouselPaused(false)}
            onFocusCapture={() => setCarouselPaused(true)}
            onBlurCapture={() => setCarouselPaused(false)}
          >
            <div className={useCandidateGrid ? 'grid gap-3 sm:grid-cols-2' : 'flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin]'}>
              {candidates.map((candidate, index) => {
                const party = normalizePartyLabel(candidate.party ?? candidate.person_party);
                const demographics = candidateDemographics.get(candidate.person_id);
                const themeKey = toPartyThemeKey(party);
                const theme = partyTheme[themeKey];
                const raceContext = getCandidateRaceContext(candidate, activeCategory, regionLabel);
                const content = (
                  <>
                    <PixelCandidateSprite
                      displayName={candidate.person_name}
                      partyKey={themeKey}
                      gender={demographics?.gender}
                      birthDate={demographics?.birthDate}
                      useDemographicSprite
                      partyLabel={party}
                      variant={candidate.candidate_id}
                    />
                    <div className="mt-2 border-t border-line/60 pt-2">
                      <span className="inline-flex rounded-sm border px-2 py-1 text-[10px]" style={{ borderColor: theme.accent, backgroundColor: `${theme.primary}28`, color: theme.text }}>
                        {translateCandidateStatus(candidate, t)}
                      </span>
                      {raceContext ? <p className="mt-2 font-display text-xs text-accent" data-candidate-race-context>{raceContext}</p> : null}
                      {candidate.person_position || !raceContext ? (
                        <p className="mt-1 line-clamp-2 min-h-4 text-xs text-slate-400">{normalizeTaiwanText(candidate.person_position ?? candidate.race_title)}</p>
                      ) : null}
                    </div>
                  </>
                );
                const className = [
                  'pixel-corners block border border-line/75 bg-bg/55 p-3 transition hover:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/35',
                  useCandidateGrid ? 'w-full' : 'w-[210px] shrink-0 snap-start',
                ].join(' ');

                return candidate.person_id ? (
                  <Link key={candidate.candidate_id} ref={(node) => { candidateRefs.current[index] = node; }} to={personPath(candidate.person_id)} className={className}>{content}</Link>
                ) : (
                  <div key={candidate.candidate_id} ref={(node) => { candidateRefs.current[index] = node; }} className={className}>{content}</div>
                );
              })}
            </div>
            {candidates.length > 2 ? (
              <div className="mt-1 flex items-center justify-between gap-3">
                <button type="button" onClick={() => moveCarousel(-1)} aria-label={t('homeSpotlight.previousCandidate')} className="pixel-corners border border-line/80 bg-bg/60 px-3 py-1.5 text-accent hover:border-accent">‹</button>
                <div className="min-w-20 text-center font-display text-[10px] text-slate-400" data-candidate-position>
                  {activeCandidateIndex + 1} / {candidates.length}
                </div>
                <button type="button" onClick={() => moveCarousel(1)} aria-label={t('homeSpotlight.nextCandidate')} className="pixel-corners border border-line/80 bg-bg/60 px-3 py-1.5 text-accent hover:border-accent">›</button>
              </div>
            ) : null}
            <p className="mt-2 text-[10px] text-slate-500" data-candidate-order-note>
              {language === 'en' ? 'Shown in district order; not ranked by polling or support.' : '依選區順序顯示；非民調或支持度排序'}
            </p>
          </div>
        ) : (
          <div className="pixel-corners border border-line/70 bg-bg/35 px-4 py-8 text-center">
            <p className="font-display text-base text-white">{t('homeSpotlight.noCandidates')}</p>
            <p className="mt-2 text-xs text-slate-500">{t('homeSpotlight.noCandidatesHint')}</p>
          </div>
        )}
      </PixelFrame>
    </div>
  );
}
