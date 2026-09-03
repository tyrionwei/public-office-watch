import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { HomeElectionSpotlight } from '../components/HomeElectionSpotlight';
import { MobileMyElection } from '../components/MobileMyElection';
import { MobileRegionBrowser } from '../components/MobileRegionBrowser';
import { PartySeatDistributionPanel } from '../components/PartySeatDistributionPanel';
import { RegionIssueConcernPanel } from '../components/RegionIssueConcernPanel';
import { TaiwanStageSelect } from '../components/TaiwanStageSelect';
import { taiwanRegions } from '../data/taiwanRegions';
import { useI18n } from '../i18n';
import { selectHomeRegionId, selectHomeRelatedRaces } from '../lib/homeRaceSelection';
import { publicDataProvider } from '../lib/publicData';
import { normalizeTaiwanText } from '../lib/taiwanText';
import { useSelectedRegion } from '../selectedRegion';
import { useVotingRegion } from '../votingRegion';

const NATIONAL_REGION_QUERY = 'national';

export function HomePage() {
  const { t } = useI18n();
  const { selectedRegionId: storedRegionId, setSelectedRegionId } = useSelectedRegion();
  const { preference: votingRegionPreference } = useVotingRegion();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRegionId = searchParams.get('region');
  const showMobileBrowse = !votingRegionPreference || requestedRegionId !== null;
  const requestedHomeRegionId = requestedRegionId ?? storedRegionId;
  const [homeData, setHomeData] = useState(() => publicDataProvider.getHomePageData());
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeLoadError, setHomeLoadError] = useState(false);
  const [myElectionData, setMyElectionData] = useState(() => publicDataProvider.getHomePageData());
  const [myElectionLoading, setMyElectionLoading] = useState(Boolean(votingRegionPreference));
  const [myElectionLoadError, setMyElectionLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    const regionId = !requestedHomeRegionId || requestedHomeRegionId === NATIONAL_REGION_QUERY
      ? null
      : requestedHomeRegionId;
    setHomeLoading(true);
    setHomeLoadError(false);
    void publicDataProvider.loadHomePageData(regionId)
      .then((data) => {
        if (active) setHomeData(data);
      })
      .catch((error: unknown) => {
        if (active) setHomeLoadError(true);
        if (import.meta.env.DEV) console.warn('Failed to load home data', error);
      })
      .finally(() => {
        if (active) setHomeLoading(false);
      });
    return () => { active = false; };
  }, [requestedHomeRegionId]);

  const votingCountyId = votingRegionPreference?.county.id ?? null;
  useEffect(() => {
    if (!votingCountyId) {
      setMyElectionLoading(false);
      setMyElectionLoadError(false);
      return undefined;
    }
    let active = true;
    setMyElectionLoading(true);
    setMyElectionLoadError(false);
    void publicDataProvider.loadHomePageData(votingCountyId)
      .then((data) => {
        if (active) setMyElectionData(data);
      })
      .catch((error: unknown) => {
        if (active) setMyElectionLoadError(true);
        if (import.meta.env.DEV) console.warn('Failed to load my election data', error);
      })
      .finally(() => {
        if (active) setMyElectionLoading(false);
      });
    return () => { active = false; };
  }, [votingCountyId]);

  const selectedRegionId = selectHomeRegionId(homeData.stageRegions, requestedHomeRegionId)
    ?? (taiwanRegions.some((region) => region.slug === requestedHomeRegionId) ? requestedHomeRegionId : null);
  const isNationalView = selectedRegionId === null;
  const relatedRaces = selectHomeRelatedRaces(homeData, selectedRegionId);
  const myElectionRegionId = selectHomeRegionId(myElectionData.stageRegions, votingCountyId)
    ?? (taiwanRegions.some((region) => region.slug === votingCountyId) ? votingCountyId : null);
  const myElectionRaces = selectHomeRelatedRaces(myElectionData, myElectionRegionId);
  const [, startTransition] = useTransition();

  const selectedRegionNode = selectedRegionId
    ? homeData.stageRegions.find((region) => region.id === selectedRegionId) ?? null
    : null;
  const selectedRegionSummary = selectedRegionId
    ? homeData.stageRegionSummaries.find((summary) => summary.regionId === selectedRegionId) ?? null
    : null;
  const selectedRegionLabel = isNationalView
    ? t('national.taiwan')
    : normalizeTaiwanText(selectedRegionSummary?.label ?? selectedRegionNode?.label
      ?? taiwanRegions.find((region) => region.slug === selectedRegionId)?.name
      ?? t('home.unspecifiedRegion'));

  useEffect(() => {
    if (homeData.stageRegions.length === 0) return;
    const nextStoredRegionId = selectedRegionId ?? NATIONAL_REGION_QUERY;
    if (storedRegionId !== nextStoredRegionId) setSelectedRegionId(nextStoredRegionId);
  }, [homeData.stageRegions.length, selectedRegionId, setSelectedRegionId, storedRegionId]);

  const handleSelectRegion = useCallback((regionId: string | null) => {
    const currentRegionQuery = searchParams.get('region');
    const alreadyExplicitlySelected = regionId === selectedRegionId
      && (regionId === null
        ? currentRegionQuery === NATIONAL_REGION_QUERY
        : currentRegionQuery === regionId);
    if (alreadyExplicitlySelected) return;

    const nextRegionId = regionId ?? NATIONAL_REGION_QUERY;
    setSelectedRegionId(nextRegionId);
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (regionId) nextParams.set('region', regionId);
      else nextParams.set('region', NATIONAL_REGION_QUERY);
      nextParams.delete('homeContent');
      nextParams.delete('candidateCategory');
      nextParams.delete('candidateDistrict');
      nextParams.delete('candidateIndex');
      setSearchParams(nextParams);
    });
  }, [searchParams, selectedRegionId, setSearchParams, setSelectedRegionId, startTransition]);

  const handleReturnToMyArea = useCallback(() => {
    if (votingCountyId) setSelectedRegionId(votingCountyId);
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('region');
      nextParams.delete('homeContent');
      nextParams.delete('candidateCategory');
      nextParams.delete('candidateDistrict');
      nextParams.delete('candidateIndex');
      setSearchParams(nextParams);
    });
  }, [searchParams, setSearchParams, setSelectedRegionId, startTransition, votingCountyId]);

  return (
    <AppShell ticker={homeData.ticker} tickerMobileHidden>
      <div className="mb-3 space-y-3 md:contents">
        <MobileRegionBrowser
          selectedRegionId={selectedRegionId}
          selectedRegionLabel={selectedRegionLabel}
          browsing={showMobileBrowse}
          onSelectRegion={handleSelectRegion}
          onReturnToMyArea={votingRegionPreference ? handleReturnToMyArea : undefined}
        />
        {votingRegionPreference && !showMobileBrowse ? (
          <MobileMyElection
            preference={votingRegionPreference}
            ticker={myElectionData.ticker}
            races={myElectionRaces}
            candidateSummaries={myElectionData.candidateSummaries ?? []}
            loading={myElectionLoading}
            loadError={myElectionLoadError}
          />
        ) : null}
      </div>
      <div
        data-home-research-grid
        className={`${showMobileBrowse ? 'grid' : 'hidden md:grid'} gap-3 xl:min-h-[880px] xl:grid-cols-[minmax(420px,0.95fr)_minmax(480px,1.08fr)_minmax(300px,0.75fr)] xl:items-stretch`}
      >
        <section className="hidden min-w-0 md:block xl:h-full">
          <TaiwanStageSelect
            regions={homeData.stageRegions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={handleSelectRegion}
          />
        </section>

        <section data-mobile-browse-results={showMobileBrowse ? '' : undefined} className="min-w-0 xl:h-full">
          <HomeElectionSpotlight
            races={relatedRaces}
            regionNode={selectedRegionNode}
            regionSummary={selectedRegionSummary}
            national={isNationalView}
            candidateSummaries={homeData.candidateSummaries ?? []}
            candidatesLoading={homeLoading}
            candidateLoadError={homeLoadError}
          />
        </section>

        <section className="min-w-0 space-y-3 xl:grid xl:h-full xl:grid-rows-[400px_minmax(0,1fr)] xl:gap-3 xl:space-y-0">
          <PartySeatDistributionPanel
            regionId={selectedRegionId}
            regionLabel={selectedRegionLabel}
            national={isNationalView}
            partyCounts={homeData.seatDistribution ?? []}
            loading={homeLoading}
          />
          <RegionIssueConcernPanel
            regionId={isNationalView ? null : selectedRegionNode?.publicRegionId ?? null}
            regionLabel={selectedRegionLabel}
            national={isNationalView}
          />
        </section>
      </div>
    </AppShell>
  );
}
