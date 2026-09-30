import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { taiwanDistrictsByCountyCode } from '../data/generated/taiwanDistrictDirectory';
import { taiwanRegions } from '../data/taiwanRegions';
import { selectNextElectionVotingCycle } from '../data/electionVotingCycles';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import { useMyBallot } from '../lib/useMyBallot';
import { validNeighborhood } from '../lib/pollingPlace';
import type { StageRegionNode } from '../types/stageMap';
import { useVotingRegion, type VotingRegionChoice, type VotingRegionPreference } from '../votingRegion';
import { MyBallots } from './MyBallots';
import { MyPollingPlace } from './MyPollingPlace';
import type { VotingRegionPanel } from '../votingRegion';
import type { BallotCategory } from '../types/ballot';

type MobileVotingRegionProps = {
  editorOpen: boolean;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
};

type SuggestedLocation = {
  county: VotingRegionChoice;
  district?: VotingRegionChoice;
};

const onboardingStorageKey = 'public-office-watch.voting-region-onboarding-dismissed.v1';

function readOnboardingDismissed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(onboardingStorageKey) === 'true';
  } catch {
    return false;
  }
}

function toChoice(region: StageRegionNode): VotingRegionChoice {
  return { id: region.id, name: region.label };
}

function getCurrentCountyChoices(regions: StageRegionNode[]) {
  return taiwanRegions.flatMap((currentCounty) => {
    const match = regions.find((region) => (
      region.level === 'county_city'
      && region.id === currentCounty.slug
      && region.stageLabel === currentCounty.code
      && region.label === currentCounty.name
    ));
    return match ? [match] : [];
  });
}

function getDistrictChoices(countyName: string): VotingRegionChoice[] {
  const countyCode = taiwanRegions.find((county) => county.name === countyName)?.code;
  if (!countyCode) return [];
  return (taiwanDistrictsByCountyCode[countyCode] ?? []).map((district) => ({
    id: `district-${district.code}`,
    name: district.name,
  }));
}

async function getVillageChoices(districtId: string): Promise<VotingRegionChoice[]> {
  const districtCode = districtId.replace(/^district-/, '');
  const { taiwanVillagesByDistrictCode } = await import('../data/generated/taiwanVillageDirectory');
  return (taiwanVillagesByDistrictCode[districtCode] ?? []).map((village) => ({
    id: `village-${village.code}`,
    name: village.name,
  }));
}

export function MobileVotingRegion({ editorOpen, onOpenEditor, onCloseEditor }: MobileVotingRegionProps) {
  const { language } = useI18n();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { preference, confirmPreference, clearPreference, setCurrentLocation, panel, selectPanel, finishEditing } = useVotingRegion();
  const dialogRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const activePanel = desktop && preference ? panel : 'settings';
  const cycle = preference ? selectNextElectionVotingCycle(preference, new Date().toISOString().slice(0, 10)) : null;
  const tabs: { id: VotingRegionPanel; label: string }[] = [
    { id: 'ballots', label: language === 'en' ? 'My ballots' : '我的選票' },
    { id: 'polling', label: language === 'en' ? 'Polling places' : '投開票所' },
    { id: 'settings', label: language === 'en' ? 'Registered address' : '戶籍設定' },
  ];
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const villagePickerRef = useRef<HTMLDivElement>(null);
  const restoreVillageForDistrictRef = useRef<string | null>(null);
  const openVillageMenuForDistrictRef = useRef<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(readOnboardingDismissed);
  const [counties, setCounties] = useState<StageRegionNode[]>([]);
  const [regionDirectoryStatus, setRegionDirectoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [districts, setDistricts] = useState<VotingRegionChoice[]>([]);
  const [countyId, setCountyId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [villages, setVillages] = useState<VotingRegionChoice[]>([]);
  const [villageId, setVillageId] = useState('');
  const [ballotCategory, setBallotCategory] = useState<BallotCategory>('unspecified');
  const [neighborhood, setNeighborhood] = useState<number | undefined>();
  const [villageSearch, setVillageSearch] = useState('');
  const [villageMenuOpen, setVillageMenuOpen] = useState(false);
  const [villagesLoading, setVillagesLoading] = useState(false);
  const [loadedVillageDistrictId, setLoadedVillageDistrictId] = useState('');
  const [villageLoadFailed, setVillageLoadFailed] = useState(false);
  const [savedVillageMissing, setSavedVillageMissing] = useState(false);
  const [storageError, setStorageError] = useState<'save' | 'clear' | null>(null);
  const [villageLoadRequest, setVillageLoadRequest] = useState(0);
  const [source, setSource] = useState<VotingRegionPreference['source']>('manual');
  const [suggestedLocation, setSuggestedLocation] = useState<SuggestedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locateWhenOpened, setLocateWhenOpened] = useState(false);

  const copy = language === 'en' ? {
    onboardingTitle: 'Find elections in your voting area',
    onboardingBody: 'Set your registered voting area to see the most relevant races first.',
    useLocation: 'Use current location',
    manual: 'Set registered voting area',
    skip: 'View nationwide information',
    privacy: 'Your exact location is neither saved nor uploaded. The detected county and district are only a suggestion; village is not detected.',
    barLabel: 'My voting area',
    change: 'Change',
    title: 'My voting area',
    intro: 'Choose your registered voting area. Location can suggest a county and district, but never changes your saved setting by itself.',
    detecting: 'Detecting…',
    suggestion: (name: string) => `Detected ${name}. Is this also your registered voting area?`,
    suggestionYes: 'Yes, use this area',
    suggestionNo: 'No, I will choose',
    locateFailed: 'We could not determine your Taiwan area. Choose your registered area manually.',
    unsupported: 'Location is unavailable in this browser. Choose your registered area manually.',
    county: 'County / city',
    district: 'District / township',
    village: 'Village (optional)',
    ballotCategory: 'Ballot lookup category (optional)',
    categoryGeneral: 'General (non-indigenous)',
    categoryLowland: 'Lowland indigenous',
    categoryHighland: 'Highland indigenous',
    categoryUnspecified: 'Unsure or skip for now',
    neighborhood: 'Neighborhood (needed for this district assignment)',
    select: 'Please select',
    selectOptional: 'Do not select a village',
    villageChoose: 'Search or select a village',
    villageSearch: 'Search villages',
    villageSearchPlaceholder: 'Enter a village name',
    villageHint: 'Search is built into the dropdown. Only an official option can be saved.',
    loadingVillages: 'Loading villages…',
    regionLoadFailed: 'Voting areas could not be loaded. Your saved area has not changed.',
    villageLoadFailed: 'Villages could not be loaded. Your saved area has not changed.',
    savedVillageMissing: 'Your saved village is not in this list. Choose a village or explicitly select “Do not select a village”.',
    saveFailed: 'This browser could not save your area. Your previous setting is unchanged. Please try saving again.',
    clearFailed: 'This browser could not clear your saved area. Please try clearing it again.',
    reload: 'Reload page',
    noVillages: 'No matching villages found.',
    save: 'Save voting area',
    clear: 'Clear saved area',
    close: 'Close',
  } : {
    onboardingTitle: '找出你的選舉資訊',
    onboardingBody: '設定戶籍投票地區，優先看到與你最相關的選舉。',
    useLocation: '使用目前位置',
    manual: '手動設定戶籍投票地區',
    skip: '先看看全國資訊',
    privacy: '不會儲存或上傳精確位置；偵測到的縣市與行政區只作為建議，不判定村里。',
    barLabel: '我的投票地區',
    change: '變更',
    title: '我的投票地區',
    intro: '請選擇戶籍投票地區。定位只建議縣市與行政區，不會自行改寫已儲存設定。',
    detecting: '定位中…',
    suggestion: (name: string) => `偵測到「${name}」，這也是你的戶籍投票地區嗎？`,
    suggestionYes: '是，套用這個地區',
    suggestionNo: '不是，我要自己選',
    locateFailed: '無法判定目前所在地區，請手動選擇戶籍投票地區。',
    unsupported: '此瀏覽器無法使用定位，請手動選擇戶籍投票地區。',
    county: '縣市',
    district: '行政區／鄉鎮市',
    village: '村里（選填）',
    ballotCategory: '選票查詢類別（選填）',
    categoryGeneral: '一般（非原住民）',
    categoryLowland: '平地原住民',
    categoryHighland: '山地原住民',
    categoryUnspecified: '不確定或暫不設定',
    neighborhood: '鄰別（此選區分配需要）',
    select: '請選擇',
    selectOptional: '不選村里',
    villageChoose: '搜尋或選擇村里',
    villageSearch: '搜尋村里',
    villageSearchPlaceholder: '輸入村里名稱',
    villageHint: '搜尋功能就在下拉清單內，只有官方選項可以儲存。',
    loadingVillages: '載入村里中…',
    regionLoadFailed: '投票地區暫時無法載入，已儲存的設定未變更。',
    villageLoadFailed: '村里暫時無法載入，已儲存的設定未變更。',
    savedVillageMissing: '原儲存的村里不在目前清單中，請重新選擇村里，或明確選擇「不選村里」。',
    saveFailed: '瀏覽器無法儲存投票地區，原設定未變更。請再次按儲存重試。',
    clearFailed: '瀏覽器無法清除已儲存地區，請再次按清除重試。',
    reload: '重新載入頁面',
    noVillages: '找不到符合的村里。',
    save: '儲存投票地區',
    clear: '清除已儲存地區',
    close: '關閉',
  };

  useEffect(() => {
    if (!editorOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [editorOpen]);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    if (desktop && editorOpen) document.getElementById(`voting-tab-${activePanel}`)?.focus({ preventScroll: true });
  }, [activePanel, desktop, editorOpen]);

  useEffect(() => {
    if (!editorOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onCloseEditor();
      if (event.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorOpen, onCloseEditor]);

  useEffect(() => {
    if (!villageMenuOpen) return undefined;
    const closeVillageMenu = (event: PointerEvent) => {
      if (villagePickerRef.current?.contains(event.target as Node)) return;
      setVillageMenuOpen(false);
      setVillageSearch('');
    };
    document.addEventListener('pointerdown', closeVillageMenu);
    return () => document.removeEventListener('pointerdown', closeVillageMenu);
  }, [villageMenuOpen]);

  useEffect(() => {
    if (!editorOpen) {
      setRegionDirectoryStatus('loading');
      return;
    }
    let active = true;
    setRegionDirectoryStatus('loading');
    setLoadedVillageDistrictId('');
    setVillageLoadFailed(false);
    setSavedVillageMissing(false);
    setStorageError(null);
    restoreVillageForDistrictRef.current = null;
    openVillageMenuForDistrictRef.current = null;
    setCountyId(preference?.county.id ?? '');
    setDistrictId('');
    setVillages([]);
    setVillageId('');
    setBallotCategory(preference?.ballotCategory ?? 'unspecified');
    setNeighborhood(preference?.neighborhood);
    setVillageSearch('');
    setVillageMenuOpen(false);
    setSource(preference?.source ?? 'manual');
    setSuggestedLocation(null);
    setLocationError('');

    void publicDataProvider.loadRegionDirectory().then(() => {
      if (!active) return;
      const nextCounties = getCurrentCountyChoices(publicDataProvider.getStageRegions());
      setCounties(nextCounties);
      setRegionDirectoryStatus('ready');
      if (!preference?.county.id) {
        setDistricts([]);
        return;
      }
      const selectedCounty = nextCounties.find((county) => county.id === preference.county.id);
      const nextDistricts = getDistrictChoices(selectedCounty?.label ?? preference.county.name);
      const nextDistrictId = nextDistricts.find((district) => district.name === preference.district?.name)?.id ?? '';
      setDistricts(nextDistricts);
      restoreVillageForDistrictRef.current = nextDistrictId || null;
      setDistrictId(nextDistrictId);
    }).catch(() => {
      if (active) setRegionDirectoryStatus('error');
    });
    return () => {
      active = false;
    };
  }, [editorOpen, preference]);

  useEffect(() => {
    if (!editorOpen || !districtId) {
      setVillages([]);
      setVillagesLoading(false);
      setLoadedVillageDistrictId('');
      return undefined;
    }
    let active = true;
    setVillagesLoading(true);
    setLoadedVillageDistrictId('');
    setVillageLoadFailed(false);
    void getVillageChoices(districtId)
      .then((nextVillages) => {
        if (!active) return;
        setVillages(nextVillages);
        setLoadedVillageDistrictId(districtId);
        const shouldRestoreSavedVillage = restoreVillageForDistrictRef.current === districtId;
        const shouldOpenVillageMenu = openVillageMenuForDistrictRef.current === districtId;
        restoreVillageForDistrictRef.current = null;
        openVillageMenuForDistrictRef.current = null;
        if (shouldRestoreSavedVillage && preference?.village) {
          const savedVillage = nextVillages.find((village) => village.id === preference.village?.id)
            ?? nextVillages.find((village) => village.name === preference.village?.name);
          setVillageId(savedVillage?.id ?? preference.village.id);
          setSavedVillageMissing(!savedVillage);
        }
        if (shouldOpenVillageMenu) setVillageMenuOpen(true);
      })
      .catch(() => {
        if (active) setVillageLoadFailed(true);
      })
      .finally(() => {
        if (active) setVillagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [districtId, editorOpen, preference, villageLoadRequest]);

  const chooseCounty = (nextCountyId: string, nextSource: VotingRegionPreference['source'] = 'manual') => {
    const selectedCounty = counties.find((county) => county.id === nextCountyId);
    restoreVillageForDistrictRef.current = null;
    openVillageMenuForDistrictRef.current = null;
    setCountyId(nextCountyId);
    setLoadedVillageDistrictId('');
    setVillageLoadFailed(false);
    setSavedVillageMissing(false);
    setDistrictId('');
    setVillages([]);
    setVillageId('');
    setNeighborhood(undefined);
    setVillageSearch('');
    setVillageMenuOpen(false);
    setDistricts(selectedCounty ? getDistrictChoices(selectedCounty.label) : []);
    setSource(nextSource);
  };

  const chooseDistrict = (nextDistrictId: string) => {
    restoreVillageForDistrictRef.current = null;
    openVillageMenuForDistrictRef.current = null;
    setDistrictId(nextDistrictId);
    setLoadedVillageDistrictId('');
    setVillageLoadFailed(false);
    setSavedVillageMissing(false);
    setVillages([]);
    setVillageId('');
    setNeighborhood(undefined);
    setVillageSearch('');
    setVillageMenuOpen(false);
  };

  const locate = () => {
    setSuggestedLocation(null);
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError(copy.unsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void import('../lib/resolveTaiwanCounty')
          .then(({ resolveTaiwanLocation }) => {
            const match = resolveTaiwanLocation(coords.latitude, coords.longitude);
            if (match) {
              setCurrentLocation({ ...match, detectedAt: new Date().toISOString() });
              setSuggestedLocation(match);
            }
            else setLocationError(copy.locateFailed);
          })
          .catch(() => setLocationError(copy.locateFailed))
          .finally(() => setLocating(false));
      },
      () => {
        setLocating(false);
        setLocationError(copy.locateFailed);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  useEffect(() => {
    if (!editorOpen || !locateWhenOpened) return;
    setLocateWhenOpened(false);
    locate();
  // copy changes when the language changes, but an open request should run only once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, locateWhenOpened]);

  const openWithLocation = () => {
    setLocateWhenOpened(true);
    onOpenEditor();
  };

  const dismissOnboarding = () => {
    try {
      window.localStorage.setItem(onboardingStorageKey, 'true');
    } catch {
      // The in-memory dismissal still works when storage is unavailable.
    }
    setOnboardingDismissed(true);
    navigate('/?region=national');
  };

  const acceptSuggestedLocation = () => {
    if (!suggestedLocation) return;
    const matchingCounty = counties.find((county) => county.label === suggestedLocation.county.name);
    if (!matchingCounty) {
      setSuggestedLocation(null);
      setLocationError(copy.locateFailed);
      return;
    }
    const nextDistricts = getDistrictChoices(matchingCounty.label);
    const matchingDistrict = suggestedLocation.district
      ? nextDistricts.find((district) => district.id === suggestedLocation.district?.id)
        ?? nextDistricts.find((district) => district.name === suggestedLocation.district?.name)
      : undefined;
    const nextDistrictId = matchingDistrict?.id ?? '';
    restoreVillageForDistrictRef.current = null;
    openVillageMenuForDistrictRef.current = nextDistrictId || null;
    setCountyId(matchingCounty.id);
    setDistricts(nextDistricts);
    setDistrictId(nextDistrictId);
    setLoadedVillageDistrictId('');
    setVillageLoadFailed(false);
    setSavedVillageMissing(false);
    setVillages([]);
    setVillageId('');
    setVillageSearch('');
    setVillageMenuOpen(false);
    setVillageLoadRequest((request) => request + 1);
    setSource('confirmed-location');
    setSuggestedLocation(null);
  };

  const canSave = regionDirectoryStatus === 'ready'
    && Boolean(counties.find((county) => county.id === countyId))
    && Boolean(districts.find((district) => district.id === districtId))
    && loadedVillageDistrictId === districtId
    && !villagesLoading && !villageLoadFailed && !savedVillageMissing;

  const save = () => {
    if (!canSave) return;
    const county = counties.find((region) => region.id === countyId);
    const district = districts.find((region) => region.id === districtId);
    if (!county) return;
    const village = villages.find((region) => region.id === villageId);
    const saved = confirmPreference({
      county: toChoice(county),
      ...(district ? { district } : {}),
      ...(village ? { village } : {}),
      ...(village ? { neighborhood } : {}),
      ballotCategory,
      source,
      confirmedAt: new Date().toISOString(),
    });
    if (!saved) {
      setStorageError('save');
      return;
    }
    setStorageError(null);
    if (desktop) finishEditing();
    else onCloseEditor();
  };

  const clear = () => {
    if (!clearPreference()) {
      setStorageError('clear');
      return;
    }
    setStorageError(null);
    onCloseEditor();
  };

  const preferenceLabel = preference
    ? [preference.county.name, preference.district?.name, preference.village?.name].filter(Boolean).join(' ')
    : '';
  const showOnboarding = pathname === '/' && !preference && !onboardingDismissed;
  const selectedVillage = villages.find((village) => village.id === villageId);
  const selectedCounty = counties.find((county) => county.id === countyId);
  const selectedDistrict = districts.find((district) => district.id === districtId);
  const draftPreference: VotingRegionPreference | null = selectedCounty && selectedDistrict ? {
    county: toChoice(selectedCounty), district: selectedDistrict,
    ...(selectedVillage ? { village: selectedVillage, neighborhood } : {}),
    ballotCategory, source, confirmedAt: preference?.confirmedAt ?? '',
  } : null;
  const nextCycle = draftPreference ? selectNextElectionVotingCycle(draftPreference, new Date().toISOString().slice(0, 10)) : null;
  const { result: draftBallots, error: draftBallotError, retry: retryDraftBallots } = useMyBallot(nextCycle?.electionEventKey, draftPreference,
    editorOpen && activePanel === 'settings' && Boolean(draftPreference?.village));
  const needsNeighborhood = Boolean(draftBallots?.items.some((item) => item.missing.includes('neighborhood')));
  const normalizedVillageSearch = villageSearch.trim();
  const filteredVillages = normalizedVillageSearch
    ? villages.filter((village) => village.name.includes(normalizedVillageSearch))
    : villages;

  return (
    <>
      {showOnboarding ? (
        <section data-voting-region-onboarding className="pixel-corners mt-3 border border-signal/55 bg-signal/8 p-4 md:hidden">
          <h2 className="font-display text-lg text-white">{copy.onboardingTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">{copy.onboardingBody}</p>
          <div className="mt-3 grid gap-2">
            <button type="button" onClick={openWithLocation} className="min-h-12 border border-signal bg-signal/12 px-4 text-sm font-semibold text-signal focus:outline-none focus:ring-2 focus:ring-signal/40">
              ◎ {copy.useLocation}
            </button>
            <button type="button" onClick={onOpenEditor} className="min-h-12 border border-line bg-bg/45 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/40">
              {copy.manual}
            </button>
            <button type="button" onClick={dismissOnboarding} className="min-h-11 text-sm text-slate-400 underline underline-offset-4">
              {copy.skip}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">{copy.privacy}</p>
        </section>
      ) : preference ? (
        <section data-voting-region-summary className="mt-3 flex min-h-12 items-center justify-between gap-3 border border-line/70 bg-panel/75 px-3 md:hidden">
          <p className="min-w-0 text-xs text-slate-400">
            {copy.barLabel}：<strong className="text-slate-100">{preferenceLabel}</strong>
          </p>
          <button type="button" onClick={onOpenEditor} className="min-h-11 shrink-0 px-2 text-xs text-accent underline underline-offset-4">
            {copy.change}
          </button>
        </section>
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button type="button" tabIndex={-1} aria-label={copy.close} onClick={onCloseEditor} className="absolute inset-0 bg-black/75" />
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="voting-region-title" className="pixel-corners absolute inset-x-0 bottom-0 max-h-[92dvh] flex flex-col overflow-hidden border-2 border-signal/60 bg-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:w-[min(44rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:pb-5">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line/70 pb-3">
              <div>
                <h2 id="voting-region-title" className="font-display text-lg text-white">{desktop ? (language === 'en' ? 'My voting area' : '我的投票地區') : copy.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">{copy.intro}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={onCloseEditor} aria-label={copy.close} className="grid h-11 w-11 shrink-0 place-items-center border border-line text-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent/40">×</button>
            </header>

            {desktop ? <div role="tablist" aria-label={language === 'en' ? 'Voting information' : '投票資訊'} className="grid shrink-0 grid-cols-3 gap-2 border-b border-line/70 py-3">
              {tabs.map((tab, index) => <button key={tab.id} id={`voting-tab-${tab.id}`} role="tab" type="button" aria-selected={activePanel === tab.id} aria-controls="voting-panel" tabIndex={activePanel === tab.id ? 0 : -1}
                onClick={() => selectPanel(tab.id)}
                onKeyDown={(event) => {
                  const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
                  if (next !== null) { event.preventDefault(); selectPanel(tabs[next].id); document.getElementById(`voting-tab-${preference ? tabs[next].id : 'settings'}`)?.focus(); }
                }} className={`min-h-11 border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 ${activePanel === tab.id ? 'border-signal bg-signal/10 text-signal' : 'border-line text-slate-300'}`}>{tab.label}</button>)}
            </div> : null}
            <div ref={contentRef} data-voting-dialog-content id="voting-panel" role={desktop ? 'tabpanel' : undefined} aria-labelledby={desktop ? `voting-tab-${activePanel}` : undefined} className="min-h-0 overflow-y-auto overscroll-contain py-3">
            {desktop && !preference && panel !== 'settings' ? <p role="status" className="mb-3 text-sm text-amber-200">{language === 'en' ? 'Set your registered address first. Saving returns you to your lookup.' : '請先設定戶籍地區，儲存後會回到原本的查詢分頁。'}</p> : null}
            {activePanel !== 'settings' && preference ? <div className="space-y-3">
              <button type="button" onClick={() => selectPanel('settings')} className="min-h-11 text-sm text-accent underline underline-offset-4">{language === 'en' ? 'Change registered address' : '變更戶籍設定'}</button>
              {activePanel === 'ballots' && cycle?.electionEventKey ? <MyBallots eventKey={cycle.electionEventKey} preference={preference} desktop onNavigate={onCloseEditor} onOpenEditor={() => selectPanel('settings')} />
                : activePanel === 'polling' && cycle?.pollingPlaceLookupUrl ? <MyPollingPlace eventKey={cycle.id} lookupUrl={cycle.pollingPlaceLookupUrl} />
                : <p className="text-sm text-slate-400">{language === 'en' ? 'No upcoming election information is available.' : '目前沒有可查詢的近期選舉資料。'}</p>}
            </div> : <>
            <button type="button" onClick={locate} disabled={locating} className="mt-4 min-h-12 w-full border border-signal/70 bg-signal/10 px-4 text-sm font-semibold text-signal disabled:opacity-60">
              ◎ {locating ? copy.detecting : copy.useLocation}
            </button>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{copy.privacy}</p>

            {suggestedLocation ? (
              <div data-location-suggestion className="mt-3 border border-accent/55 bg-accent/8 p-3">
                <p className="text-sm leading-6 text-slate-100">{copy.suggestion([suggestedLocation.county.name, suggestedLocation.district?.name].filter(Boolean).join(' '))}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={acceptSuggestedLocation} className="min-h-11 border border-accent bg-accent/12 px-3 text-sm text-accent">{copy.suggestionYes}</button>
                  <button type="button" onClick={() => { setSuggestedLocation(null); setSource('manual'); }} className="min-h-11 border border-line px-3 text-sm text-slate-300">{copy.suggestionNo}</button>
                </div>
              </div>
            ) : null}
            {locationError ? <p role="alert" className="mt-3 text-sm leading-6 text-rose-300">{locationError}</p> : null}
            {regionDirectoryStatus === 'error' || villageLoadFailed ? (
              <div role="alert" className="mt-3 text-sm leading-6 text-rose-300">
                <p>{regionDirectoryStatus === 'error' ? copy.regionLoadFailed : copy.villageLoadFailed}</p>
                <button type="button" onClick={() => window.location.reload()} className="min-h-11 text-accent underline underline-offset-4">{copy.reload}</button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 border-t border-line/70 pt-4">
              <label className="grid gap-2 text-sm text-slate-300">
                <span>{copy.county}</span>
                <select data-voting-county value={countyId} onChange={(event) => chooseCounty(event.target.value)} disabled={regionDirectoryStatus !== 'ready'} className="min-h-12 border border-line bg-bg px-3 text-white disabled:opacity-50">
                  <option value="">{copy.select}</option>
                  {counties.map((county) => <option key={county.id} value={county.id}>{county.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                <span>{copy.district}</span>
                <select data-voting-district value={districtId} onChange={(event) => chooseDistrict(event.target.value)} disabled={!countyId || regionDirectoryStatus !== 'ready'} className="min-h-12 border border-line bg-bg px-3 text-white disabled:opacity-50">
                  <option value="">{copy.select}</option>
                  {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                </select>
              </label>
              {districtId ? (
                <div className="grid gap-2 text-sm text-slate-300">
                  <span>{copy.village}</span>
                  <div ref={villagePickerRef} className="border border-line bg-bg">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-controls="voting-village-options"
                      aria-expanded={villageMenuOpen}
                      data-voting-village-trigger
                      disabled={loadedVillageDistrictId !== districtId || villagesLoading || villageLoadFailed}
                      onClick={() => {
                        setVillageSearch('');
                        setVillageMenuOpen((open) => !open);
                      }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left text-white disabled:opacity-50"
                    >
                      <span className={selectedVillage ? '' : 'text-slate-500'}>
                        {villagesLoading ? copy.loadingVillages : selectedVillage?.name ?? copy.villageChoose}
                      </span>
                      <span aria-hidden="true" className="text-slate-500">⌄</span>
                    </button>
                    {villageMenuOpen ? (
                      <div className="border-t border-line bg-panel p-2">
                        <label htmlFor="voting-village-search" className="sr-only">{copy.villageSearch}</label>
                        <input
                          id="voting-village-search"
                          type="search"
                          data-voting-village-search
                          autoFocus
                          value={villageSearch}
                          onChange={(event) => setVillageSearch(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setVillageMenuOpen(false);
                              setVillageSearch('');
                            }
                          }}
                          placeholder={copy.villageSearchPlaceholder}
                          className="min-h-11 w-full border border-line bg-bg px-3 text-white placeholder:text-slate-600"
                        />
                        <div id="voting-village-options" role="listbox" className="mt-2 max-h-48 overflow-y-auto">
                          <button
                            type="button"
                            role="option"
                            aria-selected={!villageId}
                            onClick={() => {
                              setVillageId('');
                              setNeighborhood(undefined);
                              setSavedVillageMissing(false);
                              setVillageSearch('');
                              setVillageMenuOpen(false);
                            }}
                            className="min-h-11 w-full px-3 text-left text-slate-400 hover:bg-line/40 focus:bg-line/40 focus:outline-none"
                          >
                            {copy.selectOptional}
                          </button>
                          {filteredVillages.map((village) => (
                            <button
                              key={village.id}
                              type="button"
                              role="option"
                              aria-selected={village.id === villageId}
                              onClick={() => {
                                if (village.id !== villageId) setNeighborhood(undefined);
                                setVillageId(village.id);
                                setSavedVillageMissing(false);
                                setVillageSearch('');
                                setVillageMenuOpen(false);
                              }}
                              className="min-h-11 w-full px-3 text-left text-white hover:bg-signal/10 focus:bg-signal/10 focus:outline-none"
                            >
                              {village.name}
                            </button>
                          ))}
                          {normalizedVillageSearch && filteredVillages.length === 0 ? <p role="status" className="px-3 py-3 text-xs text-amber-300">{copy.noVillages}</p> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <p className="text-[11px] leading-5 text-slate-500">{copy.villageHint}</p>
                  {savedVillageMissing ? <p role="alert" className="text-sm leading-6 text-rose-300">{copy.savedVillageMissing}</p> : null}
                </div>
              ) : null}
              {needsNeighborhood ? <label className="grid gap-2 text-sm text-slate-300">
                <span>{copy.neighborhood}</span>
                <input type="number" inputMode="numeric" min="1" max="999" value={neighborhood ?? ''} onChange={(event) => setNeighborhood(validNeighborhood(Number(event.target.value)))} className="min-h-12 border border-line bg-bg px-3 text-white" />
              </label> : null}
              {draftBallotError ? <p role="alert" className="text-xs text-amber-200">
                {language === 'en' ? 'Could not check whether a neighborhood is needed.' : '無法確認是否需要鄰別。'}{' '}
                <button type="button" onClick={retryDraftBallots} className="underline underline-offset-4">{language === 'en' ? 'Retry' : '重試'}</button>
              </p> : null}
              <label className="grid gap-2 text-sm text-slate-300">
                <span>{copy.ballotCategory}</span>
                <select data-voting-ballot-category value={ballotCategory} onChange={(event) => setBallotCategory(event.target.value as BallotCategory)} className="min-h-12 border border-line bg-bg px-3 text-white">
                  <option value="unspecified">{copy.categoryUnspecified}</option>
                  <option value="general">{copy.categoryGeneral}</option>
                  <option value="lowland">{copy.categoryLowland}</option>
                  <option value="highland">{copy.categoryHighland}</option>
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-2">
              {storageError ? <p role="alert" className="text-sm leading-6 text-rose-300">{storageError === 'save' ? copy.saveFailed : copy.clearFailed}</p> : null}
              <button type="button" onClick={save} disabled={!canSave} className="min-h-12 border border-signal bg-signal/12 px-4 text-sm font-semibold text-signal disabled:cursor-not-allowed disabled:opacity-40">
                {copy.save}
              </button>
              {preference ? (
                <button type="button" onClick={clear} className="min-h-11 text-sm text-rose-300 underline underline-offset-4">
                  {copy.clear}
                </button>
              ) : null}
            </div>
            </>}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
