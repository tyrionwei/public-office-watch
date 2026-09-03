import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { taiwanDistrictsByCountyCode } from '../data/generated/taiwanDistrictDirectory';
import { taiwanRegions } from '../data/taiwanRegions';
import { useI18n } from '../i18n';
import { publicDataProvider } from '../lib/publicData';
import type { StageRegionNode } from '../types/stageMap';
import { useVotingRegion, type VotingRegionChoice, type VotingRegionPreference } from '../votingRegion';

type MobileVotingRegionProps = {
  editorOpen: boolean;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
};

type SuggestedLocation = {
  county: VotingRegionChoice;
  district?: VotingRegionChoice;
};

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
  const { preference, confirmPreference, clearPreference, setCurrentLocation } = useVotingRegion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const villagePickerRef = useRef<HTMLDivElement>(null);
  const restoreVillageForDistrictRef = useRef<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [counties, setCounties] = useState<StageRegionNode[]>([]);
  const [districts, setDistricts] = useState<VotingRegionChoice[]>([]);
  const [countyId, setCountyId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [villages, setVillages] = useState<VotingRegionChoice[]>([]);
  const [villageId, setVillageId] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [villageMenuOpen, setVillageMenuOpen] = useState(false);
  const [villagesLoading, setVillagesLoading] = useState(false);
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
    select: 'Please select',
    selectOptional: 'Do not select a village',
    villageChoose: 'Search or select a village',
    villageSearch: 'Search villages',
    villageSearchPlaceholder: 'Enter a village name',
    villageHint: 'Search is built into the dropdown. Only an official option can be saved.',
    loadingVillages: 'Loading villages…',
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
    select: '請選擇',
    selectOptional: '不選村里',
    villageChoose: '搜尋或選擇村里',
    villageSearch: '搜尋村里',
    villageSearchPlaceholder: '輸入村里名稱',
    villageHint: '搜尋功能就在下拉清單內，只有官方選項可以儲存。',
    loadingVillages: '載入村里中…',
    noVillages: '找不到符合的村里。',
    save: '儲存投票地區',
    clear: '清除已儲存地區',
    close: '關閉',
  };

  useEffect(() => {
    if (!editorOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseEditor();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
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
    if (!editorOpen) return;
    let active = true;
    restoreVillageForDistrictRef.current = null;
    setCountyId(preference?.county.id ?? '');
    setDistrictId('');
    setVillages([]);
    setVillageId('');
    setVillageSearch('');
    setVillageMenuOpen(false);
    setSource(preference?.source ?? 'manual');
    setSuggestedLocation(null);
    setLocationError('');

    void publicDataProvider.loadRegionDirectory().then(() => {
      if (!active) return;
      const nextCounties = getCurrentCountyChoices(publicDataProvider.getStageRegions());
      setCounties(nextCounties);
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
    });
    return () => {
      active = false;
    };
  }, [editorOpen, preference]);

  useEffect(() => {
    if (!editorOpen || !districtId) {
      setVillages([]);
      setVillagesLoading(false);
      return undefined;
    }
    let active = true;
    setVillagesLoading(true);
    void getVillageChoices(districtId)
      .then((nextVillages) => {
        if (!active) return;
        setVillages(nextVillages);
        const shouldRestoreSavedVillage = restoreVillageForDistrictRef.current === districtId;
        restoreVillageForDistrictRef.current = null;
        if (shouldRestoreSavedVillage && preference?.village) {
          const savedVillage = nextVillages.find((village) => village.id === preference.village?.id)
            ?? nextVillages.find((village) => village.name === preference.village?.name);
          setVillageId(savedVillage?.id ?? '');
        }
      })
      .finally(() => {
        if (active) setVillagesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [districtId, editorOpen, preference]);

  const chooseCounty = (nextCountyId: string, nextSource: VotingRegionPreference['source'] = 'manual') => {
    const selectedCounty = counties.find((county) => county.id === nextCountyId);
    restoreVillageForDistrictRef.current = null;
    setCountyId(nextCountyId);
    setDistrictId('');
    setVillages([]);
    setVillageId('');
    setVillageSearch('');
    setVillageMenuOpen(false);
    setDistricts(selectedCounty ? getDistrictChoices(selectedCounty.label) : []);
    setSource(nextSource);
  };

  const chooseDistrict = (nextDistrictId: string) => {
    restoreVillageForDistrictRef.current = null;
    setDistrictId(nextDistrictId);
    setVillages([]);
    setVillageId('');
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
    restoreVillageForDistrictRef.current = null;
    setCountyId(matchingCounty.id);
    setDistricts(nextDistricts);
    setDistrictId(matchingDistrict?.id ?? '');
    setVillages([]);
    setVillageId('');
    setVillageSearch('');
    setVillageMenuOpen(false);
    setSource('confirmed-location');
    setSuggestedLocation(null);
  };

  const save = () => {
    const county = counties.find((region) => region.id === countyId);
    const district = districts.find((region) => region.id === districtId);
    if (!county) return;
    const village = villages.find((region) => region.id === villageId);
    confirmPreference({
      county: toChoice(county),
      ...(district ? { district } : {}),
      ...(village ? { village } : {}),
      source,
      confirmedAt: new Date().toISOString(),
    });
    onCloseEditor();
    navigate({ pathname: '/', search: `?region=${encodeURIComponent(county.id)}` });
  };

  const preferenceLabel = preference
    ? [preference.county.name, preference.district?.name, preference.village?.name].filter(Boolean).join(' ')
    : '';
  const showOnboarding = pathname === '/' && !preference && !onboardingDismissed;
  const selectedVillage = villages.find((village) => village.id === villageId);
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
            <button type="button" onClick={() => setOnboardingDismissed(true)} className="min-h-11 text-sm text-slate-400 underline underline-offset-4">
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
        <div className="fixed inset-0 z-[90] md:hidden">
          <button type="button" aria-label={copy.close} onClick={onCloseEditor} className="absolute inset-0 bg-black/75" />
          <section role="dialog" aria-modal="true" aria-labelledby="voting-region-title" className="pixel-corners absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto border-2 border-signal/60 bg-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_40px_rgba(0,0,0,0.55)]">
            <header className="flex items-start justify-between gap-3 border-b border-line/70 pb-3">
              <div>
                <h2 id="voting-region-title" className="font-display text-lg text-white">{copy.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">{copy.intro}</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={onCloseEditor} aria-label={copy.close} className="grid h-11 w-11 shrink-0 place-items-center border border-line text-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-accent/40">×</button>
            </header>

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

            <div className="mt-4 grid gap-4 border-t border-line/70 pt-4">
              <label className="grid gap-2 text-sm text-slate-300">
                <span>{copy.county}</span>
                <select data-voting-county value={countyId} onChange={(event) => chooseCounty(event.target.value)} className="min-h-12 border border-line bg-bg px-3 text-white">
                  <option value="">{copy.select}</option>
                  {counties.map((county) => <option key={county.id} value={county.id}>{county.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                <span>{copy.district}</span>
                <select data-voting-district value={districtId} onChange={(event) => chooseDistrict(event.target.value)} disabled={!countyId} className="min-h-12 border border-line bg-bg px-3 text-white disabled:opacity-50">
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
                      disabled={villagesLoading}
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
                                setVillageId(village.id);
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
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-2">
              <button type="button" onClick={save} disabled={!countyId || !districtId} className="min-h-12 border border-signal bg-signal/12 px-4 text-sm font-semibold text-signal disabled:cursor-not-allowed disabled:opacity-40">
                {copy.save}
              </button>
              {preference ? (
                <button type="button" onClick={() => { clearPreference(); onCloseEditor(); }} className="min-h-11 text-sm text-rose-300 underline underline-offset-4">
                  {copy.clear}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
